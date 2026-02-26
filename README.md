# numatter-tui

Numatter向けのターミナルUIです。内部で `numatter-client` (TypeScriptライブラリ) を利用します。

## Features

- 自分のプロフィール表示
- 未読通知数の表示
- 通知一覧の確認
- 投稿作成

## Setup

```bash
pnpm install
cp .env.example .env
# .env の NUMATTER_BASE_URL / NUMATTER_TOKEN を設定
```

## Run

```bash
pnpm dev
```

### Keybinds

- `r`: ダッシュボード再読み込み
- `p`: 投稿作成
- `n`: 通知一覧表示
- `q`: 終了

## Build

```bash
pnpm build
pnpm start
```
