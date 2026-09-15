import type { Express } from "express";
import { eq } from "drizzle-orm";
import { importedMedia } from "../drizzle/linkMetadataSchema";
import { getDb } from "./db";
import { cleanupImportedMedia } from "./linkMetadata";

export function registerImportedMediaRoutes(app: Express) {
  app.get("/api/imported-media/:id", async (req, res) => {
    const id = req.params.id;
    if (!/^[a-f0-9]{64}$/.test(id)) {
      res.status(404).end();
      return;
    }
    try {
      const db = await getDb();
      if (!db) {
        res.status(503).end();
        return;
      }
      const [media] = await db
        .select()
        .from(importedMedia)
        .where(eq(importedMedia.id, id))
        .limit(1);
      if (!media) {
        res.setHeader("Cache-Control", "no-store");
        res.status(404).end();
        return;
      }
      res.setHeader("Content-Type", media.mime);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
      res.setHeader("Cross-Origin-Resource-Policy", "same-site");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("ETag", `"${id}"`);
      if (req.headers["if-none-match"] === `"${id}"`) {
        res.status(304).end();
        return;
      }
      res.send(Buffer.from(media.content, "base64"));
    } catch {
      res.setHeader("Cache-Control", "no-store");
      res.status(503).end();
    }
  });
}
export function startImportedMediaCleanup() {
  const run = () => {
    void cleanupImportedMedia().catch(() =>
      console.warn("[metadata] Asset cleanup deferred")
    );
  };
  const first = setTimeout(run, 300000);
  first.unref();
  const timer = setInterval(run, 86400000);
  timer.unref();
}
