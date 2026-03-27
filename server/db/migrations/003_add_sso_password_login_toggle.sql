ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS sso_password_login_enabled BOOLEAN NOT NULL DEFAULT TRUE;
