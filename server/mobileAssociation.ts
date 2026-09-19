import type { Express } from "express";

export const ANDROID_PACKAGE_ID = "com.providerbeacon.app";

/** Only the Play app-signing certificate belongs here, never a debug certificate. */
export function androidAssetLinks(raw = "") {
  if (!raw.trim()) return [];
  const fingerprints = Array.from(
    new Set(raw.split(",").map(value => value.trim().toUpperCase()))
  );
  if (
    fingerprints.length > 5 ||
    fingerprints.some(value => !/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(value))
  )
    throw new Error("Invalid Android app-signing certificate configuration");
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE_ID,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

export function registerMobileAssociationRoutes(app: Express) {
  app.get("/.well-known/assetlinks.json", (_req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      const links = androidAssetLinks(
        process.env.ANDROID_APP_SHA256_FINGERPRINTS
      );
      res.setHeader("Cache-Control", "public, max-age=300");
      res.json(links);
    } catch {
      res.setHeader("Cache-Control", "no-store");
      res
        .status(503)
        .json({ error: "App association is not configured correctly" });
    }
  });
}
