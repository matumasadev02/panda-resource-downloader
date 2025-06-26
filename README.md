# PandA Resource Downloader

京都大学のPandA（学習支援システム）で、リソース（ファイル）を一括ダウンロードできるブラウザ拡張機能です。

## 機能

- **フォルダごとの一括ダウンロード**: 各フォルダにドロップダウンメニューから「一括ダウンロード」ボタンを追加
- **全リソース一括ダウンロード**: ページ上部に全てのリソースをまとめてダウンロードするボタンを追加
- **階層構造の保持**: ダウンロードしたZIPファイル内でフォルダ構造を保持
- **進捗表示**: 大量のファイルをダウンロードする際の進捗を表示

## インストール方法

### Chrome/Edge（開発者モード）

1. このリポジトリをダウンロードまたはクローンします
2. ブラウザで `chrome://extensions/` （Edgeの場合は `edge://extensions/`）を開きます
3. 右上の「デベロッパーモード」を有効にします
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. ダウンロードしたフォルダを選択します


## 使用方法

1. PandAにログインし、任意の授業のリソースページにアクセスします
2. フォルダの右側にある「▼」メニューをクリックすると、「一括ダウンロード」オプションが表示されます
3. ページ上部のアクションバーに「全てのリソースを一括ダウンロード」ボタンが表示されます
4. ボタンをクリックするとZIPファイルがダウンロードされます

## 技術仕様

- **対象サイト**: `https://panda.ecs.kyoto-u.ac.jp/*`
- **ZIP圧縮ライブラリ**: zip.js（ファイルに埋め込み済み）
- **API**: PandAのDirect Content API (`/direct/content/site/{site_id}.json`)
- **ファイル構造**: 階層構造を保持してZIPファイルを作成

## ファイル構成

```
panda_resource_downloader/
├── manifest.json          # 拡張機能の設定ファイル
├── content.js             # メインスクリプト（zip.js埋め込み済み）
└── README.md              # このファイル
```

## 主な機能詳細

### ファイルツリー構築

PandAのAPIから取得したリソース情報を階層構造に変換し、正しいフォルダ構造を構築します。

### 一括ダウンロード機能

- **個別フォルダ**: 各フォルダのドロップダウンメニューに追加
- **全リソース**: ページ上部のアクションバーに追加
- **進捗表示**: `処理中... (進行数/総数)` 形式で表示

### エラーハンドリング

- ネットワークエラー時の適切な表示
- ダウンロード失敗時の継続処理
- ユーザーフィードバックの表示

## 注意事項

- この拡張機能は京都大学のPandAシステム専用です
- 大量のファイルをダウンロードする場合、時間がかかることがあります
- ネットワーク状況によってはダウンロードが失敗する場合があります
- PandAの仕様変更により機能しなくなる可能性があります

## トラブルシューティング

### ボタンが表示されない場合

1. PandAのリソースページにいることを確認してください
2. ブラウザのコンソール（F12）でエラーメッセージを確認してください
3. 拡張機能が有効になっていることを確認してください

### ダウンロードが失敗する場合

1. ネットワーク接続を確認してください
2. PandAにログインしていることを確認してください
3. ブラウザのポップアップブロッカーを無効にしてください

### デバッグ

ブラウザのコンソール（F12 → Console）で詳細なログを確認できます：
- `PandA Downloader: Initializing for site: {site_id}`
- `PandA Downloader: File tree structure:` でファイル構造を確認
- エラー発生時の詳細情報

## 開発者向け情報

### コードの主要部分

- **buildFileTree()**: API応答をツリー構造に変換
- **getFilesRecursively()**: ツリーから全ファイルを再帰的に取得
- **findNodeByPath()**: パスでノードを検索
- **zip.js**: ブラウザ内でのZIP作成（ライブラリ埋め込み済み）

### カスタマイズ

必要に応じて以下の部分を修正できます：
- ZIPファイル名の形式
- 進捗表示の方法
- エラーメッセージ
- UI要素のスタイル

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

### 使用ライブラリ

- **zip.js**: MITライセンス ([GitHub](https://github.com/gildas-lormeau/zip.js))

```
BSD 3-Clause License

Copyright (c) 2023, Gildas Lormeau

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## 免責事項

この拡張機能は非公式ツールです。あまりにサーバーに負荷をかける可能性がある場合、使用を控えてください。使用は自己責任でお願いします。京都大学やPandAシステムとは関係ありません。
