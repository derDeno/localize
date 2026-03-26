import { createContext, useContext, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  useNavigate,
  useParams,
} from "react-router-dom";

const languageMeta = {
  ar: { countryCode: "sa", name: "Arabic" },
  bg: { countryCode: "bg", name: "Bulgarian" },
  cs: { countryCode: "cz", name: "Czech" },
  da: { countryCode: "dk", name: "Danish" },
  de: { countryCode: "de", name: "Deutsch" },
  el: { countryCode: "gr", name: "Greek" },
  en: { countryCode: "gb", name: "English" },
  es: { countryCode: "es", name: "Spanish" },
  et: { countryCode: "ee", name: "Estonian" },
  fi: { countryCode: "fi", name: "Finnish" },
  fr: { countryCode: "fr", name: "French" },
  he: { countryCode: "il", name: "Hebrew" },
  hi: { countryCode: "in", name: "Hindi" },
  hu: { countryCode: "hu", name: "Hungarian" },
  it: { countryCode: "it", name: "Italian" },
  ja: { countryCode: "jp", name: "Japanese" },
  ko: { countryCode: "kr", name: "Korean" },
  nl: { countryCode: "nl", name: "Dutch" },
  no: { countryCode: "no", name: "Norwegian" },
  pl: { countryCode: "pl", name: "Polish" },
  pt: { countryCode: "pt", name: "Portuguese" },
  ro: { countryCode: "ro", name: "Romanian" },
  ru: { countryCode: "ru", name: "Russian" },
  sk: { countryCode: "sk", name: "Slovak" },
  sl: { countryCode: "si", name: "Slovenian" },
  sv: { countryCode: "se", name: "Swedish" },
  tr: { countryCode: "tr", name: "Turkish" },
  uk: { countryCode: "ua", name: "Ukrainian" },
  zh: { countryCode: "cn", name: "Chinese" },
};

const AppContext = createContext(null);

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
  });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(body?.message || "Request failed.");
  }

  return body;
}

function languageDisplay(code, fallbackLabel) {
  const normalized = String(code || "").toLowerCase();
  const meta = languageMeta[normalized];
  return {
    code: normalized,
    label: fallbackLabel || meta?.name || normalized.toUpperCase(),
    countryCode: meta?.countryCode || null,
  };
}

function progressLabel(progress) {
  return `${progress.percent}% · ${progress.completed}/${progress.total}`;
}

function Flag({ code, label }) {
  const display = languageDisplay(code, label);
  if (!display.countryCode) {
    return <span className="flag-fallback">●</span>;
  }

  return <span className={`fi fi-${display.countryCode} flag-icon`} aria-hidden="true" />;
}

function AppProvider({ children }) {
  const [bootstrap, setBootstrap] = useState({
    loading: true,
    user: null,
    settings: null,
    error: "",
  });

  async function refreshBootstrap() {
    setBootstrap((current) => ({ ...current, loading: true, error: "" }));
    try {
      const payload = await apiFetch("/api/bootstrap");
      setBootstrap({
        loading: false,
        user: payload.user,
        settings: payload.settings,
        error: "",
      });
      return payload;
    } catch (error) {
      setBootstrap({
        loading: false,
        user: null,
        settings: null,
        error: error.message,
      });
      throw error;
    }
  }

  useEffect(() => {
    refreshBootstrap();
  }, []);

  const value = useMemo(
    () => ({
      ...bootstrap,
      refreshBootstrap,
      setBootstrap,
    }),
    [bootstrap],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function useApp() {
  return useContext(AppContext);
}

function roleAllows(user, requiredRole) {
  const order = { viewer: 1, editor: 2, admin: 3 };
  return (order[user?.role] || 0) >= (order[requiredRole] || 0);
}

function App() {
  return (
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  );
}

function LoadingPage({ text = "Loading…" }) {
  return (
    <div className="screen-center">
      <div className="panel narrow-panel">
        <p className="eyebrow">localize</p>
        <h1>{text}</h1>
      </div>
    </div>
  );
}

function PublicOnly() {
  const { loading, user } = useApp();
  if (loading) {
    return <LoadingPage />;
  }
  if (user) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

function RequireAuth() {
  const { loading, user } = useApp();
  if (loading) {
    return <LoadingPage />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function RequireRole({ role }) {
  const { user } = useApp();
  if (!roleAllows(user, role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

function AppShell() {
  const navigate = useNavigate();
  const { user, settings, refreshBootstrap, setBootstrap } = useApp();

  async function handleLogout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setBootstrap((current) => ({
      ...current,
      user: null,
    }));
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <header className="topbar panel">
        <div className="brand-block">
          <img className="brand-icon" src="/icon.svg" alt="" />
          <div>
            <p className="eyebrow">Translation Workspace</p>
            <h1>localize</h1>
          </div>
        </div>

        <nav className="topbar-menu">
          <Link className="menu-link" to="/">
            Dashboard
          </Link>
          {roleAllows(user, "admin") ? (
            <Link className="menu-link" to="/settings">
              Settings
            </Link>
          ) : null}
        </nav>

        <div className="account-menu">
          <div>
            <strong>
              {user.firstName} {user.lastName}
            </strong>
            <p className="muted">
              {user.role} · {user.email}
            </p>
          </div>
          {roleAllows(user, "admin") ? (
            <button className="ghost-button" type="button" onClick={() => navigate("/settings")}>
              Settings
            </button>
          ) : null}
          <button className="ghost-button" type="button" onClick={refreshBootstrap}>
            Refresh
          </button>
          <button className="primary-button" type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      {!settings ? null : (
        <section className="panel status-banner">
          <span>Registration: {settings.allowRegistration ? "enabled" : "disabled"}</span>
          <span>Project delete: {settings.allowProjectDelete ? "enabled" : "disabled"}</span>
          <span>Language delete: {settings.allowLanguageDelete ? "enabled" : "disabled"}</span>
          <span>SSO: {settings.sso.enabled ? "configured" : "not configured"}</span>
        </section>
      )}

      <Outlet />
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { refreshBootstrap } = useApp();
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const bootstrap = await refreshBootstrap();
      if (!bootstrap?.user) {
        throw new Error("Sign-in worked, but the session cookie was not accepted by the browser.");
      }
      navigate("/");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen-center">
      <div className="auth-shell">
        <img className="auth-logo" src="/icon.svg" alt="localize" />
        <div className="auth-brand">
          <strong>localize</strong>
        </div>
        <form className="panel auth-card stack-form" onSubmit={handleSubmit}>
          <h1>Sign in</h1>

          <label>
            <span>Email</span>
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              type="email"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              type="password"
              required
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <p className="muted">
            No account yet? <Link to="/register">Register here</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function RegisterPage() {
  const navigate = useNavigate();
  const { settings } = useApp();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (settings && !settings.allowRegistration) {
    return (
      <div className="screen-center">
        <div className="panel auth-card">
          <h1>Registration disabled</h1>
          <p className="muted">An administrator has turned off self-service sign-up.</p>
          <Link className="primary-button link-button" to="/login">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSuccess("Account created. You can sign in now.");
      window.setTimeout(() => navigate("/login"), 700);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen-center">
      <div className="auth-shell">
        <img className="auth-logo" src="/icon.svg" alt="localize" />
        <div className="auth-brand">
          <strong>localize</strong>
        </div>
        <form className="panel auth-card stack-form" onSubmit={handleSubmit}>
          <h1>Register</h1>

          <div className="split-grid">
            <label>
              <span>First name</span>
              <input
                value={form.firstName}
                onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                required
              />
            </label>

            <label>
              <span>Last name</span>
              <input
                value={form.lastName}
                onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                required
              />
            </label>
          </div>

          <label>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              required
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}
          {success ? <p className="success-text">{success}</p> : null}

          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </button>

          <p className="muted">
            Already registered? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { user } = useApp();
  const [projects, setProjects] = useState([]);
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    version: "1.0.0",
    sourceLanguage: "en",
    sourceLabel: "English",
    sourceMode: "upload",
    sourceLibraryFile: "",
    sourceFile: null,
  });

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [projectList, libraryList] = await Promise.all([
        apiFetch("/api/projects"),
        apiFetch("/api/library"),
      ]);
      setProjects(projectList);
      setLibraryFiles(libraryList);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateProject(event) {
    event.preventDefault();
    setCreating(true);
    setCreateError("");

    try {
      const body = new FormData();
      body.append("name", form.name);
      body.append("description", form.description);
      body.append("version", form.version);
      body.append("sourceLanguage", form.sourceLanguage);
      body.append("sourceLabel", form.sourceLabel);
      body.append("sourceMode", form.sourceMode);
      if (form.sourceMode === "library") {
        body.append("sourceLibraryFile", form.sourceLibraryFile);
      } else if (form.sourceFile) {
        body.append("sourceFile", form.sourceFile);
        body.append("sourceFileName", form.sourceFile.name);
      }

      await apiFetch("/api/projects", {
        method: "POST",
        body,
      });

      setForm({
        name: "",
        description: "",
        version: "1.0.0",
        sourceLanguage: "en",
        sourceLabel: "English",
        sourceMode: "upload",
        sourceLibraryFile: "",
        sourceFile: null,
      });
      await loadData();
    } catch (submitError) {
      setCreateError(submitError.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="page-stack">
      <section className="panel page-hero">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>Projects</h2>
          <p className="muted">Manage project configs, translation languages, and downloadable JSON exports.</p>
        </div>
        <div className="hero-metrics">
          <strong>{projects.length}</strong>
          <span className="muted">active projects</span>
        </div>
      </section>

      {error ? <section className="panel error-text">{error}</section> : null}

      {roleAllows(user, "editor") ? (
        <section className="panel page-stack">
          <div className="section-head">
            <div>
              <p className="eyebrow">Create</p>
              <h3>New project</h3>
            </div>
          </div>

          <form className="stack-form" onSubmit={handleCreateProject}>
            <div className="split-grid">
              <label>
                <span>Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>

              <label>
                <span>Version</span>
                <input
                  value={form.version}
                  onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))}
                />
              </label>
            </div>

            <label>
              <span>Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={3}
              />
            </label>

            <div className="split-grid">
              <label>
                <span>Source language code</span>
                <input
                  value={form.sourceLanguage}
                  onChange={(event) => setForm((current) => ({ ...current, sourceLanguage: event.target.value }))}
                  required
                />
              </label>

              <label>
                <span>Source label</span>
                <input
                  value={form.sourceLabel}
                  onChange={(event) => setForm((current) => ({ ...current, sourceLabel: event.target.value }))}
                  required
                />
              </label>
            </div>

            <label>
              <span>Source mode</span>
              <select
                value={form.sourceMode}
                onChange={(event) => setForm((current) => ({ ...current, sourceMode: event.target.value }))}
              >
                <option value="upload">Upload</option>
                <option value="library">Library</option>
              </select>
            </label>

            {form.sourceMode === "library" ? (
              <label>
                <span>Library file</span>
                <select
                  value={form.sourceLibraryFile}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, sourceLibraryFile: event.target.value }))
                  }
                  required
                >
                  <option value="">Select a JSON file</option>
                  {libraryFiles.map((file) => (
                    <option key={file.fileName} value={file.fileName}>
                      {file.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                <span>Source JSON file</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, sourceFile: event.target.files?.[0] || null }))
                  }
                  required
                />
              </label>
            )}

            {createError ? <p className="error-text">{createError}</p> : null}

            <button className="primary-button" type="submit" disabled={creating}>
              {creating ? "Creating project…" : "Create project"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="cards-grid">
        {loading ? (
          <div className="panel">Loading projects…</div>
        ) : projects.length ? (
          projects.map((project) => (
            <article className="panel project-card" key={project.id}>
              <div className="card-top">
                <div>
                  <p className="eyebrow">{project.version || "No version"}</p>
                  <strong>{project.name}</strong>
                </div>
                <span className="badge">rev {project.currentRevision}</span>
              </div>
              <p className="muted">{project.description || "No description yet."}</p>
              <div className="mini-flags">
                {project.languages.map((language) => (
                  <span className="lang-pill" key={language.id}>
                    <Flag code={language.code} label={language.label} />
                    {language.label}
                  </span>
                ))}
              </div>
              <div className="card-actions">
                <span className="muted">{project.languages.length} languages</span>
                <Link className="primary-button link-button" to={`/projects/${project.id}`}>
                  Open
                </Link>
              </div>
            </article>
          ))
        ) : (
          <div className="panel">No projects yet.</div>
        )}
      </section>
    </main>
  );
}

function ProjectPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { user, settings } = useApp();
  const [project, setProject] = useState(null);
  const [versions, setVersions] = useState([]);
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    version: "",
    sourceLanguage: "",
  });
  const [languageForm, setLanguageForm] = useState({
    code: "",
    label: "",
    mode: "empty",
    libraryFile: "",
    file: null,
  });

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [projectPayload, versionPayload, libraryPayload] = await Promise.all([
        apiFetch(`/api/projects/${projectId}`),
        apiFetch(`/api/projects/${projectId}/versions`),
        apiFetch("/api/library"),
      ]);
      setProject(projectPayload);
      setVersions(versionPayload);
      setLibraryFiles(libraryPayload);
      setEditForm({
        name: projectPayload.name,
        description: projectPayload.description || "",
        version: projectPayload.version || "",
        sourceLanguage: projectPayload.sourceLanguage,
      });
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function handleUpdateProject(event) {
    event.preventDefault();
    await apiFetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    await loadData();
  }

  async function handleAddLanguage(event) {
    event.preventDefault();
    const body = new FormData();
    body.append("code", languageForm.code);
    body.append("label", languageForm.label);
    body.append("mode", languageForm.mode);
    if (languageForm.mode === "library") {
      body.append("libraryFile", languageForm.libraryFile);
    }
    if (languageForm.mode === "upload" && languageForm.file) {
      body.append("file", languageForm.file);
      body.append("fileName", languageForm.file.name);
    }
    await apiFetch(`/api/projects/${projectId}/languages`, {
      method: "POST",
      body,
    });
    setLanguageForm({
      code: "",
      label: "",
      mode: "empty",
      libraryFile: "",
      file: null,
    });
    await loadData();
  }

  async function handleDeleteProject() {
    if (!window.confirm("Delete this project?")) {
      return;
    }
    await apiFetch(`/api/projects/${projectId}`, {
      method: "DELETE",
    });
    navigate("/");
  }

  async function handleDeleteLanguage(languageCode) {
    if (!window.confirm(`Delete ${languageCode}?`)) {
      return;
    }
    await apiFetch(`/api/projects/${projectId}/languages/${languageCode}`, {
      method: "DELETE",
    });
    await loadData();
  }

  async function handleMakeSource(languageCode) {
    await apiFetch(`/api/projects/${projectId}/source`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ languageCode }),
    });
    await loadData();
  }

  async function handleReplaceLanguageFile(languageCode, file) {
    const body = new FormData();
    body.append("file", file);
    body.append("fileName", file.name);
    await apiFetch(`/api/projects/${projectId}/languages/${languageCode}/upload`, {
      method: "POST",
      body,
    });
    await loadData();
  }

  if (loading) {
    return <LoadingPage text="Loading project…" />;
  }

  if (error) {
    return <section className="panel error-text">{error}</section>;
  }

  return (
    <main className="page-stack">
      <section className="panel page-hero">
        <div>
          <p className="eyebrow">Project</p>
          <h2>{project.name}</h2>
          <p className="muted">{project.description || "No description yet."}</p>
        </div>
        <div className="hero-actions">
          <span className="badge">Version {project.version || "n/a"}</span>
          <span className="badge">Revision {project.currentRevision}</span>
          <a className="ghost-button link-button" href={`/api/projects/${projectId}/download-all`}>
            Download all
          </a>
          {roleAllows(user, "editor") && settings?.allowProjectDelete ? (
            <button className="danger-button" type="button" onClick={handleDeleteProject}>
              Delete project
            </button>
          ) : null}
        </div>
      </section>

      {roleAllows(user, "editor") ? (
        <section className="dashboard-grid">
          <form className="panel stack-form" onSubmit={handleUpdateProject}>
            <div className="section-head">
              <div>
                <p className="eyebrow">Project config</p>
                <h3>Edit project</h3>
              </div>
            </div>

            <label>
              <span>Name</span>
              <input
                value={editForm.name}
                onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>

            <label>
              <span>Description</span>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
              />
            </label>

            <div className="split-grid">
              <label>
                <span>Version</span>
                <input
                  value={editForm.version}
                  onChange={(event) => setEditForm((current) => ({ ...current, version: event.target.value }))}
                />
              </label>

              <label>
                <span>Source language</span>
                <select
                  value={editForm.sourceLanguage}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, sourceLanguage: event.target.value }))
                  }
                >
                  {project.languages.map((language) => (
                    <option key={language.id} value={language.code}>
                      {language.label} ({language.code})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button className="primary-button" type="submit">
              Save project
            </button>
          </form>

          <form className="panel stack-form" onSubmit={handleAddLanguage}>
            <div className="section-head">
              <div>
                <p className="eyebrow">Languages</p>
                <h3>Add language</h3>
              </div>
            </div>

            <div className="split-grid">
              <label>
                <span>Code</span>
                <input
                  value={languageForm.code}
                  onChange={(event) => setLanguageForm((current) => ({ ...current, code: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Label</span>
                <input
                  value={languageForm.label}
                  onChange={(event) => setLanguageForm((current) => ({ ...current, label: event.target.value }))}
                  required
                />
              </label>
            </div>

            <label>
              <span>Origin</span>
              <select
                value={languageForm.mode}
                onChange={(event) => setLanguageForm((current) => ({ ...current, mode: event.target.value }))}
              >
                <option value="empty">Blank</option>
                <option value="upload">Upload</option>
                <option value="library">Library</option>
              </select>
            </label>

            {languageForm.mode === "library" ? (
              <label>
                <span>Library file</span>
                <select
                  value={languageForm.libraryFile}
                  onChange={(event) =>
                    setLanguageForm((current) => ({ ...current, libraryFile: event.target.value }))
                  }
                  required
                >
                  <option value="">Select a JSON file</option>
                  {libraryFiles.map((file) => (
                    <option key={file.fileName} value={file.fileName}>
                      {file.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {languageForm.mode === "upload" ? (
              <label>
                <span>Translation file</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) =>
                    setLanguageForm((current) => ({ ...current, file: event.target.files?.[0] || null }))
                  }
                  required
                />
              </label>
            ) : null}

            <button className="primary-button" type="submit">
              Add language
            </button>
          </form>
        </section>
      ) : null}

      <section className="cards-grid">
        {project.languages.map((language) => (
          <article className="panel language-card" key={language.id}>
            <div className="card-top">
              <div className="lang-title">
                <Flag code={language.code} label={language.label} />
                <div>
                  <strong>{language.label}</strong>
                  <p className="muted">
                    {language.code.toUpperCase()} · {language.origin}
                  </p>
                </div>
              </div>
              {language.isSource ? <span className="badge badge-accent">Source</span> : null}
            </div>

            <div className="detail-badges">
              <span className="badge">{progressLabel(language.progress)}</span>
              <span className="badge">created {new Date(language.createdAt).toLocaleDateString()}</span>
            </div>

            <div className="card-actions wrap-actions">
              <Link className="primary-button link-button" to={`/projects/${projectId}/languages/${language.code}/edit`}>
                Open editor
              </Link>
              <a className="ghost-button link-button" href={`/api/projects/${projectId}/download/${language.code}`}>
                Download JSON
              </a>
              {roleAllows(user, "editor") && !language.isSource ? (
                <button className="ghost-button" type="button" onClick={() => handleMakeSource(language.code)}>
                  Make source
                </button>
              ) : null}
              {roleAllows(user, "editor") ? (
                <label className="ghost-button upload-button">
                  Replace JSON
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        handleReplaceLanguageFile(language.code, file);
                      }
                    }}
                  />
                </label>
              ) : null}
              {roleAllows(user, "editor") && settings?.allowLanguageDelete && !language.isSource ? (
                <button className="danger-button" type="button" onClick={() => handleDeleteLanguage(language.code)}>
                  Delete
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      <section className="panel page-stack">
        <div className="section-head">
          <div>
            <p className="eyebrow">Versions</p>
            <h3>Revision history</h3>
          </div>
        </div>

        <div className="version-list">
          {versions.map((version) => (
            <div className="version-row" key={version.id}>
              <strong>Revision {version.revision}</strong>
              <span className="muted">
                {version.version_label || "no version label"} ·{" "}
                {new Date(version.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function EditorPage() {
  const { user } = useApp();
  const { projectId, languageCode } = useParams();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [filter, setFilter] = useState("");
  const deferredFilter = useDeferredValue(filter);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const payload = await apiFetch(`/api/projects/${projectId}/languages/${languageCode}`);
      setRows(payload.rows);
      setMeta(payload);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [projectId, languageCode]);

  const visibleRows = useMemo(() => {
    const query = deferredFilter.trim().toLowerCase();
    if (!query) {
      return rows;
    }
    return rows.filter(
      (row) =>
        row.key.toLowerCase().includes(query) ||
        String(row.source).toLowerCase().includes(query) ||
        String(row.translation).toLowerCase().includes(query),
    );
  }, [deferredFilter, rows]);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const entries = Object.fromEntries(rows.map((row) => [row.key, row.translation]));
      const payload = await apiFetch(`/api/projects/${projectId}/languages/${languageCode}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      setMeta((current) => ({ ...current, progress: payload.progress }));
      setMessage("Translations saved.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingPage text="Loading editor…" />;
  }

  return (
    <main className="page-stack">
      <section className="panel page-hero">
        <div>
          <p className="eyebrow">Editor</p>
          <h2>
            {languageCode.toUpperCase()} against {meta.sourceLanguage.toUpperCase()}
          </h2>
          <p className="muted">Viewer accounts can inspect entries, editors and admins can save changes.</p>
        </div>
        <div className="hero-actions">
          <span className="badge">{progressLabel(meta.progress)}</span>
          <Link className="ghost-button link-button" to={`/projects/${projectId}`}>
            Back to project
          </Link>
          {roleAllows(user, "editor") ? (
            <button className="primary-button" type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          ) : null}
        </div>
      </section>

      <section className="panel page-stack">
        <label>
          <span>Filter keys or texts</span>
          <input value={filter} onChange={(event) => setFilter(event.target.value)} />
        </label>

        {message ? <p className="success-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        <div className="editor-list">
          {visibleRows.map((row) => (
            <article className="panel editor-row" key={row.key}>
              <div className="editor-meta">
                <strong>{row.key}</strong>
              </div>
              <label>
                <span>Source</span>
                <textarea value={row.source} readOnly rows={3} />
              </label>
              <label>
                <span>Translation</span>
                <textarea
                  value={row.translation}
                  rows={3}
                  readOnly={!roleAllows(user, "editor")}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item) =>
                        item.key === row.key ? { ...item, translation: event.target.value } : item,
                      ),
                    )
                  }
                />
              </label>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function SettingsPage() {
  const [tab, setTab] = useState("users");
  return (
    <main className="page-stack">
      <section className="panel page-hero">
        <div>
          <p className="eyebrow">Administration</p>
          <h2>Settings</h2>
          <p className="muted">User management, app controls, and SSO placeholders for the next stage.</p>
        </div>
      </section>

      <section className="panel page-stack">
        <div className="tab-row">
          <button className={tab === "users" ? "tab-button active" : "tab-button"} onClick={() => setTab("users")}>
            Users
          </button>
          <button className={tab === "app" ? "tab-button active" : "tab-button"} onClick={() => setTab("app")}>
            App settings
          </button>
          <button className={tab === "sso" ? "tab-button active" : "tab-button"} onClick={() => setTab("sso")}>
            SSO
          </button>
        </div>

        {tab === "users" ? <UsersTab /> : null}
        {tab === "app" ? <AppSettingsTab /> : null}
        {tab === "sso" ? <SsoSettingsTab /> : null}
      </section>
    </main>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "viewer",
    status: "active",
  });
  const [error, setError] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const payload = await apiFetch("/api/users");
      setUsers(payload);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function fillFromUser(user) {
    setSelectedUserId(user?.id || "");
    setForm({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      password: "",
      role: user?.role || "viewer",
      status: user?.status || "active",
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      if (selectedUserId) {
        await apiFetch(`/api/users/${selectedUserId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        await apiFetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      fillFromUser(null);
      await loadUsers();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <div className="dashboard-grid">
      <section className="panel page-stack">
        <div className="section-head">
          <div>
            <p className="eyebrow">Directory</p>
            <h3>Users</h3>
          </div>
        </div>
        {loading ? <p>Loading users…</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        <div className="version-list">
          {users.map((user) => (
            <button className="user-row" type="button" key={user.id} onClick={() => fillFromUser(user)}>
              <strong>
                {user.firstName} {user.lastName}
              </strong>
              <span className="muted">
                {user.email} · {user.role} · {user.status}
              </span>
            </button>
          ))}
        </div>
      </section>

      <form className="panel stack-form" onSubmit={handleSubmit}>
        <div className="section-head">
          <div>
            <p className="eyebrow">{selectedUserId ? "Update" : "Create"}</p>
            <h3>{selectedUserId ? "Edit user" : "Add user"}</h3>
          </div>
        </div>

        <div className="split-grid">
          <label>
            <span>First name</span>
            <input
              value={form.firstName}
              onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
              required
            />
          </label>
          <label>
            <span>Last name</span>
            <input
              value={form.lastName}
              onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
              required
            />
          </label>
        </div>

        <label>
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            required
          />
        </label>

        <label>
          <span>Password {selectedUserId ? "(leave empty to keep)" : ""}</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            required={!selectedUserId}
          />
        </label>

        <div className="split-grid">
          <label>
            <span>Role</span>
            <select
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
            >
              <option value="admin">admin</option>
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
            </select>
          </label>

          <label>
            <span>Status</span>
            <select
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="active">active</option>
              <option value="invited">invited</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
        </div>

        <div className="card-actions">
          <button className="ghost-button" type="button" onClick={() => fillFromUser(null)}>
            Clear
          </button>
          <button className="primary-button" type="submit">
            {selectedUserId ? "Save user" : "Create user"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AppSettingsTab() {
  const { refreshBootstrap } = useApp();
  const [form, setForm] = useState({
    allowRegistration: true,
    allowProjectDelete: true,
    allowLanguageDelete: true,
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiFetch("/api/settings/app").then((payload) => {
      setForm({
        allowRegistration: payload.allowRegistration,
        allowProjectDelete: payload.allowProjectDelete,
        allowLanguageDelete: payload.allowLanguageDelete,
      });
    });
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    await apiFetch("/api/settings/app", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    await refreshBootstrap();
    setMessage("Settings saved.");
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={form.allowRegistration}
          onChange={(event) => setForm((current) => ({ ...current, allowRegistration: event.target.checked }))}
        />
        <span>Allow new user registration</span>
      </label>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={form.allowProjectDelete}
          onChange={(event) => setForm((current) => ({ ...current, allowProjectDelete: event.target.checked }))}
        />
        <span>Allow project deletion</span>
      </label>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={form.allowLanguageDelete}
          onChange={(event) => setForm((current) => ({ ...current, allowLanguageDelete: event.target.checked }))}
        />
        <span>Allow language deletion</span>
      </label>

      <p className="muted">
        Improvement idea: next we can split these into global policies and per-project overrides for safer workflows.
      </p>

      {message ? <p className="success-text">{message}</p> : null}

      <button className="primary-button" type="submit">
        Save app settings
      </button>
    </form>
  );
}

function SsoSettingsTab() {
  const [form, setForm] = useState({
    enabled: false,
    provider: "",
    issuerUrl: "",
    clientId: "",
    clientSecret: "",
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiFetch("/api/settings/sso").then((payload) => {
      setForm(payload);
    });
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    await apiFetch("/api/settings/sso", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setMessage("SSO settings saved. Auth flow wiring can build on this later.");
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
        />
        <span>Enable SSO configuration</span>
      </label>

      <label>
        <span>Provider</span>
        <input
          value={form.provider}
          onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))}
          placeholder="Azure AD, Keycloak, Okta…"
        />
      </label>

      <label>
        <span>Issuer URL</span>
        <input
          value={form.issuerUrl}
          onChange={(event) => setForm((current) => ({ ...current, issuerUrl: event.target.value }))}
          placeholder="https://identity.example.com"
        />
      </label>

      <div className="split-grid">
        <label>
          <span>Client ID</span>
          <input
            value={form.clientId}
            onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))}
          />
        </label>

        <label>
          <span>Client secret</span>
          <input
            value={form.clientSecret}
            onChange={(event) => setForm((current) => ({ ...current, clientSecret: event.target.value }))}
          />
        </label>
      </div>

      <p className="muted">
        Improvement idea: when we add SSO, we should map identity groups to the admin/editor/viewer roles here.
      </p>

      {message ? <p className="success-text">{message}</p> : null}

      <button className="primary-button" type="submit">
        Save SSO settings
      </button>
    </form>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/projects/:projectId/languages/:languageCode/edit" element={<EditorPage />} />
          <Route element={<RequireRole role="admin" />}>
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </>,
  ),
);

export default App;
