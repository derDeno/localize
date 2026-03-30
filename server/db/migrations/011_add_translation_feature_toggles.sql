ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS translation_approval_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS translation_memory_enabled BOOLEAN NOT NULL DEFAULT TRUE;
