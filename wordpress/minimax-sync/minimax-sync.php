<?php
/**
 * Plugin Name: MiniMax Sync Bridge
 * Plugin URI: https://jasonsbase.com/
 * Description: Provides WordPress-backed login and settings backup endpoints for the MiniMax AI Chat extension.
 * Version: 0.1.0
 * Author: Jason Wang
 * License: GPLv2 or later
 */

if (!defined('ABSPATH')) {
    exit;
}

final class Minimax_Sync_Bridge {
    private const OPTION_ENABLED = 'minimax_sync_bridge_enabled';
    private const TABLE_BACKUPS = 'minimax_sync_backups';
    private const TABLE_CODES = 'minimax_sync_auth_codes';
    private const TABLE_TOKENS = 'minimax_sync_tokens';
    private const CODE_TTL_SECONDS = 600;
    private const TOKEN_PREFIX = 'mms_';

    public static function init(): void {
        register_activation_hook(__FILE__, [self::class, 'activate']);
        add_action('rest_api_init', [self::class, 'register_rest_routes']);
        add_action('template_redirect', [self::class, 'maybe_render_authorize_page']);
        add_action('admin_menu', [self::class, 'register_admin_page']);
        add_action('admin_post_minimax_sync_save_settings', [self::class, 'handle_admin_save']);
        add_action('admin_post_minimax_sync_revoke_token', [self::class, 'handle_admin_revoke_token']);
    }

    public static function activate(): void {
        global $wpdb;

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $charset = $wpdb->get_charset_collate();
        $backups = self::table(self::TABLE_BACKUPS);
        $codes = self::table(self::TABLE_CODES);
        $tokens = self::table(self::TABLE_TOKENS);

        dbDelta("
            CREATE TABLE {$backups} (
                user_id BIGINT(20) UNSIGNED NOT NULL,
                backup_json LONGTEXT NOT NULL,
                updated_at DATETIME NOT NULL,
                PRIMARY KEY  (user_id)
            ) {$charset};
        ");

        dbDelta("
            CREATE TABLE {$codes} (
                id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
                user_id BIGINT(20) UNSIGNED NOT NULL,
                code_hash CHAR(64) NOT NULL,
                redirect_uri TEXT NOT NULL,
                state VARCHAR(128) NOT NULL,
                expires_at DATETIME NOT NULL,
                used_at DATETIME NULL,
                created_at DATETIME NOT NULL,
                PRIMARY KEY  (id),
                UNIQUE KEY code_hash (code_hash)
            ) {$charset};
        ");

        dbDelta("
            CREATE TABLE {$tokens} (
                id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
                user_id BIGINT(20) UNSIGNED NOT NULL,
                token_hash CHAR(64) NOT NULL,
                last_used_at DATETIME NULL,
                revoked_at DATETIME NULL,
                created_at DATETIME NOT NULL,
                PRIMARY KEY  (id),
                UNIQUE KEY token_hash (token_hash)
            ) {$charset};
        ");

        add_option(self::OPTION_ENABLED, '1');
    }

    public static function register_rest_routes(): void {
        register_rest_route('minimax-sync/v1', '/auth/exchange', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [self::class, 'rest_exchange_code'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route('minimax-sync/v1', '/me/status', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [self::class, 'rest_status'],
            'permission_callback' => [self::class, 'require_token'],
        ]);

        register_rest_route('minimax-sync/v1', '/backup/settings', [
            [
                'methods' => WP_REST_Server::READABLE,
                'callback' => [self::class, 'rest_get_backup'],
                'permission_callback' => [self::class, 'require_token'],
            ],
            [
                'methods' => WP_REST_Server::EDITABLE,
                'callback' => [self::class, 'rest_put_backup'],
                'permission_callback' => [self::class, 'require_token'],
            ],
        ]);

        register_rest_route('minimax-sync/v1', '/auth/logout', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [self::class, 'rest_logout'],
            'permission_callback' => [self::class, 'require_token'],
        ]);
    }

    public static function maybe_render_authorize_page(): void {
        if (!isset($_GET['minimax_sync_action']) || $_GET['minimax_sync_action'] !== 'authorize') {
            return;
        }

        if (!self::is_enabled()) {
            self::render_message_page('MiniMax Sync 暫停中', '站台管理者目前已停用同步授權。請稍後再試。');
        }

        $redirect_uri = isset($_GET['redirect_uri']) ? esc_url_raw(wp_unslash($_GET['redirect_uri'])) : '';
        $state = isset($_GET['state']) ? sanitize_text_field(wp_unslash($_GET['state'])) : '';

        if (!self::is_valid_redirect_uri($redirect_uri) || empty($state)) {
            self::render_message_page('無效的授權請求', '缺少必要參數或 redirect URI 格式不正確。');
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['minimax_sync_approve'])) {
            check_admin_referer('minimax_sync_authorize');

            if (!is_user_logged_in()) {
                self::render_message_page('尚未登入', '請先登入 WordPress 帳號後再授權。');
            }

            $code = self::issue_auth_code(get_current_user_id(), $redirect_uri, $state);
            $target = add_query_arg([
                'code' => $code,
                'state' => $state,
            ], $redirect_uri);

            wp_redirect($target, 302, 'MiniMax Sync Bridge');
            exit;
        }

        self::render_authorize_page($redirect_uri, $state);
    }

    public static function rest_exchange_code(WP_REST_Request $request) {
        if (!self::is_enabled()) {
            return new WP_Error('minimax_sync_disabled', 'Sync bridge is disabled.', ['status' => 403]);
        }

        $code = sanitize_text_field((string) $request->get_param('code'));
        $redirect_uri = esc_url_raw((string) $request->get_param('redirectUri'));

        if (empty($code) || empty($redirect_uri)) {
            return new WP_Error('minimax_sync_bad_request', 'Missing code or redirectUri.', ['status' => 400]);
        }

        $record = self::consume_auth_code($code, $redirect_uri);
        if (!$record) {
            return new WP_Error('minimax_sync_invalid_code', 'Authorization code is invalid or expired.', ['status' => 403]);
        }

        $raw_token = self::generate_secret(32);
        self::store_token((int) $record->user_id, $raw_token);

        $user = get_userdata((int) $record->user_id);
        return new WP_REST_Response([
            'token' => self::TOKEN_PREFIX . $raw_token,
            'account' => self::format_user($user),
        ]);
    }

    public static function rest_status(WP_REST_Request $request) {
        $auth = $request->get_attribute('minimax_sync_auth');
        $last_backup = self::get_last_backup_at((int) $auth['user_id']);

        return new WP_REST_Response([
            'account' => self::format_user(get_userdata((int) $auth['user_id'])),
            'lastBackupAt' => $last_backup,
        ]);
    }

    public static function rest_get_backup(WP_REST_Request $request) {
        $auth = $request->get_attribute('minimax_sync_auth');
        $payload = self::get_backup_payload((int) $auth['user_id']);

        return new WP_REST_Response([
            'payload' => $payload,
            'updatedAt' => self::get_last_backup_at((int) $auth['user_id']),
        ]);
    }

    public static function rest_put_backup(WP_REST_Request $request) {
        $auth = $request->get_attribute('minimax_sync_auth');
        $payload = $request->get_json_params();

        if (!is_array($payload) || !isset($payload['settings']) || !is_array($payload['settings'])) {
            return new WP_Error('minimax_sync_invalid_payload', 'Backup payload must contain a settings object.', ['status' => 400]);
        }

        $json = wp_json_encode($payload);
        if (!$json || strlen($json) > 262144) {
            return new WP_Error('minimax_sync_payload_too_large', 'Backup payload is too large.', ['status' => 413]);
        }

        self::store_backup_payload((int) $auth['user_id'], $json);

        return new WP_REST_Response([
            'updatedAt' => gmdate('c'),
        ]);
    }

    public static function rest_logout(WP_REST_Request $request) {
        $auth = $request->get_attribute('minimax_sync_auth');
        self::revoke_token_by_id((int) $auth['token_id']);

        return new WP_REST_Response(['success' => true]);
    }

    public static function require_token(WP_REST_Request $request) {
        if (!self::is_enabled()) {
            return new WP_Error('minimax_sync_disabled', 'Sync bridge is disabled.', ['status' => 403]);
        }

        $raw_header = $request->get_header('authorization');
        if (!preg_match('/Bearer\s+(.+)/i', (string) $raw_header, $matches)) {
            return new WP_Error('minimax_sync_missing_token', 'Missing bearer token.', ['status' => 401]);
        }

        $token = trim($matches[1]);
        if (strpos($token, self::TOKEN_PREFIX) === 0) {
            $token = substr($token, strlen(self::TOKEN_PREFIX));
        }

        $record = self::find_token($token);
        if (!$record) {
            return new WP_Error('minimax_sync_invalid_token', 'Token is invalid or revoked.', ['status' => 401]);
        }

        self::touch_token((int) $record->id);

        $request->set_attribute('minimax_sync_auth', [
            'token_id' => (int) $record->id,
            'user_id' => (int) $record->user_id,
        ]);

        return true;
    }

    public static function register_admin_page(): void {
        add_options_page(
            'MiniMax Sync',
            'MiniMax Sync',
            'manage_options',
            'minimax-sync',
            [self::class, 'render_admin_page']
        );
    }

    public static function render_admin_page(): void {
        if (!current_user_can('manage_options')) {
            wp_die('Insufficient permissions.');
        }

        global $wpdb;
        $tokens = $wpdb->get_results(
            "SELECT t.id, t.user_id, t.last_used_at, t.revoked_at, t.created_at, u.user_login, u.user_email
             FROM " . self::table(self::TABLE_TOKENS) . " t
             LEFT JOIN {$wpdb->users} u ON u.ID = t.user_id
             ORDER BY t.created_at DESC
             LIMIT 20"
        );

        $backups = $wpdb->get_results(
            "SELECT b.user_id, b.updated_at, u.user_login, u.user_email
             FROM " . self::table(self::TABLE_BACKUPS) . " b
             LEFT JOIN {$wpdb->users} u ON u.ID = b.user_id
             ORDER BY b.updated_at DESC
             LIMIT 20"
        );
        ?>
        <div class="wrap">
            <h1>MiniMax Sync</h1>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('minimax_sync_save_settings'); ?>
                <input type="hidden" name="action" value="minimax_sync_save_settings">
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row">啟用同步橋接</th>
                        <td>
                            <label>
                                <input type="checkbox" name="enabled" value="1" <?php checked(self::is_enabled()); ?>>
                                允許 extension 使用 WordPress 備援登入與設定備份
                            </label>
                        </td>
                    </tr>
                </table>
                <?php submit_button('儲存設定'); ?>
            </form>

            <h2>最近備份</h2>
            <table class="widefat striped">
                <thead><tr><th>User</th><th>Email</th><th>Updated At (UTC)</th></tr></thead>
                <tbody>
                <?php foreach ($backups as $backup): ?>
                    <tr>
                        <td><?php echo esc_html($backup->user_login ?: $backup->user_id); ?></td>
                        <td><?php echo esc_html($backup->user_email ?: ''); ?></td>
                        <td><?php echo esc_html($backup->updated_at); ?></td>
                    </tr>
                <?php endforeach; ?>
                <?php if (empty($backups)): ?>
                    <tr><td colspan="3">尚無備份紀錄。</td></tr>
                <?php endif; ?>
                </tbody>
            </table>

            <h2 style="margin-top: 24px;">Token 管理</h2>
            <table class="widefat striped">
                <thead><tr><th>User</th><th>Email</th><th>Created</th><th>Last Used</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                <?php foreach ($tokens as $token): ?>
                    <tr>
                        <td><?php echo esc_html($token->user_login ?: $token->user_id); ?></td>
                        <td><?php echo esc_html($token->user_email ?: ''); ?></td>
                        <td><?php echo esc_html($token->created_at); ?></td>
                        <td><?php echo esc_html($token->last_used_at ?: ''); ?></td>
                        <td><?php echo esc_html($token->revoked_at ? 'Revoked' : 'Active'); ?></td>
                        <td>
                            <?php if (!$token->revoked_at): ?>
                                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                                    <?php wp_nonce_field('minimax_sync_revoke_token'); ?>
                                    <input type="hidden" name="action" value="minimax_sync_revoke_token">
                                    <input type="hidden" name="token_id" value="<?php echo esc_attr($token->id); ?>">
                                    <?php submit_button('Revoke', 'secondary small', '', false); ?>
                                </form>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
                <?php if (empty($tokens)): ?>
                    <tr><td colspan="6">尚無 token。</td></tr>
                <?php endif; ?>
                </tbody>
            </table>
        </div>
        <?php
    }

    public static function handle_admin_save(): void {
        if (!current_user_can('manage_options')) {
            wp_die('Insufficient permissions.');
        }

        check_admin_referer('minimax_sync_save_settings');
        update_option(self::OPTION_ENABLED, isset($_POST['enabled']) ? '1' : '0');
        wp_safe_redirect(add_query_arg(['page' => 'minimax-sync', 'updated' => '1'], admin_url('options-general.php')));
        exit;
    }

    public static function handle_admin_revoke_token(): void {
        if (!current_user_can('manage_options')) {
            wp_die('Insufficient permissions.');
        }

        check_admin_referer('minimax_sync_revoke_token');
        self::revoke_token_by_id((int) ($_POST['token_id'] ?? 0));
        wp_safe_redirect(add_query_arg(['page' => 'minimax-sync', 'revoked' => '1'], admin_url('options-general.php')));
        exit;
    }

    private static function render_authorize_page(string $redirect_uri, string $state): void {
        $current_url = add_query_arg([
            'minimax_sync_action' => 'authorize',
            'redirect_uri' => $redirect_uri,
            'state' => $state,
        ], home_url('/'));

        nocache_headers();
        ?>
        <!doctype html>
        <html lang="zh-TW">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <title>MiniMax Sync 授權</title>
            <style>
                body { font-family: sans-serif; background:#111827; color:#f9fafb; padding:32px; }
                .card { max-width:560px; margin:0 auto; background:#1f2937; border:1px solid #374151; border-radius:16px; padding:24px; }
                a, button { display:inline-block; margin-right:8px; margin-top:12px; padding:10px 16px; border-radius:10px; text-decoration:none; border:none; cursor:pointer; }
                .primary { background:#ec4899; color:#fff; }
                .secondary { background:#374151; color:#fff; }
                p { line-height:1.6; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>MiniMax Sync 授權</h1>
                <p>此頁面會將你的 WordPress 帳號授權給 MiniMax AI Chat extension，用於備份與還原設定快照。</p>
                <?php if (!is_user_logged_in()): ?>
                    <p>你尚未登入。請先登入或註冊 WordPress 帳號後，再回到此頁完成授權。</p>
                    <a class="primary" href="<?php echo esc_url(wp_login_url($current_url)); ?>">登入</a>
                    <?php if (get_option('users_can_register')): ?>
                        <a class="secondary" href="<?php echo esc_url(wp_registration_url()); ?>">註冊帳號</a>
                    <?php endif; ?>
                <?php else: ?>
                    <p>目前登入帳號：<?php echo esc_html(wp_get_current_user()->user_email ?: wp_get_current_user()->user_login); ?></p>
                    <form method="post">
                        <?php wp_nonce_field('minimax_sync_authorize'); ?>
                        <button class="primary" type="submit" name="minimax_sync_approve" value="1">同意授權</button>
                    </form>
                <?php endif; ?>
            </div>
        </body>
        </html>
        <?php
        exit;
    }

    private static function render_message_page(string $title, string $message): void {
        nocache_headers();
        ?>
        <!doctype html>
        <html lang="zh-TW">
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?php echo esc_html($title); ?></title></head>
        <body style="font-family:sans-serif;background:#111827;color:#f9fafb;padding:32px;">
            <div style="max-width:560px;margin:0 auto;background:#1f2937;border:1px solid #374151;border-radius:16px;padding:24px;">
                <h1><?php echo esc_html($title); ?></h1>
                <p><?php echo esc_html($message); ?></p>
            </div>
        </body>
        </html>
        <?php
        exit;
    }

    private static function issue_auth_code(int $user_id, string $redirect_uri, string $state): string {
        global $wpdb;
        $raw_code = self::generate_secret(24);
        $wpdb->insert(self::table(self::TABLE_CODES), [
            'user_id' => $user_id,
            'code_hash' => hash('sha256', $raw_code),
            'redirect_uri' => $redirect_uri,
            'state' => $state,
            'expires_at' => gmdate('Y-m-d H:i:s', time() + self::CODE_TTL_SECONDS),
            'created_at' => gmdate('Y-m-d H:i:s'),
        ]);

        return $raw_code;
    }

    private static function consume_auth_code(string $code, string $redirect_uri): ?object {
        global $wpdb;
        $table = self::table(self::TABLE_CODES);
        $record = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$table} WHERE code_hash = %s AND redirect_uri = %s AND used_at IS NULL LIMIT 1",
            hash('sha256', $code),
            $redirect_uri
        ));

        if (!$record || strtotime($record->expires_at . ' UTC') < time()) {
            return null;
        }

        $wpdb->update($table, ['used_at' => gmdate('Y-m-d H:i:s')], ['id' => $record->id]);
        return $record;
    }

    private static function store_token(int $user_id, string $raw_token): void {
        global $wpdb;
        $wpdb->insert(self::table(self::TABLE_TOKENS), [
            'user_id' => $user_id,
            'token_hash' => hash('sha256', $raw_token),
            'created_at' => gmdate('Y-m-d H:i:s'),
        ]);
    }

    private static function find_token(string $raw_token): ?object {
        global $wpdb;
        $table = self::table(self::TABLE_TOKENS);
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$table} WHERE token_hash = %s AND revoked_at IS NULL LIMIT 1",
            hash('sha256', $raw_token)
        ));
    }

    private static function touch_token(int $token_id): void {
        global $wpdb;
        $wpdb->update(self::table(self::TABLE_TOKENS), [
            'last_used_at' => gmdate('Y-m-d H:i:s'),
        ], [
            'id' => $token_id,
        ]);
    }

    private static function revoke_token_by_id(int $token_id): void {
        if ($token_id <= 0) {
            return;
        }

        global $wpdb;
        $wpdb->update(self::table(self::TABLE_TOKENS), [
            'revoked_at' => gmdate('Y-m-d H:i:s'),
        ], [
            'id' => $token_id,
        ]);
    }

    private static function store_backup_payload(int $user_id, string $json): void {
        global $wpdb;
        $wpdb->replace(self::table(self::TABLE_BACKUPS), [
            'user_id' => $user_id,
            'backup_json' => $json,
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ]);
    }

    private static function get_backup_payload(int $user_id): array {
        global $wpdb;
        $json = $wpdb->get_var($wpdb->prepare(
            'SELECT backup_json FROM ' . self::table(self::TABLE_BACKUPS) . ' WHERE user_id = %d',
            $user_id
        ));

        if (!$json) {
            return [
                'schemaVersion' => 1,
                'kind' => 'minimax-settings-backup',
                'exportedAt' => gmdate('c'),
                'settings' => [],
            ];
        }

        $decoded = json_decode($json, true);
        return is_array($decoded) ? $decoded : [
            'schemaVersion' => 1,
            'kind' => 'minimax-settings-backup',
            'exportedAt' => gmdate('c'),
            'settings' => [],
        ];
    }

    private static function get_last_backup_at(int $user_id): ?string {
        global $wpdb;
        $value = $wpdb->get_var($wpdb->prepare(
            'SELECT updated_at FROM ' . self::table(self::TABLE_BACKUPS) . ' WHERE user_id = %d',
            $user_id
        ));

        return $value ? gmdate('c', strtotime($value . ' UTC')) : null;
    }

    private static function format_user(?WP_User $user): array {
        if (!$user) {
            return [];
        }

        return [
            'id' => (int) $user->ID,
            'username' => $user->user_login,
            'email' => $user->user_email,
            'displayName' => $user->display_name,
        ];
    }

    private static function table(string $suffix): string {
        global $wpdb;
        return $wpdb->prefix . $suffix;
    }

    private static function is_enabled(): bool {
        return get_option(self::OPTION_ENABLED, '1') === '1';
    }

    private static function is_valid_redirect_uri(string $redirect_uri): bool {
        if (empty($redirect_uri)) {
            return false;
        }

        $parts = wp_parse_url($redirect_uri);
        if (!$parts || ($parts['scheme'] ?? '') !== 'https') {
            return false;
        }

        $host = (string) ($parts['host'] ?? '');
        return substr($host, -strlen('.chromiumapp.org')) === '.chromiumapp.org';
    }

    private static function generate_secret(int $bytes): string {
        return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
    }
}

Minimax_Sync_Bridge::init();
