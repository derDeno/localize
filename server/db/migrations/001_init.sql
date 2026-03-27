CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  status TEXT NOT NULL CHECK (status IN ('active', 'invited', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON users ((LOWER(email)))
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  allow_registration BOOLEAN NOT NULL DEFAULT TRUE,
  allow_project_delete BOOLEAN NOT NULL DEFAULT TRUE,
  allow_language_delete BOOLEAN NOT NULL DEFAULT TRUE,
  sso_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sso_provider TEXT NOT NULL DEFAULT '',
  sso_issuer_url TEXT NOT NULL DEFAULT '',
  sso_client_id TEXT NOT NULL DEFAULT '',
  sso_client_secret TEXT NOT NULL DEFAULT '',
  sso_password_login_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sso_auto_provision_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sso_auto_provision_role_mode TEXT NOT NULL DEFAULT 'default_role' CHECK (sso_auto_provision_role_mode IN ('default_role', 'identity_mapping')),
  sso_auto_provision_default_role TEXT NOT NULL DEFAULT 'viewer' CHECK (sso_auto_provision_default_role IN ('admin', 'editor', 'viewer')),
  sso_role_sync_mode TEXT NOT NULL DEFAULT 'first_login' CHECK (sso_role_sync_mode IN ('first_login', 'each_login')),
  sso_admin_group TEXT NOT NULL DEFAULT '',
  sso_editor_group TEXT NOT NULL DEFAULT '',
  sso_viewer_group TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '',
  source_language TEXT NOT NULL,
  config_json JSONB NOT NULL,
  current_revision INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS languages (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  origin TEXT NOT NULL,
  library_file TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_source BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (project_id, code)
);

CREATE INDEX IF NOT EXISTS languages_project_id_idx ON languages (project_id);

CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  translation_key TEXT NOT NULL,
  value_text TEXT NOT NULL DEFAULT '',
  value_type TEXT NOT NULL DEFAULT 'string',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (language_id, translation_key)
);

CREATE INDEX IF NOT EXISTS translations_project_language_idx
  ON translations (project_id, language_id);

CREATE TABLE IF NOT EXISTS project_versions (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  version_label TEXT NOT NULL DEFAULT '',
  snapshot_json JSONB NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, revision)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
