const express = require("express");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const fs = require("node:fs/promises");
const fssync = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const archiver = require("archiver");
const { pool } = require("./db/client");
const {
  DATA_DIR,
  DIST_DIR,
  LIBRARY_DIR,
  PORT,
  PUBLIC_APP_URL,
  PROJECTS_DIR,
  SESSION_COOKIE_SECURE,
  SESSION_SECRET,
} = require("./config");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const SESSION_COOKIE = "localize_session";
const SSO_TRANSACTION_COOKIE = "localize_sso_transaction";
const roleRank = {
  viewer: 1,
  editor: 2,
  admin: 3,
};

app.set("trust proxy", true);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.exposeMessage = message;
  return error;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function flattenJson(input, prefix = "", result = {}) {
  if (Array.isArray(input)) {
    input.forEach((item, index) => {
      flattenJson(item, prefix ? `${prefix}.${index}` : String(index), result);
    });
    return result;
  }

  if (isPlainObject(input)) {
    Object.entries(input).forEach(([key, value]) => {
      flattenJson(value, prefix ? `${prefix}.${key}` : key, result);
    });
    return result;
  }

  if (prefix) {
    result[prefix] = input;
  }

  return result;
}

function unflattenJson(entries) {
  const root = {};

  Object.entries(entries).forEach(([flatKey, value]) => {
    const parts = flatKey.split(".");
    let cursor = root;

    parts.forEach((part, index) => {
      const isLeaf = index === parts.length - 1;
      const nextPart = parts[index + 1];
      const nextShouldBeArray = /^\d+$/.test(nextPart);

      if (isLeaf) {
        if (Array.isArray(cursor)) {
          cursor[Number(part)] = value;
        } else {
          cursor[part] = value;
        }
        return;
      }

      if (Array.isArray(cursor)) {
        if (cursor[Number(part)] === undefined) {
          cursor[Number(part)] = nextShouldBeArray ? [] : {};
        }
        cursor = cursor[Number(part)];
        return;
      }

      if (cursor[part] === undefined) {
        cursor[part] = nextShouldBeArray ? [] : {};
      }
      cursor = cursor[part];
    });
  });

  return root;
}

function stringifyValue(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function parseJsonBuffer(buffer) {
  let parsed;
  try {
    parsed = JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    throw createError("The uploaded file is not valid JSON.");
  }

  if (!isPlainObject(parsed) && !Array.isArray(parsed)) {
    throw createError("Only JSON objects and arrays are supported.");
  }

  return parsed;
}

async function writeJsonFile(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  await fs.mkdir(LIBRARY_DIR, { recursive: true });
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [body, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");

  if (signature.length !== expected.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.exp || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch (_error) {
    return null;
  }
}

function signSession(payload) {
  return signToken(payload);
}

function verifySession(token) {
  const payload = verifyToken(token);
  if (!payload?.sub) {
    return null;
  }
  return payload;
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

function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    const [salt, hash] = String(storedHash || "").split(":");
    if (!salt || !hash) {
      resolve(false);
      return;
    }

    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(crypto.timingSafeEqual(Buffer.from(hash, "hex"), derivedKey));
    });
  });
}

function getRequestBaseUrl(req) {
  if (PUBLIC_APP_URL) {
    return PUBLIC_APP_URL;
  }

  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const forwardedHost = String(req.get("x-forwarded-host") || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "http";
  const host = forwardedHost || req.get("host");

  if (!host) {
    throw createError("Unable to determine the application URL for SSO.", 500);
  }

  return `${protocol}://${host}`;
}

function getSsoCallbackUrl(req) {
  return `${getRequestBaseUrl(req)}/api/auth/sso/callback`;
}

function normalizeReturnTo(value) {
  const fallback = "/";
  const candidate = String(value || "").trim();

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  return candidate;
}

function splitClaimValues(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => splitClaimValues(item));
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getIdentityGroups(claims) {
  const groups = new Set();
  ["groups", "roles", "group", "memberOf"].forEach((key) => {
    splitClaimValues(claims?.[key]).forEach((value) => groups.add(value));
  });
  return Array.from(groups);
}

function getIdentityRole(settings, claims) {
  const groups = new Set(getIdentityGroups(claims));
  const mappings = settings.sso.roleMappings || {};

  if (mappings.admin && groups.has(mappings.admin)) {
    return "admin";
  }

  if (mappings.editor && groups.has(mappings.editor)) {
    return "editor";
  }

  if (mappings.viewer && groups.has(mappings.viewer)) {
    return "viewer";
  }

  return null;
}

function getUserNamesFromClaims(claims) {
  const firstName = String(claims?.given_name || "").trim();
  const lastName = String(claims?.family_name || "").trim();

  if (firstName || lastName) {
    return {
      firstName: firstName || "SSO",
      lastName: lastName || "User",
    };
  }

  const fullName = String(claims?.name || "").trim();
  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    return {
      firstName: parts[0] || "SSO",
      lastName: parts.slice(1).join(" ") || "User",
    };
  }

  const email = String(claims?.email || claims?.preferred_username || claims?.upn || "").trim();
  if (email.includes("@")) {
    return {
      firstName: email.split("@")[0],
      lastName: "User",
    };
  }

  return {
    firstName: "SSO",
    lastName: "User",
  };
}

function getSsoIdentity(claims) {
  const issuer = String(claims?.iss || "").trim();
  const subject = String(claims?.sub || "").trim();
  const email = String(claims?.email || claims?.preferred_username || claims?.upn || "")
    .trim()
    .toLowerCase();

  return {
    issuer,
    subject,
    email,
    groups: getIdentityGroups(claims),
    ...getUserNamesFromClaims(claims),
  };
}

function getSsoRoleForUser(settings, identity, isFirstLogin) {
  if (settings.sso.autoProvisionRoleMode === "identity_mapping") {
    const mappedRole = getIdentityRole(settings, { groups: identity.groups });
    if (mappedRole) {
      return mappedRole;
    }

    if (isFirstLogin) {
      throw createError("No matching SSO group mapping was found for this account.", 403);
    }
  }

  if (isFirstLogin) {
    return settings.sso.autoProvisionDefaultRole;
  }

  return null;
}

function shouldSyncSsoRole(settings, isFirstLogin) {
  if (settings.sso.autoProvisionRoleMode !== "identity_mapping") {
    return false;
  }

  if (isFirstLogin) {
    return true;
  }

  return settings.sso.roleSyncMode === "each_login";
}

function createRandomSecret() {
  return crypto.randomBytes(32).toString("base64url");
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

function normalizeLanguageInfo(language) {
  return {
    id: language.id,
    code: String(language.code || "").trim().toLowerCase(),
    label: String(language.label || "").trim(),
    origin: String(language.origin || "upload").trim(),
    libraryFile: language.library_file,
    isSource: Boolean(language.is_source),
    metadata: language.metadata_json || {},
    createdAt: language.created_at,
    updatedAt: language.updated_at,
    deletedAt: language.deleted_at,
    createdBy: language.created_by,
    updatedBy: language.updated_by,
  };
}

function countProgress(sourceEntries, translatedEntries) {
  const keys = Object.keys(sourceEntries);
  if (!keys.length) {
    return { completed: 0, total: 0, percent: 0 };
  }

  const completed = keys.filter((key) => String(translatedEntries[key] ?? "").trim() !== "").length;
  return {
    completed,
    total: keys.length,
    percent: Math.round((completed / keys.length) * 100),
  };
}

async function queryOne(text, params = [], client = pool) {
  const result = await client.query(text, params);
  return result.rows[0] || null;
}

async function countActiveAdmins(excludedUserId = null) {
  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM users
      WHERE deleted_at IS NULL
        AND role = 'admin'
        AND status = 'active'
        AND ($1::uuid IS NULL OR id <> $1)
    `,
    [excludedUserId],
  );
  return result.rows[0]?.count || 0;
}

async function ensureAdminRetention(existingUser, nextRole, nextStatus) {
  const removesAdminAccess =
    existingUser.role === "admin" && (nextRole !== "admin" || nextStatus !== "active");

  if (!removesAdminAccess) {
    return;
  }

  const remainingAdmins = await countActiveAdmins(existingUser.id);
  if (remainingAdmins < 1) {
    throw createError("At least one active admin must remain.", 400);
  }
}

async function getAppSettings(client = pool) {
  const row = await queryOne(
    `
      SELECT
        allow_registration,
        allow_project_delete,
        allow_language_delete,
        sso_enabled,
        sso_provider,
        sso_issuer_url,
        sso_client_id,
        sso_client_secret,
        sso_scopes,
        sso_password_login_enabled,
        sso_auto_provision_enabled,
        sso_auto_provision_role_mode,
        sso_auto_provision_default_role,
        sso_role_sync_mode,
        sso_admin_group,
        sso_editor_group,
        sso_viewer_group,
        updated_at
      FROM app_settings
      WHERE id = TRUE
    `,
    [],
    client,
  );

  return {
    allowRegistration: Boolean(row?.allow_registration),
    allowProjectDelete: Boolean(row?.allow_project_delete),
    allowLanguageDelete: Boolean(row?.allow_language_delete),
    sso: {
      enabled: Boolean(row?.sso_enabled),
      provider: row?.sso_provider || "",
      issuerUrl: row?.sso_issuer_url || "",
      clientId: row?.sso_client_id || "",
      clientSecret: row?.sso_client_secret || "",
      scopes: row?.sso_scopes || "openid profile email",
      passwordLoginEnabled: Boolean(row?.sso_password_login_enabled ?? true),
      autoProvisionEnabled: Boolean(row?.sso_auto_provision_enabled),
      autoProvisionRoleMode:
        row?.sso_auto_provision_role_mode === "identity_mapping" ? "identity_mapping" : "default_role",
      autoProvisionDefaultRole: roleRank[row?.sso_auto_provision_default_role]
        ? row.sso_auto_provision_default_role
        : "viewer",
      roleSyncMode: row?.sso_role_sync_mode === "each_login" ? "each_login" : "first_login",
      roleMappings: {
        admin: row?.sso_admin_group || "",
        editor: row?.sso_editor_group || "",
        viewer: row?.sso_viewer_group || "",
      },
    },
    updatedAt: row?.updated_at || null,
  };
}

const oidcMetadataCache = new Map();

async function getOidcMetadata(issuerUrl) {
  const normalizedIssuer = String(issuerUrl || "").trim().replace(/\/+$/g, "");
  if (!normalizedIssuer) {
    throw createError("The SSO issuer URL is required.", 400);
  }

  const cached = oidcMetadataCache.get(normalizedIssuer);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.metadata;
  }

  const discoveryUrl = `${normalizedIssuer}/.well-known/openid-configuration`;
  const response = await fetch(discoveryUrl);
  if (!response.ok) {
    throw createError("The SSO issuer discovery document could not be loaded.", 502);
  }

  const metadata = await response.json();
  if (!metadata?.authorization_endpoint || !metadata?.token_endpoint || !metadata?.jwks_uri) {
    throw createError("The SSO issuer metadata is missing required OpenID Connect endpoints.", 502);
  }

  oidcMetadataCache.set(normalizedIssuer, {
    metadata,
    expiresAt: Date.now() + 1000 * 60 * 10,
  });

  return metadata;
}

async function exchangeAuthorizationCode(metadata, params) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
    client_id: params.clientId,
  });

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (params.clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${params.clientId}:${params.clientSecret}`, "utf8").toString("base64")}`;
  }

  const response = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers,
    body,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw createError(payload?.error_description || "The SSO token exchange failed.", 502);
  }

  if (!payload?.id_token) {
    throw createError("The SSO provider did not return an ID token.", 502);
  }

  return payload;
}

async function verifyIdToken(metadata, tokenSet, expected) {
  const { createRemoteJWKSet, jwtVerify } = await import("jose");
  const jwks = createRemoteJWKSet(new URL(metadata.jwks_uri));
  const result = await jwtVerify(tokenSet.id_token, jwks, {
    issuer: expected.issuer,
    audience: expected.clientId,
  });

  if (expected.nonce && result.payload?.nonce !== expected.nonce) {
    throw createError("The SSO response nonce did not match.", 400);
  }

  return result.payload;
}

async function resolveSsoUser(settings, claims, client = pool) {
  const identity = getSsoIdentity(claims);

  if (!identity.issuer || !identity.subject) {
    throw createError("The SSO provider response is missing the required subject information.", 400);
  }

  let user = await queryOne(
    `
      SELECT *
      FROM users
      WHERE sso_issuer = $1
        AND sso_subject = $2
        AND deleted_at IS NULL
    `,
    [identity.issuer, identity.subject],
    client,
  );

  const isFirstLogin = !user;

  if (!user && identity.email) {
    user = await queryOne(
      `
        SELECT *
        FROM users
        WHERE LOWER(email) = LOWER($1)
          AND deleted_at IS NULL
      `,
      [identity.email],
      client,
    );
  }

  if (!user) {
    if (!settings.sso.autoProvisionEnabled) {
      throw createError("Your account is not provisioned, and automatic SSO provisioning is disabled.", 403);
    }

    if (!identity.email) {
      throw createError("The SSO provider did not return an email address for this account.", 403);
    }

    const role = getSsoRoleForUser(settings, identity, true);
    const passwordHash = await hashPassword(createRandomSecret());
    user = await queryOne(
      `
        INSERT INTO users (
          id,
          first_name,
          last_name,
          email,
          password_hash,
          role,
          status,
          sso_issuer,
          sso_subject
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8)
        RETURNING *
      `,
      [
        crypto.randomUUID(),
        identity.firstName,
        identity.lastName,
        identity.email,
        passwordHash,
        role,
        identity.issuer,
        identity.subject,
      ],
      client,
    );
  } else {
    if (user.status !== "active") {
      throw createError("This account is inactive. Please contact an administrator.", 403);
    }

    const updates = [];
    const values = [user.id];
    let index = values.length + 1;

    if (user.sso_issuer !== identity.issuer) {
      updates.push(`sso_issuer = $${index}`);
      values.push(identity.issuer);
      index += 1;
    }

    if (user.sso_subject !== identity.subject) {
      updates.push(`sso_subject = $${index}`);
      values.push(identity.subject);
      index += 1;
    }

    const shouldUpdateNames =
      user.first_name !== identity.firstName || user.last_name !== identity.lastName || user.email !== identity.email;
    if (shouldUpdateNames && identity.email) {
      updates.push(`first_name = $${index}`, `last_name = $${index + 1}`, `email = $${index + 2}`);
      values.push(identity.firstName, identity.lastName, identity.email);
      index += 3;
    }

    if (shouldSyncSsoRole(settings, !user.sso_subject || !user.sso_issuer)) {
      const mappedRole = getSsoRoleForUser(settings, identity, !user.sso_subject || !user.sso_issuer);
      if (mappedRole && mappedRole !== user.role) {
        updates.push(`role = $${index}`);
        values.push(mappedRole);
        index += 1;
      }
    }

    updates.push(`updated_at = NOW()`);
    if (updates.length > 1) {
      user = await queryOne(
        `
          UPDATE users
          SET ${updates.join(", ")}
          WHERE id = $1
          RETURNING *
        `,
        values,
        client,
      );
    } else {
      await client.query("UPDATE users SET updated_at = NOW() WHERE id = $1", [user.id]);
      user.updated_at = new Date().toISOString();
    }
  }

  return user;
}

async function loadCurrentUser(req, _res, next) {
  const payload = verifySession(req.cookies?.[SESSION_COOKIE]);
  if (!payload?.sub) {
    req.currentUser = null;
    next();
    return;
  }

  const user = await queryOne(
    `
      SELECT *
      FROM users
      WHERE id = $1
        AND deleted_at IS NULL
        AND status = 'active'
    `,
    [payload.sub],
  );

  req.currentUser = user || null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.currentUser) {
    res.status(401).json({ message: "Please sign in to continue." });
    return;
  }

  next();
}

function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.currentUser) {
      res.status(401).json({ message: "Please sign in to continue." });
      return;
    }

    if ((roleRank[req.currentUser.role] || 0) < (roleRank[minRole] || 0)) {
      res.status(403).json({ message: "You do not have permission to do that." });
      return;
    }

    next();
  };
}

async function requireDeleteSetting(kind, req, res, next) {
  const settings = await getAppSettings();
  const allowed = kind === "project" ? settings.allowProjectDelete : settings.allowLanguageDelete;
  if (!allowed) {
    res.status(403).json({ message: `Deleting ${kind}s is currently disabled in app settings.` });
    return;
  }
  await next();
}

async function listLibraryFiles() {
  await ensureDirs();
  const entries = await fs.readdir(LIBRARY_DIR, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const fullPath = path.join(LIBRARY_DIR, entry.name);
    const stats = await fs.stat(fullPath);
    files.push({
      fileName: entry.name,
      label: entry.name.replace(/\.json$/i, ""),
      size: stats.size,
      updatedAt: stats.mtime.toISOString(),
    });
  }

  return files.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function saveLibraryFile(buffer, preferredName) {
  const safeBase = slugify(preferredName) || `file-${Date.now()}`;
  const fileName = `${safeBase}-${crypto.randomUUID().slice(0, 8)}.json`;
  const filePath = path.join(LIBRARY_DIR, fileName);
  const parsed = parseJsonBuffer(buffer);
  await writeJsonFile(filePath, parsed);
  return {
    fileName,
    json: parsed,
  };
}

async function readLibraryFile(fileName) {
  const filePath = path.join(LIBRARY_DIR, fileName);
  const exists = await fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    throw createError("The selected library file was not found.", 404);
  }

  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getProjectRow(projectId, client = pool) {
  const project = await queryOne(
    `
      SELECT *
      FROM projects
      WHERE id = $1
        AND deleted_at IS NULL
    `,
    [projectId],
    client,
  );

  if (!project) {
    throw createError("The selected project was not found.", 404);
  }

  return project;
}

async function getProjectLanguages(projectId, client = pool) {
  const result = await client.query(
    `
      SELECT *
      FROM languages
      WHERE project_id = $1
        AND deleted_at IS NULL
      ORDER BY code ASC
    `,
    [projectId],
  );

  return result.rows;
}

async function getLanguageRow(projectId, languageCode, client = pool) {
  const row = await queryOne(
    `
      SELECT *
      FROM languages
      WHERE project_id = $1
        AND code = $2
        AND deleted_at IS NULL
    `,
    [projectId, String(languageCode || "").trim().toLowerCase()],
    client,
  );

  if (!row) {
    throw createError("The selected language does not exist in this project.", 404);
  }

  return row;
}

async function getTranslationEntries(projectId, languageId, client = pool) {
  const result = await client.query(
    `
      SELECT translation_key, value_text
      FROM translations
      WHERE project_id = $1
        AND language_id = $2
        AND deleted_at IS NULL
      ORDER BY translation_key ASC
    `,
    [projectId, languageId],
  );

  return Object.fromEntries(result.rows.map((row) => [row.translation_key, row.value_text ?? ""]));
}

async function getProjectData(projectId, client = pool) {
  const project = await getProjectRow(projectId, client);
  const languages = await getProjectLanguages(projectId, client);
  const entryMaps = {};

  for (const language of languages) {
    entryMaps[language.code] = await getTranslationEntries(projectId, language.id, client);
  }

  return {
    project,
    languages,
    entryMaps,
  };
}

function buildProjectConfig(project, languages) {
  return {
    id: project.id,
    name: project.name,
    description: project.description || "",
    version: project.version || "",
    sourceLanguage: project.source_language,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    languages: languages.map((language) => ({
      code: language.code,
      label: language.label,
      origin: language.origin,
      libraryFile: language.library_file,
    })),
  };
}

async function persistProjectConfig(projectId, userId, client) {
  const project = await getProjectRow(projectId, client);
  const languages = await getProjectLanguages(projectId, client);
  const config = buildProjectConfig(project, languages);

  await client.query(
    `
      UPDATE projects
      SET
        config_json = $2::jsonb,
        updated_at = NOW(),
        updated_by = $3
      WHERE id = $1
    `,
    [projectId, JSON.stringify(config), userId || null],
  );

  return config;
}

async function syncProjectFiles(projectId, client = pool) {
  const { project, languages, entryMaps } = await getProjectData(projectId, client);
  const projectDir = path.join(PROJECTS_DIR, project.id);
  const languagesDir = path.join(projectDir, "languages");

  await fs.mkdir(languagesDir, { recursive: true });
  await writeJsonFile(path.join(projectDir, "project.json"), buildProjectConfig(project, languages));

  const existingFiles = await fs.readdir(languagesDir).catch(() => []);
  const activeFiles = new Set();

  for (const language of languages) {
    const fileName = `${language.code}.json`;
    activeFiles.add(fileName);
    await writeJsonFile(path.join(languagesDir, fileName), unflattenJson(entryMaps[language.code] || {}));
  }

  await Promise.all(
    existingFiles
      .filter((fileName) => fileName.endsWith(".json") && !activeFiles.has(fileName))
      .map((fileName) => fs.rm(path.join(languagesDir, fileName), { force: true })),
  );
}

async function syncAllProjectFiles() {
  const result = await pool.query("SELECT id FROM projects WHERE deleted_at IS NULL ORDER BY created_at ASC");
  for (const row of result.rows) {
    await syncProjectFiles(row.id);
  }
}

async function removeProjectFiles(projectId) {
  await fs.rm(path.join(PROJECTS_DIR, projectId), { recursive: true, force: true });
}

async function createProjectVersion(projectId, userId, client) {
  const { project, languages, entryMaps } = await getProjectData(projectId, client);
  const revision = Number(project.current_revision || 0) + 1;
  const snapshot = {
    revision,
    project: buildProjectConfig(project, languages),
    languages: languages.map((language) => ({
      ...normalizeLanguageInfo(language),
      entries: entryMaps[language.code] || {},
    })),
  };

  await client.query(
    `
      INSERT INTO project_versions (
        id,
        project_id,
        revision,
        version_label,
        snapshot_json,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6)
    `,
    [crypto.randomUUID(), projectId, revision, project.version || "", JSON.stringify(snapshot), userId || null],
  );

  await client.query("UPDATE projects SET current_revision = $2 WHERE id = $1", [projectId, revision]);
  return revision;
}

async function buildProjectSummary(projectId, client = pool) {
  const { project, languages, entryMaps } = await getProjectData(projectId, client);
  const sourceEntries = entryMaps[project.source_language] || {};

  return {
    id: project.id,
    name: project.name,
    description: project.description || "",
    version: project.version || "",
    sourceLanguage: project.source_language,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    currentRevision: project.current_revision,
    languages: languages.map((language) => ({
      ...normalizeLanguageInfo(language),
      progress: countProgress(sourceEntries, entryMaps[language.code] || {}),
    })),
  };
}

async function listProjects() {
  const result = await pool.query(
    `
      SELECT id
      FROM projects
      WHERE deleted_at IS NULL
      ORDER BY updated_at DESC
    `,
  );

  const projects = [];
  for (const row of result.rows) {
    projects.push(await buildProjectSummary(row.id));
  }
  return projects;
}

async function upsertTranslations(projectId, language, entries, userId, client) {
  await client.query(
    `
      DELETE FROM translations
      WHERE project_id = $1
        AND language_id = $2
    `,
    [projectId, language.id],
  );

  const keys = Object.keys(entries);
  for (const key of keys) {
    await client.query(
      `
        INSERT INTO translations (
          id,
          project_id,
          language_id,
          translation_key,
          value_text,
          value_type,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, 'string', $6, $6)
      `,
      [crypto.randomUUID(), projectId, language.id, key, stringifyValue(entries[key]), userId || null],
    );
  }

  await client.query(
    `
      UPDATE languages
      SET
        updated_at = NOW(),
        updated_by = $3
      WHERE id = $1
        AND project_id = $2
    `,
    [language.id, projectId, userId || null],
  );
}

app.use(loadCurrentUser);

app.get("/api/bootstrap", async (req, res, next) => {
  try {
    res.json({
      user: sanitizeUser(req.currentUser),
      settings: await getAppSettings(),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/sso/start", async (req, res) => {
  const returnTo = normalizeReturnTo(req.query.returnTo || "/");

  try {
    const settings = await getAppSettings();
    if (!settings.sso.enabled) {
      return res.redirect(`/sso-status?reason=${encodeURIComponent("not-configured")}`);
    }

    if (!settings.sso.issuerUrl || !settings.sso.clientId) {
      return res.redirect(`/sso-status?reason=${encodeURIComponent("not-configured")}`);
    }

    const metadata = await getOidcMetadata(settings.sso.issuerUrl);
    const state = crypto.randomBytes(24).toString("base64url");
    const nonce = crypto.randomBytes(24).toString("base64url");
    const codeVerifier = crypto.randomBytes(48).toString("base64url");
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
    const redirectUri = getSsoCallbackUrl(req);
    const transaction = signToken({
      type: "sso",
      state,
      nonce,
      codeVerifier,
      returnTo,
      exp: Date.now() + 1000 * 60 * 10,
    });

    res.cookie(SSO_TRANSACTION_COOKIE, transaction, {
      httpOnly: true,
      sameSite: "lax",
      secure: SESSION_COOKIE_SECURE,
      maxAge: 1000 * 60 * 10,
    });

    const authorizationUrl = new URL(metadata.authorization_endpoint);
    authorizationUrl.searchParams.set("client_id", settings.sso.clientId);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("scope", settings.sso.scopes || "openid profile email");
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("nonce", nonce);
    authorizationUrl.searchParams.set("code_challenge", codeChallenge);
    authorizationUrl.searchParams.set("code_challenge_method", "S256");

    return res.redirect(authorizationUrl.toString());
  } catch (error) {
    console.error(error);
    return res.redirect(`/sso-status?reason=${encodeURIComponent("signin-failed")}`);
  }
});

app.get("/api/auth/sso/callback", async (req, res) => {
  const clearTransactionCookie = () => {
    res.clearCookie(SSO_TRANSACTION_COOKIE, {
      httpOnly: true,
      sameSite: "lax",
      secure: SESSION_COOKIE_SECURE,
    });
  };

  try {
    const transaction = verifyToken(req.cookies?.[SSO_TRANSACTION_COOKIE]);
    clearTransactionCookie();

    if (!transaction || transaction.type !== "sso") {
      return res.redirect(`/sso-status?reason=${encodeURIComponent("session-expired")}`);
    }

    if (req.query.error) {
      return res.redirect(`/sso-status?reason=${encodeURIComponent("signin-failed")}`);
    }

    const code = String(req.query.code || "").trim();
    const state = String(req.query.state || "").trim();

    if (!code || !state || state !== transaction.state) {
      return res.redirect(`/sso-status?reason=${encodeURIComponent("state-mismatch")}`);
    }

    const settings = await getAppSettings();
    const metadata = await getOidcMetadata(settings.sso.issuerUrl);
    const tokenSet = await exchangeAuthorizationCode(metadata, {
      code,
      redirectUri: getSsoCallbackUrl(req),
      codeVerifier: transaction.codeVerifier,
      clientId: settings.sso.clientId,
      clientSecret: settings.sso.clientSecret,
    });
    const claims = await verifyIdToken(metadata, tokenSet, {
      issuer: String(metadata.issuer || settings.sso.issuerUrl).trim(),
      clientId: settings.sso.clientId,
      nonce: transaction.nonce,
    });

    const user = await withTransaction((client) => resolveSsoUser(settings, claims, client));
    const token = signSession({
      sub: user.id,
      role: user.role,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    });

    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: SESSION_COOKIE_SECURE,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return res.redirect(normalizeReturnTo(transaction.returnTo));
  } catch (error) {
    console.error(error);
    const message = String(error?.message || "");
    let reason = "signin-failed";

    if (message.includes("inactive")) {
      reason = "inactive";
    } else if (message.includes("automatic SSO provisioning is disabled")) {
      reason = "provisioning-disabled";
    } else if (message.includes("email address")) {
      reason = "missing-email";
    } else if (message.includes("group mapping")) {
      reason = "role-mapping-missing";
    }

    return res.redirect(`/sso-status?reason=${encodeURIComponent(reason)}`);
  }
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const settings = await getAppSettings();
    if (!settings.allowRegistration) {
      return res.status(403).json({ message: "New user registration is currently disabled." });
    }
    if (!settings.sso.passwordLoginEnabled) {
      return res.status(403).json({ message: "Email/password sign-up is disabled. Please use SSO." });
    }

    const firstName = String(req.body.firstName || "").trim();
    const lastName = String(req.body.lastName || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "First name, last name, email, and password are required." });
    }

    const existing = await queryOne(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL",
      [email],
    );
    if (existing) {
      return res.status(409).json({ message: "An account with that email already exists." });
    }

    const passwordHash = await hashPassword(password);
    const user = await queryOne(
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
        VALUES ($1, $2, $3, $4, $5, 'viewer', 'active')
        RETURNING *
      `,
      [crypto.randomUUID(), firstName, lastName, email, passwordHash],
    );

    res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const settings = await getAppSettings();
    if (!settings.sso.passwordLoginEnabled) {
      return res.status(403).json({ message: "Email/password sign-in is disabled. Please use SSO." });
    }

    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const user = await queryOne(
      `
        SELECT *
        FROM users
        WHERE LOWER(email) = LOWER($1)
          AND deleted_at IS NULL
      `,
      [email],
    );

    if (!user) {
      return res.status(401).json({ message: "The email or password is incorrect." });
    }

    if (user.status !== "active") {
      return res.status(403).json({ message: "This account is inactive. Please contact an administrator." });
    }

    if (!(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ message: "The email or password is incorrect." });
    }

    await pool.query("UPDATE users SET updated_at = NOW() WHERE id = $1", [user.id]);
    const token = signSession({
      sub: user.id,
      role: user.role,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    });

    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: SESSION_COOKIE_SECURE,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    res.json({ user: sanitizeUser(user), settings: await getAppSettings() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: SESSION_COOKIE_SECURE,
  });
  res.status(204).end();
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: sanitizeUser(req.currentUser) });
});

app.patch("/api/auth/profile", requireAuth, async (req, res, next) => {
  try {
    const firstName = String(req.body.firstName || "").trim();
    const lastName = String(req.body.lastName || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ message: "First name, last name, and email are required." });
    }

    const existing = await queryOne(
      `
        SELECT id
        FROM users
        WHERE LOWER(email) = LOWER($1)
          AND deleted_at IS NULL
          AND id <> $2
      `,
      [email, req.currentUser.id],
    );

    if (existing) {
      return res.status(409).json({ message: "An account with that email already exists." });
    }

    const user = await queryOne(
      `
        UPDATE users
        SET
          first_name = $2,
          last_name = $3,
          email = $4,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [req.currentUser.id, firstName, lastName, email],
    );

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/change-password", requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required." });
    }

    if (!(await verifyPassword(currentPassword, req.currentUser.password_hash))) {
      return res.status(401).json({ message: "The current password is incorrect." });
    }

    const passwordHash = await hashPassword(newPassword);
    const user = await queryOne(
      `
        UPDATE users
        SET password_hash = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [req.currentUser.id, passwordHash],
    );

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/users", requireRole("admin"), async (_req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT *
        FROM users
        WHERE deleted_at IS NULL
        ORDER BY created_at ASC
      `,
    );
    res.json(result.rows.map(sanitizeUser));
  } catch (error) {
    next(error);
  }
});

app.post("/api/users", requireRole("admin"), async (req, res, next) => {
  try {
    const firstName = String(req.body.firstName || "").trim();
    const lastName = String(req.body.lastName || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = String(req.body.role || "viewer").trim().toLowerCase();
    const status = String(req.body.status || "active").trim().toLowerCase();

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "All user fields are required." });
    }

    if (!roleRank[role]) {
      return res.status(400).json({ message: "Please select a valid role." });
    }

    const passwordHash = await hashPassword(password);
    const user = await queryOne(
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
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [crypto.randomUUID(), firstName, lastName, email, passwordHash, role, status],
    );

    res.status(201).json(sanitizeUser(user));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/users/:userId", requireRole("admin"), async (req, res, next) => {
  try {
    const existing = await queryOne("SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL", [req.params.userId]);
    if (!existing) {
      return res.status(404).json({ message: "The selected user was not found." });
    }

    const firstName = typeof req.body.firstName === "string" ? req.body.firstName.trim() : existing.first_name;
    const lastName = typeof req.body.lastName === "string" ? req.body.lastName.trim() : existing.last_name;
    const email =
      typeof req.body.email === "string" && req.body.email.trim()
        ? req.body.email.trim().toLowerCase()
        : existing.email;
    const role = roleRank[req.body.role] ? req.body.role : existing.role;
    const status = ["active", "invited", "disabled"].includes(req.body.status) ? req.body.status : existing.status;
    const passwordHash = req.body.password ? await hashPassword(String(req.body.password)) : existing.password_hash;
    await ensureAdminRetention(existing, role, status);

    const user = await queryOne(
      `
        UPDATE users
        SET
          first_name = $2,
          last_name = $3,
          email = $4,
          role = $5,
          status = $6,
          password_hash = $7,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [req.params.userId, firstName, lastName, email, role, status, passwordHash],
    );

    res.json(sanitizeUser(user));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/users/:userId/role", requireRole("admin"), async (req, res, next) => {
  try {
    const existing = await queryOne("SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL", [req.params.userId]);
    if (!existing) {
      return res.status(404).json({ message: "The selected user was not found." });
    }

    const role = roleRank[req.body.role] ? req.body.role : "";
    if (!role) {
      return res.status(400).json({ message: "Please select a valid role." });
    }

    await ensureAdminRetention(existing, role, existing.status);

    const user = await queryOne(
      `
        UPDATE users
        SET role = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [req.params.userId, role],
    );

    res.json(sanitizeUser(user));
  } catch (error) {
    next(error);
  }
});

app.post("/api/users/:userId/reset-password", requireRole("admin"), async (req, res, next) => {
  try {
    const existing = await queryOne("SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL", [req.params.userId]);
    if (!existing) {
      return res.status(404).json({ message: "The selected user was not found." });
    }

    const password = String(req.body.password || "");
    if (!password) {
      return res.status(400).json({ message: "A new password is required." });
    }

    const passwordHash = await hashPassword(password);
    const user = await queryOne(
      `
        UPDATE users
        SET password_hash = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [req.params.userId, passwordHash],
    );

    res.json(sanitizeUser(user));
  } catch (error) {
    next(error);
  }
});

app.post("/api/users/:userId/deactivate", requireRole("admin"), async (req, res, next) => {
  try {
    const existing = await queryOne("SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL", [req.params.userId]);
    if (!existing) {
      return res.status(404).json({ message: "The selected user was not found." });
    }

    await ensureAdminRetention(existing, existing.role, "disabled");

    const user = await queryOne(
      `
        UPDATE users
        SET status = 'disabled', updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [req.params.userId],
    );

    res.json(sanitizeUser(user));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/users/:userId", requireRole("admin"), async (req, res, next) => {
  try {
    const existing = await queryOne("SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL", [req.params.userId]);
    if (!existing) {
      return res.status(404).json({ message: "The selected user was not found." });
    }

    await ensureAdminRetention(existing, "viewer", "disabled");

    await pool.query(
      `
        UPDATE users
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [req.params.userId],
    );

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings/app", requireRole("admin"), async (_req, res, next) => {
  try {
    const settings = await getAppSettings();
    res.json({
      allowRegistration: settings.allowRegistration,
      allowProjectDelete: settings.allowProjectDelete,
      allowLanguageDelete: settings.allowLanguageDelete,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/settings/app", requireRole("admin"), async (req, res, next) => {
  try {
    await pool.query(
      `
        UPDATE app_settings
        SET
          allow_registration = $1,
          allow_project_delete = $2,
          allow_language_delete = $3,
          updated_at = NOW()
        WHERE id = TRUE
      `,
      [
        Boolean(req.body.allowRegistration),
        Boolean(req.body.allowProjectDelete),
        Boolean(req.body.allowLanguageDelete),
      ],
    );

    res.json(await getAppSettings());
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings/sso", requireRole("admin"), async (_req, res, next) => {
  try {
    res.json((await getAppSettings()).sso);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/settings/sso", requireRole("admin"), async (req, res, next) => {
  try {
    const enabled = Boolean(req.body.enabled);
    const provider = String(req.body.provider || "").trim();
    const issuerUrl = String(req.body.issuerUrl || "").trim();
    const clientId = String(req.body.clientId || "").trim();
    const clientSecret = String(req.body.clientSecret || "").trim();
    const scopes = String(req.body.scopes || "").trim();
    const autoProvisionRoleMode =
      req.body.autoProvisionRoleMode === "identity_mapping" ? "identity_mapping" : "default_role";
    const autoProvisionDefaultRole = roleRank[req.body.autoProvisionDefaultRole]
      ? req.body.autoProvisionDefaultRole
      : "viewer";
    const roleSyncMode = req.body.roleSyncMode === "each_login" ? "each_login" : "first_login";

    if (enabled && !provider) {
      throw createError("The SSO provider name is required.", 400);
    }
    if (enabled && !issuerUrl) {
      throw createError("The SSO issuer URL is required.", 400);
    }
    if (enabled && !clientId) {
      throw createError("The SSO client ID is required.", 400);
    }
    if (enabled && !clientSecret) {
      throw createError("The SSO client secret is required.", 400);
    }
    if (enabled && !scopes) {
      throw createError("The SSO scopes are required.", 400);
    }

    await pool.query(
      `
        UPDATE app_settings
        SET
          sso_enabled = $1,
          sso_provider = $2,
          sso_issuer_url = $3,
          sso_client_id = $4,
          sso_client_secret = $5,
          sso_scopes = $6,
          sso_password_login_enabled = $7,
          sso_auto_provision_enabled = $8,
          sso_auto_provision_role_mode = $9,
          sso_auto_provision_default_role = $10,
          sso_role_sync_mode = $11,
          sso_admin_group = $12,
          sso_editor_group = $13,
          sso_viewer_group = $14,
          updated_at = NOW()
        WHERE id = TRUE
      `,
      [
        enabled,
        provider,
        issuerUrl,
        clientId,
        clientSecret,
        scopes,
        Boolean(req.body.passwordLoginEnabled ?? true),
        Boolean(req.body.autoProvisionEnabled),
        autoProvisionRoleMode,
        autoProvisionDefaultRole,
        roleSyncMode,
        String(req.body.roleMappings?.admin || "").trim(),
        String(req.body.roleMappings?.editor || "").trim(),
        String(req.body.roleMappings?.viewer || "").trim(),
      ],
    );

    res.json((await getAppSettings()).sso);
  } catch (error) {
    next(error);
  }
});

app.get("/api/library", requireAuth, async (_req, res, next) => {
  try {
    res.json(await listLibraryFiles());
  } catch (error) {
    next(error);
  }
});

app.post("/api/library/upload", requireRole("editor"), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please upload a JSON file." });
    }

    const saved = await saveLibraryFile(req.file.buffer, req.body.name || req.file.originalname);
    res.status(201).json({
      fileName: saved.fileName,
      label: saved.fileName.replace(/\.json$/i, ""),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects", requireAuth, async (_req, res, next) => {
  try {
    res.json(await listProjects());
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects", requireRole("editor"), upload.single("sourceFile"), async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim();
    const version = String(req.body.version || "").trim();
    const sourceLanguage = String(req.body.sourceLanguage || "").trim().toLowerCase();
    const sourceLabel = String(req.body.sourceLabel || sourceLanguage.toUpperCase()).trim();
    const sourceMode = String(req.body.sourceMode || "upload").trim();

    if (!name || !sourceLanguage) {
      return res.status(400).json({ message: "Project name and source language are required." });
    }

    let sourceJson;
    let libraryFile = null;

    if (sourceMode === "library") {
      if (!req.body.sourceLibraryFile) {
        return res.status(400).json({ message: "Please select a library file." });
      }
      sourceJson = await readLibraryFile(req.body.sourceLibraryFile);
      libraryFile = req.body.sourceLibraryFile;
    } else {
      if (!req.file) {
        return res.status(400).json({ message: "Please upload a source JSON file." });
      }
      const saved = await saveLibraryFile(req.file.buffer, req.body.sourceFileName || req.file.originalname);
      sourceJson = saved.json;
      libraryFile = saved.fileName;
    }

    const projectId = crypto.randomUUID();
    const sourceEntries = Object.fromEntries(
      Object.entries(flattenJson(sourceJson)).map(([key, value]) => [key, stringifyValue(value)]),
    );

    await withTransaction(async (client) => {
      await client.query(
        `
          INSERT INTO projects (
            id,
            name,
            description,
            version,
            source_language,
            config_json,
            current_revision,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, '{}'::jsonb, 0, $6, $6)
        `,
        [projectId, name, description, version, sourceLanguage, req.currentUser.id],
      );

      const languageId = crypto.randomUUID();
      await client.query(
        `
          INSERT INTO languages (
            id,
            project_id,
            code,
            label,
            origin,
            library_file,
            metadata_json,
            is_source,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, TRUE, $7, $7)
        `,
        [languageId, projectId, sourceLanguage, sourceLabel, sourceMode, libraryFile, req.currentUser.id],
      );

      await upsertTranslations(
        projectId,
        { id: languageId },
        sourceEntries,
        req.currentUser.id,
        client,
      );
      await persistProjectConfig(projectId, req.currentUser.id, client);
      await createProjectVersion(projectId, req.currentUser.id, client);
    });

    await syncProjectFiles(projectId);
    res.status(201).json(await buildProjectSummary(projectId));
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects/:projectId", requireAuth, async (req, res, next) => {
  try {
    res.json(await buildProjectSummary(req.params.projectId));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/projects/:projectId", requireRole("editor"), async (req, res, next) => {
  try {
    await withTransaction(async (client) => {
      const project = await getProjectRow(req.params.projectId, client);
      const languages = await getProjectLanguages(req.params.projectId, client);
      const nextSourceLanguage =
        typeof req.body.sourceLanguage === "string" && req.body.sourceLanguage.trim()
          ? req.body.sourceLanguage.trim().toLowerCase()
          : project.source_language;

      if (!languages.some((language) => language.code === nextSourceLanguage)) {
        throw createError("The selected language does not exist in this project.", 404);
      }

      await client.query(
        `
          UPDATE projects
          SET
            name = $2,
            description = $3,
            version = $4,
            source_language = $5,
            updated_at = NOW(),
            updated_by = $6
          WHERE id = $1
        `,
        [
          req.params.projectId,
          typeof req.body.name === "string" && req.body.name.trim() ? req.body.name.trim() : project.name,
          typeof req.body.description === "string" ? req.body.description.trim() : project.description,
          typeof req.body.version === "string" ? req.body.version.trim() : project.version,
          nextSourceLanguage,
          req.currentUser.id,
        ],
      );

      await client.query(
        `
          UPDATE languages
          SET is_source = (code = $2)
          WHERE project_id = $1
        `,
        [req.params.projectId, nextSourceLanguage],
      );

      await persistProjectConfig(req.params.projectId, req.currentUser.id, client);
      await createProjectVersion(req.params.projectId, req.currentUser.id, client);
    });

    await syncProjectFiles(req.params.projectId);
    res.json(await buildProjectSummary(req.params.projectId));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/projects/:projectId", requireRole("editor"), async (req, res, next) => {
  try {
    await requireDeleteSetting("project", req, res, async () => {
      await pool.query(
        `
          UPDATE projects
          SET
            deleted_at = NOW(),
            updated_at = NOW(),
            updated_by = $2
          WHERE id = $1
        `,
        [req.params.projectId, req.currentUser.id],
      );
      await removeProjectFiles(req.params.projectId);
      res.status(204).end();
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects/:projectId/versions", requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT id, revision, version_label, created_by, created_at
        FROM project_versions
        WHERE project_id = $1
        ORDER BY revision DESC
      `,
      [req.params.projectId],
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:projectId/languages", requireRole("editor"), upload.single("file"), async (req, res, next) => {
  try {
    const code = String(req.body.code || "").trim().toLowerCase();
    const label = String(req.body.label || code.toUpperCase()).trim();
    const mode = String(req.body.mode || "empty").trim();

    if (!code) {
      return res.status(400).json({ message: "Language code is required." });
    }

    await withTransaction(async (client) => {
      const project = await getProjectRow(req.params.projectId, client);
      const languages = await getProjectLanguages(req.params.projectId, client);
      if (languages.some((language) => language.code === code)) {
        throw createError("That language already exists in the project.", 409);
      }

      const sourceLanguage = languages.find((language) => language.code === project.source_language);
      const sourceEntries = await getTranslationEntries(req.params.projectId, sourceLanguage.id, client);

      let entries = Object.fromEntries(Object.keys(sourceEntries).map((key) => [key, ""]));
      let libraryFile = null;

      if (mode === "library") {
        if (!req.body.libraryFile) {
          throw createError("Please select a library file.");
        }
        libraryFile = req.body.libraryFile;
        const fileJson = await readLibraryFile(libraryFile);
        const flattened = flattenJson(fileJson);
        entries = Object.fromEntries(Object.keys(sourceEntries).map((key) => [key, stringifyValue(flattened[key] ?? "")]));
      } else if (mode === "upload") {
        if (!req.file) {
          throw createError("Please upload a JSON file.");
        }
        const saved = await saveLibraryFile(req.file.buffer, req.body.fileName || req.file.originalname);
        libraryFile = saved.fileName;
        const flattened = flattenJson(saved.json);
        entries = Object.fromEntries(Object.keys(sourceEntries).map((key) => [key, stringifyValue(flattened[key] ?? "")]));
      }

      const language = {
        id: crypto.randomUUID(),
      };

      await client.query(
        `
          INSERT INTO languages (
            id,
            project_id,
            code,
            label,
            origin,
            library_file,
            metadata_json,
            is_source,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, FALSE, $7, $7)
        `,
        [language.id, req.params.projectId, code, label, mode, libraryFile, req.currentUser.id],
      );

      await upsertTranslations(req.params.projectId, language, entries, req.currentUser.id, client);
      await persistProjectConfig(req.params.projectId, req.currentUser.id, client);
      await createProjectVersion(req.params.projectId, req.currentUser.id, client);
    });

    await syncProjectFiles(req.params.projectId);
    res.status(201).json(await buildProjectSummary(req.params.projectId));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/projects/:projectId/languages/:languageCode", requireRole("editor"), async (req, res, next) => {
  try {
    await requireDeleteSetting("language", req, res, async () => {
      await withTransaction(async (client) => {
        const project = await getProjectRow(req.params.projectId, client);
        const language = await getLanguageRow(req.params.projectId, req.params.languageCode, client);

        if (project.source_language === language.code) {
          throw createError("The source language cannot be deleted.");
        }

        await client.query(
          `
            UPDATE languages
            SET
              deleted_at = NOW(),
              updated_at = NOW(),
              updated_by = $3
            WHERE id = $1
              AND project_id = $2
          `,
          [language.id, req.params.projectId, req.currentUser.id],
        );

        await persistProjectConfig(req.params.projectId, req.currentUser.id, client);
        await createProjectVersion(req.params.projectId, req.currentUser.id, client);
      });

      await syncProjectFiles(req.params.projectId);
      res.json(await buildProjectSummary(req.params.projectId));
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/projects/:projectId/source", requireRole("editor"), async (req, res, next) => {
  try {
    const languageCode = String(req.body.languageCode || "").trim().toLowerCase();
    await withTransaction(async (client) => {
      await getLanguageRow(req.params.projectId, languageCode, client);
      await client.query(
        `
          UPDATE projects
          SET
            source_language = $2,
            updated_at = NOW(),
            updated_by = $3
          WHERE id = $1
        `,
        [req.params.projectId, languageCode, req.currentUser.id],
      );
      await client.query(
        `
          UPDATE languages
          SET is_source = (code = $2)
          WHERE project_id = $1
        `,
        [req.params.projectId, languageCode],
      );

      await persistProjectConfig(req.params.projectId, req.currentUser.id, client);
      await createProjectVersion(req.params.projectId, req.currentUser.id, client);
    });

    await syncProjectFiles(req.params.projectId);
    res.json(await buildProjectSummary(req.params.projectId));
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects/:projectId/languages/:languageCode", requireAuth, async (req, res, next) => {
  try {
    const project = await getProjectRow(req.params.projectId);
    const sourceLanguage = await getLanguageRow(req.params.projectId, project.source_language);
    const targetLanguage = await getLanguageRow(req.params.projectId, req.params.languageCode);
    const sourceEntries = await getTranslationEntries(req.params.projectId, sourceLanguage.id);
    const translationEntries = await getTranslationEntries(req.params.projectId, targetLanguage.id);

    const rows = Object.keys(sourceEntries)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => ({
        key,
        source: sourceEntries[key] ?? "",
        translation: translationEntries[key] ?? "",
      }));

    res.json({
      projectId: req.params.projectId,
      sourceLanguage: project.source_language,
      languageCode: targetLanguage.code,
      rows,
      progress: countProgress(sourceEntries, translationEntries),
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/projects/:projectId/languages/:languageCode", requireRole("editor"), async (req, res, next) => {
  try {
    await withTransaction(async (client) => {
      const project = await getProjectRow(req.params.projectId, client);
      const sourceLanguage = await getLanguageRow(req.params.projectId, project.source_language, client);
      const targetLanguage = await getLanguageRow(req.params.projectId, req.params.languageCode, client);
      const sourceEntries = await getTranslationEntries(req.params.projectId, sourceLanguage.id, client);
      const submittedEntries = req.body.entries || {};
      const safeEntries = Object.fromEntries(
        Object.keys(sourceEntries).map((key) => [key, String(submittedEntries[key] ?? "")]),
      );

      await upsertTranslations(req.params.projectId, targetLanguage, safeEntries, req.currentUser.id, client);
      await persistProjectConfig(req.params.projectId, req.currentUser.id, client);
      await createProjectVersion(req.params.projectId, req.currentUser.id, client);
    });

    await syncProjectFiles(req.params.projectId);
    const project = await getProjectRow(req.params.projectId);
    const sourceLanguage = await getLanguageRow(req.params.projectId, project.source_language);
    const targetLanguage = await getLanguageRow(req.params.projectId, req.params.languageCode);
    const sourceEntries = await getTranslationEntries(req.params.projectId, sourceLanguage.id);
    const translationEntries = await getTranslationEntries(req.params.projectId, targetLanguage.id);

    res.json({
      ok: true,
      progress: countProgress(sourceEntries, translationEntries),
    });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/projects/:projectId/languages/:languageCode/upload",
  requireRole("editor"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Please upload a JSON file." });
      }

      const saved = await saveLibraryFile(req.file.buffer, req.body.fileName || req.file.originalname);
      const flattened = flattenJson(saved.json);

      await withTransaction(async (client) => {
        const project = await getProjectRow(req.params.projectId, client);
        const sourceLanguage = await getLanguageRow(req.params.projectId, project.source_language, client);
        const targetLanguage = await getLanguageRow(req.params.projectId, req.params.languageCode, client);
        const sourceEntries = await getTranslationEntries(req.params.projectId, sourceLanguage.id, client);
        const safeEntries = Object.fromEntries(
          Object.keys(sourceEntries).map((key) => [key, stringifyValue(flattened[key] ?? "")]),
        );

        await upsertTranslations(req.params.projectId, targetLanguage, safeEntries, req.currentUser.id, client);
        await client.query(
          `
            UPDATE languages
            SET
              origin = 'upload',
              library_file = $3,
              updated_at = NOW(),
              updated_by = $4
            WHERE id = $1
              AND project_id = $2
          `,
          [targetLanguage.id, req.params.projectId, saved.fileName, req.currentUser.id],
        );

        await persistProjectConfig(req.params.projectId, req.currentUser.id, client);
        await createProjectVersion(req.params.projectId, req.currentUser.id, client);
      });

      await syncProjectFiles(req.params.projectId);
      res.json(await buildProjectSummary(req.params.projectId));
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/projects/:projectId/download/:languageCode", requireAuth, async (req, res, next) => {
  try {
    await syncProjectFiles(req.params.projectId);
    const project = await getProjectRow(req.params.projectId);
    const language = await getLanguageRow(req.params.projectId, req.params.languageCode);
    const downloadName = `${slugify(project.name)}-${language.code}.json`;
    res.download(path.join(PROJECTS_DIR, req.params.projectId, "languages", `${language.code}.json`), downloadName);
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects/:projectId/download-all", requireAuth, async (req, res, next) => {
  try {
    await syncProjectFiles(req.params.projectId);
    const project = await getProjectRow(req.params.projectId);
    const languages = await getProjectLanguages(req.params.projectId);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${slugify(project.name) || project.id}-translations.zip"`,
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", next);
    archive.pipe(res);

    for (const language of languages) {
      archive.file(path.join(PROJECTS_DIR, req.params.projectId, "languages", `${language.code}.json`), {
        name: `${language.code}.json`,
      });
    }

    await archive.finalize();
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error?.code === "23505") {
    return res.status(409).json({
      message: "That value already exists and must be unique.",
    });
  }
  res.status(error.statusCode || 500).json({
    message: error.exposeMessage || "Something went wrong while processing the request.",
  });
});

async function start() {
  await ensureDirs();
  await syncAllProjectFiles();

  if (fssync.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(DIST_DIR, "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`localize server listening on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
