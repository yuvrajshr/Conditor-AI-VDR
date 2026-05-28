import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

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
  // API proxy for /api/ai - would need to be handled separately or via CORS
  if (req.url.startsWith("/api/")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Run 'vercel dev' for API support" }));
    return;
  }

  let filePath = path.join(__dirname, req.url === "/" ? "index.html" : req.url);
  
  // Security: prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath);
    const mimeType = mimeTypes[ext] || "text/plain";
    
    res.writeHead(200, {
      "Content-Type": mimeType,
      "Cache-Control": "no-cache",
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`✓ Dev server running at http://localhost:${PORT}`);
  console.log(`  Frontend: http://localhost:${PORT} (demo mode)`);
  console.log(`  For live AI features, run 'vercel dev' instead (requires Vercel CLI)`);
});
