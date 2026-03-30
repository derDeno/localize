import { useEffect, useMemo, useState } from "react";
import { FiDownload, FiMoreHorizontal, FiPlus, FiUpload, FiX } from "react-icons/fi";
import { Link, Navigate, NavLink, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { apiKeyScopeOptions, appVersion } from "../constants";
import { DialogPortal, PasswordEyeIcon } from "../components/common";
import { useApp } from "../context";
import { apiFetch, formatDateTime, getSsoCallbackUrl, normalizeSsoIssuerUrl, roleAllows } from "../utils";

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
  const { user, settings, setBootstrap } = useApp();
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
  const canEditProfile = roleAllows(user, "admin") || settings?.allowUserProfileEdit !== false;

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
              disabled={!canEditProfile}
              onChange={(event) => setProfileForm((current) => ({ ...current, firstName: event.target.value }))}
            />
          </label>
          <label>
            <span>Last name</span>
            <input
              value={profileForm.lastName}
              disabled={!canEditProfile}
              onChange={(event) => setProfileForm((current) => ({ ...current, lastName: event.target.value }))}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={profileForm.email}
              disabled={!canEditProfile}
              onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label>
            <span>Role</span>
            <input value={user?.role || ""} readOnly />
          </label>
        </div>

        <div>
          {!canEditProfile ? (
            <p className="helper-text">Only administrators can edit profile details right now. You can still change your password below.</p>
          ) : null}
          {profileError ? <p className="error-text">{profileError}</p> : null}

          <button className="primary-button" type="submit" disabled={profileSubmitting || !canEditProfile}>
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
    allowUserProfileEdit: true,
    allowProjectDelete: true,
    allowLanguageDelete: true,
    translationApprovalEnabled: true,
    translationMemoryEnabled: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch("/api/settings/app").then((payload) => {
      setForm({
        allowRegistration: payload.allowRegistration,
        allowUserProfileEdit: payload.allowUserProfileEdit !== false,
        allowProjectDelete: payload.allowProjectDelete,
        allowLanguageDelete: payload.allowLanguageDelete,
        translationApprovalEnabled: payload.translationApprovalEnabled !== false,
        translationMemoryEnabled: payload.translationMemoryEnabled !== false,
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
          checked={form.allowUserProfileEdit}
          onChange={(event) => setForm((current) => ({ ...current, allowUserProfileEdit: event.target.checked }))}
        />
        <span>Allow non-admin users to edit their profile</span>
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

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={form.translationApprovalEnabled}
          onChange={(event) =>
            setForm((current) => ({ ...current, translationApprovalEnabled: event.target.checked }))
          }
        />
        <span>Enable translation approval</span>
      </label>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={form.translationMemoryEnabled}
          onChange={(event) =>
            setForm((current) => ({ ...current, translationMemoryEnabled: event.target.checked }))
          }
        />
        <span>Enable translation memory</span>
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

          <div className="field-with-helper">
            <label>
              <span>Issuer URL</span>
              <input
                value={form.issuerUrl}
                onChange={(event) => setForm((current) => ({ ...current, issuerUrl: event.target.value }))}
                placeholder="https://identity.example.com/realm-or-tenant"
                required={form.enabled}
              />
            </label>

            <p className="helper-text">
              Enter the issuer base URL only, not the
              <code> /.well-known/openid-configuration</code> document URL.
            </p>
          </div>

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

          <div className="field-with-helper">
            <label>
              <span>OAuth callback / redirect URL</span>
              <input readOnly value={callbackUrl} />
            </label>

            <p className="helper-text">
              Register this exact URL in your OpenID Connect provider. The app starts sign-in at
              <code> /api/auth/sso/start</code> and completes it at <code> /api/auth/sso/callback</code>. Add
              <code> groups</code> to the scopes above if your provider requires it for role mapping claims.
            </p>
          </div>

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

export default SettingsPage;
