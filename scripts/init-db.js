const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { pool } = require("../server/db/client");
const {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
} = require("../server/config");

const ADMIN_FIRST_NAME = "System";
const ADMIN_LAST_NAME = "Admin";
const DB_CONNECT_RETRIES = Number(process.env.DB_CONNECT_RETRIES || 30);
const DB_CONNECT_RETRY_DELAY_MS = Number(process.env.DB_CONNECT_RETRY_DELAY_MS || 2000);

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function withDatabaseRetry(operation) {
  let lastError;

  for (let attempt = 1; attempt <= DB_CONNECT_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === DB_CONNECT_RETRIES) {
        break;
      }

      console.warn(
        `Database not ready yet (attempt ${attempt}/${DB_CONNECT_RETRIES}): ${error.message}`,
      );
      await sleep(DB_CONNECT_RETRY_DELAY_MS);
    }
  }

  throw lastError;
}

async function applyMigrations() {
  const migrationsDir = path.join(__dirname, "..", "server", "db", "migrations");
  const client = await withDatabaseRetry(() => pool.connect());

  try {
    await client.query("BEGIN");
    await ensureMigrationsTable(client);
    const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

    for (const fileName of files) {
      const alreadyApplied = await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [fileName]);
      if (alreadyApplied.rowCount) {
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, fileName), "utf8");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [fileName]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function seedSettings() {
  await pool.query(
    `
      INSERT INTO app_settings (
        id,
        allow_registration,
        allow_project_delete,
        allow_language_delete,
        updated_at
      )
      VALUES (TRUE, $1, $2, $3, NOW())
      ON CONFLICT (id) DO NOTHING
    `,
    [true, true, true],
  );
}

async function seedAdminUser() {
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  const existingAdmin = await pool.query(
    "SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL",
    [ADMIN_EMAIL],
  );

  if (existingAdmin.rowCount) {
    await pool.query(
      `
        UPDATE users
        SET
          first_name = $2,
          last_name = $3,
          password_hash = $4,
          role = 'admin',
          status = 'active',
          updated_at = NOW(),
          deleted_at = NULL
        WHERE id = $1
      `,
      [existingAdmin.rows[0].id, ADMIN_FIRST_NAME, ADMIN_LAST_NAME, passwordHash],
    );
    return;
  }

  await pool.query(
    `
      INSERT INTO users (
        id,
        first_name,
        last_name,
        email,
        password_hash,
        role,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'admin', 'active')
    `,
    [crypto.randomUUID(), ADMIN_FIRST_NAME, ADMIN_LAST_NAME, ADMIN_EMAIL, passwordHash],
  );
}

async function main() {
  await applyMigrations();
  await withDatabaseRetry(seedSettings);
  await withDatabaseRetry(seedAdminUser);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
