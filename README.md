# HubKey

GitHub / GitBucket の Issue に **Backlog のようなプロジェクトキー + 連番**（例: `FRONT-1`, `BACK-5`）を付与し、VS Code 上でチケット管理できる拡張機能です。

## Features

### Issue 管理
- **プロジェクトキー採番** — Issue 作成時に `[PROJ-1]` 形式の接頭辞をタイトルに自動付与
- **Issue 作成・編集** — Webview フォームでタイトル・本文・ラベル・アサイニーを設定
- **Issue 詳細表示** — クリックで本文・コメント一覧を表示、コメント投稿も可能
- **ステータス変更** — ワンクリックで Close / Reopen

### 複数リポジトリ対応
- **リポジトリごとにプロジェクトキーを設定** — `FRONT`, `BACK`, `INFRA` など
- **表示の ON/OFF 切り替え** — 不要なリポジトリを非表示にできる

### 変更検知
- **更新バッジ** — ActivityBar アイコンに未確認の変更件数を表示
- **変更マーク** — コメント追加やステータス変更があった Issue に `●` マークを表示
- **既読管理** — Issue をクリックすると既読になりマークが消える

### 検索・フィルタ
- **プロジェクトキー検索** — `FRONT-3` や `FRONT` で絞り込み
- **ステータスフィルタ** — Open / Closed / All を切り替え

### GitHub 互換プラットフォーム対応
- **GitHub.com** — デフォルト
- **GitBucket** — `apiUrl` を指定して接続
- **GitHub Enterprise** — 同様に `apiUrl` で対応

## Quick Start

### 1. 認証設定

**gh CLI（推奨）:**

```sh
gh auth login
```

**Personal Access Token:**

VS Code 設定で `hubkey.auth.method` を `pat` に変更。初回起動時にトークン入力を求められ、OS Keychain に安全に保存されます。

必要なスコープ: `repo`

### 2. 設定ファイル作成

コマンドパレット → **`HubKey: Initialize .hubkey.json`** を実行、またはワークスペースのルートに `.hubkey.json` を手動作成:

```json
{
  "repositories": [
    {
      "owner": "myorg",
      "repo": "frontend",
      "projectKey": "FRONT",
      "enabled": true
    },
    {
      "owner": "myorg",
      "repo": "backend",
      "projectKey": "BACK",
      "enabled": true
    }
  ]
}
```

### 3. 使い始める

ActivityBar の HubKey アイコンをクリックすると、サイドバーに Issue 一覧が表示されます。

## `.hubkey.json` リファレンス

```jsonc
{
  "repositories": [
    {
      "owner": "myorg",           // リポジトリオーナー（必須）
      "repo": "my-repo",          // リポジトリ名（必須）
      "projectKey": "PROJ",       // プロジェクトキー（必須、大文字英数字 1-10 文字）
      "enabled": true,            // 表示の ON/OFF（省略時: true）
      "apiUrl": "http://..."      // GitHub 互換 API の URL（省略時: GitHub.com）
    }
  ]
}
```

### GitBucket の場合

```json
{
  "repositories": [
    {
      "owner": "myuser",
      "repo": "internal-tool",
      "projectKey": "TOOL",
      "enabled": true,
      "apiUrl": "http://gitbucket.example.com:8080/api/v3"
    }
  ]
}
```

### GitHub Enterprise の場合

```json
{
  "repositories": [
    {
      "owner": "myorg",
      "repo": "enterprise-app",
      "projectKey": "ENT",
      "enabled": true,
      "apiUrl": "https://github.example.com/api/v3"
    }
  ]
}
```

## Commands

| コマンド | 説明 |
|---|---|
| `HubKey: Create Issue` | 新規 Issue を作成 |
| `HubKey: Edit Issue` | 選択した Issue を編集 |
| `HubKey: Show Issue Detail` | Issue の詳細・コメントを表示 |
| `HubKey: Close Issue` | Issue をクローズ |
| `HubKey: Reopen Issue` | Issue をリオープン |
| `HubKey: Search by Project Key` | プロジェクトキーで検索 |
| `HubKey: Filter Open/Closed` | ステータスフィルタを切り替え |
| `HubKey: Refresh` | Issue 一覧と詳細画面を再取得 |
| `HubKey: Open on GitHub` | ブラウザで Issue を開く |
| `HubKey: Toggle Repository Visibility` | リポジトリの表示/非表示を切り替え |
| `HubKey: Add Repository` | 対話的にリポジトリを追加 |
| `HubKey: Initialize .hubkey.json` | 設定ファイルのテンプレートを作成 |

## Settings

| 設定 | デフォルト | 説明 |
|---|---|---|
| `hubkey.auth.method` | `ghCli` | 認証方式（`ghCli` または `pat`） |
| `hubkey.defaultState` | `open` | デフォルトのフィルタ状態（`open` / `closed` / `all`） |
| `hubkey.fetchLimit` | `100` | リポジトリごとの Issue 取得上限数 |

## TreeView の見方

```
HubKey (サイドバー)
├── FRONT — myorg/frontend
│   ├── ● FRONT-3: ログイン修正    #42 · @user · 💬3 · updated
│   ├──   FRONT-2: ダークモード     #41 · @user · 💬1
│   └──   FRONT-1: 初期セットアップ  #40
├── BACK — myorg/backend
│   └──   BACK-1: API 実装          #10 · @dev
└── INFRA — myorg/infra (hidden)
```

- **●** — 前回チェック時から変更あり（コメント追加・更新・ステータス変更）
- **💬N** — コメント数
- **updated** — 変更ありの表示
- **(hidden)** — 非表示リポジトリ

## 採番の仕組み

Issue 本文に HTML コメントとしてマーカーを埋め込みます:

```html
<!-- hubkey:FRONT-3 -->
```

- Markdown レンダリングでは非表示
- ラベルを汚染しない
- GitHub Issue 本来の `#番号` とは独立した採番体系
- 全 Issue（open + closed）をスキャンして最大番号 + 1 で採番

## 開発

```sh
git clone https://github.com/your-org/hubkey.git
cd hubkey
npm install
npm run compile
```

`F5` で Extension Development Host が起動します。

## License

MIT
