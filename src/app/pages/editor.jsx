import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { FiChevronLeft, FiSave } from "react-icons/fi";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { editorFilterOptions } from "../constants";
import { Flag } from "../components/common";
import { useApp } from "../context";
import { apiFetch, progressLabel, roleAllows } from "../utils";

function EditorPage() {
  const { showToast } = useOutletContext();
  const { projectId, languageCode } = useParams();
  const { user } = useApp();
  const [project, setProject] = useState(null);
  const [editorData, setEditorData] = useState(null);
  const [editorDraft, setEditorDraft] = useState({});
  const [editorApprovalDraft, setEditorApprovalDraft] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState("all");
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
          setEditorApprovalDraft(
            Object.fromEntries(editorDetails.rows.map((row) => [row.key, Boolean(row.approved)])),
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
    return editorData.rows.filter((row) => {
      const sourceText = String(row.source ?? "");
      const sourceValue = sourceText.toLowerCase();
      const translatedValue = String(editorDraft[row.key] ?? row.translation ?? "");
      const normalizedTranslation = translatedValue.toLowerCase();
      const currentApproved = Boolean(editorApprovalDraft[row.key] ?? row.approved);
      const isTranslated = translatedValue.trim() !== "";
      const isIdenticalToSource = isTranslated && translatedValue === sourceText;
      const isChanged =
        row.sourceUpdatedAt && row.translationUpdatedAt
          ? new Date(row.translationUpdatedAt).getTime() < new Date(row.sourceUpdatedAt).getTime()
          : Boolean(row.sourceUpdatedAt);

      const matchesQuery =
        !normalizedQuery ||
        row.key.toLowerCase().includes(normalizedQuery) ||
        sourceValue.includes(normalizedQuery) ||
        normalizedTranslation.includes(normalizedQuery);

      if (!matchesQuery) {
        return false;
      }

      if (filterMode === "changed") {
        return !editorData.isSourceLanguage && isChanged;
      }

      if (filterMode === "untranslated") {
        return !isTranslated;
      }

      if (filterMode === "translated") {
        return isTranslated;
      }

      if (filterMode === "identical") {
        return !editorData.isSourceLanguage && isIdenticalToSource;
      }

      if (filterMode === "needs-approval") {
        return !editorData.isSourceLanguage && isTranslated && !currentApproved;
      }

      if (filterMode === "approved") {
        return !editorData.isSourceLanguage && isTranslated && currentApproved;
      }

      return true;
    });
  }, [deferredSearchQuery, editorApprovalDraft, editorData, editorDraft, filterMode]);

  async function handleSaveTranslations() {
    if (!editorData) {
      return;
    }

    setBusy(true);

    try {
      const result = await apiFetch(`/api/projects/${projectId}/languages/${languageCode}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: editorDraft, approvals: editorApprovalDraft }),
      });

      const editorDetails = await apiFetch(`/api/projects/${projectId}/languages/${languageCode}`);
      setEditorData(editorDetails);
      setEditorDraft(Object.fromEntries(editorDetails.rows.map((row) => [row.key, row.translation ?? ""])));
      setEditorApprovalDraft(Object.fromEntries(editorDetails.rows.map((row) => [row.key, Boolean(row.approved)])));
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
        <div className="editor-toolbar">
          <label className="editor-search">
            <input
              type="search"
              placeholder="Search by key, source text, or translation..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>

          <label className="editor-filter">
            <select value={filterMode} onChange={(event) => setFilterMode(event.target.value)}>
              {editorFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

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
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setEditorDraft((current) => ({
                      ...current,
                      [row.key]: nextValue,
                    }));
                    setEditorApprovalDraft((current) => ({
                      ...current,
                      [row.key]: nextValue === String(row.translation ?? "") ? Boolean(row.approved) : false,
                    }));
                  }}
                />

                <div className="editor-field-meta">
                  {row.memories?.length ? (
                    <div className="translation-memory-list">
                      {row.memories.slice(0, 5).map((memory) => (
                        <button
                          key={`${row.key}-${memory}`}
                          className="translation-memory-button"
                          type="button"
                          disabled={!roleAllows(user, "editor")}
                          onClick={() => {
                            setEditorDraft((current) => ({
                              ...current,
                              [row.key]: memory,
                            }));
                            setEditorApprovalDraft((current) => ({
                              ...current,
                              [row.key]: false,
                            }));
                          }}
                        >
                          {memory}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {!editorData.isSourceLanguage ? (
                    <label className="editor-approval-toggle">
                      <input
                        type="checkbox"
                        checked={Boolean(editorApprovalDraft[row.key] ?? row.approved)}
                        disabled={!roleAllows(user, "editor") || String(editorDraft[row.key] ?? "").trim() === ""}
                        onChange={(event) =>
                          setEditorApprovalDraft((current) => ({
                            ...current,
                            [row.key]: event.target.checked,
                          }))
                        }
                      />
                      <span>Approved</span>
                    </label>
                  ) : null}
                </div>
              </label>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default EditorPage;
