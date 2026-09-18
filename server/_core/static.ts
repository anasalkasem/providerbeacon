import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(
    express.static(distPath, {
      setHeaders(res, filePath) {
        const file = path.basename(filePath);
        if (file === "sw.js") {
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Service-Worker-Allowed", "/");
          res.setHeader("X-Content-Type-Options", "nosniff");
        }
        if (file === "manifest.json") {
          res.setHeader("Content-Type", "application/manifest+json");
          res.setHeader("Cache-Control", "no-cache");
        }
        if (file === "index.html") res.setHeader("Cache-Control", "no-cache");
      },
    })
  );

  // Fall through to the SPA entry point when a static file does not exist.
  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
