const express = require("express");
const multer = require("multer");
const fs = require("node:fs/promises");
const fssync = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const archiver = require("archiver");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const PORT = Number(process.env.PORT || 3001);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");
const LIBRARY_DIR = path.join(DATA_DIR, "library");
const DIST_DIR = path.join(process.cwd(), "dist");

app.use(express.json({ limit: "10mb" }));

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function projectPath(projectId) {
  return path.join(PROJECTS_DIR, projectId);
}

function projectConfigPath(projectId) {
  return path.join(projectPath(projectId), "project.json");
}

function languagePath(projectId, code) {
  return path.join(projectPath(projectId), "languages", `${code}.json`);
}

async function ensureDirs() {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  await fs.mkdir(LIBRARY_DIR, { recursive: true });
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

function countProgress(sourceEntries, translatedEntries) {
  const keys = Object.keys(sourceEntries);
  if (!keys.length) {
    return { completed: 0, total: 0, percent: 0 };
  }

  const completed = keys.filter((key) => {
    const value = translatedEntries[key];
    return value !== undefined && value !== null && String(value).trim() !== "";
  }).length;

  return {
    completed,
    total: keys.length,
    percent: Math.round((completed / keys.length) * 100),
  };
}

function parseJsonBuffer(buffer) {
  let parsed;
  try {
    parsed = JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    error.statusCode = 400;
    error.exposeMessage = "The uploaded file is not valid JSON.";
    throw error;
  }

  if (!isPlainObject(parsed) && !Array.isArray(parsed)) {
    const error = new Error("Only JSON objects and arrays are supported.");
    error.statusCode = 400;
    error.exposeMessage = error.message;
    throw error;
  }

  return parsed;
}

async function writeJsonFile(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJsonFile(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
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
  await ensureDirs();
  const safeBase = slugify(preferredName) || `file-${Date.now()}`;
  const fileName = `${safeBase}-${crypto.randomUUID().slice(0, 8)}.json`;
  const filePath = path.join(LIBRARY_DIR, fileName);
  const parsed = parseJsonBuffer(buffer);
  await writeJsonFile(filePath, parsed);
  return { fileName, json: parsed };
}

async function copyLibraryFileToProject(projectId, libraryFileName, languageCode) {
  const sourcePath = path.join(LIBRARY_DIR, libraryFileName);
  const exists = await fs
    .access(sourcePath)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    const error = new Error("The selected library file was not found.");
    error.statusCode = 404;
    error.exposeMessage = error.message;
    throw error;
  }

  const json = await readJsonFile(sourcePath);
  await writeJsonFile(languagePath(projectId, languageCode), json);
  return json;
}

async function readProject(projectId) {
  const configPath = projectConfigPath(projectId);
  const config = await readJsonFile(configPath);
  const normalized = normalizeProjectConfig(projectId, config);

  if (JSON.stringify(config) !== JSON.stringify(normalized)) {
    await writeJsonFile(configPath, normalized);
  }

  return normalized;
}

async function writeProject(project) {
  const normalized = normalizeProjectConfig(project.id, project);
  normalized.updatedAt = new Date().toISOString();
  await writeJsonFile(projectConfigPath(normalized.id), normalized);
  Object.assign(project, normalized);
}

async function getProjectSummary(project) {
  const sourceJson = await readJsonFile(languagePath(project.id, project.sourceLanguage));
  const sourceEntries = flattenJson(sourceJson);
  const languages = await Promise.all(
    project.languages.map(async (language) => {
      const translationJson = await readJsonFile(languagePath(project.id, language.code));
      const progress = countProgress(sourceEntries, flattenJson(translationJson));
      return {
        ...language,
        progress,
        isSource: language.code === project.sourceLanguage,
      };
    }),
  );

  return {
    id: project.id,
    name: project.name,
    description: project.description || "",
    version: project.version || "",
    sourceLanguage: project.sourceLanguage,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    languages,
  };
}

async function listProjects() {
  await ensureDirs();
  const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    try {
      const project = await readProject(entry.name);
      projects.push(await getProjectSummary(project));
    } catch (error) {
      console.warn(`Skipping broken project ${entry.name}`, error);
    }
  }

  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function buildLanguageInfo(code, label, origin, libraryFile = null) {
  return {
    code,
    label: label || code.toUpperCase(),
    origin,
    libraryFile,
  };
}

function normalizeLanguageInfo(language) {
  const code = String(language?.code || "").trim().toLowerCase();
  return {
    code,
    label: String(language?.label || code.toUpperCase()).trim(),
    origin: String(language?.origin || "upload").trim(),
    libraryFile: language?.libraryFile ? String(language.libraryFile).trim() : null,
  };
}

function normalizeProjectConfig(projectId, config) {
  const languages = Array.isArray(config?.languages) ? config.languages.map(normalizeLanguageInfo) : [];
  const sourceLanguage = String(config?.sourceLanguage || languages[0]?.code || "")
    .trim()
    .toLowerCase();

  return {
    id: String(config?.id || projectId).trim(),
    name: String(config?.name || projectId).trim(),
    description: String(config?.description || "").trim(),
    version: String(config?.version || "").trim(),
    sourceLanguage,
    createdAt: config?.createdAt || new Date().toISOString(),
    updatedAt: config?.updatedAt || new Date().toISOString(),
    languages,
  };
}

async function deletePath(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

app.get("/api/library", async (_req, res, next) => {
  try {
    res.json(await listLibraryFiles());
  } catch (error) {
    next(error);
  }
});

app.post("/api/library/upload", upload.single("file"), async (req, res, next) => {
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

app.get("/api/projects", async (_req, res, next) => {
  try {
    res.json(await listProjects());
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects", upload.single("sourceFile"), async (req, res, next) => {
  try {
    const { name, description, version, sourceLanguage, sourceLabel, sourceMode, sourceLibraryFile } = req.body;

    if (!name || !sourceLanguage) {
      return res.status(400).json({ message: "Project name and source language are required." });
    }

    const projectId = `${slugify(name) || "project"}-${crypto.randomUUID().slice(0, 8)}`;
    const project = {
      id: projectId,
      name,
      description: String(description || "").trim(),
      version: String(version || "").trim(),
      sourceLanguage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      languages: [],
    };

    let sourceJson;
    let libraryFile = null;

    if (sourceMode === "library") {
      if (!sourceLibraryFile) {
        return res.status(400).json({ message: "Please select a library file." });
      }
      sourceJson = await copyLibraryFileToProject(projectId, sourceLibraryFile, sourceLanguage);
      libraryFile = sourceLibraryFile;
    } else {
      if (!req.file) {
        return res.status(400).json({ message: "Please upload a source JSON file." });
      }
      const saved = await saveLibraryFile(req.file.buffer, req.body.sourceFileName || req.file.originalname);
      sourceJson = saved.json;
      libraryFile = saved.fileName;
      await writeJsonFile(languagePath(projectId, sourceLanguage), sourceJson);
    }

    project.sourceLanguage = sourceLanguage;
    project.languages.push(buildLanguageInfo(sourceLanguage, sourceLabel, sourceMode || "upload", libraryFile));
    await writeProject(project);
    res.status(201).json(await getProjectSummary(project));
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects/:projectId", async (req, res, next) => {
  try {
    const project = await readProject(req.params.projectId);
    res.json(await getProjectSummary(project));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/projects/:projectId", async (req, res, next) => {
  try {
    const project = await readProject(req.params.projectId);
    const { name, description, version, sourceLanguage } = req.body;

    if (typeof name === "string" && name.trim()) {
      project.name = name.trim();
    }

    if (typeof description === "string") {
      project.description = description.trim();
    }

    if (typeof version === "string") {
      project.version = version.trim();
    }

    if (typeof sourceLanguage === "string" && sourceLanguage.trim()) {
      if (!project.languages.some((language) => language.code === sourceLanguage)) {
        return res.status(404).json({ message: "The selected language does not exist in this project." });
      }
      project.sourceLanguage = sourceLanguage.trim();
    }

    await writeProject(project);
    res.json(await getProjectSummary(project));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/projects/:projectId", async (req, res, next) => {
  try {
    await deletePath(projectPath(req.params.projectId));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:projectId/languages", upload.single("file"), async (req, res, next) => {
  try {
    const project = await readProject(req.params.projectId);
    const { code, label, mode, libraryFile } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Language code is required." });
    }

    if (project.languages.some((language) => language.code === code)) {
      return res.status(409).json({ message: "That language already exists in the project." });
    }

    const sourceJson = await readJsonFile(languagePath(project.id, project.sourceLanguage));
    const sourceEntries = flattenJson(sourceJson);
    let targetJson;
    let linkedLibraryFile = null;

    if (mode === "library") {
      if (!libraryFile) {
        return res.status(400).json({ message: "Please select a library file." });
      }
      targetJson = await copyLibraryFileToProject(project.id, libraryFile, code);
      linkedLibraryFile = libraryFile;
    } else if (mode === "upload") {
      if (!req.file) {
        return res.status(400).json({ message: "Please upload a JSON file." });
      }
      const saved = await saveLibraryFile(req.file.buffer, req.body.fileName || req.file.originalname);
      targetJson = saved.json;
      linkedLibraryFile = saved.fileName;
      await writeJsonFile(languagePath(project.id, code), targetJson);
    } else {
      const blankEntries = Object.fromEntries(Object.keys(sourceEntries).map((key) => [key, ""]));
      targetJson = unflattenJson(blankEntries);
      await writeJsonFile(languagePath(project.id, code), targetJson);
    }

    project.languages.push(buildLanguageInfo(code, label, mode || "empty", linkedLibraryFile));
    await writeProject(project);
    res.status(201).json(await getProjectSummary(project));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/projects/:projectId/languages/:languageCode", async (req, res, next) => {
  try {
    const project = await readProject(req.params.projectId);
    const { languageCode } = req.params;

    if (!project.languages.some((language) => language.code === languageCode)) {
      return res.status(404).json({ message: "The selected language does not exist in this project." });
    }

    if (project.sourceLanguage === languageCode) {
      return res.status(400).json({ message: "The source language cannot be deleted." });
    }

    project.languages = project.languages.filter((language) => language.code !== languageCode);
    await deletePath(languagePath(project.id, languageCode));
    await writeProject(project);
    res.json(await getProjectSummary(project));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/projects/:projectId/source", async (req, res, next) => {
  try {
    const project = await readProject(req.params.projectId);
    const languageCode = req.body.languageCode;

    if (!project.languages.some((language) => language.code === languageCode)) {
      return res.status(404).json({ message: "The selected language does not exist in this project." });
    }

    project.sourceLanguage = languageCode;
    await writeProject(project);
    res.json(await getProjectSummary(project));
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects/:projectId/languages/:languageCode", async (req, res, next) => {
  try {
    const project = await readProject(req.params.projectId);
    const sourceJson = await readJsonFile(languagePath(project.id, project.sourceLanguage));
    const sourceEntries = flattenJson(sourceJson);
    const translationJson = await readJsonFile(languagePath(project.id, req.params.languageCode));
    const translationEntries = flattenJson(translationJson);

    const rows = Object.keys(sourceEntries)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => ({
        key,
        source: sourceEntries[key] ?? "",
        translation: translationEntries[key] ?? "",
      }));

    res.json({
      projectId: project.id,
      sourceLanguage: project.sourceLanguage,
      languageCode: req.params.languageCode,
      rows,
      progress: countProgress(sourceEntries, translationEntries),
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/projects/:projectId/languages/:languageCode", async (req, res, next) => {
  try {
    const project = await readProject(req.params.projectId);
    const sourceJson = await readJsonFile(languagePath(project.id, project.sourceLanguage));
    const sourceEntries = flattenJson(sourceJson);
    const entries = req.body.entries || {};
    const safeEntries = Object.fromEntries(
      Object.keys(sourceEntries).map((key) => [key, entries[key] ?? ""]),
    );

    await writeJsonFile(languagePath(project.id, req.params.languageCode), unflattenJson(safeEntries));
    res.json({ ok: true, progress: countProgress(sourceEntries, safeEntries) });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/projects/:projectId/languages/:languageCode/upload",
  upload.single("file"),
  async (req, res, next) => {
    try {
      const project = await readProject(req.params.projectId);
      const language = project.languages.find((item) => item.code === req.params.languageCode);

      if (!language) {
        return res.status(404).json({ message: "The selected language does not exist in this project." });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Please upload a JSON file." });
      }

      const saved = await saveLibraryFile(req.file.buffer, req.body.fileName || req.file.originalname);
      await writeJsonFile(languagePath(project.id, req.params.languageCode), saved.json);

      language.origin = "upload";
      language.libraryFile = saved.fileName;
      await writeProject(project);

      res.json(await getProjectSummary(project));
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/projects/:projectId/download/:languageCode", async (req, res, next) => {
  try {
    const project = await readProject(req.params.projectId);
    const filePath = languagePath(project.id, req.params.languageCode);
    const language = project.languages.find((item) => item.code === req.params.languageCode);
    const downloadName = `${slugify(project.name)}-${language?.code || req.params.languageCode}.json`;
    res.download(filePath, downloadName);
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects/:projectId/download-all", async (req, res, next) => {
  try {
    const project = await readProject(req.params.projectId);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${slugify(project.name) || project.id}-translations.zip"`,
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", next);
    archive.pipe(res);

    for (const language of project.languages) {
      archive.file(languagePath(project.id, language.code), { name: `${language.code}.json` });
    }

    await archive.finalize();
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    message: error.exposeMessage || "Something went wrong while processing the request.",
  });
});

async function start() {
  await ensureDirs();

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
