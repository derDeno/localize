import { useEffect, useMemo, useState } from "react";

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

const initialLanguageForm = {
  code: "",
  label: "",
  mode: "empty",
  libraryFile: "",
  fileName: "",
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

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("localize-theme") || "dark");
  const [projects, setProjects] = useState([]);
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedLanguageCode, setSelectedLanguageCode] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [editorData, setEditorData] = useState(null);
  const [projectForm, setProjectForm] = useState(initialProjectForm);
  const [projectFile, setProjectFile] = useState(null);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [languageForm, setLanguageForm] = useState(initialLanguageForm);
  const [languageFile, setLanguageFile] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isProjectFileHovering, setIsProjectFileHovering] = useState(false);
  const [editorDraft, setEditorDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || projectDetails,
    [projects, projectDetails, selectedProjectId],
  );

  const editorLanguage = selectedProject?.languages.find(
    (language) => language.code === selectedLanguageCode,
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("localize-theme", theme);
  }, [theme]);

  useEffect(() => {
    void refreshDashboard();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      void refreshProject(selectedProjectId);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    setProjectNameDraft(selectedProject?.name || "");
  }, [selectedProject?.id, selectedProject?.name]);

  useEffect(() => {
    if (selectedProjectId && selectedLanguageCode) {
      void loadEditor(selectedProjectId, selectedLanguageCode);
    }
  }, [selectedProjectId, selectedLanguageCode]);

  async function refreshDashboard() {
    try {
      const [nextProjects, nextLibrary] = await Promise.all([
        apiFetch("/api/projects"),
        apiFetch("/api/library"),
      ]);
      setProjects(nextProjects);
      setLibraryFiles(nextLibrary);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function refreshProject(projectId) {
    try {
      const details = await apiFetch(`/api/projects/${projectId}`);
      setProjectDetails(details);
      setProjects((current) => {
        const others = current.filter((project) => project.id !== details.id);
        return [details, ...others].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      });
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function loadEditor(projectId, languageCode) {
    try {
      const details = await apiFetch(`/api/projects/${projectId}/languages/${languageCode}`);
      setEditorData(details);
      setEditorDraft(
        Object.fromEntries(details.rows.map((row) => [row.key, row.translation ?? ""])),
      );
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  function resetProjectDialog() {
    setProjectForm(initialProjectForm);
    setProjectFile(null);
    setIsProjectFileHovering(false);
  }

  function openCreateDialog() {
    clearFeedback();
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
    clearFeedback();
    setBusy(true);

    try {
      const formData = new FormData();
      formData.set("name", projectForm.name);
      formData.set("sourceLanguage", projectForm.sourceLanguage.trim().toLowerCase());
      formData.set("sourceLabel", projectForm.sourceLabel.trim() || projectForm.sourceLanguage.toUpperCase());
      formData.set("sourceMode", "upload");
      formData.set("sourceFileName", projectFile?.name || `${projectForm.name}-${projectForm.sourceLanguage}`);

      if (projectFile) {
        formData.set("sourceFile", projectFile);
      }

      const created = await apiFetch("/api/projects", {
        method: "POST",
        body: formData,
      });

      setProjects((current) => [created, ...current.filter((project) => project.id !== created.id)]);
      setSelectedProjectId(created.id);
      setSelectedLanguageCode(null);
      closeCreateDialog();
      setMessage("Project created.");
      await refreshDashboard();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteProject(projectId) {
    clearFeedback();
    setBusy(true);

    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Could not delete the project.");
      }
      setProjects((current) => current.filter((project) => project.id !== projectId));
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null);
        setSelectedLanguageCode(null);
        setProjectDetails(null);
        setEditorData(null);
      }
      setMessage("Project deleted.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRenameProject(event) {
    event.preventDefault();
    if (!selectedProjectId || !projectNameDraft.trim()) {
      return;
    }

    clearFeedback();
    setBusy(true);

    try {
      const updated = await apiFetch(`/api/projects/${selectedProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectNameDraft.trim() }),
      });
      setProjectDetails(updated);
      setMessage("Project updated.");
      await refreshDashboard();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddLanguage(event) {
    event.preventDefault();
    if (!selectedProjectId) {
      return;
    }

    clearFeedback();
    setBusy(true);

    try {
      const formData = new FormData();
      formData.set("code", languageForm.code.trim().toLowerCase());
      formData.set("label", languageForm.label.trim() || languageForm.code.toUpperCase());
      formData.set("mode", languageForm.mode);
      formData.set("libraryFile", languageForm.libraryFile);
      formData.set("fileName", languageForm.fileName);

      if (languageFile) {
        formData.set("file", languageFile);
      }

      const updated = await apiFetch(`/api/projects/${selectedProjectId}/languages`, {
        method: "POST",
        body: formData,
      });

      setProjectDetails(updated);
      setLanguageForm(initialLanguageForm);
      setLanguageFile(null);
      setMessage("Language added.");
      await refreshDashboard();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveTranslations() {
    if (!selectedProjectId || !selectedLanguageCode) {
      return;
    }

    clearFeedback();
    setBusy(true);

    try {
      const result = await apiFetch(
        `/api/projects/${selectedProjectId}/languages/${selectedLanguageCode}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: editorDraft }),
        },
      );

      setEditorData((current) => (current ? { ...current, progress: result.progress } : current));
      setMessage(`Saved. ${progressLabel(result.progress)}`);
      await refreshProject(selectedProjectId);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSetSource(languageCode) {
    if (!selectedProjectId) {
      return;
    }

    clearFeedback();
    setBusy(true);

    try {
      const updated = await apiFetch(`/api/projects/${selectedProjectId}/source`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languageCode }),
      });
      setProjectDetails(updated);
      setSelectedLanguageCode(null);
      setEditorData(null);
      setMessage("Source language updated.");
      await refreshDashboard();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
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

        <div className="topbar-actions">
          <label className="theme-switch">
            <span>{theme === "dark" ? "Dark" : "Light"}</span>
            <button
              type="button"
              className="switch"
              aria-label="Toggle dark mode"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            >
              <span className="switch-thumb" />
            </button>
          </label>

          <button className="primary-button" type="button" onClick={openCreateDialog}>
            Create project
          </button>
        </div>
      </header>

      {(message || error) && (
        <div className={`banner ${error ? "error" : "success"}`}>{error || message}</div>
      )}

      <main className="dashboard">
        <section className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Dashboard</p>
              <h2>Projects</h2>
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="empty-state">
              <h3>No projects yet</h3>
              <p className="muted">Create your first project to start translating JSON files.</p>
            </div>
          ) : (
            <div className="project-grid">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={`project-tile ${project.id === selectedProjectId ? "active" : ""}`}
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    setSelectedLanguageCode(null);
                  }}
                >
                  <div className="project-tile-top">
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
                </button>
              ))}
            </div>
          )}
        </section>

        {selectedProject && (
          <>
            <section className="panel">
              <div className="project-header">
                <div>
                  <p className="eyebrow">Project details</p>
                  <h2>{selectedProject.name}</h2>
                  <p className="muted">
                    Source language: <strong>{selectedProject.sourceLanguage.toUpperCase()}</strong>
                  </p>
                </div>

                <div className="action-row">
                  <a
                    className="secondary-button"
                    href={`/api/projects/${selectedProject.id}/download-all`}
                  >
                    Download all
                  </a>
                  <button
                    className="danger-button"
                    disabled={busy}
                    type="button"
                    onClick={() => handleDeleteProject(selectedProject.id)}
                  >
                    Delete project
                  </button>
                </div>
              </div>

              <form className="rename-form" onSubmit={handleRenameProject}>
                <label>
                  <span>Project name</span>
                  <input
                    value={projectNameDraft}
                    onChange={(event) => setProjectNameDraft(event.target.value)}
                  />
                </label>
                <button className="secondary-button" disabled={busy} type="submit">
                  Save project
                </button>
              </form>

              <div className="lang-grid">
                {selectedProject.languages.map((language) => {
                  const display = languageDisplay(language.code, language.label);
                  return (
                    <article className="lang-card" key={language.code}>
                      <div className="lang-card-head">
                        <div>
                          <span className="flag">{display.flag}</span>
                          <h3>{display.label}</h3>
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
                        <button
                          className="primary-button"
                          type="button"
                          onClick={() => setSelectedLanguageCode(language.code)}
                        >
                          Open editor
                        </button>
                        <a
                          className="secondary-button"
                          href={`/api/projects/${selectedProject.id}/download/${language.code}`}
                        >
                          Download
                        </a>
                        {!language.isSource && (
                          <button
                            className="ghost-button"
                            disabled={busy}
                            type="button"
                            onClick={() => handleSetSource(language.code)}
                          >
                            Set as source
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Add language</p>
                  <h2>New target language</h2>
                </div>
              </div>

              <form className="stack-form" onSubmit={handleAddLanguage}>
                <div className="inline-fields">
                  <label>
                    <span>Language code</span>
                    <input
                      required
                      value={languageForm.code}
                      onChange={(event) =>
                        setLanguageForm((current) => ({ ...current, code: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    <span>Language label</span>
                    <input
                      value={languageForm.label}
                      onChange={(event) =>
                        setLanguageForm((current) => ({ ...current, label: event.target.value }))
                      }
                    />
                  </label>
                </div>

                <label>
                  <span>Start from</span>
                  <select
                    value={languageForm.mode}
                    onChange={(event) =>
                      setLanguageForm((current) => ({ ...current, mode: event.target.value }))
                    }
                  >
                    <option value="empty">Create empty file</option>
                    <option value="upload">Upload translation file</option>
                    <option value="library">Import from library</option>
                  </select>
                </label>

                {languageForm.mode === "upload" && (
                  <>
                    <label>
                      <span>Stored name</span>
                      <input
                        placeholder="project-fr"
                        value={languageForm.fileName}
                        onChange={(event) =>
                          setLanguageForm((current) => ({
                            ...current,
                            fileName: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Translation JSON</span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={(event) => setLanguageFile(event.target.files?.[0] || null)}
                      />
                    </label>
                  </>
                )}

                {languageForm.mode === "library" && (
                  <label>
                    <span>Library file</span>
                    <select
                      value={languageForm.libraryFile}
                      onChange={(event) =>
                        setLanguageForm((current) => ({
                          ...current,
                          libraryFile: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select a stored file</option>
                      {libraryFiles.map((file) => (
                        <option key={file.fileName} value={file.fileName}>
                          {file.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <button className="primary-button" disabled={busy} type="submit">
                  Add language
                </button>
              </form>
            </section>

            {editorData && editorLanguage && (
              <section className="panel editor-panel">
                <div className="project-header">
                  <div>
                    <p className="eyebrow">Translation editor</p>
                    <h2>
                      {languageDisplay(editorLanguage.code, editorLanguage.label).flag}{" "}
                      {editorLanguage.label}
                    </h2>
                    <p className="muted">{progressLabel(editorData.progress)}</p>
                  </div>

                  <button className="primary-button" disabled={busy} onClick={handleSaveTranslations}>
                    Save progress
                  </button>
                </div>

                <div className="editor-grid">
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
            )}
          </>
        )}
      </main>

      {isCreateDialogOpen && (
        <div className="dialog-backdrop" onClick={closeCreateDialog}>
          <div className="dialog panel" onClick={(event) => event.stopPropagation()}>
            <div className="project-header">
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
                    required
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

              <button className="primary-button" disabled={busy} type="submit">
                Create
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
