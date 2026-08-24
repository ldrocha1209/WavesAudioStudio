import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import server from "../dist/server/server.js";

const appRoot = resolve(import.meta.dirname, "..");
const clientDir = resolve(appRoot, "dist/client");
const desktopDir = resolve(appRoot, "dist/desktop");

await rm(desktopDir, { recursive: true, force: true });
await mkdir(desktopDir, { recursive: true });
await cp(clientDir, desktopDir, { recursive: true });

const response = await server.fetch(
  new Request("http://waves.local/"),
  {},
  { waitUntil() {}, passThroughOnException() {} },
);
if (!response.ok) {
  throw new Error(`Desktop prerender failed with HTTP ${response.status}`);
}

const html = await response.text();
if (!html.includes("Waves") || !html.includes("/assets/")) {
  throw new Error("Desktop prerender did not contain the expected Waves shell");
}

// Tauri serves frontendDist from its own origin, so root-relative assets remain local.
await writeFile(resolve(desktopDir, "index.html"), html, "utf8");
