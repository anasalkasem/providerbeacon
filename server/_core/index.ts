import { startPushWorker } from "../messagePush";
import { startServiceScreeningWorker } from "../serviceScreening";
import { startMessagingWorker } from "../messageTranslation";
import { registerImportedMediaRoutes, startImportedMediaCleanup } from "../importedMediaRoutes";
import { repairImportedProviderLogos } from "../providerLogoRepair";
import "dotenv/config";
import { registerProviderAnalyticsRoutes } from "../providerAnalyticsRoutes";
import { startProviderAnalyticsCleanup } from "../providerAnalyticsDb";
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
import { registerMemberRoutes } from "../memberGoogle";
import { registerEmailRoutes } from "../emailRoutes";
import { startEmailWorker } from "../emailDb";
import { startPriceAlertWorker } from "../priceAlerts";
import { registerPaymentRoutes } from "../paymentRoutes";

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
  registerProviderAnalyticsRoutes(app);
  registerImportedMediaRoutes(app);
  registerEmailRoutes(app);
  registerPaymentRoutes(app);
  const assistantJson = express.json({ limit: "32kb" });
  // Cover uploads have one bounded endpoint. Batches retain the normal body limit.
  app.use("/api/trpc/business.vip.submit", express.json({ limit: "720kb" }));
  app.use((req, res, next) => {
    const procedures = req.path.startsWith("/api/trpc/") ? req.path.slice("/api/trpc/".length).split(",") : [];
    return procedures.some(name => name.startsWith("messaging.") || name === "assistant.chat" || name.startsWith("member.") || name.startsWith("business.") || name.startsWith("admin.business.") || name.startsWith("workspace.") || name.startsWith("admin.email.") || name.startsWith("community.") || name.startsWith("ratings.") || name.startsWith("admin.groups.") || ["admin.providers.previewWebsite", "admin.providers.createDraft", "admin.providers.saveProfile"].includes(name)) ? assistantJson(req, res, next) : next();
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerMemberRoutes(app);
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
    // Resume due pricing/catalogue refreshes after deployment without waiting
    // for the external hourly scheduler. The shared queue deduplicates workers.
    void runDueProviderSyncs(10).catch(() => {
      console.warn("[Provider sync] Due catalogues will be retried by the scheduler");
    });
    server.on("close", stopWorker);
    server.on("close", startEmailWorker());
    server.on("close", startProviderAnalyticsCleanup());
    startImportedMediaCleanup();
    if (process.env.NODE_ENV === "production") {
      const repair = setTimeout(() => {
        void repairImportedProviderLogos().catch(() => console.warn("[metadata] Logo recovery deferred"));
      }, 5000);
      repair.unref();
      server.on("close", () => clearTimeout(repair));
    }
    server.on("close", startPriceAlertWorker());
    server.on("close", startServiceScreeningWorker());
    server.on("close", startMessagingWorker());
    server.on("close", startPushWorker());
  });
}

startServer().catch(console.error);
