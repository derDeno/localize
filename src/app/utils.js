import { languageMeta } from "./constants";

export async function apiFetch(url, options = {}) {
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

export function getSsoCallbackUrl() {
  if (typeof window === "undefined") {
    return "/api/auth/sso/callback";
  }

  return `${window.location.origin}/api/auth/sso/callback`;
}

export function normalizeSsoIssuerUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/g, "")
    .replace(/\/\.well-known\/openid-configuration$/i, "");
}

export function languageDisplay(code, fallbackLabel) {
  const normalized = String(code || "").toLowerCase();
  const meta = languageMeta[normalized];
  return {
    code: normalized,
    label: fallbackLabel || meta?.name || normalized.toUpperCase(),
    countryCode: meta?.countryCode || null,
  };
}

export function progressLabel(progress) {
  return `${progress.percent}% · ${progress.completed}/${progress.total}`;
}

export function formatDateTime(value) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

export function getSystemTheme() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function roleAllows(user, requiredRole) {
  const order = { viewer: 1, editor: 2, admin: 3 };
  return (order[user?.role] || 0) >= (order[requiredRole] || 0);
}
