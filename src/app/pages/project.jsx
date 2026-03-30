import { useEffect, useMemo, useState } from "react";
import { FiDownload, FiEdit2, FiMoreHorizontal, FiPlus, FiUpload, FiX } from "react-icons/fi";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { languageMeta } from "../constants";
import { Flag, FlagSelect } from "../components/common";
import { useApp } from "../context";
import { apiFetch, languageDisplay, roleAllows } from "../utils";

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
                      <span className="progress-value">{language.progress.percent}%</span>
                      <div className="progress-bar" style={{ width: `${language.progress.percent}%` }}>
                        <span className="progress-value progress-value-filled">{language.progress.percent}%</span>
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

export default ProjectPage;
