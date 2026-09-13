import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./static";
import { runMigrations } from "../migrate";
import { verifyScheduledWorkflowToken } from "../schedulerAuth";
import { runDueProviderSyncs } from "../vaultDb";
import { startProviderSyncWorker } from "../providerSync";
import { runLegacyNormalization } from "../serviceReviewDb";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  if (process.env.NODE_ENV === "production") await runMigrations();
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "healthy",
      service: "providerbeacon",
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
    });
  });
  app.post("/api/internal/provider-sync", async (req, res) => {
    const authorization = req.headers.authorization ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Missing workflow identity token" });
    try {
      const identity = await verifyScheduledWorkflowToken(token);
      const result = await runDueProviderSyncs(10);
      return res.status(200).json({ ok: true, trigger: identity.claims.eventName, ...result });
    } catch (error) {
      console.warn("[Scheduler] Rejected scheduled sync request:", error instanceof Error ? error.message : error);
      return res.status(401).json({ error: "Invalid workflow identity token" });
    }
  });
  registerStorageProxy(app);
  if (process.env.OAUTH_SERVER_URL) {
    const { registerOAuthRoutes } = await import("./oauth");
    registerOAuthRoutes(app);
  }
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = process.env.NODE_ENV === "production"
    ? preferredPort
    : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}/`);
    if (process.env.NODE_ENV === "production") void runLegacyNormalization();
    const stopWorker = startProviderSyncWorker();
    server.on("close", stopWorker);
  });
}

startServer().catch(console.error);
