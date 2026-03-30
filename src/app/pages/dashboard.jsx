import { useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { Link, useOutletContext } from "react-router-dom";
import { Flag } from "../components/common";
import { useApp } from "../context";
import { apiFetch, roleAllows } from "../utils";

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

export default DashboardPage;
