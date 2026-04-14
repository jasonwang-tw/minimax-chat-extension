# MiniMax Sync Bridge

WordPress plugin for the MiniMax AI Chat extension fallback sync flow.

## Features

- WordPress account login / registration handoff
- Extension auth bridge using one-time authorization codes
- REST API for:
  - `POST /wp-json/minimax-sync/v1/auth/exchange`
  - `GET /wp-json/minimax-sync/v1/me/status`
  - `GET /wp-json/minimax-sync/v1/backup/settings`
  - `POST /wp-json/minimax-sync/v1/backup/settings`
  - `PUT /wp-json/minimax-sync/v1/backup/settings`
  - `POST /wp-json/minimax-sync/v1/auth/logout`
- Admin page under `Settings > MiniMax Sync`
- Plugin-local debug log file (`minimax-sync-debug.log`)

## Install

1. Copy the `minimax-sync` folder into `wp-content/plugins/`
2. Activate `MiniMax Sync Bridge`
3. Ensure WordPress user registration is enabled if self-service signup is required
4. Keep the site on HTTPS

## Extension config

- WordPress Base URL: `https://jasonsbase.com`
- The extension opens:
  - `/?minimax_sync_action=authorize&redirect_uri=<chromium callback>&state=<uuid>`

## Notes

- Backup payload is stored per user as a single JSON snapshot
- This MVP only targets settings backup/restore, not chat history or knowledge-base payloads

## Debug Log

- Log file path (inside plugin directory):
  - `wp-content/plugins/minimax-sync/minimax-sync-debug.log`
- If backup/restore fails:
  1. Trigger the action again from the extension
  2. Open the log file above
  3. Check the latest lines for `rest_put_backup`, `rest_get_backup`, or `require_token`

## Changelog

### 0.1.4

- Add token deletion controls in admin:
  - `Delete` button for revoked tokens
  - `清理全部 Revoked Token` one-click cleanup action
- Keep existing `Revoke` behavior for active tokens

### 0.1.3

- Display admin time columns in `Asia/Taipei` timezone:
  - Backup list `Updated At`
  - Token list `Created` and `Last Used`

### 0.1.2

- Fix compatibility for WordPress environments where `WP_REST_Request::set_attribute()` is unavailable
- Move request authentication context handling to internal helper (`authenticate_request`)
- Keep plugin-local debug log output and actionable REST error messages

### 0.1.1

- Add plugin-local debug log output at `minimax-sync-debug.log`
- Improve REST error handling to return actionable failure messages
- Add token header fallback support (`X-Minimax-Token`)
- Keep backup API compatible with both `POST` and `PUT` callers
