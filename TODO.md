# WordPress Sync TODO

## Ready For Validation

- Install `wordpress/minimax-sync` on `https://jasonsbase.com`
- Activate the `MiniMax Sync Bridge` plugin
- Confirm WordPress registration is enabled for self-service signup
- Reload the Chrome extension on branch `codex/plan-synchronization-for-settings-and-data`
- Open `設定 > 同步`
- Test `使用 WordPress 登入`
- Test `立即備份設定`
- Change a few settings locally, then test `從雲端還原`
- Verify admin page `Settings > MiniMax Sync` shows:
  - recent backups
  - active tokens
  - revoke action

## Still Pending After MVP

- End-to-end runtime validation against the real WordPress site
- PHP lint/test in a machine with `php` installed
- Better user-facing copy for sync section and plugin pages
- Optional token expiration / rotation policy
- Optional encrypted payload support
- Optional auto-sync background scheduling
- Optional backup version history
