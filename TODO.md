# WordPress Sync TODO

## Done

- Installed `wordpress/minimax-sync` on `https://jasonsbase.com`
- Activated the `MiniMax Sync Bridge` plugin
- Confirmed WordPress registration flow for self-service signup
- Reloaded Chrome extension on branch `codex/plan-synchronization-for-settings-and-data`
- Verified `設定 > 同步` WordPress login flow (`使用 WordPress 登入`)
- Verified manual backup flow (`立即備份設定`)
- Verified restore flow (`從雲端還原`) after local settings changes
- Verified admin page `Settings > MiniMax Sync`:
  - recent backups
  - active tokens
  - revoke action
- Completed hardening/fixes during validation:
  - token header fallback support (`Authorization` + `X-Minimax-Token`)
  - fallback backup method (`POST` with `PUT` fallback)
  - plugin-local debug log (`wp-content/plugins/minimax-sync/minimax-sync-debug.log`)
  - WordPress compatibility fix (remove dependency on `WP_REST_Request::set_attribute`)
  - admin time display in `Asia/Taipei`
  - token management cleanup UI (`Delete` revoked token / bulk cleanup revoked tokens)

## Next Phase

- Final E2E regression pass on production-like setup (login -> backup -> restore -> token cleanup)
- PHP lint/test on machine with `php` installed
- Improve user-facing copy in extension sync section and plugin admin pages
- Define token lifecycle policy:
  - expiration / rotation
  - retention cleanup rules
- Optional encrypted payload support for settings backup
- Optional auto-sync background scheduling
- Optional backup version history
