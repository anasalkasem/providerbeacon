import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/** A new worker revision for every changed client build, without a PWA runtime dependency. */
export function pwaPlugin(): Plugin {
  return {
    name: "providerbeacon-pwa",
    apply: "build",
    generateBundle(_options, bundle) {
      const root = path.resolve(import.meta.dirname, "../client");
      const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
      const hash = createHash("sha256").update(worker);
      for (const name of Object.keys(bundle).sort()) hash.update(name);
      for (const name of ["offline.html", "offline.js", "manifest.json"])
        hash.update(fs.readFileSync(path.join(root, "public", name)));
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: worker.replaceAll(
          "__BUILD_ID__",
          hash.digest("hex").slice(0, 16)
        ),
      });
    },
  };
}
