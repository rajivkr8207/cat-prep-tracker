let refreshPromise;

function getRequestUrl(path) {
  return new URL(path, window.location.origin);
}

function canRefreshAfterUnauthorized(path) {
  const pathname = getRequestUrl(path).pathname.replace(/\/+$/, "");
  return ![
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/logout",
    "/api/auth/refresh",
  ].includes(pathname);
}

async function parseResponse(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || "Something went wrong. Please try again.");
    error.status = response.status;
    throw error;
  }
  return result;
}

async function fetchJson(path, options) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  return parseResponse(response);
}

function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetchJson("/api/auth/refresh", { method: "POST" }).finally(() => {
      refreshPromise = undefined;
    });
  }
  return refreshPromise;
}

export async function requestJson(path, options = {}) {
  try {
    return await fetchJson(path, options);
  } catch (error) {
    if (error.status !== 401 || !canRefreshAfterUnauthorized(path)) {
      throw error;
    }

    try {
      await refreshSession();
    } catch {
      throw error;
    }

    return fetchJson(path, options);
  }
}
