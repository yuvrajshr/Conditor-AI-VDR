// ============================================================
// Conditor VDR AI — BACKEND  (Vercel Serverless Function)
// Route: /api/ai
// ------------------------------------------------------------
// This is the server side of the app. The browser never sees the
// AI key — it lives in an environment variable on the server and
// is used here to call Google's Gemini API (free tier).
//
// Swap providers by editing callGemini() below (e.g. Groq, OpenAI).
// ============================================================

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";

export default async function handler(req, res) {
  // Basic CORS (same-origin in production; harmless to include)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(500).json({ error: "Server is missing GEMINI_API_KEY. Add it in your Vercel project settings → Environment Variables." });
    return;
  }

  try {
    // Vercel parses JSON bodies, but guard for string bodies just in case.
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    const { system = "", prompt = "", maxTokens = 1300 } = body || {};
    if (!prompt) { res.status(400).json({ error: "Missing 'prompt' in request body." }); return; }

    const text = await callGemini({ key, system, prompt, maxTokens });
    res.status(200).json({ text, model: MODEL });
  } catch (e) {
    res.status(502).json({ error: "AI request failed: " + (e && e.message ? e.message : String(e)) });
  }
}

async function callGemini({ key, system, prompt, maxTokens }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
  };
  if (system) payload.systemInstruction = { parts: [{ text: system }] };

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) {
    const msg = data?.error?.message || `Gemini returned ${r.status}`;
    throw new Error(msg);
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const out = parts.map((p) => p.text || "").join("").trim();
  if (!out) throw new Error("Empty response from model");
  return out;
}
