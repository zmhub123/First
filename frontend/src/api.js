const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function logFrontendApi(event, details = {}) {
  const time = new Date().toISOString();
  console.log(`[frontend-api][${time}] ${event}`, details);
}

async function requestJson(path, options = {}, hooks = {}) {
  const method = options.method || "GET";
  const url = `${API_BASE_URL}${path}`;
  const startedAt = performance.now();
  hooks.onBackendTrigger?.({ method, path, url });
  logFrontendApi("request:start", { method, path, url, body: options.body || null });

  const response = await fetch(url, options);
  const elapsedMs = Math.round(performance.now() - startedAt);
  logFrontendApi("request:end", {
    method,
    path,
    status: response.status,
    ok: response.ok,
    elapsedMs
  });

  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status}`);
  }
  return response.json();
}

export async function getHealth() {
  return requestJson("/api/health");
}

export async function getMessage() {
  return requestJson("/api/message");
}

export async function loadGameSave(hooks = {}) {
  return requestJson("/api/game/save", {}, hooks);
}

export async function saveGame(payload, hooks = {}) {
  return requestJson(
    "/api/game/save",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    },
    hooks
  );
}
