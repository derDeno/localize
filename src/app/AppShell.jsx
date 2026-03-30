import { useEffect, useMemo, useState } from "react";
import { FiChevronLeft, FiGithub, FiLogOut, FiMoon, FiSun, FiX } from "react-icons/fi";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { languageMeta, initialProjectForm } from "./constants";
import { FlagSelect } from "./components/common";
import { useApp } from "./context";
import { apiFetch, getSystemTheme, languageDisplay } from "./utils";

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

      <footer className="github-footer">
        <a
          className="github-footer-link"
          href="https://github.com/derDeno/localize"
          target="_blank"
          rel="noreferrer"
        >
          <FiGithub aria-hidden="true" />
          <span>Star this project on GitHub</span>
        </a>
      </footer>

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

export default AppShell;
