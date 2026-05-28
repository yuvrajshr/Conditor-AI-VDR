import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

// Load .env if present
try {
  fs.readFileSync(path.join(__dirname, ".env"), "utf8").split("\n").forEach(line => {
    const eq = line.indexOf("=");
    if(eq > 0 && !line.startsWith("#")){
      process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  });
} catch(e) {}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";

function log(tag, msg, data) {
  const ts = new Date().toISOString().slice(11, 23);
  const extra = data !== undefined ? " " + JSON.stringify(data) : "";
  console.log(`[${ts}] [${tag}] ${msg}${extra}`);
}

function geminiRequest(apiKey, prompt, maxTokens) {
  return new Promise((resolve, reject) => {
    const model = GEMINI_MODEL;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 }
    };
    const body = JSON.stringify(payload);
    log("GEMINI", `→ request`, { model, maxTokens, promptLen: prompt.length });
    const req = https.request({
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if(res.statusCode >= 400) {
            const errMsg = json.error?.message || "Gemini HTTP " + res.statusCode;
            log("GEMINI", `✗ HTTP ${res.statusCode}`, { model, error: errMsg, details: json.error?.details });
            return reject(new Error(errMsg));
          }
          const candidate = json.candidates?.[0];
          const finishReason = candidate?.finishReason;
          const parts = candidate?.content?.parts || [];
          const text = parts.map(p => p.text || "").join("").trim();
          if(!text) {
            log("GEMINI", `✗ empty response`, { model, finishReason, candidateCount: json.candidates?.length, safetyRatings: candidate?.safetyRatings });
            return reject(new Error(`Empty Gemini response (finishReason: ${finishReason})`));
          }
          log("GEMINI", `✓ success`, { model, finishReason, textLen: text.length });
          resolve(text);
        } catch(e) {
          log("GEMINI", `✗ parse error`, { model, error: e.message, rawSnippet: data.slice(0, 200) });
          reject(e);
        }
      });
    });
    req.on("error", e => {
      log("GEMINI", `✗ network error`, { model, error: e.message });
      reject(e);
    });
    req.write(body);
    req.end();
  });
}

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if(req.method === "OPTIONS"){ res.writeHead(204); res.end(); return; }

  // /api/chat — server-side Gemini call (no browser CORS issues)
  if(req.url === "/api/chat" && req.method === "POST"){
    let body = "";
    req.on("data", c => body += c);
    req.on("end", async () => {
      try {
        const { prompt, maxTokens, apiKey } = JSON.parse(body);
        const key = process.env.GEMINI_API_KEY || apiKey || "";
        log("CHAT", `request received`, { promptLen: prompt?.length, maxTokens, hasKey: !!key });
        if(!key){
          log("CHAT", `✗ no API key`);
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No GEMINI_API_KEY. Add it to .env or set CONFIG.GEMINI_API_KEY in app.js." }));
          return;
        }
        log("CHAT", `calling Gemini (${GEMINI_MODEL})`);
        const text = await geminiRequest(key, prompt, maxTokens || 800);
        log("CHAT", `✓ response`, { textLen: text.length });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ text }));
      } catch(e) {
        log("CHAT", `✗ fatal error`, { error: e.message, stack: e.stack?.split("\n")[1]?.trim() });
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // /api/ai — full AI backend (needs vercel dev for other features)
  if(req.url === "/api/ai" && req.method === "POST"){
    let body = "";
    req.on("data", c => body += c);
    req.on("end", async () => {
      try {
        const { system, prompt, maxTokens } = JSON.parse(body);
        const key = process.env.GEMINI_API_KEY || "";
        if(!key){
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No GEMINI_API_KEY in .env" }));
          return;
        }
        const fullPrompt = system ? system + "\n\n" + prompt : prompt;
        const text = await geminiRequest(key, fullPrompt, maxTokens || 1300);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ text }));
      } catch(e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Static file serving
  let filePath = path.join(__dirname, req.url === "/" ? "index.html" : req.url);
  if(!filePath.startsWith(__dirname)){ res.writeHead(403); res.end("Forbidden"); return; }

  fs.readFile(filePath, (err, data) => {
    if(err){ res.writeHead(404); res.end("Not Found"); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain", "Cache-Control": "no-cache" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const hasKey = !!process.env.GEMINI_API_KEY;
  console.log(`✓ Dev server running at http://localhost:${PORT}`);
  console.log(`  AI chat:  ${hasKey ? "✓ Gemini ready (GEMINI_API_KEY loaded)" : "⚠ Add GEMINI_API_KEY to .env for AI features"}`);
});
