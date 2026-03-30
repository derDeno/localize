import { useRef } from "react";
import { createPortal } from "react-dom";
import { FiChevronDown } from "react-icons/fi";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useApp } from "../context";
import { languageDisplay, roleAllows } from "../utils";

export function PasswordEyeIcon({ hidden = false }) {
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

export function Flag({ code, label, className = "" }) {
  const display = languageDisplay(code, label);
  if (!display.countryCode) {
    return <span className={`flag-fallback ${className}`.trim()}>●</span>;
  }

  return <span className={`fi fi-${display.countryCode} flag-icon ${className}`.trim()} aria-hidden="true" />;
}

export function FlagSelect({ label, value, options, onChange }) {
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

export function DialogPortal({ children }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}

export function LoadingPage({ text = "Loading…" }) {
  return (
    <div className="screen-center">
      <div className="panel narrow-panel">
        <h1>{text}</h1>
      </div>
    </div>
  );
}

export function PublicOnly() {
  const { loading, user } = useApp();
  if (loading) {
    return <LoadingPage />;
  }
  if (user) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export function RequireAuth() {
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

export function RequireRole({ role }) {
  const { user } = useApp();
  if (!roleAllows(user, role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
