import { createContext, useContext, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  useNavigate,
  useOutletContext,
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

const initialProjectForm = {
  name: "",
  description: "",
  version: "1.0.0",
  sourceLanguage: "en",
  sourceLabel: "English",
  sourceLibraryFile: "",
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

function getSystemTheme() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="switch-glyph">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <path
        d="M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1 5.3 5.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="switch-glyph">
      <path
        d="M14.8 3.2a8.7 8.7 0 1 0 6 14.8A9.8 9.8 0 0 1 14.8 3.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Flag({ code, label, className = "" }) {
  const display = languageDisplay(code, label);
  if (!display.countryCode) {
    return <span className={`flag-fallback ${className}`.trim()}>●</span>;
  }

  return <span className={`fi fi-${display.countryCode} flag-icon ${className}`.trim()} aria-hidden="true" />;
}

function FlagSelect({ label, value, options, onChange }) {
  const detailsRef = useRef(null);
  const selectedOption = options.find((option) => option.code === value) || options[0];

  return (
    <label className="flag-select-field">
      {label ? <span>{label}</span> : null}
      <details className="flag-select" ref={detailsRef}>
        <summary className="flag-select-trigger">
          <span className="flag-select-value">
            {selectedOption ? (
              <>
                <Flag code={selectedOption.code} label={selectedOption.label} />
                <span>
                  {selectedOption.label} ({selectedOption.code.toUpperCase()})
                </span>
              </>
            ) : (
              <span>Select a language</span>
            )}
          </span>
          <span className="flag-select-chevron" aria-hidden="true">
            ▾
          </span>
        </summary>

        <div className="flag-select-menu">
          {options.map((option) => (
            <button
              key={option.code}
              className={`flag-select-option${option.code === value ? " active" : ""}`}
              type="button"
              onClick={() => {
                onChange(option.code);
                detailsRef.current?.removeAttribute("open");
              }}
            >
              <Flag code={option.code} label={option.label} />
              <span>
                {option.label} ({option.code.toUpperCase()})
              </span>
            </button>
          ))}
        </div>
      </details>
    </label>
  );
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
  const { user, setBootstrap } = useApp();
  const [themePreference, setThemePreference] = useState(() => localStorage.getItem("localize-theme"));
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const [toast, setToast] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isProjectFileHovering, setIsProjectFileHovering] = useState(false);
  const [projectForm, setProjectForm] = useState(initialProjectForm);
  const [projectFile, setProjectFile] = useState(null);
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const theme = themePreference || systemTheme || "light";
  const projectLanguageOptions = useMemo(
    () =>
      Object.entries(languageMeta).map(([code, meta]) => ({
        code,
        label: meta.name,
      })),
    [],
  );

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

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 320);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isCreateDialogOpen) {
      return;
    }

    apiFetch("/api/library")
      .then((payload) => setLibraryFiles(payload))
      .catch(() => setLibraryFiles([]));
  }, [isCreateDialogOpen]);

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
    setProjectFile(file);
    if (file) {
      setProjectForm((current) => ({ ...current, sourceLibraryFile: "" }));
    }
  }

  function handleProjectLibrarySelection(fileName) {
    setProjectFile(null);
    setProjectForm((current) => ({
      ...current,
      sourceLibraryFile: fileName,
      sourceLabel: languageDisplay(current.sourceLanguage).label,
    }));
  }

  async function handleLogout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setBootstrap((current) => ({
      ...current,
      user: null,
    }));
    navigate("/login");
  }

  async function handleCreateProject(event) {
    event.preventDefault();
    const sourceMode = projectForm.sourceLibraryFile && !projectFile ? "library" : "upload";

    if (sourceMode === "upload" && !projectFile) {
      showToast("error", "Please select a source file or a library file.");
      return;
    }

    setIsCreatingProject(true);

    try {
      const formData = new FormData();
      formData.set("name", projectForm.name);
      formData.set("description", projectForm.description);
      formData.set("version", projectForm.version);
      formData.set("sourceLanguage", projectForm.sourceLanguage.trim().toLowerCase());
      formData.set(
        "sourceLabel",
        projectForm.sourceLabel.trim() || languageDisplay(projectForm.sourceLanguage).label,
      );
      formData.set("sourceMode", sourceMode);

      if (sourceMode === "library") {
        formData.set("sourceLibraryFile", projectForm.sourceLibraryFile);
      } else if (projectFile) {
        formData.set("sourceFile", projectFile);
        formData.set(
          "sourceFileName",
          projectFile.name || `${projectForm.name}-${projectForm.sourceLanguage}.json`,
        );
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
            <h1>localize</h1>
          </div>
        </div>

        <nav className="topbar-menu" aria-label="Primary">
          <NavLink className={({ isActive }) => `menu-link${isActive ? " active" : ""}`} to="/">
            Dashboard
          </NavLink>
          {roleAllows(user, "admin") ? (
            <NavLink className={({ isActive }) => `menu-link${isActive ? " active" : ""}`} to="/settings">
              Settings
            </NavLink>
          ) : null}
        </nav>

        <div className="topbar-actions">
          <label className="theme-switch">
            <button
              type="button"
              className="switch"
              aria-label="Toggle dark mode"
              aria-pressed={theme === "dark"}
              onClick={() => {
                const nextTheme = theme === "dark" ? "light" : "dark";
                setThemePreference(nextTheme);
                localStorage.setItem("localize-theme", nextTheme);
              }}
            >
              <span className="switch-icon switch-icon-sun" aria-hidden="true">
                <SunIcon />
              </span>
              <span className="switch-thumb" />
              <span className="switch-icon switch-icon-moon" aria-hidden="true">
                <MoonIcon />
              </span>
            </button>
          </label>

          <button className="icon-button danger-icon-button" type="button" aria-label="Sign out" onClick={handleLogout}>
            ⏻
          </button>
        </div>
      </header>

      {toast ? (
        <div className={`toast ${toast.kind}`} key={toast.id} role="status" aria-live="polite">
          {toast.text}
        </div>
      ) : null}

      {showBackToTop ? (
        <button
          className="back-to-top"
          type="button"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          ‹
        </button>
      ) : null}

      <main className="page-shell">
        <Outlet context={{ refreshSeed, openCreateDialog, showToast }} />
      </main>

      {isCreateDialogOpen ? (
        <div className="dialog-backdrop">
          <div className="dialog panel" onClick={(event) => event.stopPropagation()}>
            <div className="dialog-header">
              <div>
                <h2>Create project</h2>
              </div>
              <button
                className="ghost-button dialog-close"
                type="button"
                aria-label="Close dialog"
                onClick={closeCreateDialog}
              >
                ×
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
                <span>Description</span>
                <textarea
                  rows="4"
                  value={projectForm.description}
                  onChange={(event) =>
                    setProjectForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>

              <label>
                <span>Version</span>
                <input
                  value={projectForm.version}
                  onChange={(event) =>
                    setProjectForm((current) => ({ ...current, version: event.target.value }))
                  }
                />
              </label>

              <FlagSelect
                label="Source language"
                value={projectForm.sourceLanguage}
                options={projectLanguageOptions}
                onChange={(nextCode) =>
                  setProjectForm((current) => ({
                    ...current,
                    sourceLanguage: nextCode,
                    sourceLabel: languageDisplay(nextCode).label,
                  }))
                }
              />

              {libraryFiles.length ? (
                <label>
                  <span>Library file (optional)</span>
                  <select
                    value={projectForm.sourceLibraryFile}
                    onChange={(event) => handleProjectLibrarySelection(event.target.value)}
                  >
                    <option value="">Use uploaded file</option>
                    {libraryFiles.map((file) => (
                      <option key={file.fileName} value={file.fileName}>
                        {file.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

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
                    <span>
                      {projectFile
                        ? "This upload will be used for the project source."
                        : "If you leave this empty, the selected library file will be used."}
                    </span>
                  </label>
                </div>
              </label>

              <button className="primary-button" disabled={isCreatingProject} type="submit">
                {isCreatingProject ? "Creating..." : "Create"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
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
  const { refreshSeed, openCreateDialog } = useOutletContext();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const projectList = await apiFetch("/api/projects");
      setProjects(projectList);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [refreshSeed]);

  return (
    <div className="page-stack">
      <section className="page-hero panel">
        <div>
          <h2>Projects</h2>
          <p className="muted">Open a project card to manage languages and translations.</p>
        </div>
        {roleAllows(user, "editor") ? (
          <button className="primary-button" type="button" onClick={openCreateDialog}>
            <span className="button-icon" aria-hidden="true">
              ＋
            </span>
            Create project
          </button>
        ) : null}
      </section>

      {error ? <section className="panel error-text">{error}</section> : null}

      {loading ? (
        <section className="panel empty-state">
          <h3>Loading projects...</h3>
        </section>
      ) : projects.length === 0 ? (
        <section className="empty-state page-empty-state">
          <h3>No projects yet</h3>
          <p className="muted">Create your first project to start translating JSON files.</p>
        </section>
      ) : (
        <section className="dashboard-grid">
          {projects.map((project) => (
            <article className="project-card panel" key={project.id}>
              <div className="card-top">
                <strong>{project.name}</strong>
                <div className="card-badges">
                  {project.version ? <span className="pill">v{project.version}</span> : null}
                  <span className="pill">{project.sourceLanguage.toUpperCase()}</span>
                </div>
              </div>
              {project.description ? <p className="muted">{project.description}</p> : null}
              <p className="muted">{project.languages.length} languages</p>
              <div className="mini-flags">
                {project.languages.slice(0, 5).map((language) => (
                  <span key={language.code} title={language.label}>
                    <Flag code={language.code} label={language.label} />
                  </span>
                ))}
              </div>
              <div className="project-card-actions">
                <Link className="primary-button" to={`/projects/${project.id}`}>
                  Open project
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function ProjectPage() {
  const { showToast } = useOutletContext();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { user, settings } = useApp();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState("");
  const [projectSettings, setProjectSettings] = useState({
    name: "",
    description: "",
    version: "",
    sourceLanguage: "",
  });
  const [languageFile, setLanguageFile] = useState(null);
  const [isLanguageFileHovering, setIsLanguageFileHovering] = useState(false);
  const [sourceFile, setSourceFile] = useState(null);
  const [isSourceFileHovering, setIsSourceFileHovering] = useState(false);
  const [uploadingLanguageCode, setUploadingLanguageCode] = useState("");
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [languageToDelete, setLanguageToDelete] = useState(null);
  const [languageActionMenu, setLanguageActionMenu] = useState(null);
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
          setProjectSettings({
            name: details.name || "",
            description: details.description || "",
            version: details.version || "",
            sourceLanguage: details.sourceLanguage || "",
          });
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

  function resetCreateLanguageDialog() {
    setLanguageFile(null);
    setIsLanguageFileHovering(false);
  }

  function openCreateLanguageDialog() {
    resetCreateLanguageDialog();
    setIsDialogOpen(true);
  }

  function closeCreateLanguageDialog() {
    setIsDialogOpen(false);
    resetCreateLanguageDialog();
  }

  function openEditProjectDialog() {
    setSourceFile(null);
    setIsSourceFileHovering(false);
    setIsEditDialogOpen(true);
  }

  function closeEditProjectDialog() {
    setIsEditDialogOpen(false);
    setSourceFile(null);
    setIsSourceFileHovering(false);
  }

  function closeDeleteProjectDialog() {
    setDeleteProjectOpen(false);
  }

  function closeDeleteLanguageDialog() {
    setLanguageToDelete(null);
  }

  function closeLanguageActionMenu() {
    setLanguageActionMenu(null);
  }

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
      formData.set("mode", languageFile ? "upload" : "empty");

      if (languageFile) {
        formData.set("file", languageFile);
        formData.set("fileName", languageFile.name);
      }

      const updated = await apiFetch(`/api/projects/${projectId}/languages`, {
        method: "POST",
        body: formData,
      });

      setProject(updated);
      closeCreateLanguageDialog();
      showToast("success", languageFile ? "Language added from uploaded file." : "Language added.");
    } catch (requestError) {
      showToast("error", requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateProject(event) {
    event.preventDefault();
    setBusy(true);

    try {
      let updated = await apiFetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectSettings.name,
          description: projectSettings.description,
          version: projectSettings.version,
          sourceLanguage: projectSettings.sourceLanguage,
        }),
      });

      if (sourceFile) {
        const formData = new FormData();
        formData.set("file", sourceFile);
        formData.set("fileName", sourceFile.name);

        updated = await apiFetch(`/api/projects/${projectId}/languages/${projectSettings.sourceLanguage}/upload`, {
          method: "POST",
          body: formData,
        });
      }

      setProject(updated);
      setProjectSettings({
        name: updated.name || "",
        description: updated.description || "",
        version: updated.version || "",
        sourceLanguage: updated.sourceLanguage || "",
      });
      closeEditProjectDialog();
      showToast(
        "success",
        sourceFile ? "Project details and source file updated." : "Project details updated.",
      );
    } catch (requestError) {
      showToast("error", requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReplaceLanguageFile(languageCode, file) {
    if (!file) {
      return;
    }

    setUploadingLanguageCode(languageCode);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("fileName", file.name);

      const updated = await apiFetch(`/api/projects/${projectId}/languages/${languageCode}/upload`, {
        method: "POST",
        body: formData,
      });

      setProject(updated);
      closeLanguageActionMenu();
      showToast("success", "Translation file updated.");
    } catch (requestError) {
      showToast("error", requestError.message);
    } finally {
      setUploadingLanguageCode("");
    }
  }

  async function handleDeleteProject() {
    setBusy(true);

    try {
      await apiFetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      closeDeleteProjectDialog();
      showToast("success", "Project deleted.");
      navigate("/");
    } catch (requestError) {
      showToast("error", requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteLanguage() {
    if (!languageToDelete) {
      return;
    }

    setBusy(true);

    try {
      const updated = await apiFetch(`/api/projects/${projectId}/languages/${languageToDelete.code}`, {
        method: "DELETE",
      });
      setProject(updated);
      closeDeleteLanguageDialog();
      closeLanguageActionMenu();
      showToast("success", "Language deleted.");
    } catch (requestError) {
      showToast("error", requestError.message);
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
    return <section className="panel error-text">{error}</section>;
  }

  if (!project) {
    return null;
  }

  return (
    <>
      <div className="page-stack">
        <section className="page-hero panel">
          <div>
            <div className="project-hero-header">
              <div>
                <p className="eyebrow">Project details</p>
                <div className="title-with-action">
                  <h2>{project.name}</h2>
                  {roleAllows(user, "editor") ? (
                    <button
                      className="title-action"
                      type="button"
                      aria-label="Edit project details"
                      onClick={openEditProjectDialog}
                    >
                      ✎
                    </button>
                  ) : null}
                </div>
              </div>
              {project.version ? (
                <div className="detail-badges">
                  <span className="pill">v{project.version}</span>
                </div>
              ) : null}
            </div>
            {project.description ? <p className="muted">{project.description}</p> : null}
            <p className="muted">
              Source language: <strong>{project.sourceLanguage.toUpperCase()}</strong>
            </p>
          </div>

          <div className="hero-actions">
            {roleAllows(user, "editor") ? (
              <button
                className="primary-button"
                type="button"
                onClick={openCreateLanguageDialog}
                disabled={!availableLanguages.length}
              >
                <span className="button-icon" aria-hidden="true">
                  ＋
                </span>
                Add language
              </button>
            ) : null}
            <a className="secondary-button" href={`/api/projects/${project.id}/download-all`}>
              <span className="button-icon" aria-hidden="true">
                ⭳
              </span>
              Download all
            </a>
          </div>
        </section>

        {project.languages.length === 0 ? (
          <section className="panel empty-state">
            <h3>No languages yet</h3>
          </section>
        ) : (
          <section className="project-language-grid">
            {project.languages.map((language) => {
              const display = languageDisplay(language.code, language.label);

              return (
                <article key={language.code} className="language-card panel">
                  <div className="card-top">
                    <div className="lang-title">
                      <Flag code={display.code} label={display.label} className="flag" />
                      <div>
                        <strong>{display.label}</strong>
                        <p className="muted code-label">{language.code.toUpperCase()}</p>
                      </div>
                    </div>
                    {language.isSource ? <span className="pill">Source</span> : null}
                  </div>

                  <div className="progress-section">
                    <div className="progress-copy">
                      <span className="progress-label">Translation progress</span>
                      <span className="muted progress-stats">
                        Translated: {language.progress.completed} · Total: {language.progress.total}
                      </span>
                    </div>
                    <div
                      className="progress-track"
                      role="progressbar"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      aria-valuenow={language.progress.percent}
                      aria-label="Translation progress"
                    >
                      <div className="progress-bar" style={{ width: `${language.progress.percent}%` }}>
                        <span className="progress-value">{language.progress.percent}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="card-actions">
                    <Link className="primary-button" to={`/projects/${project.id}/languages/${language.code}/edit`}>
                      <span className="button-icon" aria-hidden="true">
                        ✎
                      </span>
                      Edit
                    </Link>
                    <button
                      className="secondary-button action-menu-button"
                      type="button"
                      aria-label={`Open actions for ${display.label}`}
                      onClick={() => setLanguageActionMenu(language)}
                    >
                      ⋯
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>

      {isDialogOpen ? (
        <div className="dialog-backdrop">
          <div className="dialog panel dialog-compact" onClick={(event) => event.stopPropagation()}>
            <div className="dialog-header">
              <div>
                <h2>Add language</h2>
              </div>
              <button className="dialog-close" type="button" aria-label="Close dialog" onClick={closeCreateLanguageDialog}>
                ×
              </button>
            </div>

            {availableLanguages.length === 0 ? (
              <div className="empty-state">
                <h3>All available languages already exist</h3>
              </div>
            ) : (
              <form className="stack-form" onSubmit={handleCreateLanguage}>
                <FlagSelect value={selectedCode} options={availableLanguages} onChange={setSelectedCode} />

                <label>
                  <span>Existing translation file (optional)</span>
                  <div
                    className={`dropzone dropzone-compact ${isLanguageFileHovering ? "hover" : ""}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setIsLanguageFileHovering(true);
                    }}
                    onDragLeave={() => setIsLanguageFileHovering(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setIsLanguageFileHovering(false);
                      setLanguageFile(event.dataTransfer.files?.[0] || null);
                    }}
                  >
                    <input
                      id="language-upload-file"
                      type="file"
                      accept=".json,application/json"
                      onChange={(event) => setLanguageFile(event.target.files?.[0] || null)}
                    />
                    <label htmlFor="language-upload-file" className="dropzone-content">
                      <strong>{languageFile ? languageFile.name : "Drop JSON file here"}</strong>
                      <span>
                        {languageFile
                          ? "This file will be used to initialize the new language."
                          : "Optional: upload an existing translation or create an empty language."}
                      </span>
                    </label>
                  </div>
                </label>

                <button className="primary-button" disabled={busy} type="submit">
                  {busy ? "Adding..." : languageFile ? "Add from file" : "Add"}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {isEditDialogOpen ? (
        <div className="dialog-backdrop">
          <div className="dialog panel dialog-compact" onClick={(event) => event.stopPropagation()}>
            <div className="dialog-header">
              <div>
                <h2>Edit project</h2>
              </div>
              <button className="dialog-close" type="button" aria-label="Close dialog" onClick={closeEditProjectDialog}>
                ×
              </button>
            </div>

            <form className="stack-form" onSubmit={handleUpdateProject}>
              <label>
                <span>Name</span>
                <input
                  required
                  value={projectSettings.name}
                  onChange={(event) =>
                    setProjectSettings((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>

              <label>
                <span>Description</span>
                <textarea
                  rows="4"
                  value={projectSettings.description}
                  onChange={(event) =>
                    setProjectSettings((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>

              <label>
                <span>Version</span>
                <input
                  value={projectSettings.version}
                  onChange={(event) =>
                    setProjectSettings((current) => ({ ...current, version: event.target.value }))
                  }
                />
              </label>

              <FlagSelect
                label="Source language"
                value={projectSettings.sourceLanguage}
                options={project.languages.map((language) => ({
                  code: language.code,
                  label: language.label,
                }))}
                onChange={(nextCode) =>
                  setProjectSettings((current) => ({ ...current, sourceLanguage: nextCode }))
                }
              />

              <label>
                <span>Source language file (optional)</span>
                <div
                  className={`dropzone dropzone-compact ${isSourceFileHovering ? "hover" : ""}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsSourceFileHovering(true);
                  }}
                  onDragLeave={() => setIsSourceFileHovering(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsSourceFileHovering(false);
                    setSourceFile(event.dataTransfer.files?.[0] || null);
                  }}
                >
                  <input
                    id="project-source-update-file"
                    type="file"
                    accept=".json,application/json"
                    onChange={(event) => setSourceFile(event.target.files?.[0] || null)}
                  />
                  <label htmlFor="project-source-update-file" className="dropzone-content">
                    <strong>{sourceFile ? sourceFile.name : "Drop JSON file here"}</strong>
                    <span>
                      {sourceFile
                        ? "This file will replace the selected source language file."
                        : "Optional: upload a new source language file while saving project details."}
                    </span>
                  </label>
                </div>
              </label>

              <button className="primary-button" disabled={busy} type="submit">
                {busy ? "Saving..." : "Save changes"}
              </button>
              {settings?.allowProjectDelete ? (
                <button className="danger-button" disabled={busy} type="button" onClick={() => setDeleteProjectOpen(true)}>
                  Delete project
                </button>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}

      {deleteProjectOpen ? (
        <div className="dialog-backdrop">
          <div className="dialog panel dialog-compact" onClick={(event) => event.stopPropagation()}>
            <div className="dialog-header">
              <div>
                <h2>Delete project</h2>
              </div>
              <button className="dialog-close" type="button" aria-label="Close dialog" onClick={closeDeleteProjectDialog}>
                ×
              </button>
            </div>

            <div className="dialog-copy">
              <p className="muted">
                Delete <strong>{project.name}</strong> and all of its language files? This cannot be undone.
              </p>
            </div>

            <div className="dialog-actions">
              <button className="secondary-button" type="button" onClick={closeDeleteProjectDialog}>
                Cancel
              </button>
              <button className="danger-button" type="button" disabled={busy} onClick={handleDeleteProject}>
                {busy ? "Deleting..." : "Delete project"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {languageToDelete ? (
        <div className="dialog-backdrop">
          <div className="dialog panel dialog-compact" onClick={(event) => event.stopPropagation()}>
            <div className="dialog-header">
              <div>
                <h2>Delete language</h2>
              </div>
              <button className="dialog-close" type="button" aria-label="Close dialog" onClick={closeDeleteLanguageDialog}>
                ×
              </button>
            </div>

            <div className="dialog-copy">
              <p className="muted">
                Delete <strong>{languageDisplay(languageToDelete.code, languageToDelete.label).label}</strong> from
                this project? This cannot be undone.
              </p>
            </div>

            <div className="dialog-actions">
              <button className="secondary-button" type="button" onClick={closeDeleteLanguageDialog}>
                Cancel
              </button>
              <button className="danger-button" type="button" disabled={busy} onClick={handleDeleteLanguage}>
                {busy ? "Deleting..." : "Delete language"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {languageActionMenu ? (
        <div className="dialog-backdrop">
          <div className="dialog panel dialog-compact" onClick={(event) => event.stopPropagation()}>
            <div className="dialog-header">
              <div>
                <h2>{languageDisplay(languageActionMenu.code, languageActionMenu.label).label}</h2>
              </div>
              <button className="dialog-close" type="button" aria-label="Close dialog" onClick={closeLanguageActionMenu}>
                ×
              </button>
            </div>

            <div className="dialog-actions dialog-actions-stacked">
              <a
                className="secondary-button"
                href={`/api/projects/${project.id}/download/${languageActionMenu.code}`}
                onClick={closeLanguageActionMenu}
              >
                <span className="button-icon" aria-hidden="true">
                  ⭳
                </span>
                Download
              </a>
              {roleAllows(user, "editor") ? (
                <label className="secondary-button upload-button">
                  <input
                    type="file"
                    accept=".json,application/json"
                    disabled={busy || uploadingLanguageCode === languageActionMenu.code}
                    onChange={(event) => {
                      void handleReplaceLanguageFile(languageActionMenu.code, event.target.files?.[0] || null);
                      event.target.value = "";
                    }}
                  />
                  <span className="button-icon" aria-hidden="true">
                    ⭱
                  </span>
                  {uploadingLanguageCode === languageActionMenu.code ? "Uploading..." : "Upload"}
                </label>
              ) : null}
              {!languageActionMenu.isSource && roleAllows(user, "editor") && settings?.allowLanguageDelete ? (
                <button
                  className="danger-button"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setLanguageToDelete(languageActionMenu);
                    closeLanguageActionMenu();
                  }}
                >
                  <span className="button-icon" aria-hidden="true">
                    ×
                  </span>
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function EditorPage() {
  const { showToast } = useOutletContext();
  const { projectId, languageCode } = useParams();
  const { user } = useApp();
  const [project, setProject] = useState(null);
  const [editorData, setEditorData] = useState(null);
  const [editorDraft, setEditorDraft] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
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

  const filteredRows = useMemo(() => {
    if (!editorData) {
      return [];
    }

    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return editorData.rows;
    }

    return editorData.rows.filter((row) => {
      const sourceValue = String(row.source ?? "").toLowerCase();
      const translatedValue = String(editorDraft[row.key] ?? row.translation ?? "").toLowerCase();

      return (
        row.key.toLowerCase().includes(normalizedQuery) ||
        sourceValue.includes(normalizedQuery) ||
        translatedValue.includes(normalizedQuery)
      );
    });
  }, [deferredSearchQuery, editorData, editorDraft]);

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

      setEditorData((current) =>
        current
          ? {
              ...current,
              progress: result.progress,
              rows: current.rows.map((row) => ({
                ...row,
                translation: editorDraft[row.key] ?? "",
              })),
            }
          : current,
      );
      showToast("success", `Saved. ${progressLabel(result.progress)}`);
    } catch (requestError) {
      showToast("error", requestError.message);
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
    return <section className="panel error-text">{error}</section>;
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
            <span className="editor-title-text">
              <Flag code={editorLanguage.code} label={editorLanguage.label} className="editor-flag" />{" "}
              {editorLanguage.label}
            </span>
          </h2>
          <p className="muted">
            Progress: {editorData.progress.percent}% · Translated strings: {editorData.progress.completed}/
            {editorData.progress.total}
          </p>
        </div>

        {roleAllows(user, "editor") ? (
          <button className="primary-button" disabled={busy} type="button" onClick={handleSaveTranslations}>
            <span className="button-icon" aria-hidden="true">
              ✎
            </span>
            {busy ? "Saving..." : "Save progress"}
          </button>
        ) : null}
      </div>

      <div className="editor-list">
        <label className="editor-search">
          <span>Search translations</span>
          <input
            type="search"
            placeholder="Search by key, source text, or translation..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>

        {filteredRows.length === 0 ? (
          <div className="empty-state editor-empty-state">
            <h3>No matching translations</h3>
            <p className="muted">Try a different search term for the key, source text, or translation.</p>
          </div>
        ) : (
          filteredRows.map((row) => (
            <div className="editor-row" key={row.key}>
              <label className="editor-field">
                <span className="field-key">{row.key}</span>
                <input readOnly value={String(row.source ?? "")} />
              </label>

              <label className="editor-field editor-field-editable">
                <span className="field-key field-key-placeholder">{row.key}</span>
                <input
                  readOnly={!roleAllows(user, "editor")}
                  value={String(editorDraft[row.key] ?? "")}
                  onChange={(event) =>
                    setEditorDraft((current) => ({
                      ...current,
                      [row.key]: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          ))
        )}
      </div>
    </section>
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
