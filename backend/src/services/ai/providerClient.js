// Single point of contact with the configured AI provider (spec #32/#33).
// The app supports both the original OpenAI flow and the Gemini flow.
//
// Env vars (see .env.example):
//   AI_PROVIDER         "openai" or "gemini"
//   AI_API_KEY          secret key, never sent to the frontend
//   AI_MODEL            chat/vision model, e.g. "gpt-4o-mini" or "gemini-2.0-flash"
//   VISION_MODEL        defaults to AI_MODEL if unset
//   EMBEDDING_MODEL     e.g. "text-embedding-3-small" or a Gemini embedding model
//   AI_TIMEOUT_MS       per-call timeout, default 10s

const PROVIDER = (process.env.AI_PROVIDER || "openai").toLowerCase();
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = Math.max(Number(process.env.AI_TIMEOUT_MS) || 30000, 30000);

class AIUnavailableError extends Error {
    constructor(message, cause) {
        super(message || "AI service is temporarily unavailable");
        this.name = "AIUnavailableError";
        this.cause = cause;
    }
}

let _client = null;
let _OpenAI = null;

const getOpenAIClient = () => {
    if (_client) return _client;
    if (!process.env.AI_API_KEY) {
        throw new AIUnavailableError("AI_API_KEY is not configured");
    }
    try {
        // eslint-disable-next-line global-require
        _OpenAI = _OpenAI || require("openai");
        const OpenAICtor = _OpenAI.OpenAI || _OpenAI;
        _client = new OpenAICtor({ apiKey: process.env.AI_API_KEY });
        return _client;
    } catch (err) {
        throw new AIUnavailableError("AI SDK could not be initialized", err);
    }
};

const toGeminiModelName = (model, kind = "chat") => {
    const value = (model || "").trim();
    if (!value) {
        return kind === "embedding" ? "gemini-embedding-001" : "gemini-2.0-flash";
    }
    if (value.startsWith("models/")) return value.replace(/^models\//, "");
    if (kind === "embedding" && value.toLowerCase().includes("embedding")) {
        return "gemini-embedding-001";
    }
    return value;
};

const parseGeminiTextResponse = (payload) => {
    const rawText = payload?.candidates?.[0]?.content?.parts
        ?.map((part) => part?.text || "")
        .join("") || payload?.text || "{}";
    const text = String(rawText).replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    try {
        return JSON.parse(text);
    } catch {
        return {}; 
    }
};

const withTimeout = (promise, ms, label) => {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new AIUnavailableError(`${label} timed out`)), ms);
        }),
    ]).finally(() => clearTimeout(timer));
};

const fetchJson = async (url, options = {}, retries = 2) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        const rawText = await response.text();
        let payload;
        try {
            payload = rawText ? JSON.parse(rawText) : {};
        } catch {
            payload = rawText;
        }

        if (!response.ok) {
            const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
            if ((response.status === 429 || response.status === 503) && retries > 0) {
                await new Promise((resolve) => setTimeout(resolve, 1000 * (3 - retries + 1)));
                return fetchJson(url, options, retries - 1);
            }
            throw new AIUnavailableError(`AI request failed: ${message}`, payload);
        }
        return payload;
    } catch (err) {
        if (err instanceof AIUnavailableError) throw err;
        if (err.name === "AbortError") {
            throw new AIUnavailableError("AI request timed out");
        }
        throw new AIUnavailableError("AI request failed", err);
    } finally {
        clearTimeout(timer);
    }
};

const toBase64ImagePart = async (imageUrl) => {
    if (!imageUrl) return null;

    if (imageUrl.startsWith("data:")) {
        const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i.exec(imageUrl);
        if (!match) {
            throw new AIUnavailableError("Unsupported image data URL format");
        }
        return {
            inlineData: {
                mimeType: match[1],
                data: match[2],
            },
        };
    }

    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get("content-type") || "image/jpeg";

    return {
        inlineData: {
            mimeType,
            data: buffer.toString("base64"),
        },
    };
};

// Lazily require/construct the SDK client so the app can boot and serve
// every non-AI route even if the provider package or API key is missing.
const getClient = () => {
    if (PROVIDER === "gemini") {
        if (!process.env.AI_API_KEY) {
            throw new AIUnavailableError("AI_API_KEY is not configured");
        }
        return { provider: "gemini" };
    }
    if (PROVIDER !== "openai") {
        throw new AIUnavailableError(`Unsupported AI_PROVIDER "${PROVIDER}"`);
    }
    return getOpenAIClient();
};

// Returns a plain number[] embedding for a piece of text.
const createEmbedding = async (text) => {
    const client = getClient();
    const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

    if (PROVIDER === "gemini") {
        const geminiModel = toGeminiModelName(model, "embedding");
        try {
            const response = await withTimeout(
                fetchJson(`${GEMINI_API_BASE}/models/${geminiModel}:embedContent?key=${process.env.AI_API_KEY}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        content: {
                            parts: [{ text: text.slice(0, 8000) }],
                        },
                    }),
                }),
                TIMEOUT_MS,
                "Embedding request"
            );
            const embedding = response?.embedding?.values || response?.data?.embedding?.values || [];
            return { embedding, model: geminiModel };
        } catch (err) {
            if (err instanceof AIUnavailableError) throw err;
            throw new AIUnavailableError("Embedding request failed", err);
        }
    }

    try {
        const response = await withTimeout(
            client.embeddings.create({ model, input: text.slice(0, 8000) }),
            TIMEOUT_MS,
            "Embedding request"
        );
        return { embedding: response.data[0].embedding, model };
    } catch (err) {
        if (err instanceof AIUnavailableError) throw err;
        throw new AIUnavailableError("Embedding request failed", err);
    }
};

// Sends a vision + text prompt, expects a strict JSON object back.
// `imageUrl` may be a remote https URL (Cloudinary) or a data: URI.
const classifyImageJSON = async ({ imageUrl, instructions }) => {
    const client = getClient();
    const model = process.env.VISION_MODEL || process.env.AI_MODEL || "gpt-4o-mini";

    if (PROVIDER === "gemini") {
        const geminiModel = toGeminiModelName(model, "chat");
        try {
            const imagePart = await toBase64ImagePart(imageUrl);
            const response = await withTimeout(
                fetchJson(`${GEMINI_API_BASE}/models/${geminiModel}:generateContent?key=${process.env.AI_API_KEY}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        systemInstruction: {
                            parts: [{ text: "You identify a physical household/donation item from a photo. Respond ONLY with a JSON object and nothing else." }],
                        },
                        contents: [{
                            parts: [
                                { text: instructions },
                                imagePart,
                            ].filter(Boolean),
                        }],
                        generationConfig: { responseMimeType: "application/json" },
                    }),
                }),
                TIMEOUT_MS,
                "Image classification request"
            );
            return parseGeminiTextResponse(response);
        } catch (err) {
            if (err instanceof AIUnavailableError) throw err;
            throw new AIUnavailableError("Image classification request failed", err);
        }
    }

    try {
        const response = await withTimeout(
            client.chat.completions.create({
                model,
                max_tokens: 300,
                temperature: 0,
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content:
                            "You identify a physical household/donation item from a photo. " +
                            "Respond ONLY with a JSON object and nothing else.",
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: instructions },
                            { type: "image_url", image_url: { url: imageUrl } },
                        ],
                    },
                ],
            }),
            TIMEOUT_MS,
            "Image classification request"
        );
        const raw = response.choices?.[0]?.message?.content || "{}";
        return JSON.parse(raw);
    } catch (err) {
        if (err instanceof AIUnavailableError) throw err;
        throw new AIUnavailableError("Image classification request failed", err);
    }
};

// Sends a plain text prompt, expects a strict JSON object back. Used for
// "suggest a brand-new category name" when nothing similar exists yet.
const completeJSON = async ({ system, prompt }) => {
    const client = getClient();
    const model = process.env.AI_MODEL || "gpt-4o-mini";

    if (PROVIDER === "gemini") {
        const geminiModel = toGeminiModelName(model, "chat");
        try {
            const response = await withTimeout(
                fetchJson(`${GEMINI_API_BASE}/models/${geminiModel}:generateContent?key=${process.env.AI_API_KEY}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        systemInstruction: {
                            parts: [{ text: system }],
                        },
                        contents: [{
                            parts: [{ text: prompt }],
                        }],
                        generationConfig: { responseMimeType: "application/json" },
                    }),
                }),
                TIMEOUT_MS,
                "AI text request"
            );
            return parseGeminiTextResponse(response);
        } catch (err) {
            if (err instanceof AIUnavailableError) throw err;
            throw new AIUnavailableError("AI text request failed", err);
        }
    }

    try {
        const response = await withTimeout(
            client.chat.completions.create({
                model,
                max_tokens: 300,
                temperature: 0.2,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt },
                ],
            }),
            TIMEOUT_MS,
            "AI text request"
        );
        const raw = response.choices?.[0]?.message?.content || "{}";
        return JSON.parse(raw);
    } catch (err) {
        if (err instanceof AIUnavailableError) throw err;
        throw new AIUnavailableError("AI text request failed", err);
    }
};

const isAIConfigured = () => Boolean(process.env.AI_API_KEY);

module.exports = {
    AIUnavailableError,
    createEmbedding,
    classifyImageJSON,
    completeJSON,
    isAIConfigured,
};
