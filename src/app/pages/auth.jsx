import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../context";
import { apiFetch } from "../utils";

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
            <button className="primary-button" type="button" onClick={handleSsoLogin}>
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

export { LoginPage, RegisterPage, SsoStatusPage };
