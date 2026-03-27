"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_DIRECTORY_CANDIDATES = [
  "languages",
  "locales",
  "translations",
  "i18n",
  "src/languages",
  "src/locales",
  "src/translations",
  "src/i18n",
  "public/languages",
  "public/locales",
];

function printHelp() {
  console.log(`Push translation JSON files and update the Localize project version.

Usage:
  node scripts/push-translations.js --project-id <id> --api-key <key> --version <version> --languages <codes>

Options:
  --project-id <id>         Localize project id
  --api-key <key>           Localize API key with update scope
  --version <version>       Project version to store after successful uploads
  --languages <codes>       Comma-separated language codes, e.g. de,en,fr
  --base-url <url>          Localize base URL, defaults to LOCALIZE_BASE_URL or PUBLIC_APP_URL
  --translations-dir <dir>  Directory with <language>.json files
  --dry-run                 Validate files and show what would be uploaded
  --help                    Show this help

Environment:
  LOCALIZE_BASE_URL
  LOCALIZE_PROJECT_ID
  LOCALIZE_API_KEY
  LOCALIZE_VERSION
  LOCALIZE_LANGUAGE_CODES
  LOCALIZE_TRANSLATIONS_DIR
`);
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (token === "--help" || token === "-h") {
      options.help = true;
      continue;
    }

    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const name = token.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}`);
    }

    options[name] = value;
    index += 1;
  }

  return options;
}

function normalizeLanguageCodes(value) {
  return String(value || "")
    .split(",")
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function detectTranslationsDir(explicitDir) {
  if (explicitDir) {
    return path.resolve(explicitDir);
  }

  for (const candidate of DEFAULT_DIRECTORY_CANDIDATES) {
    const resolved = path.resolve(candidate);
    if (await pathExists(resolved)) {
      return resolved;
    }
  }

  return path.resolve("languages");
}

async function readTranslationFile(translationsDir, languageCode) {
  const filePath = path.join(translationsDir, `${languageCode}.json`);
  const raw = await fs.readFile(filePath, "utf8").catch((error) => {
    if (error && error.code === "ENOENT") {
      throw new Error(`Translation file not found for "${languageCode}": ${filePath}`);
    }

    throw error;
  });

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }

  if (parsed === null || typeof parsed !== "object") {
    throw new Error(`Translation file must contain a JSON object or array: ${filePath}`);
  }

  return {
    filePath,
    entries: parsed,
  };
}

async function parseApiResponse(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function formatErrorPayload(payload) {
  if (!payload) {
    return "";
  }

  if (typeof payload === "string") {
    return payload;
  }

  if (payload && typeof payload.message === "string") {
    return payload.message;
  }

  return JSON.stringify(payload);
}

async function requestJson({ url, method, apiKey, body }) {
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  const payload = await parseApiResponse(response);

  if (!response.ok) {
    const details = formatErrorPayload(payload);
    throw new Error(`${method} ${url} failed with ${response.status}${details ? `: ${details}` : ""}`);
  }

  return payload;
}

async function main() {
  if (typeof fetch !== "function") {
    throw new Error("This script requires a Node.js runtime with global fetch support.");
  }

  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const projectId = String(args["project-id"] || process.env.LOCALIZE_PROJECT_ID || "").trim();
  const apiKey = String(args["api-key"] || process.env.LOCALIZE_API_KEY || "").trim();
  const version = String(args.version || process.env.LOCALIZE_VERSION || "").trim();
  const baseUrl = String(args["base-url"] || process.env.LOCALIZE_BASE_URL || process.env.PUBLIC_APP_URL || "").trim();
  const languageCodes = normalizeLanguageCodes(args.languages || process.env.LOCALIZE_LANGUAGE_CODES);
  const translationsDir = await detectTranslationsDir(
    args["translations-dir"] || process.env.LOCALIZE_TRANSLATIONS_DIR || "",
  );

  if (!projectId || !apiKey || !version || !baseUrl || languageCodes.length === 0) {
    printHelp();
    throw new Error(
      "Missing required configuration. project id, api key, version, base URL, and at least one language code are required.",
    );
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/g, "");
  const uniqueLanguageCodes = [...new Set(languageCodes)];
  const files = [];

  for (const languageCode of uniqueLanguageCodes) {
    files.push(await readTranslationFile(translationsDir, languageCode));
  }

  console.log(`Using translations directory: ${translationsDir}`);
  console.log(`Project: ${projectId}`);
  console.log(`Languages: ${uniqueLanguageCodes.join(", ")}`);

  if (args.dryRun) {
    for (const file of files) {
      console.log(`Validated ${path.basename(file.filePath)}`);
    }
    console.log(`Dry run complete. Version "${version}" would be uploaded last.`);
    return;
  }

  for (const [index, languageCode] of uniqueLanguageCodes.entries()) {
    const file = files[index];
    console.log(`Uploading ${languageCode} from ${file.filePath}`);

    await requestJson({
      url: `${normalizedBaseUrl}/api/key/projects/${encodeURIComponent(projectId)}/languages/${encodeURIComponent(languageCode)}`,
      method: "PUT",
      apiKey,
      body: { entries: file.entries },
    });
  }

  console.log(`Updating project version to ${version}`);
  await requestJson({
    url: `${normalizedBaseUrl}/api/key/projects/${encodeURIComponent(projectId)}/version`,
    method: "PATCH",
    apiKey,
    body: { version },
  });

  console.log("Translations uploaded successfully.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
