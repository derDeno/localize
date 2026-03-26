import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";

const languageMeta = {
  ar: { flag: "🇸🇦", name: "Arabic" },
  bg: { flag: "🇧🇬", name: "Bulgarian" },
  cs: { flag: "🇨🇿", name: "Czech" },
  da: { flag: "🇩🇰", name: "Danish" },
  de: { flag: "🇩🇪", name: "German" },
  el: { flag: "🇬🇷", name: "Greek" },
  en: { flag: "🇬🇧", name: "English" },
  es: { flag: "🇪🇸", name: "Spanish" },
  et: { flag: "🇪🇪", name: "Estonian" },
  fi: { flag: "🇫🇮", name: "Finnish" },
  fr: { flag: "🇫🇷", name: "French" },
  he: { flag: "🇮🇱", name: "Hebrew" },
  hi: { flag: "🇮🇳", name: "Hindi" },
  hu: { flag: "🇭🇺", name: "Hungarian" },
  it: { flag: "🇮🇹", name: "Italian" },
  ja: { flag: "🇯🇵", name: "Japanese" },
  ko: { flag: "🇰🇷", name: "Korean" },
  nl: { flag: "🇳🇱", name: "Dutch" },
  no: { flag: "🇳🇴", name: "Norwegian" },
  pl: { flag: "🇵🇱", name: "Polish" },
  pt: { flag: "🇵🇹", name: "Portuguese" },
  ro: { flag: "🇷🇴", name: "Romanian" },
  ru: { flag: "🇷🇺", name: "Russian" },
  sk: { flag: "🇸🇰", name: "Slovak" },
  sl: { flag: "🇸🇮", name: "Slovenian" },
  sv: { flag: "🇸🇪", name: "Swedish" },
  tr: { flag: "🇹🇷", name: "Turkish" },
  uk: { flag: "🇺🇦", name: "Ukrainian" },
  zh: { flag: "🇨🇳", name: "Chinese" },
};

const initialProjectForm = {
  name: "",
  sourceLanguage: "en",
  sourceLabel: "English",
};

function languageDisplay(code, fallbackLabel) {
  const normalized = String(code || "").toLowerCase();
  const meta = languageMeta[normalized];
  return {
    code: normalized,
    flag: meta?.flag || "🌐",
    label: fallbackLabel || meta?.name || normalized.toUpperCase(),
  };
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, options);
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(body?.message || "Request failed.");
  }

  return body;
}

function progressLabel(progress) {
  return `${progress.percent}% · ${progress.completed}/${progress.total}`;
}

function getSystemTheme() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const [themePreference, setThemePreference] = useState(() => localStorage.getItem("localize-theme"));
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const [toast, setToast] = useState(null);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isProjectFileHovering, setIsProjectFileHovering] = useState(false);
  const [projectForm, setProjectForm] = useState(initialProjectForm);
  const [projectFile, setProjectFile] = useState(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const theme = themePreference || systemTheme || "light";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    setSystemTheme(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  function showToast(kind, text) {
    setToast({
      id: `${Date.now()}-${Math.random()}`,
      kind,
      text,
    });
  }

  function resetProjectDialog() {
    setProjectForm(initialProjectForm);
    setProjectFile(null);
    setIsProjectFileHovering(false);
  }

  function openCreateDialog() {
    resetProjectDialog();
    setIsCreateDialogOpen(true);
  }

  function closeCreateDialog() {
    setIsCreateDialogOpen(false);
    resetProjectDialog();
  }

  function handleProjectFileSelection(file) {
    if (!file) {
      return;
    }

    setProjectFile(file);
  }

  async function handleCreateProject(event) {
    event.preventDefault();

    if (!projectFile) {
      showToast("error", "Please select a source file.");
      return;
    }

    setIsCreatingProject(true);

    try {
      const formData = new FormData();
      formData.set("name", projectForm.name);
      formData.set("sourceLanguage", projectForm.sourceLanguage.trim().toLowerCase());
      formData.set(
        "sourceLabel",
        projectForm.sourceLabel.trim() || projectForm.sourceLanguage.toUpperCase(),
      );
      formData.set("sourceMode", "upload");
      formData.set(
        "sourceFileName",
        projectFile?.name || `${projectForm.name}-${projectForm.sourceLanguage}`,
      );

      if (projectFile) {
        formData.set("sourceFile", projectFile);
      }

      const created = await apiFetch("/api/projects", {
        method: "POST",
        body: formData,
      });

      closeCreateDialog();
      setRefreshSeed((current) => current + 1);
      showToast("success", "Project created.");
      navigate(`/projects/${created.id}`);
    } catch (error) {
      showToast("error", error.message);
    } finally {
      setIsCreatingProject(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img src="/icon.svg" alt="localize icon" className="brand-icon" />
          <div>
            <p className="eyebrow">i18n workspace</p>
            <h1>localize</h1>
          </div>
        </div>

        <nav className="topbar-menu" aria-label="Primary">
          <Link className="menu-link" to="/">
            Dashboard
          </Link>
        </nav>

        <div className="topbar-actions">
          <label className="theme-switch">
            <span>{theme === "dark" ? "Dark" : "Light"}</span>
            <button
              type="button"
              className="switch"
              aria-label="Toggle dark mode"
              onClick={() => {
                const nextTheme = theme === "dark" ? "light" : "dark";
                setThemePreference(nextTheme);
                localStorage.setItem("localize-theme", nextTheme);
              }}
            >
              <span className="switch-thumb" />
            </button>
          </label>

          <button className="primary-button" type="button" onClick={openCreateDialog}>
            <span className="button-icon" aria-hidden="true">
              ＋
            </span>
            Create project
          </button>
        </div>
      </header>

      {toast && (
        <div className={`toast ${toast.kind}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}

      <main className="page-shell">
        <Routes>
          <Route
            path="/"
            element={<DashboardPage refreshSeed={refreshSeed} onCreateProject={openCreateDialog} />}
          />
          <Route
            path="/projects/:projectId"
            element={<ProjectPage onNotify={showToast} />}
          />
          <Route
            path="/projects/:projectId/languages/:languageCode/edit"
            element={<EditorPage onNotify={showToast} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {isCreateDialogOpen && (
        <div className="dialog-backdrop" onClick={closeCreateDialog}>
          <div className="dialog panel" onClick={(event) => event.stopPropagation()}>
            <div className="dialog-header">
              <div>
                <p className="eyebrow">New project</p>
                <h2>Create project</h2>
              </div>
              <button className="ghost-button" type="button" onClick={closeCreateDialog}>
                Close
              </button>
            </div>

            <form className="stack-form" onSubmit={handleCreateProject}>
              <label>
                <span>Name</span>
                <input
                  required
                  value={projectForm.name}
                  onChange={(event) =>
                    setProjectForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>

              <label>
                <span>Source language</span>
                <select
                  value={projectForm.sourceLanguage}
                  onChange={(event) => {
                    const nextCode = event.target.value;
                    setProjectForm((current) => ({
                      ...current,
                      sourceLanguage: nextCode,
                      sourceLabel: languageDisplay(nextCode).label,
                    }));
                  }}
                >
                  {Object.entries(languageMeta).map(([code, meta]) => (
                    <option key={code} value={code}>
                      {meta.flag} {meta.name} ({code.toUpperCase()})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Source file</span>
                <div
                  className={`dropzone ${isProjectFileHovering ? "hover" : ""}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsProjectFileHovering(true);
                  }}
                  onDragLeave={() => setIsProjectFileHovering(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsProjectFileHovering(false);
                    handleProjectFileSelection(event.dataTransfer.files?.[0] || null);
                  }}
                >
                  <input
                    id="project-source-file"
                    type="file"
                    accept=".json,application/json"
                    onChange={(event) => handleProjectFileSelection(event.target.files?.[0] || null)}
                  />
                  <label htmlFor="project-source-file" className="dropzone-content">
                    <strong>{projectFile ? projectFile.name : "Drop JSON file here"}</strong>
                    <span>{projectFile ? "Click to replace it." : "or click to browse your files."}</span>
                  </label>
                </div>
              </label>

              <button className="primary-button" disabled={isCreatingProject} type="submit">
                {isCreatingProject ? "Creating..." : "Create"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardPage({ refreshSeed, onCreateProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProjects() {
      setLoading(true);
      setError("");

      try {
        const nextProjects = await apiFetch("/api/projects");
        if (active) {
          setProjects(nextProjects);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProjects();

    return () => {
      active = false;
    };
  }, [refreshSeed]);

  return (
    <div className="page-stack">
      <section className="page-hero panel">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h2>Projects</h2>
          <p className="muted">Open a project card to manage languages and translations.</p>
        </div>
        <button className="primary-button" type="button" onClick={onCreateProject}>
          <span className="button-icon" aria-hidden="true">
            ＋
          </span>
          Create project
        </button>
      </section>

      {error && <InlineNotice kind="error" message={error} />}

      {loading ? (
        <section className="panel empty-state">
          <h3>Loading projects...</h3>
        </section>
      ) : projects.length === 0 ? (
        <section className="panel empty-state">
          <h3>No projects yet</h3>
          <p className="muted">Create your first project to start translating JSON files.</p>
        </section>
      ) : (
        <section className="cards-grid">
          {projects.map((project) => (
            <Link key={project.id} className="project-card panel" to={`/projects/${project.id}`}>
              <div className="card-top">
                <strong>{project.name}</strong>
                <span className="pill">{project.sourceLanguage.toUpperCase()}</span>
              </div>
              <p className="muted">{project.languages.length} languages</p>
              <div className="mini-flags">
                {project.languages.slice(0, 5).map((language) => (
                  <span key={language.code} title={language.label}>
                    {languageDisplay(language.code, language.label).flag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}

function ProjectPage({ onNotify }) {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState("");
  const [busy, setBusy] = useState(false);

  const availableLanguages = useMemo(() => {
    if (!project) {
      return [];
    }

    return Object.entries(languageMeta)
      .filter(([code]) => !project.languages.some((language) => language.code === code))
      .map(([code, meta]) => ({
        code,
        label: meta.name,
        flag: meta.flag,
      }));
  }, [project]);

  useEffect(() => {
    let active = true;

    async function loadProject() {
      setLoading(true);
      setError("");

      try {
        const details = await apiFetch(`/api/projects/${projectId}`);
        if (active) {
          setProject(details);
          setSelectedCode((current) => current || details.languages.find((language) => !language.isSource)?.code || "");
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProject();

    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!availableLanguages.length) {
      setSelectedCode("");
      return;
    }

    setSelectedCode((current) =>
      availableLanguages.some((language) => language.code === current) ? current : availableLanguages[0].code,
    );
  }, [availableLanguages]);

  async function handleCreateLanguage(event) {
    event.preventDefault();
    if (!selectedCode) {
      return;
    }

    setBusy(true);

    try {
      const formData = new FormData();
      formData.set("code", selectedCode);
      formData.set("label", languageDisplay(selectedCode).label);
      formData.set("mode", "empty");

      const updated = await apiFetch(`/api/projects/${projectId}/languages`, {
        method: "POST",
        body: formData,
      });

      setProject(updated);
      setIsDialogOpen(false);
      onNotify("success", "Language created.");
    } catch (requestError) {
      onNotify("error", requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="panel empty-state">
        <h3>Loading project...</h3>
      </section>
    );
  }

  if (error) {
    return <InlineNotice kind="error" message={error} />;
  }

  if (!project) {
    return null;
  }

  return (
    <>
      <div className="page-stack">
        <section className="page-hero panel">
          <div>
            <p className="eyebrow">Project details</p>
            <h2>{project.name}</h2>
            <p className="muted">
              Source language: <strong>{project.sourceLanguage.toUpperCase()}</strong>
            </p>
          </div>

          <div className="hero-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setIsDialogOpen(true)}
              disabled={!availableLanguages.length}
            >
              <span className="button-icon" aria-hidden="true">
                ＋
              </span>
              Create language
            </button>
            <a className="secondary-button" href={`/api/projects/${project.id}/download-all`}>
              <span className="button-icon" aria-hidden="true">
                ⭳
              </span>
              Download zip
            </a>
          </div>
        </section>

        {project.languages.length === 0 ? (
          <section className="panel empty-state">
            <h3>No languages yet</h3>
          </section>
        ) : (
          <section className="cards-grid">
            {project.languages.map((language) => {
              const display = languageDisplay(language.code, language.label);

              return (
                <article key={language.code} className="language-card panel">
                  <div className="card-top">
                    <div className="lang-title">
                      <span className="flag">{display.flag}</span>
                      <div>
                        <strong>{display.label}</strong>
                        <p className="muted code-label">{language.code.toUpperCase()}</p>
                      </div>
                    </div>
                    {language.isSource && <span className="pill">Source</span>}
                  </div>

                  <p className="muted">{progressLabel(language.progress)}</p>
                  <div className="progress-track">
                    <div
                      className="progress-bar"
                      style={{ width: `${language.progress.percent}%` }}
                    />
                  </div>

                  <div className="card-actions">
                    <Link
                      className="primary-button"
                      to={`/projects/${project.id}/languages/${language.code}/edit`}
                    >
                      <span className="button-icon" aria-hidden="true">
                        ✎
                      </span>
                      Edit
                    </Link>
                    <a
                      className="secondary-button"
                      href={`/api/projects/${project.id}/download/${language.code}`}
                    >
                      <span className="button-icon" aria-hidden="true">
                        ⭳
                      </span>
                      Download
                    </a>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>

      {isDialogOpen && (
        <div className="dialog-backdrop" onClick={() => setIsDialogOpen(false)}>
          <div className="dialog panel dialog-compact" onClick={(event) => event.stopPropagation()}>
            <div className="dialog-header">
              <div>
                <p className="eyebrow">Add language</p>
                <h2>Create language</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setIsDialogOpen(false)}>
                Close
              </button>
            </div>

            {availableLanguages.length === 0 ? (
              <div className="empty-state">
                <h3>All available languages already exist</h3>
              </div>
            ) : (
              <form className="stack-form" onSubmit={handleCreateLanguage}>
                <label>
                  <span>Language</span>
                  <select
                    value={selectedCode}
                    onChange={(event) => setSelectedCode(event.target.value)}
                  >
                    {availableLanguages.map((language) => (
                      <option key={language.code} value={language.code}>
                        {language.flag} {language.label} ({language.code.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </label>

                <button className="primary-button" disabled={busy} type="submit">
                  {busy ? "Creating..." : "Create"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function EditorPage({ onNotify }) {
  const { projectId, languageCode } = useParams();
  const [project, setProject] = useState(null);
  const [editorData, setEditorData] = useState(null);
  const [editorDraft, setEditorDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadEditorPage() {
      setLoading(true);
      setError("");

      try {
        const [projectDetails, editorDetails] = await Promise.all([
          apiFetch(`/api/projects/${projectId}`),
          apiFetch(`/api/projects/${projectId}/languages/${languageCode}`),
        ]);

        if (active) {
          setProject(projectDetails);
          setEditorData(editorDetails);
          setEditorDraft(
            Object.fromEntries(editorDetails.rows.map((row) => [row.key, row.translation ?? ""])),
          );
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadEditorPage();

    return () => {
      active = false;
    };
  }, [projectId, languageCode]);

  const editorLanguage = useMemo(
    () => project?.languages.find((language) => language.code === languageCode) || null,
    [project, languageCode],
  );

  async function handleSaveTranslations() {
    if (!editorData) {
      return;
    }

    setBusy(true);

    try {
      const result = await apiFetch(`/api/projects/${projectId}/languages/${languageCode}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: editorDraft }),
      });

      setEditorData((current) => (current ? { ...current, progress: result.progress } : current));
      onNotify("success", `Saved. ${progressLabel(result.progress)}`);
    } catch (requestError) {
      onNotify("error", requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="panel empty-state">
        <h3>Loading editor...</h3>
      </section>
    );
  }

  if (error) {
    return <InlineNotice kind="error" message={error} />;
  }

  if (!project || !editorData || !editorLanguage) {
    return null;
  }

  return (
    <section className="panel editor-panel">
      <div className="editor-header">
        <div>
          <p className="eyebrow">Translation editor</p>
          <h2 className="editor-title">
            <Link className="back-link" to={`/projects/${project.id}`}>
              ‹
            </Link>
            <span>
              {languageDisplay(editorLanguage.code, editorLanguage.label).flag} {editorLanguage.label}
            </span>
          </h2>
          <p className="muted">{progressLabel(editorData.progress)}</p>
        </div>

        <button className="primary-button" disabled={busy} type="button" onClick={handleSaveTranslations}>
          <span className="button-icon" aria-hidden="true">
            ✎
          </span>
          {busy ? "Saving..." : "Save progress"}
        </button>
      </div>

      <div className="editor-list">
        {editorData.rows.map((row) => (
          <div className="editor-row" key={row.key}>
            <label className="editor-field">
              <span className="field-key">{row.key}</span>
              <input readOnly value={String(row.source ?? "")} />
            </label>

            <label className="editor-field">
              <span className="field-key">Translation</span>
              <input
                value={editorDraft[row.key] ?? ""}
                onChange={(event) =>
                  setEditorDraft((current) => ({
                    ...current,
                    [row.key]: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}

function InlineNotice({ kind, message }) {
  return <div className={`inline-notice ${kind}`}>{message}</div>;
}

export default App;
