const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");

const createApiUrl = (path) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return apiBaseUrl ? `${apiBaseUrl}${normalizedPath}` : normalizedPath;
};

export const readApiPayload = async (response) => {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    return text ? { error: text } : null;
  } catch {
    return null;
  }
};

export const getApiErrorMessage = (response, payload, fallbackMessage) => {
  if (payload && typeof payload === "object") {
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }
  }

  if (response.status >= 500) {
    return "The server is unavailable right now. If you're running locally, make sure the backend is started.";
  }

  return fallbackMessage;
};

export const apiFetch = (path, options) => fetch(createApiUrl(path), options);

export const apiRequest = async (path, options) => {
  const response = await apiFetch(path, options);
  const payload = await readApiPayload(response);
  return { response, payload };
};

export const createAuthHeaders = (token, headers = {}) =>
  token
    ? {
        ...headers,
        Authorization: `Bearer ${token}`,
      }
    : { ...headers };

export const isUnauthorizedResponse = (response) => response.status === 401;
export { createApiUrl };
