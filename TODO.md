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

## Done (v1.14.x)

- Improved sync section UI: hide login button after login, show backup/restore/logout only when authorized
- Removed daily scheduled backup (replaced by instant backup on storage change with 5s debounce)
- Fixed geminiApiKey / braveApiKey / exaApiKey missing from auto-backup watch list
- Removed reply modes feature
- Structured long-term memory format (title / summary / tags)
- Added chatSessions to instant backup scope
- Added "auto-restore on startup" option

## Next Phase

- Final E2E regression pass on production-like setup (login -> backup -> restore -> token cleanup)
- PHP lint/test on machine with `php` installed
- Define token lifecycle policy:
  - expiration / rotation
  - retention cleanup rules
- Optional encrypted payload support for settings backup
- Optional backup version history
- Spaces feature (Phase 1: tab-based space switching)
- 財經功能：/stock、/twstock、/news slash commands
- 自動化功能：daily Gmail digest via chrome.alarms + chrome.identity
