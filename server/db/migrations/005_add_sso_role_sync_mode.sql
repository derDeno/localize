ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS sso_role_sync_mode TEXT NOT NULL DEFAULT 'first_login';

UPDATE app_settings
SET sso_role_sync_mode = CASE
  WHEN sso_role_sync_mode IN ('first_login', 'each_login') THEN sso_role_sync_mode
  ELSE 'first_login'
END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_sso_role_sync_mode_check'
  ) THEN
    ALTER TABLE app_settings
      ADD CONSTRAINT app_settings_sso_role_sync_mode_check
      CHECK (sso_role_sync_mode IN ('first_login', 'each_login'));
  END IF;
END $$;
