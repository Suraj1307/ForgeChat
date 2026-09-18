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
