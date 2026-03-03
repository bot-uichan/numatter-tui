# numatter-tui

Numatter Developer API 向けのターミナル UI です。内部で `numatter-client` を利用します。

## Coverage

- Profile API: 表示 / 更新
- Posts API: 作成 / 単体取得 / スレッド取得 / 削除
- Interactions API: like / unlike / repost / unrepost
- Notifications API: 一覧 / 未読数 / 詳細 / mark-as-read(all)
- Notification Webhooks API: 一覧 / 作成 / 更新 / 削除 / manual send
- Token endpoints (`/api/developer/tokens`): 一覧 / 作成 / revoke
  - Bearer tokenのみで拒否された場合、TOTP要求レスポンス(401/403)を検知してコード入力→自動リトライします

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

## Keybinds

- `r` refresh dashboard
- `h` help
- `q` quit
- `p` create post
- `o` open post by id
- `t` open post thread by post id
- `x` delete post by id
- `l/u` like/unlike
- `s/S` repost/unrepost
- `n` notifications list
- `m` notifications list + mark all as read
- `d` notification detail by id
- `e` edit profile
- `w/W/a/k/g` webhook list/create/update-active/delete/send
- `z/Z/v` token list/create/revoke

## Test / Build

```bash
pnpm test
pnpm build
```
