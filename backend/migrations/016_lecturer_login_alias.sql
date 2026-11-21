ALTER TABLE users ADD COLUMN IF NOT EXISTS login_alias VARCHAR(100) COLLATE utf8mb4_unicode_ci NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_login_alias ON users (login_alias);
