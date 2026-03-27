ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS sso_scopes TEXT NOT NULL DEFAULT 'openid profile email';
