ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS sso_auto_provision_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS sso_auto_provision_role_mode TEXT NOT NULL DEFAULT 'default_role';

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS sso_auto_provision_default_role TEXT NOT NULL DEFAULT 'viewer';

UPDATE app_settings
SET
  sso_auto_provision_role_mode = CASE
    WHEN sso_auto_provision_role_mode IN ('default_role', 'identity_mapping') THEN sso_auto_provision_role_mode
    ELSE 'default_role'
  END,
  sso_auto_provision_default_role = CASE
    WHEN sso_auto_provision_default_role IN ('admin', 'editor', 'viewer') THEN sso_auto_provision_default_role
    ELSE 'viewer'
  END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_sso_auto_provision_role_mode_check'
  ) THEN
    ALTER TABLE app_settings
      ADD CONSTRAINT app_settings_sso_auto_provision_role_mode_check
      CHECK (sso_auto_provision_role_mode IN ('default_role', 'identity_mapping'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_sso_auto_provision_default_role_check'
  ) THEN
    ALTER TABLE app_settings
      ADD CONSTRAINT app_settings_sso_auto_provision_default_role_check
      CHECK (sso_auto_provision_default_role IN ('admin', 'editor', 'viewer'));
  END IF;
END $$;
