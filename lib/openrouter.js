// Thin wrapper around OpenRouter's chat completions API (OpenAI-compatible).
// Every AI feature calls `askJson`, which asks the model for JSON matching a schema.
//
// Reliability: AI providers are sometimes slow (we measured 2 s normally, but 15-30+ s at times).
// So each attempt gets a time limit, and if the main model fails or is too slow we automatically
// retry once with a backup model from a DIFFERENT provider.
const URL = "https://openrouter.ai/api/v1/chat/completions";

export class AiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function models() {
  const primary = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
  const backup = process.env.OPENROUTER_FALLBACK_MODEL || "openai/gpt-4.1-mini";
  return primary === backup ? [primary] : [primary, backup];
}

// One request to one model. Throws AiError; `retry: false` means trying another model won't help.
async function attempt(model, { system, content, schemaName, schema, timeoutMs }) {
  const key = process.env.OPENROUTER_API_KEY;
  try {
    const res = await fetch(URL, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs), // covers waiting for the reply AND reading it
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "SocSync" },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 1500,
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
        response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } },
      }),
    });
    if (res.status === 401) throw Object.assign(new AiError("The OpenRouter API key is invalid. Check .env.local.", 503), { retry: false });
    if (res.status === 402) throw Object.assign(new AiError("OpenRouter credits have run out. Top up at openrouter.ai.", 503), { retry: false });
    if (!res.ok) throw new AiError(`OpenRouter error ${res.status}: ${(await res.text()).slice(0, 200)}`);

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    try {
      return JSON.parse(text);
    } catch {
      // Some models wrap JSON in ```json fences; pull out the first {...} block.
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new AiError("The AI returned something that wasn't valid JSON.");
    }
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err.name === "TimeoutError" || err.name === "AbortError") throw new AiError(`took longer than ${timeoutMs / 1000} s`, 504);
    throw new AiError(`could not reach OpenRouter (${err.message})`);
  }
}

// Returns { data, model, ms, usedBackup }.
export async function askJsonWithMeta({ system, content, schemaName, schema, timeoutMs = 20000 }) {
  if (!process.env.OPENROUTER_API_KEY) throw new AiError("AI is not configured (OPENROUTER_API_KEY missing in .env.local).", 503);

  const tried = [];
  const list = models();
  for (const [i, model] of list.entries()) {
    const t = Date.now();
    try {
      const data = await attempt(model, { system, content, schemaName, schema, timeoutMs });
      const ms = Date.now() - t;
      console.log(`[ai] ${schemaName} via ${model} in ${ms} ms${i ? " (backup)" : ""}`);
      return { data, model, ms, usedBackup: i > 0 };
    } catch (err) {
      console.warn(`[ai] ${schemaName} via ${model} failed after ${Date.now() - t} ms: ${err.message}`);
      if (err.retry === false) throw err;
      tried.push(`${model}: ${err.message}`);
    }
  }
  throw new AiError(
    `The AI is slow or unavailable right now (tried ${tried.length} model${tried.length > 1 ? "s" : ""}). ` +
      `You can fill in the form yourself, or try again in a minute.`,
    504
  );
}

export async function askJson(options) {
  return (await askJsonWithMeta(options)).data;
}

// ---------- Image generation (AI poster backgrounds) ----------
// Asks an image model for ONE picture. Returns a data URL, or null if every model failed:
// callers must still work without it (the poster falls back to a colour gradient).
export async function generateImage(prompt, { timeoutMs = 45000 } = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const list = [
    process.env.OPENROUTER_IMAGE_MODEL || "google/gemini-3.1-flash-lite-image",
    process.env.OPENROUTER_IMAGE_FALLBACK_MODEL || "google/gemini-2.5-flash-image",
  ];
  for (const model of [...new Set(list)]) {
    const t = Date.now();
    try {
      const res = await fetch(URL, {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "SocSync" },
        body: JSON.stringify({ model, modalities: ["image", "text"], messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (res.ok && url?.startsWith("data:image/")) {
        console.log(`[ai] poster image via ${model} in ${Date.now() - t} ms`);
        return { url, model };
      }
      console.warn(`[ai] image via ${model} returned no image (${res.status})`);
    } catch (err) {
      console.warn(`[ai] image via ${model} failed after ${Date.now() - t} ms: ${err.message}`);
    }
  }
  return null;
}

// Helper for route handlers: turn any error into a JSON response the UI can show.
export function aiErrorResponse(err) {
  console.error("[ai]", err.message);
  const status = err instanceof AiError ? err.status : 500;
  return Response.json({ error: err instanceof AiError ? err.message : "AI request failed." }, { status });
}
