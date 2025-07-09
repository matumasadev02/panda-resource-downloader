// ==UserScript==
// --- PandA Resource Downloader ---
(function() {
    'use strict';

    // Use the embedded zip.js library directly
    const {
        ZipWriter,
        BlobReader,
        BlobWriter
    } = window.zip;

    // 1. Get site_id from the current URL
    const url = window.location.href;
    const match = url.match(/\/portal\/site\/(.*?)\/tool\//);
    const site_id = match ? match[1] : null;

    if (!site_id) {
        console.log("PandA Downloader: Not on a resource page.");
        return;
    }

    console.log("PandA Downloader: Initializing for site:", site_id);
    const API_URL = `https://panda.ecs.kyoto-u.ac.jp/direct/content/site/${site_id}.json`;

    /**
     * Builds a hierarchical tree from a flat list of items.
     */
    function buildFileTree(items) {
        const tree = {};
        const nodes = {}; // Keyed by URL
        
        // First pass: create all nodes
        items.forEach(item => {
            nodes[item.url] = { ...item, children: {} };
        });

        console.log("PandA Downloader: Total nodes created:", Object.keys(nodes).length);
        
        // Debug: log all URLs and containers
        console.log("PandA Downloader: All URLs and containers:");
        Object.values(nodes).forEach(node => {
            console.log(`  ${node.title}: URL=${node.url}, container=${node.container}`);
        });

        // Second pass: build parent-child relationships
        Object.values(nodes).forEach(node => {
            const parentContainerPath = node.container;
            
            if (parentContainerPath) {
                // Find parent by matching container path with existing node URLs
                let parentNode = null;
                
                for (const [url, candidate] of Object.entries(nodes)) {
                    // Extract path from the candidate URL
                    let candidatePathMatch = url.match(/\/access\/content(.*)$/);
                    
                    if (candidatePathMatch) {
                        let candidateRawPath = candidatePathMatch[1];
                        
                        // Decode the URL-encoded path
                        const candidateDecodedPath = decodeURIComponent(candidateRawPath);
                        
                        // Build full container path - ensure trailing slash
                        const candidateContainerPath = '/content' + candidateDecodedPath + (candidateDecodedPath.endsWith('/') ? '' : '/');
                        
                        console.log(`    Comparing: "${candidateContainerPath}" === "${parentContainerPath}"`);
                        
                        if (candidateContainerPath === parentContainerPath) {
                            parentNode = candidate;
                            console.log(`    MATCH FOUND for ${node.title}!`);
                            break;
                        }
                    }
                }

                console.log(`Processing ${node.title}:`);
                console.log(`  container: ${parentContainerPath}`);
                console.log(`  parentFound: ${!!parentNode}`);
                if (parentNode) {
                    console.log(`  parentTitle: ${parentNode.title}`);
                }

                if (parentNode) {
                    parentNode.children[node.title] = node;
                    console.log(`  → Added to parent: ${parentNode.title}`);
                } else {
                    tree[node.title] = node;
                    console.log(`  → Added to root (no parent found)`);
                }
            } else {
                tree[node.title] = node;
                console.log(`Processing ${node.title}: → Added to root (no container)`);
            }
        });

        return tree;
    }

    /**
     * Recursively traverses a node and its children to find all files and their relative paths.
     * @param {object} node - The starting node from the file tree.
     * @param {string} basePath - The base path for the current recursion level.
     * @returns {Array<{url: string, path: string}>} - A list of file objects with their URL and relative path.
     */
    function getFilesRecursively(node, basePath = "") {
        let files = [];
        if (node.type !== 'collection') {
            // It's a file
            files.push({ url: node.url, path: basePath + node.title });
        } else {
            // It's a folder
            const newBasePath = basePath + node.title + '/';
            if (node.children) {
                for (const childKey in node.children) {
                    files = files.concat(getFilesRecursively(node.children[childKey], newBasePath));
                }
            }
        }
        return files;
    }

    /**
     * Finds a node in the tree by its path.
     */
    function findNodeByPath(fileTree, directoryPath) {
        // Normalize the trailing slash
        const normalizedPath = directoryPath.endsWith('/') ? directoryPath : directoryPath + '/';
        const expectedUrl = `https://panda.ecs.kyoto-u.ac.jp/access${normalizedPath}`;
        
        console.log(`[findNodeByPath] Searching for path: ${directoryPath}`);
        console.log(`[findNodeByPath] Expected URL: ${expectedUrl}`);
        
        function searchInTree(node) {
            // Normalize and compare both URLs
            const nodeUrl = node.url;
            const normalizedNodeUrl = nodeUrl.endsWith('/') ? nodeUrl : nodeUrl + '/';
            
            console.log(`[findNodeByPath] Checking node URL: ${nodeUrl} (normalized: ${normalizedNodeUrl})`);
            
            if (normalizedNodeUrl === expectedUrl) {
                console.log(`[findNodeByPath] Found matching node: ${node.title}`);
                return node;
            }
            
            // Also try comparing after URL decoding
            try {
                const decodedNodeUrl = decodeURIComponent(normalizedNodeUrl);
                const decodedExpectedUrl = decodeURIComponent(expectedUrl);
                if (decodedNodeUrl === decodedExpectedUrl) {
                    console.log(`[findNodeByPath] Found matching node (decoded): ${node.title}`);
                    return node;
                }
            } catch (e) {
                // Ignore decoding errors
            }
            
            if (node.children) {
                for (const childKey in node.children) {
                    const result = searchInTree(node.children[childKey]);
                    if (result) return result;
                }
            }
            return null;
        }
        
        for (const rootKey in fileTree) {
            const result = searchInTree(fileTree[rootKey]);
            if (result) return result;
        }
        
        console.log(`[findNodeByPath] Node not found for path: ${directoryPath}`);
        return null;
    }

    /**
     * Extracts directory path from folder link elements in the HTML.
     */
    function extractDirectoryPath(row) {
        const folderLinks = row.querySelectorAll('td.specialLink a[href*="/group/"]');
        for (const link of folderLinks) {
            const href = link.getAttribute('href');
            const name = link.getAttribute('name');
            
            console.log(`[extractDirectoryPath] Checking link - href: ${href}, name: ${name}`);
            
            if (href && href.includes('/group/')) {
                const pathMatch = href.match(/#(.+)$/);
                if (pathMatch) {
                    const path = '/content' + pathMatch[1];
                    console.log(`[extractDirectoryPath] Extracted path from href: ${path}`);
                    return path;
                }
            }
            if (name && name.includes('/group/')) {
                const path = '/content' + name;
                console.log(`[extractDirectoryPath] Extracted path from name: ${path}`);
                return path;
            }
        }
        
        // Another approach: extract the path from the onclick attribute
        const onclickLinks = row.querySelectorAll('a[onclick*="toggleFolder"]');
        for (const link of onclickLinks) {
            const onclick = link.getAttribute('onclick');
            if (onclick) {
                const pathMatch = onclick.match(/toggleFolder\([^,]+,\s*'([^']+)'/);
                if (pathMatch) {
                    const path = pathMatch[1];
                    console.log(`[extractDirectoryPath] Extracted path from onclick: ${path}`);
                    return path;
                }
            }
        }
        
        console.log(`[extractDirectoryPath] No path found for row`);
        return null;
    }

    // 2. Fetch resource data and process it
    fetch(API_URL)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (!data.content_collection) {
                console.error("PandA Downloader: 'content_collection' not found in API response.");
                return;
            }

            const fileTree = buildFileTree(data.content_collection);
            console.log("PandA Downloader: File tree built.");
            console.log("PandA Downloader: File tree structure:", fileTree);

            document.querySelectorAll(".Mrphs-sakai-resources .table tr").forEach(row => {
                try {
                    const isFolder = (row.querySelector("td.specialLink > a.fa")?.classList.contains("fa-folder")) | (row.querySelector("td.specialLink > a.fa")?.classList.contains("fa-folder-open"));
                    if (!isFolder) return;

                    const folderName = row.querySelector("td.specialLink > a > span.resource-name")?.textContent.trim();
                    if (!folderName) return;

                    const directoryPath = extractDirectoryPath(row);
                    if (!directoryPath) return;

                    const ul = row.querySelector("ul.dropdown-menu");
                    if (!ul) return;

                    const newLi = document.createElement("li");
                    const newA = document.createElement("a");
                    newA.textContent = "一括ダウンロード";
                    newA.href = "#";
                    newA.style.cursor = "pointer";

                    newA.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        newA.textContent = "準備中...";
                        newA.style.pointerEvents = "none";

                        try {
                            const folderNode = findNodeByPath(fileTree, directoryPath);
                            if (folderNode) {
                                const filesToDownload = getFilesRecursively(folderNode);
                                if (filesToDownload.length === 0) {
                                    newA.textContent = "ファイルなし";
                                    setTimeout(() => { newA.textContent = "一括ダウンロード"; newA.style.pointerEvents = "auto"; }, 2000);
                                    return;
                                }

                                const zipWriter = new ZipWriter(new BlobWriter("application/zip"));

                                await Promise.all(filesToDownload.map(async (file) => {
                                    try {
                                        const response = await fetch(file.url);
                                        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
                                        const blob = await response.blob();
                                        await zipWriter.add(file.path, new BlobReader(blob));
                                    } catch (err) {
                                        console.error(`Failed to process ${file.url}`, err);
                                    }
                                }));

                                const zipBlob = await zipWriter.close();
                                const zipUrl = URL.createObjectURL(zipBlob);
                                const downloadLink = document.createElement('a');
                                downloadLink.href = zipUrl;
                                downloadLink.download = `${folderName}.zip`;
                                document.body.appendChild(downloadLink);
                                downloadLink.click();
                                document.body.removeChild(downloadLink);
                                URL.revokeObjectURL(zipUrl);

                                newA.textContent = "完了";
                            } else {
                                newA.textContent = "フォルダ未発見";
                                console.error(`Could not find folder '${folderName}' with path '${directoryPath}'`);
                                console.error("Available tree structure:", Object.keys(fileTree));
                                
                                // デバッグ用：ツリー内のすべてのURLを出力
                                function logAllUrls(node, prefix = "") {
                                    console.log(`${prefix}${node.title}: ${node.url}`);
                                    if (node.children) {
                                        for (const childKey in node.children) {
                                            logAllUrls(node.children[childKey], prefix + "  ");
                                        }
                                    }
                                }
                                
                                for (const rootKey in fileTree) {
                                    logAllUrls(fileTree[rootKey]);
                                }
                            }
                        } catch (err) {
                            newA.textContent = "エラー";
                            console.error("Error creating zip:", err);
                        } finally {
                            setTimeout(() => {
                                newA.textContent = "一括ダウンロード";
                                newA.style.pointerEvents = "auto";
                            }, 2000);
                        }
                    });

                    newLi.appendChild(newA);
                    ul.appendChild(newLi);

                } catch (err) {
                    // Ignore rows that don't match
                }
            });

            // Add a bulk download button to the top-level directory as well
            const actionBar = document.querySelector(".Mrphs-sakai-resources .act");
            if (actionBar && Object.keys(fileTree).length > 0) {
                const downloadAllButton = document.createElement("button");
                downloadAllButton.textContent = "全てのリソースを一括ダウンロード";
                downloadAllButton.className = "btn btn-primary";
                downloadAllButton.style.marginLeft = "10px";
                downloadAllButton.style.cursor = "pointer";

                downloadAllButton.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    downloadAllButton.textContent = "準備中...";
                    downloadAllButton.disabled = true;

                    try {
                        // Collect all files from the entire file tree
                        let allFiles = [];
                        for (const rootKey in fileTree) {
                            const rootNode = fileTree[rootKey];
                            allFiles = allFiles.concat(getFilesRecursively(rootNode));
                        }

                        if (allFiles.length === 0) {
                            downloadAllButton.textContent = "ファイルなし";
                            setTimeout(() => { 
                                downloadAllButton.textContent = "全てのリソースを一括ダウンロード"; 
                                downloadAllButton.disabled = false; 
                            }, 2000);
                            return;
                        }

                        const zipWriter = new ZipWriter(new BlobWriter("application/zip"));

                        // Progress display
                        let processed = 0;
                        await Promise.all(allFiles.map(async (file) => {
                            try {
                                const response = await fetch(file.url);
                                if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
                                const blob = await response.blob();
                                await zipWriter.add(file.path, new BlobReader(blob));
                                processed++;
                                downloadAllButton.textContent = `処理中... (${processed}/${allFiles.length})`;
                            } catch (err) {
                                console.error(`Failed to process ${file.url}`, err);
                                processed++;
                                downloadAllButton.textContent = `処理中... (${processed}/${allFiles.length})`;
                            }
                        }));

                        downloadAllButton.textContent = "ZIP作成中...";
                        const zipBlob = await zipWriter.close();
                        const zipUrl = URL.createObjectURL(zipBlob);
                        const downloadLink = document.createElement('a');
                        downloadLink.href = zipUrl;
                        downloadLink.download = `${site_id}_all_resources.zip`;
                        document.body.appendChild(downloadLink);
                        downloadLink.click();
                        document.body.removeChild(downloadLink);
                        URL.revokeObjectURL(zipUrl);

                        downloadAllButton.textContent = "完了";
                    } catch (err) {
                        downloadAllButton.textContent = "エラー";
                        console.error("Error creating zip:", err);
                    } finally {
                        setTimeout(() => {
                            downloadAllButton.textContent = "全てのリソースを一括ダウンロード";
                            downloadAllButton.disabled = false;
                        }, 2000);
                    }
                });

                actionBar.appendChild(downloadAllButton);
            }
        })
        .catch(error => {
            console.error("PandA Downloader: Error fetching or processing data:", error);
        });
})();
