const path = require("node:path");

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

module.exports = {
  PORT: Number(process.env.PORT || 3001),
  DATA_DIR,
  PROJECTS_DIR: path.join(DATA_DIR, "projects"),
  LIBRARY_DIR: path.join(DATA_DIR, "library"),
  DIST_DIR: path.join(process.cwd(), "dist"),
  DATABASE_URL:
    process.env.DATABASE_URL ||
    `postgresql://${encodeURIComponent(process.env.POSTGRES_USER || "localize")}:${encodeURIComponent(
      process.env.POSTGRES_PASSWORD || "localize",
    )}@${process.env.POSTGRES_HOST || "postgres"}:${process.env.POSTGRES_PORT || "5432"}/${
      process.env.POSTGRES_DB || "localize"
    }`,
  SESSION_SECRET: process.env.SESSION_SECRET || "change-me-localize-session-secret",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@localize.local",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "admin123!",
};
