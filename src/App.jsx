import { createContext, useContext, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiChevronDown,
  FiChevronLeft,
  FiDownload,
  FiEdit2,
  FiLogOut,
  FiMoreHorizontal,
  FiMoon,
  FiPlus,
  FiSave,
  FiSun,
  FiUpload,
  FiX,
} from "react-icons/fi";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
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

const apiKeyScopeOptions = ["create", "read", "update", "delete"];
const appVersion = __APP_VERSION__;

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

function getSsoCallbackUrl() {
  if (typeof window === "undefined") {
    return "/api/auth/sso/callback";
  }

  return `${window.location.origin}/api/auth/sso/callback`;
}

function normalizeSsoIssuerUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/g, "")
    .replace(/\/\.well-known\/openid-configuration$/i, "");
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

function formatDateTime(value) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

function getSystemTheme() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function PasswordEyeIcon({ hidden = false }) {
  return hidden ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 4.5 20 19.5M10.6 6.3A10.7 10.7 0 0 1 12 6.2c5.1 0 8.8 3.4 10 5.8-.5 1-1.5 2.4-2.9 3.5M6.6 9C5 10.1 3.9 11.6 3.4 12c1.2 2.4 4.9 5.8 10 5.8 1.2 0 2.3-.2 3.3-.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.9 11.1a3 3 0 0 0 4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2.8 12c1.3-2.6 5.1-5.8 9.2-5.8s7.9 3.2 9.2 5.8c-1.3 2.6-5.1 5.8-9.2 5.8S4.1 14.6 2.8 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
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
            <FiChevronDown />
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

function DialogPortal({ children }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
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
  const location = useLocation();
  if (loading) {
    return <LoadingPage />;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
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
          <NavLink className={({ isActive }) => `menu-link${isActive ? " active" : ""}`} to="/settings">
            Settings
          </NavLink>
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
                <FiSun className="switch-glyph" />
              </span>
              <span className="switch-thumb" />
              <span className="switch-icon switch-icon-moon" aria-hidden="true">
                <FiMoon className="switch-glyph" />
              </span>
            </button>
          </label>

          <button className="icon-button danger-icon-button" type="button" aria-label="Sign out" onClick={handleLogout}>
            <FiLogOut />
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
          <FiChevronLeft />
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
                className="dialog-close"
                type="button"
                aria-label="Close dialog"
                onClick={closeCreateDialog}
              >
                <FiX />
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
  const location = useLocation();
  const { refreshBootstrap, settings } = useApp();
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const passwordLoginEnabled = settings?.sso?.passwordLoginEnabled !== false;
  const ssoEnabled = Boolean(settings?.sso?.enabled);
  const ssoProviderName = settings?.sso?.provider?.trim() || "SSO";

  function handleSsoLogin() {
    const from = location.state?.from;
    const returnTo = from ? `${from.pathname || ""}${from.search || ""}${from.hash || ""}` || "/" : "/";
    window.location.assign(`/api/auth/sso/start?returnTo=${encodeURIComponent(returnTo)}`);
  }

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

          {passwordLoginEnabled ? (
            <>
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
            </>
          ) : null}

          {error ? <p className="error-text">{error}</p> : null}

          {passwordLoginEnabled ? (
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          ) : null}

          {passwordLoginEnabled && ssoEnabled ? (
            <div className="auth-divider">
              <span>or</span>
            </div>
          ) : null}

          {ssoEnabled ? (
            <button className="secondary-button" type="button" onClick={handleSsoLogin}>
              {`Login with ${ssoProviderName}`}
            </button>
          ) : null}

          {passwordLoginEnabled && settings?.allowRegistration ? (
            <p className="muted">
              No account yet? <Link to="/register">Register here</Link>
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}

function SsoStatusPage() {
  const [searchParams] = useSearchParams();
  const reason = searchParams.get("reason") || "";
  const detail = searchParams.get("detail") || "";

  let title = "SSO sign-in";
  let message = "We could not complete your SSO sign-in.";

  if (reason === "inactive") {
    title = "Account inactive";
    message = "Your account is inactive. Please contact an administrator before signing in.";
  } else if (reason === "provisioning-disabled") {
    title = "Account access pending";
    message = "Your account is not provisioned, and automatic SSO provisioning is disabled. Please contact an administrator.";
  } else if (reason === "missing-email") {
    title = "Email required";
    message = "Your identity provider did not return an email address. Please ask an administrator to add the email claim.";
  } else if (reason === "role-mapping-missing") {
    title = "No mapped role";
    message = "Your account signed in successfully, but none of the configured SSO group mappings matched. Please contact an administrator.";
  } else if (reason === "state-mismatch" || reason === "session-expired") {
    title = "Session expired";
    message = "The SSO sign-in session expired or became invalid. Please try again.";
  } else if (reason === "not-configured") {
    title = "SSO not configured";
    message = "SSO is enabled, but the provider settings are incomplete. Please review the SSO settings.";
  }

  return (
    <div className="screen-center">
      <div className="panel auth-card stack-form">
        <h1>{title}</h1>
        <p className="muted">{message}</p>
        {detail ? <p className="error-text">{detail}</p> : null}
        <div>
          <Link className="secondary-button" to="/login">
            Back to sign in
          </Link>
        </div>
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

  if (settings && settings.sso?.passwordLoginEnabled === false) {
    return (
      <div className="screen-center">
        <div className="panel auth-card">
          <h1>Email sign-up disabled</h1>
          <p className="muted">This workspace only allows sign-in through SSO.</p>
          <Link className="primary-button link-button" to="/login">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

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
      <section className="page-hero">
        <div>
          <h2>Projects</h2>
        </div>
        {roleAllows(user, "editor") ? (
          <button className="primary-button" type="button" onClick={openCreateDialog}>
            <span className="button-icon" aria-hidden="true">
              <FiPlus />
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
        <section className="page-hero">
          <div>
            <div className="project-hero-header">
              <div>
                <div className="title-with-action">
                  <h2>{project.name}</h2>
                  {roleAllows(user, "editor") ? (
                    <button
                      className="title-action"
                      type="button"
                      aria-label="Edit project details"
                      onClick={openEditProjectDialog}
                    >
                      <FiEdit2 />
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
                  <FiPlus />
                </span>
                Add language
              </button>
            ) : null}
            <a className="secondary-button" href={`/api/projects/${project.id}/download-all`}>
              <span className="button-icon" aria-hidden="true">
                <FiDownload />
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
                        <FiEdit2 />
                      </span>
                      Edit
                    </Link>
                    <button
                      className="secondary-button action-menu-button"
                      type="button"
                      aria-label={`Open actions for ${display.label}`}
                      onClick={() => setLanguageActionMenu(language)}
                    >
                      <FiMoreHorizontal />
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
                <FiX />
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
                <FiX />
              </button>
            </div>

            <form className="stack-form" onSubmit={handleUpdateProject}>
              <label>
                <span>Project ID</span>
                <input readOnly value={project.id} />
                <span className="helper-text">Use this ID in API requests and GitHub workflow uploads.</span>
              </label>

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
                <FiX />
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
                <FiX />
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
                <FiX />
              </button>
            </div>

            <div className="dialog-actions dialog-actions-stacked">
              <a
                className="secondary-button"
                href={`/api/projects/${project.id}/download/${languageActionMenu.code}`}
                onClick={closeLanguageActionMenu}
              >
                <span className="button-icon" aria-hidden="true">
                  <FiDownload />
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
                    <FiUpload />
                  </span>
                  {uploadingLanguageCode === languageActionMenu.code ? "Uploading..." : "Upload new file"}
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
                    <FiX />
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
          <h2 className="editor-title">
            <Link className="back-link" to={`/projects/${project.id}`}>
              <FiChevronLeft />
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
              <FiSave />
            </span>
            {busy ? "Saving..." : "Save progress"}
          </button>
        ) : null}
      </div>

      <div className="editor-list">
        <label className="editor-search">
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
  const { user } = useApp();
  const isAdmin = roleAllows(user, "admin");
  const { tab } = useParams();
  const allowedTabs = isAdmin ? ["profile", "users", "app", "api", "sso"] : ["profile"];
  const activeTab = allowedTabs.includes(tab) ? tab : "profile";

  if (!tab) {
    return <Navigate to="/settings/profile" replace />;
  }

  if (tab !== activeTab) {
    return <Navigate to={`/settings/${activeTab}`} replace />;
  }

  return (
    <main className="page-stack">
      <section className="page-stack">
        <div>
          <h2>Settings</h2>
        </div>
      </section>

      <div className="settings-tabbar" role="tablist" aria-label="Settings sections">
        <NavLink
          className={({ isActive }) => (isActive ? "tab-button active" : "tab-button")}
          to="/settings/profile"
          role="tab"
          aria-selected={activeTab === "profile"}
          aria-controls="settings-panel"
        >
          Profile
        </NavLink>
        {isAdmin ? (
          <NavLink
            className={({ isActive }) => (isActive ? "tab-button active" : "tab-button")}
            to="/settings/users"
            role="tab"
            aria-selected={activeTab === "users"}
            aria-controls="settings-panel"
          >
            Users
          </NavLink>
        ) : null}
        {isAdmin ? (
          <NavLink
            className={({ isActive }) => (isActive ? "tab-button active" : "tab-button")}
            to="/settings/app"
            role="tab"
            aria-selected={activeTab === "app"}
            aria-controls="settings-panel"
          >
            System
          </NavLink>
        ) : null}
        {isAdmin ? (
          <NavLink
            className={({ isActive }) => (isActive ? "tab-button active" : "tab-button")}
            to="/settings/api"
            role="tab"
            aria-selected={activeTab === "api"}
            aria-controls="settings-panel"
          >
            API
          </NavLink>
        ) : null}
        {isAdmin ? (
          <NavLink
            className={({ isActive }) => (isActive ? "tab-button active" : "tab-button")}
            to="/settings/sso"
            role="tab"
            aria-selected={activeTab === "sso"}
            aria-controls="settings-panel"
          >
            SSO
          </NavLink>
        ) : null}
      </div>

      <section className="panel page-stack" id="settings-panel" role="tabpanel" aria-label={`${activeTab} settings`}>
        {activeTab === "profile" ? <ProfileTab /> : null}
        {isAdmin && activeTab === "users" ? <UsersTab /> : null}
        {isAdmin && activeTab === "app" ? <AppSettingsTab /> : null}
        {isAdmin && activeTab === "api" ? <ApiSettingsTab /> : null}
        {isAdmin && activeTab === "sso" ? <SsoSettingsTab /> : null}
      </section>
    </main>
  );
}

function ProfileTab() {
  const { user, setBootstrap } = useApp();
  const { showToast } = useOutletContext();
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
  });
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [visiblePasswords, setVisiblePasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  useEffect(() => {
    setProfileForm({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
    });
  }, [user?.firstName, user?.lastName, user?.email]);

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileError("");

    if (!profileForm.firstName.trim() || !profileForm.lastName.trim() || !profileForm.email.trim()) {
      const message = "First name, last name, and email are required.";
      setProfileError(message);
      showToast("error", message);
      return;
    }

    setProfileSubmitting(true);
    try {
      const payload = await apiFetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      setBootstrap((current) => ({
        ...current,
        user: payload.user,
      }));
      showToast("success", "Profile saved.");
    } catch (submitError) {
      setProfileError(submitError.message);
      showToast("error", submitError.message);
    } finally {
      setProfileSubmitting(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordError("");

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      const message = "Please fill in all password fields.";
      setPasswordError(message);
      showToast("error", message);
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      const message = "The new passwords do not match.";
      setPasswordError(message);
      showToast("error", message);
      return;
    }

    setPasswordSubmitting(true);
    try {
      await apiFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      setForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      showToast("success", "Password updated.");
    } catch (submitError) {
      setPasswordError(submitError.message);
      showToast("error", submitError.message);
    } finally {
      setPasswordSubmitting(false);
    }
  }

  return (
    <section className="page-stack">
      <div className="section-head">
        <div>
          <h3>Profile</h3>
        </div>
      </div>

      <form className="stack-form" onSubmit={handleProfileSubmit}>
        <div className="profile-summary-grid">
          <label>
            <span>First name</span>
            <input
              value={profileForm.firstName}
              onChange={(event) => setProfileForm((current) => ({ ...current, firstName: event.target.value }))}
            />
          </label>
          <label>
            <span>Last name</span>
            <input
              value={profileForm.lastName}
              onChange={(event) => setProfileForm((current) => ({ ...current, lastName: event.target.value }))}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={profileForm.email}
              onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label>
            <span>Role</span>
            <input value={user?.role || ""} readOnly />
          </label>
        </div>

        <div>
          {profileError ? <p className="error-text">{profileError}</p> : null}

          <button className="primary-button" type="submit" disabled={profileSubmitting}>
            {profileSubmitting ? "Saving..." : "Save profile"}
          </button>
        </div>
      </form>

      <form className="stack-form profile-password-form" onSubmit={handlePasswordSubmit}>
        <div>
          <h3>Change password</h3>
        </div>

        <div className="split-grid">
          <label>
            <span>Current password</span>
            <div className="password-field">
              <input
                type={visiblePasswords.currentPassword ? "text" : "password"}
                value={form.currentPassword}
                onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))}
                required
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() =>
                  setVisiblePasswords((current) => ({
                    ...current,
                    currentPassword: !current.currentPassword,
                  }))
                }
                aria-label={visiblePasswords.currentPassword ? "Hide current password" : "Show current password"}
                aria-pressed={visiblePasswords.currentPassword}
              >
                <PasswordEyeIcon hidden={visiblePasswords.currentPassword} />
              </button>
            </div>
          </label>
          <div aria-hidden="true" />
        </div>

        <div className="split-grid">
          <label>
            <span>New password</span>
            <div className="password-field">
              <input
                type={visiblePasswords.newPassword ? "text" : "password"}
                value={form.newPassword}
                onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))}
                required
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() =>
                  setVisiblePasswords((current) => ({
                    ...current,
                    newPassword: !current.newPassword,
                  }))
                }
                aria-label={visiblePasswords.newPassword ? "Hide new password" : "Show new password"}
                aria-pressed={visiblePasswords.newPassword}
              >
                <PasswordEyeIcon hidden={visiblePasswords.newPassword} />
              </button>
            </div>
          </label>
          <label>
            <span>Confirm new password</span>
            <div className="password-field">
              <input
                type={visiblePasswords.confirmPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                required
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() =>
                  setVisiblePasswords((current) => ({
                    ...current,
                    confirmPassword: !current.confirmPassword,
                  }))
                }
                aria-label={visiblePasswords.confirmPassword ? "Hide confirmed password" : "Show confirmed password"}
                aria-pressed={visiblePasswords.confirmPassword}
              >
                <PasswordEyeIcon hidden={visiblePasswords.confirmPassword} />
              </button>
            </div>
          </label>
        </div>

        {passwordError ? <p className="error-text">{passwordError}</p> : null}

        <div>
          <button className="primary-button" type="submit" disabled={passwordSubmitting}>
            {passwordSubmitting ? "Saving..." : "Save password"}
          </button>
        </div>
      </form>
    </section>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [actionUser, setActionUser] = useState(null);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [nextRole, setNextRole] = useState("viewer");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
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
  const [submitting, setSubmitting] = useState(false);

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

  function resetForm() {
    setSelectedUserId("");
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "viewer",
      status: "active",
    });
    setError("");
  }

  function openCreateUserDialog() {
    resetForm();
    setIsUserDialogOpen(true);
  }

  function closeUserDialog() {
    setIsUserDialogOpen(false);
    resetForm();
  }

  function openActionMenu(user) {
    setActionUser(user);
    setError("");
  }

  function closeActionMenu() {
    setActionUser(null);
  }

  function openResetPasswordDialog() {
    setResetPassword("");
    setIsResetPasswordOpen(true);
    closeActionMenu();
  }

  function closeResetPasswordDialog() {
    setIsResetPasswordOpen(false);
    setResetPassword("");
  }

  function openRoleDialog() {
    setNextRole(actionUser?.role || "viewer");
    setIsRoleDialogOpen(true);
    closeActionMenu();
  }

  function closeRoleDialog() {
    setIsRoleDialogOpen(false);
    setNextRole("viewer");
  }

  function openDeleteDialog() {
    setIsDeleteDialogOpen(true);
    closeActionMenu();
  }

  function closeDeleteDialog() {
    setIsDeleteDialogOpen(false);
  }

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
    setError("");
    setIsUserDialogOpen(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
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
      closeUserDialog();
      await loadUsers();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    if (!actionUser) {
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await apiFetch(`/api/users/${actionUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      closeResetPasswordDialog();
      await loadUsers();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange() {
    if (!actionUser) {
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await apiFetch(`/api/users/${actionUser.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      closeRoleDialog();
      await loadUsers();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivateUser() {
    if (!actionUser) {
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await apiFetch(`/api/users/${actionUser.id}/deactivate`, {
        method: "POST",
      });
      closeActionMenu();
      await loadUsers();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteUser() {
    if (!actionUser) {
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await apiFetch(`/api/users/${actionUser.id}`, {
        method: "DELETE",
      });
      closeDeleteDialog();
      setActionUser(null);
      await loadUsers();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="page-stack">
        <div className="section-head">
          <div>
            <h3>Users</h3>
          </div>
          <button className="primary-button" type="button" onClick={openCreateUserDialog}>
            <span className="button-icon" aria-hidden="true">
              <FiPlus />
            </span>
            Add user
          </button>
        </div>
        {loading ? <p>Loading users…</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th className="actions-cell">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    {user.firstName} {user.lastName}
                  </td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.status}</td>
                  <td className="actions-cell">
                    <button
                      className="icon-button table-action-button"
                      type="button"
                      aria-label={`Open actions for ${user.firstName} ${user.lastName}`}
                      onClick={() => openActionMenu(user)}
                    >
                      <FiMoreHorizontal />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isUserDialogOpen ? (
        <DialogPortal>
          <div className="dialog-backdrop">
            <div className="dialog panel dialog-compact" onClick={(event) => event.stopPropagation()}>
            <div className="dialog-header">
              <div>
                <h2>{selectedUserId ? "Edit user" : "Add user"}</h2>
              </div>
              <button className="dialog-close" type="button" aria-label="Close dialog" onClick={closeUserDialog}>
                <FiX />
              </button>
            </div>

            <form className="stack-form" onSubmit={handleSubmit}>
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

              {error ? <p className="error-text">{error}</p> : null}

              <div className="dialog-actions">
                <button className="secondary-button" type="button" onClick={closeUserDialog}>
                  Cancel
                </button>
                <button className="primary-button" type="submit" disabled={submitting}>
                  {submitting ? (selectedUserId ? "Saving..." : "Creating...") : selectedUserId ? "Save user" : "Create user"}
                </button>
              </div>
            </form>
            </div>
          </div>
        </DialogPortal>
      ) : null}

      {actionUser ? (
        <DialogPortal>
          <div className="dialog-backdrop">
            <div className="dialog panel dialog-compact" onClick={(event) => event.stopPropagation()}>
            <div className="dialog-header">
              <div>
                <h2>
                  {actionUser.firstName} {actionUser.lastName}
                </h2>
              </div>
              <button className="dialog-close" type="button" aria-label="Close dialog" onClick={closeActionMenu}>
                <FiX />
              </button>
            </div>

            <div className="dialog-actions dialog-actions-stacked">
              <button className="secondary-button" type="button" onClick={() => fillFromUser(actionUser)}>
                Edit
              </button>
              <button className="danger-button" type="button" onClick={openDeleteDialog}>
                Delete
              </button>
            </div>
            </div>
          </div>
        </DialogPortal>
      ) : null}

      {isResetPasswordOpen ? (
        <DialogPortal>
          <div className="dialog-backdrop">
            <div className="dialog panel dialog-compact" onClick={(event) => event.stopPropagation()}>
            <div className="dialog-header">
              <div>
                <h2>Reset password</h2>
              </div>
              <button className="dialog-close" type="button" aria-label="Close dialog" onClick={closeResetPasswordDialog}>
                <FiX />
              </button>
            </div>

            <div className="stack-form">
              <label>
                <span>New password</span>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                />
              </label>

              {error ? <p className="error-text">{error}</p> : null}

              <div className="dialog-actions">
                <button className="secondary-button" type="button" onClick={closeResetPasswordDialog}>
                  Cancel
                </button>
                <button className="primary-button" type="button" disabled={!resetPassword || submitting} onClick={handleResetPassword}>
                  {submitting ? "Saving..." : "Save password"}
                </button>
              </div>
            </div>
            </div>
          </div>
        </DialogPortal>
      ) : null}

      {isRoleDialogOpen ? (
        <DialogPortal>
          <div className="dialog-backdrop">
            <div className="dialog panel dialog-compact" onClick={(event) => event.stopPropagation()}>
            <div className="dialog-header">
              <div>
                <h2>Change role</h2>
              </div>
              <button className="dialog-close" type="button" aria-label="Close dialog" onClick={closeRoleDialog}>
                <FiX />
              </button>
            </div>

            <div className="stack-form">
              <label>
                <span>Role</span>
                <select value={nextRole} onChange={(event) => setNextRole(event.target.value)}>
                  <option value="admin">admin</option>
                  <option value="editor">editor</option>
                  <option value="viewer">viewer</option>
                </select>
              </label>

              {error ? <p className="error-text">{error}</p> : null}

              <div className="dialog-actions">
                <button className="secondary-button" type="button" onClick={closeRoleDialog}>
                  Cancel
                </button>
                <button className="primary-button" type="button" disabled={submitting} onClick={handleRoleChange}>
                  {submitting ? "Saving..." : "Save role"}
                </button>
              </div>
            </div>
            </div>
          </div>
        </DialogPortal>
      ) : null}

      {isDeleteDialogOpen ? (
        <DialogPortal>
          <div className="dialog-backdrop">
            <div className="dialog panel dialog-compact" onClick={(event) => event.stopPropagation()}>
            <div className="dialog-header">
              <div>
                <h2>Delete user</h2>
              </div>
              <button className="dialog-close" type="button" aria-label="Close dialog" onClick={closeDeleteDialog}>
                <FiX />
              </button>
            </div>

            <div className="dialog-copy">
              <p className="muted">
                Delete <strong>{actionUser?.firstName} {actionUser?.lastName}</strong>? This cannot be undone.
              </p>
            </div>

            {error ? <p className="error-text">{error}</p> : null}

            <div className="dialog-actions">
              <button className="secondary-button" type="button" onClick={closeDeleteDialog}>
                Cancel
              </button>
              <button className="danger-button" type="button" disabled={submitting} onClick={handleDeleteUser}>
                {submitting ? "Deleting..." : "Delete"}
              </button>
            </div>
            </div>
          </div>
        </DialogPortal>
      ) : null}
    </>
  );
}

function AppSettingsTab() {
  const { setBootstrap } = useApp();
  const { showToast } = useOutletContext();
  const [form, setForm] = useState({
    allowRegistration: true,
    allowProjectDelete: true,
    allowLanguageDelete: true,
  });
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      const payload = await apiFetch("/api/settings/app", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setBootstrap((current) => ({
        ...current,
        settings: payload,
      }));
      showToast("success", "System settings saved.");
    } catch (submitError) {
      showToast("error", submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="stack-form app-settings-form" onSubmit={handleSubmit}>
      <p className="helper-text">App-Version: {appVersion}</p>

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
      <button className="primary-button" type="submit" disabled={submitting}>
        {submitting ? "Saving..." : "Save app settings"}
      </button>
    </form>
  );
}

function ApiSettingsTab() {
  const { showToast } = useOutletContext();
  const [apiKeys, setApiKeys] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState(null);
  const [createdSecret, setCreatedSecret] = useState("");
  const [form, setForm] = useState({
    name: "",
    scopes: ["update"],
    projectAccessMode: "all",
    projectIds: [],
  });

  const selectedProjectNames = useMemo(() => {
    const selectedIds = new Set(form.projectIds);
    return projects.filter((project) => selectedIds.has(project.id)).map((project) => project.name);
  }, [form.projectIds, projects]);

  async function loadProjects({ silent = false } = {}) {
    if (!silent) {
      setProjectsLoading(true);
    }

    try {
      const projectsPayload = await apiFetch("/api/projects");
      setProjects(projectsPayload);
      return projectsPayload;
    } catch (loadError) {
      if (!silent) {
        setError(loadError.message);
      }
      return [];
    } finally {
      if (!silent) {
        setProjectsLoading(false);
      }
    }
  }

  useEffect(() => {
    async function loadApiSettings() {
      setLoading(true);
      setError("");
      try {
        const keysPayload = await apiFetch("/api/settings/api-keys");
        setApiKeys(keysPayload);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }

      await loadProjects({ silent: true });
    }

    loadApiSettings();
  }, []);

  useEffect(() => {
    if (!isCreateDialogOpen || form.projectAccessMode !== "selected") {
      return;
    }

    loadProjects();
  }, [isCreateDialogOpen, form.projectAccessMode]);

  function resetForm() {
    setForm({
      name: "",
      scopes: ["update"],
      projectAccessMode: "all",
      projectIds: [],
    });
  }

  function openCreateDialog() {
    resetForm();
    setCreatedSecret("");
    setError("");
    setIsCreateDialogOpen(true);
  }

  function closeCreateDialog() {
    setIsCreateDialogOpen(false);
    resetForm();
  }

  function openDeleteDialog(apiKey) {
    setSelectedApiKey(apiKey);
    setError("");
    setIsDeleteDialogOpen(true);
  }

  function closeDeleteDialog() {
    setIsDeleteDialogOpen(false);
    setSelectedApiKey(null);
  }

  function toggleScope(scope) {
    setForm((current) => ({
      ...current,
      scopes: current.scopes.includes(scope)
        ? current.scopes.filter((value) => value !== scope)
        : [...current.scopes, scope],
    }));
  }

  function toggleProject(projectId) {
    setForm((current) => ({
      ...current,
      projectIds: current.projectIds.includes(projectId)
        ? current.projectIds.filter((value) => value !== projectId)
        : [...current.projectIds, projectId],
    }));
  }

  async function handleCreateKey(event) {
    event.preventDefault();
    setError("");

    if (!form.name.trim()) {
      const message = "The API key name is required.";
      setError(message);
      showToast("error", message);
      return;
    }

    if (!form.scopes.length) {
      const message = "Please choose at least one scope.";
      setError(message);
      showToast("error", message);
      return;
    }

    if (form.projectAccessMode === "selected" && !form.projectIds.length) {
      const message = "Please choose at least one project.";
      setError(message);
      showToast("error", message);
      return;
    }

    setSubmitting(true);
    try {
      const payload = await apiFetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setApiKeys((current) => [payload.record, ...current]);
      setCreatedSecret(payload.apiKey);
      resetForm();
      showToast("success", "API key created.");
    } catch (submitError) {
      setError(submitError.message);
      showToast("error", submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteKey() {
    if (!selectedApiKey) {
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await apiFetch(`/api/settings/api-keys/${selectedApiKey.id}`, {
        method: "DELETE",
      });
      setApiKeys((current) => current.filter((entry) => entry.id !== selectedApiKey.id));
      closeDeleteDialog();
      showToast("success", "API key deleted.");
    } catch (requestError) {
      setError(requestError.message);
      showToast("error", requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCreatedSecret() {
    if (!createdSecret || !navigator?.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(createdSecret);
      showToast("success", "API key copied.");
    } catch (_error) {
      showToast("error", "Copying the API key failed.");
    }
  }

  function projectAccessLabel(apiKey) {
    if (apiKey.projectAccessMode === "all") {
      return "All projects";
    }

    const allowedIds = new Set(apiKey.projectIds);
    const names = projects.filter((project) => allowedIds.has(project.id)).map((project) => project.name);
    return names.length ? names.join(", ") : `${apiKey.projectIds.length} selected`;
  }

  return (
    <>
      <section className="page-stack">
        <div className="section-head">
          <div>
            <h3>API keys</h3>
            <p className="helper-text">Create scoped keys for updating project versions and language entries.</p>
          </div>
          <button className="primary-button" type="button" onClick={openCreateDialog}>
            <span className="button-icon" aria-hidden="true">
              <FiPlus />
            </span>
            Create API key
          </button>
        </div>

        {loading ? <p>Loading API keys…</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {!loading ? (
          <div className="users-table-wrap">
            <table className="users-table api-keys-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key</th>
                  <th>Scope</th>
                  <th>Projects</th>
                  <th>Last used</th>
                  <th className="actions-cell">Action</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.length ? (
                  apiKeys.map((apiKey) => (
                    <tr key={apiKey.id}>
                      <td>{apiKey.name}</td>
                      <td className="api-key-preview">{apiKey.keyPreview}</td>
                      <td>{apiKey.scopes.join(", ")}</td>
                      <td>{projectAccessLabel(apiKey)}</td>
                      <td>{formatDateTime(apiKey.lastUsedAt)}</td>
                      <td className="actions-cell">
                        <button
                          className="danger-button table-delete-button"
                          type="button"
                          disabled={submitting}
                          onClick={() => openDeleteDialog(apiKey)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6">
                      <span className="helper-text">No API keys created yet.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="page-stack api-endpoint-card">
        <div className="section-head">
          <div>
            <h3>API endpoints</h3>
          </div>
        </div>
        <p className="helper-text">
          Send the key with <code>Authorization: Bearer YOUR_API_KEY</code> or <code>x-api-key</code>.
        </p>
        <div className="api-doc-grid">
          <article className="api-doc-block">
            <h4>Update project version</h4>
            <pre>{`PATCH /api/key/projects/:projectId/version
Content-Type: application/json

{
  "version": "2.0.0"
}`}</pre>
          </article>
          <article className="api-doc-block">
            <h4>Update source or target language entries</h4>
            <pre>{`PUT /api/key/projects/:projectId/languages/:languageCode
Content-Type: application/json

{
  "entries": {
    "common.save": "Save",
    "home.title": "Welcome"
  }
}`}</pre>
          </article>
        </div>
        <p className="helper-text">
          If you update the source language, the app keeps the same key set across all project languages and preserves
          existing translations where keys still match.
        </p>
      </section>

      {isCreateDialogOpen ? (
        <DialogPortal>
          <div className="dialog-backdrop">
            <div className="dialog panel" onClick={(event) => event.stopPropagation()}>
              <div className="dialog-header">
                <div>
                  <h2>Create API key</h2>
                </div>
                <button className="dialog-close" type="button" aria-label="Close dialog" onClick={closeCreateDialog}>
                  <FiX />
                </button>
              </div>

              <form className="stack-form" onSubmit={handleCreateKey}>
                {createdSecret ? (
                  <div className="api-secret-card">
                    <div>
                      <strong>Save this key now.</strong>
                      <p className="helper-text">For security, the full key is only shown once after creation.</p>
                    </div>
                    <code>{createdSecret}</code>
                    <div className="dialog-actions">
                      <button className="secondary-button" type="button" onClick={copyCreatedSecret}>
                        Copy key
                      </button>
                    </div>
                  </div>
                ) : null}

                <label>
                  <span>Name</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Deployment pipeline"
                    required
                  />
                </label>

                <fieldset className="api-scope-fieldset">
                  <legend>Scope</legend>
                  <div className="api-checkbox-grid">
                    {apiKeyScopeOptions.map((scope) => (
                      <label className="toggle-row" key={scope}>
                        <input
                          type="checkbox"
                          checked={form.scopes.includes(scope)}
                          onChange={() => toggleScope(scope)}
                        />
                        <span>{scope}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label>
                  <span>Project access</span>
                  <select
                    value={form.projectAccessMode}
                    onChange={async (event) => {
                      const nextMode = event.target.value === "selected" ? "selected" : "all";
                      setForm((current) => ({
                        ...current,
                        projectAccessMode: nextMode,
                        projectIds: nextMode === "selected" ? current.projectIds : [],
                      }));

                      if (nextMode === "selected") {
                        await loadProjects();
                      }
                    }}
                  >
                    <option value="all">All projects</option>
                    <option value="selected">Selected projects</option>
                  </select>
                </label>

                {form.projectAccessMode === "selected" ? (
                  <div className="api-project-picker">
                    <div className="api-project-picker-head">
                      <strong>Select projects</strong>
                      <span className="helper-text">
                        {selectedProjectNames.length ? selectedProjectNames.join(", ") : "No project selected"}
                      </span>
                    </div>
                    <div className="api-project-list">
                      {projectsLoading ? (
                        <span className="helper-text">Loading projects…</span>
                      ) : projects.length ? (
                        projects.map((project) => (
                          <label className="toggle-row api-project-option" key={project.id}>
                            <input
                              type="checkbox"
                              checked={form.projectIds.includes(project.id)}
                              onChange={() => toggleProject(project.id)}
                            />
                            <span>{project.name}</span>
                          </label>
                        ))
                      ) : (
                        <span className="helper-text">No projects are available yet.</span>
                      )}
                    </div>
                  </div>
                ) : null}

                {error ? <p className="error-text">{error}</p> : null}

                <div className="dialog-actions">
                  <button className="secondary-button" type="button" onClick={closeCreateDialog}>
                    Close
                  </button>
                  <button className="primary-button" type="submit" disabled={submitting}>
                    {submitting ? "Creating..." : "Create key"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </DialogPortal>
      ) : null}

      {isDeleteDialogOpen ? (
        <DialogPortal>
          <div className="dialog-backdrop" onClick={closeDeleteDialog}>
            <div className="dialog panel dialog-compact" onClick={(event) => event.stopPropagation()}>
              <div className="dialog-header">
                <div>
                  <h2>Delete API key</h2>
                </div>
                <button className="dialog-close" type="button" aria-label="Close dialog" onClick={closeDeleteDialog}>
                  <FiX />
                </button>
              </div>

              <div className="dialog-copy">
                <p className="muted">
                  Delete <strong>{selectedApiKey?.name}</strong>? Applications using this key will lose access
                  immediately. This cannot be undone.
                </p>
              </div>

              {error ? <p className="error-text">{error}</p> : null}

              <div className="dialog-actions">
                <button className="secondary-button" type="button" onClick={closeDeleteDialog}>
                  Cancel
                </button>
                <button className="danger-button" type="button" disabled={submitting} onClick={handleDeleteKey}>
                  {submitting ? "Deleting..." : "Delete key"}
                </button>
              </div>
            </div>
          </div>
        </DialogPortal>
      ) : null}
    </>
  );
}

function SsoSettingsTab() {
  const { setBootstrap } = useApp();
  const { showToast } = useOutletContext();
  const callbackUrl = getSsoCallbackUrl();
  const [form, setForm] = useState({
    enabled: false,
    provider: "",
    issuerUrl: "",
    clientId: "",
    clientSecret: "",
    scopes: "openid profile email",
    passwordLoginEnabled: true,
    autoProvisionEnabled: false,
    autoProvisionRoleMode: "default_role",
    autoProvisionDefaultRole: "viewer",
    roleSyncMode: "first_login",
    roleMappings: {
      admin: "",
      editor: "",
      viewer: "",
    },
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch("/api/settings/sso").then((payload) => {
      setForm({
        enabled: Boolean(payload.enabled),
        provider: payload.provider || "",
        issuerUrl: payload.issuerUrl || "",
        clientId: payload.clientId || "",
        clientSecret: payload.clientSecret || "",
        scopes: payload.scopes || "openid profile email",
        passwordLoginEnabled: payload.passwordLoginEnabled !== false,
        autoProvisionEnabled: Boolean(payload.autoProvisionEnabled),
        autoProvisionRoleMode:
          payload.autoProvisionRoleMode === "identity_mapping" ? "identity_mapping" : "default_role",
        autoProvisionDefaultRole: ["admin", "editor", "viewer"].includes(payload.autoProvisionDefaultRole)
          ? payload.autoProvisionDefaultRole
          : "viewer",
        roleSyncMode: payload.roleSyncMode === "each_login" ? "each_login" : "first_login",
        roleMappings: {
          admin: payload.roleMappings?.admin || "",
          editor: payload.roleMappings?.editor || "",
          viewer: payload.roleMappings?.viewer || "",
        },
      });
    });
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (form.enabled && !form.provider.trim()) {
      showToast("error", "The SSO provider name is required.");
      return;
    }
    if (form.enabled && !form.issuerUrl.trim()) {
      showToast("error", "The SSO issuer URL is required.");
      return;
    }
    if (form.enabled && !form.clientId.trim()) {
      showToast("error", "The SSO client ID is required.");
      return;
    }
    if (form.enabled && !form.clientSecret.trim()) {
      showToast("error", "The SSO client secret is required.");
      return;
    }
    if (form.enabled && !form.scopes.trim()) {
      showToast("error", "The SSO scopes are required.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = await apiFetch("/api/settings/sso", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          issuerUrl: normalizeSsoIssuerUrl(form.issuerUrl),
        }),
      });
      setBootstrap((current) => ({
        ...current,
        settings: {
          ...current.settings,
          sso: payload,
        },
      }));
      setForm((current) => ({
        ...current,
        issuerUrl: payload.issuerUrl || normalizeSsoIssuerUrl(current.issuerUrl),
      }));
      showToast("success", "SSO settings saved.");
    } catch (submitError) {
      showToast("error", submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="stack-form sso-settings-form" onSubmit={handleSubmit}>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
        />
        <span>Enable SSO configuration</span>
      </label>

      {form.enabled ? (
        <>
          <label>
            <span>Provider name</span>
            <input
              value={form.provider}
              onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))}
              placeholder="Azure AD, Keycloak, Okta…"
              required={form.enabled}
            />
          </label>

          <label>
            <span>Issuer URL</span>
            <input
              value={form.issuerUrl}
              onChange={(event) => setForm((current) => ({ ...current, issuerUrl: event.target.value }))}
              placeholder="https://identity.example.com/realm-or-tenant"
              required={form.enabled}
            />
          </label>

          <div className="split-grid">
            <label>
              <span>Client ID</span>
              <input
                value={form.clientId}
                onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))}
                required={form.enabled}
              />
            </label>

            <label>
              <span>Client secret</span>
              <input
                type="password"
                value={form.clientSecret}
                onChange={(event) => setForm((current) => ({ ...current, clientSecret: event.target.value }))}
                required={form.enabled}
              />
            </label>
          </div>

          <label>
            <span>Scopes</span>
            <input
              value={form.scopes}
              onChange={(event) => setForm((current) => ({ ...current, scopes: event.target.value }))}
              placeholder="openid profile email groups"
              required={form.enabled}
            />
          </label>

          <label>
            <span>OAuth callback / redirect URL</span>
            <input readOnly value={callbackUrl} />
          </label>

          <p className="helper-text">
            Enter the issuer base URL only, not the
            <code> /.well-known/openid-configuration</code> document URL. If you paste the full discovery URL, the
            app will trim it automatically.
          </p>

          <p className="helper-text">
            Register this exact URL in your OpenID Connect provider. The app starts sign-in at
            <code> /api/auth/sso/start</code> and completes it at <code> /api/auth/sso/callback</code>. Add
            <code> groups</code> to the scopes above if your provider requires it for role mapping claims.
          </p>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={form.passwordLoginEnabled}
              onChange={(event) =>
                setForm((current) => ({ ...current, passwordLoginEnabled: event.target.checked }))
              }
            />
            <span>Allow login with email and password</span>
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={form.autoProvisionEnabled}
              onChange={(event) =>
                setForm((current) => ({ ...current, autoProvisionEnabled: event.target.checked }))
              }
            />
            <span>Auto provision new users on first login</span>
          </label>

          {form.autoProvisionEnabled ? (
            <>
              <label>
                <span>Provisioning role assignment</span>
                <select
                  value={form.autoProvisionRoleMode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      autoProvisionRoleMode:
                        event.target.value === "identity_mapping" ? "identity_mapping" : "default_role",
                    }))
                  }
                >
                  <option value="default_role">Default user role</option>
                  <option value="identity_mapping">Identity group mapping</option>
                </select>
              </label>

              {form.autoProvisionRoleMode === "default_role" ? (
                <label>
                  <span>Default role for new users</span>
                  <select
                    value={form.autoProvisionDefaultRole}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        autoProvisionDefaultRole: ["admin", "editor", "viewer"].includes(event.target.value)
                          ? event.target.value
                          : "viewer",
                      }))
                    }
                  >
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </label>
              ) : (
                <>
                  <label>
                    <span>Role sync timing</span>
                    <select
                      value={form.roleSyncMode}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          roleSyncMode: event.target.value === "each_login" ? "each_login" : "first_login",
                        }))
                      }
                    >
                      <option value="first_login">Only on first login</option>
                      <option value="each_login">On each login</option>
                    </select>
                  </label>

                  <p className="helper-text">
                    New users will receive their role from the identity group mappings below.
                  </p>
                  <div className="split-grid">
                    <label>
                      <span>Admin group</span>
                      <input
                        value={form.roleMappings.admin}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            roleMappings: {
                              ...current.roleMappings,
                              admin: event.target.value,
                            },
                          }))
                        }
                        placeholder="localize-admins"
                      />
                    </label>

                    <label>
                      <span>Editor group</span>
                      <input
                        value={form.roleMappings.editor}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            roleMappings: {
                              ...current.roleMappings,
                              editor: event.target.value,
                            },
                          }))
                        }
                        placeholder="localize-editors"
                      />
                    </label>
                  </div>

                  <label>
                    <span>Viewer group</span>
                    <input
                      value={form.roleMappings.viewer}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          roleMappings: {
                            ...current.roleMappings,
                            viewer: event.target.value,
                          },
                        }))
                      }
                      placeholder="localize-viewers"
                    />
                  </label>
                </>
              )}
            </>
          ) : null}
        </>
      ) : null}
      <button className="primary-button" type="submit" disabled={submitting}>
        {submitting ? "Saving..." : "Save SSO settings"}
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
        <Route path="/sso-status" element={<SsoStatusPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/projects/:projectId/languages/:languageCode/edit" element={<EditorPage />} />
          <Route path="/settings/:tab?" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </>,
  ),
);

export default App;
