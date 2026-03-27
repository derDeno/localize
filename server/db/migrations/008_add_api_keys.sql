CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  scopes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  project_access_mode TEXT NOT NULL DEFAULT 'all' CHECK (project_access_mode IN ('all', 'selected')),
  project_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS api_keys_key_hash_unique_idx
  ON api_keys (key_hash)
  WHERE deleted_at IS NULL;
