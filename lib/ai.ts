// Calls Groq (OpenAI-compatible) over plain REST - free tier, less overloaded than Gemini.
// Free key: https://console.groq.com/keys
//
// Models in priority order: the first one that answers wins; on overload (429/5xx)
// fall through to the next one.
// Updated 28/9/2026 - Groq removed the llama-3.x line; re-check periodically with:
// curl -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models
const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Each model gets this many tries when the network itself fails (not for HTTP errors)
const NETWORK_ATTEMPTS = 2;
const TIMEOUT_MS = 20_000;

export type AIResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

/** Call the model and force a JSON answer. Never throws - callers decide how to degrade. */
export async function callAIJson<T>(systemPrompt: string, userContent: string): Promise<AIResult<T>> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false, error: "Thiếu GROQ_API_KEY trong .env.local", status: 500 };

  // Only move to the next model on overload (429/5xx) or a network failure. Other 4xx
  // (bad key...) would fail the same way on every model, so stop right there.
  let response: Response | null = null;
  let lastError = "";
  let networkFailed = false;

  for (const model of MODELS) {
    const requestBody = JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    let r: Response | null = null;
    for (let attempt = 1; attempt <= NETWORK_ATTEMPTS && !r; attempt++) {
      try {
        r = await fetch(GROQ_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: requestBody,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (e) {
        // "fetch failed" / timeout: the connection dropped. Retry instead of crashing the route.
        networkFailed = true;
        lastError = (e as Error).message;
        console.error(`Groq [${model}] network error (attempt ${attempt}):`, e);
      }
    }
    if (!r) continue;
    networkFailed = false;

    if (r.ok) {
      response = r;
      break;
    }

    lastError = await r.text().catch(() => "");
    console.error(`Groq [${model}] error ${r.status}:`, lastError);

    const tryNext = r.status === 429 || r.status >= 500 || lastError.includes("model_not_found");
    if (!tryNext) break;
  }

  if (!response) {
    const badKey = lastError.includes("Invalid API Key") || lastError.includes("invalid_api_key");
    return {
      ok: false,
      error: badKey
        ? "GROQ_API_KEY không hợp lệ hoặc đã bị thu hồi."
        : networkFailed
          ? "Không kết nối được tới dịch vụ AI. Kiểm tra mạng rồi thử lại."
          : "Hệ thống AI đang quá tải. Thử lại sau ít giây.",
      status: 502,
    };
  }

  let body: { choices?: { message?: { content?: string } }[] } | null = null;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: "AI trả về dữ liệu hỏng, vui lòng thử lại.", status: 502 };
  }
  const jsonText: string | undefined = body?.choices?.[0]?.message?.content;

  if (!jsonText) {
    console.error("Groq returned empty:", JSON.stringify(body));
    return { ok: false, error: "AI trả về rỗng, vui lòng thử lại.", status: 502 };
  }

  try {
    const data = JSON.parse(jsonText);
    if (!data || typeof data !== "object" || Array.isArray(data))
      return { ok: false, error: "AI trả về sai định dạng JSON, vui lòng thử lại.", status: 502 };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "AI trả về sai định dạng JSON, vui lòng thử lại.", status: 502 };
  }
}
