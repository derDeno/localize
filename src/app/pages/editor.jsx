import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { FiChevronLeft, FiSave } from "react-icons/fi";
import { Link, useBeforeUnload, useBlocker, useOutletContext, useParams } from "react-router-dom";
import { editorFilterOptions } from "../constants";
import { Flag } from "../components/common";
import { useApp } from "../context";
import { apiFetch, progressLabel, roleAllows } from "../utils";

const VIRTUAL_ROW_HEIGHT = 220;
const VIRTUAL_OVERSCAN = 6;

const EditorRow = memo(function EditorRow({
  row,
  canEdit,
  isSourceLanguage,
  translationApprovalEnabled,
  translationMemoryEnabled,
  value,
  approved,
  onTranslationChange,
  onApprovalChange,
  onMemoryApply,
}) {
  return (
    <div className="editor-row">
      <label className="editor-field">
        <span className="field-key">{row.key}</span>
        <input readOnly value={String(row.source ?? "")} />
      </label>

      <label className="editor-field editor-field-editable">
        <span className="field-key field-key-placeholder">{row.key}</span>
        <input
          readOnly={!canEdit}
          value={value}
          onChange={(event) => onTranslationChange(row.key, event.target.value)}
        />

        <div className="editor-field-meta">
          {translationMemoryEnabled && row.memories?.length ? (
            <div className="translation-memory-list">
              {row.memories.slice(0, 5).map((memory) => (
                <button
                  key={`${row.key}-${memory}`}
                  className="translation-memory-button"
                  type="button"
                  disabled={!canEdit}
                  onClick={() => onMemoryApply(row.key, memory)}
                >
                  {memory}
                </button>
              ))}
            </div>
          ) : null}

          {!isSourceLanguage && translationApprovalEnabled ? (
            <label className="editor-approval-toggle">
              <input
                type="checkbox"
                checked={approved}
                disabled={!canEdit || value.trim() === ""}
                onChange={(event) => onApprovalChange(row.key, event.target.checked)}
              />
              <span>Approved</span>
            </label>
          ) : null}
        </div>
      </label>
    </div>
  );
});

function EditorPage() {
  const { showToast } = useOutletContext();
  const { projectId, languageCode } = useParams();
  const { user, settings } = useApp();
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
  const [dirtyKeys, setDirtyKeys] = useState(() => new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(720);
  const resultsRef = useRef(null);
  const translationApprovalEnabled = settings?.translationApprovalEnabled !== false;
  const translationMemoryEnabled = settings?.translationMemoryEnabled !== false;

  const availableFilterOptions = useMemo(
    () =>
      translationApprovalEnabled
        ? editorFilterOptions
        : editorFilterOptions.filter((option) => option.value !== "needs-approval" && option.value !== "approved"),
    [translationApprovalEnabled],
  );

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
          setDirtyKeys(new Set());
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

  useEffect(() => {
    if (!translationApprovalEnabled && (filterMode === "needs-approval" || filterMode === "approved")) {
      setFilterMode("all");
    }
  }, [filterMode, translationApprovalEnabled]);

  useEffect(() => {
    const node = resultsRef.current;
    if (!node) {
      return undefined;
    }

    const updateViewportHeight = () => {
      setViewportHeight(node.clientHeight || 720);
    };

    updateViewportHeight();
    const resizeObserver = new ResizeObserver(updateViewportHeight);
    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    setScrollTop(0);
    resultsRef.current?.scrollTo({ top: 0 });
  }, [projectId, languageCode, deferredSearchQuery, filterMode]);

  const editorLanguage = useMemo(
    () => project?.languages.find((language) => language.code === languageCode) || null,
    [project, languageCode],
  );

  const savedRowMap = useMemo(
    () => new Map((editorData?.rows || []).map((row) => [row.key, row])),
    [editorData],
  );

  const canEdit = roleAllows(user, "editor");
  const hasUnsavedChanges = canEdit && dirtyKeys.size > 0;

  const syncDirtyStateForRow = useCallback(
    (key, nextTranslation, nextApproved) => {
      const savedRow = savedRowMap.get(key);
      if (!savedRow) {
        return;
      }

      const savedTranslation = String(savedRow.translation ?? "");
      const translationsChanged = nextTranslation !== savedTranslation;
      const approvalsChanged =
        translationApprovalEnabled && !editorData?.isSourceLanguage
          ? Boolean(nextApproved) !== Boolean(savedRow.approved)
          : false;

      setDirtyKeys((current) => {
        const next = new Set(current);
        if (translationsChanged || approvalsChanged) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return next;
      });
    },
    [editorData?.isSourceLanguage, savedRowMap, translationApprovalEnabled],
  );

  const handleTranslationChange = useCallback(
    (key, nextValue) => {
      const savedRow = savedRowMap.get(key);
      const nextApproved = nextValue === String(savedRow?.translation ?? "") ? Boolean(savedRow?.approved) : false;

      setEditorDraft((current) => {
        if (current[key] === nextValue) {
          return current;
        }

        return {
          ...current,
          [key]: nextValue,
        };
      });
      setEditorApprovalDraft((current) => {
        if (current[key] === nextApproved) {
          return current;
        }

        return {
          ...current,
          [key]: nextApproved,
        };
      });
      syncDirtyStateForRow(key, nextValue, nextApproved);
    },
    [savedRowMap, syncDirtyStateForRow],
  );

  const handleApprovalChange = useCallback(
    (key, nextApproved) => {
      const currentTranslation = String(editorDraft[key] ?? savedRowMap.get(key)?.translation ?? "");

      setEditorApprovalDraft((current) => {
        if (current[key] === nextApproved) {
          return current;
        }

        return {
          ...current,
          [key]: nextApproved,
        };
      });
      syncDirtyStateForRow(key, currentTranslation, nextApproved);
    },
    [editorDraft, savedRowMap, syncDirtyStateForRow],
  );

  const handleMemoryApply = useCallback(
    (key, memory) => {
      setEditorDraft((current) => {
        if (current[key] === memory) {
          return current;
        }

        return {
          ...current,
          [key]: memory,
        };
      });
      setEditorApprovalDraft((current) => {
        if (current[key] === false) {
          return current;
        }

        return {
          ...current,
          [key]: false,
        };
      });
      syncDirtyStateForRow(key, memory, false);
    },
    [syncDirtyStateForRow],
  );

  const blocker = useBlocker(hasUnsavedChanges);

  useEffect(() => {
    if (blocker.state !== "blocked") {
      return;
    }

    const shouldLeave = window.confirm("You have unsaved changes. Do you really want to leave the editor?");
    if (shouldLeave) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker]);

  useBeforeUnload(
    useMemo(
      () => (event) => {
        if (!hasUnsavedChanges) {
          return;
        }

        event.preventDefault();
        event.returnValue = "";
      },
      [hasUnsavedChanges],
    ),
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
      const currentApproved = translationApprovalEnabled && Boolean(editorApprovalDraft[row.key] ?? row.approved);
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

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / VIRTUAL_ROW_HEIGHT) + VIRTUAL_OVERSCAN * 2;
    const endIndex = Math.min(filteredRows.length, startIndex + visibleCount);

    return {
      startIndex,
      endIndex,
      topSpacerHeight: startIndex * VIRTUAL_ROW_HEIGHT,
      bottomSpacerHeight: Math.max(0, (filteredRows.length - endIndex) * VIRTUAL_ROW_HEIGHT),
    };
  }, [filteredRows.length, scrollTop, viewportHeight]);

  const visibleRows = useMemo(
    () => filteredRows.slice(visibleRange.startIndex, visibleRange.endIndex),
    [filteredRows, visibleRange.endIndex, visibleRange.startIndex],
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
        body: JSON.stringify({
          entries: editorDraft,
          approvals: translationApprovalEnabled ? editorApprovalDraft : {},
        }),
      });

      const editorDetails = await apiFetch(`/api/projects/${projectId}/languages/${languageCode}`);
      setEditorData(editorDetails);
      setEditorDraft(Object.fromEntries(editorDetails.rows.map((row) => [row.key, row.translation ?? ""])));
      setEditorApprovalDraft(Object.fromEntries(editorDetails.rows.map((row) => [row.key, Boolean(row.approved)])));
      setDirtyKeys(new Set());
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
              {availableFilterOptions.map((option) => (
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
          <div
            ref={resultsRef}
            className="editor-results"
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          >
            {visibleRange.topSpacerHeight > 0 ? (
              <div style={{ height: `${visibleRange.topSpacerHeight}px` }} aria-hidden="true" />
            ) : null}

            {visibleRows.map((row) => (
              <EditorRow
                key={row.key}
                row={row}
                canEdit={canEdit}
                isSourceLanguage={editorData.isSourceLanguage}
                translationApprovalEnabled={translationApprovalEnabled}
                translationMemoryEnabled={translationMemoryEnabled}
                value={String(editorDraft[row.key] ?? "")}
                approved={Boolean(editorApprovalDraft[row.key] ?? row.approved)}
                onTranslationChange={handleTranslationChange}
                onApprovalChange={handleApprovalChange}
                onMemoryApply={handleMemoryApply}
              />
            ))}

            {visibleRange.bottomSpacerHeight > 0 ? (
              <div style={{ height: `${visibleRange.bottomSpacerHeight}px` }} aria-hidden="true" />
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

export default EditorPage;
