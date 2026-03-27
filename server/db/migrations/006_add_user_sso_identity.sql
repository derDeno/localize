ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sso_issuer TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sso_subject TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS users_sso_identity_unique_idx
  ON users (sso_issuer, sso_subject)
  WHERE deleted_at IS NULL
    AND sso_issuer <> ''
    AND sso_subject <> '';
