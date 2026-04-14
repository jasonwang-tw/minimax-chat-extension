# MiniMax Sync Bridge

WordPress plugin for the MiniMax AI Chat extension fallback sync flow.

## Features

- WordPress account login / registration handoff
- Extension auth bridge using one-time authorization codes
- REST API for:
  - `POST /wp-json/minimax-sync/v1/auth/exchange`
  - `GET /wp-json/minimax-sync/v1/me/status`
  - `GET /wp-json/minimax-sync/v1/backup/settings`
  - `PUT /wp-json/minimax-sync/v1/backup/settings`
  - `POST /wp-json/minimax-sync/v1/auth/logout`
- Admin page under `Settings > MiniMax Sync`

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
