ALTER TABLE translations
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE translations
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE translations
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE translations
  ADD COLUMN IF NOT EXISTS value_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE translations
SET value_updated_at = COALESCE(updated_at, created_at, NOW())
WHERE value_updated_at IS NULL;

CREATE TABLE IF NOT EXISTS translation_memories (
  id UUID PRIMARY KEY,
  source_language_code TEXT NOT NULL,
  target_language_code TEXT NOT NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS translation_memories_unique_idx
  ON translation_memories (source_language_code, target_language_code, source_text, translated_text);

CREATE INDEX IF NOT EXISTS translation_memories_lookup_idx
  ON translation_memories (source_language_code, target_language_code, updated_at DESC);
