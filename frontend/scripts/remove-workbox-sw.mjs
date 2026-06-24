/**
 * Remove legacy Workbox service worker artifacts from /public.
 * Push notifications use /push-sw.js only — Workbox was caching stale CSS after deploys.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const REMOVE_NAMES = new Set([
  "openhrm-sw.js",
  "sw.js",
  "worker-push.js",
]);

if (!fs.existsSync(publicDir)) {
  process.exit(0);
}

for (const name of fs.readdirSync(publicDir)) {
  const remove =
    REMOVE_NAMES.has(name) ||
    /^workbox-.*\.js$/i.test(name) ||
    /^worker-[A-Za-z0-9_-]+\.js$/i.test(name);
  if (!remove) continue;
  const full = path.join(publicDir, name);
  if (fs.statSync(full).isFile()) {
    fs.unlinkSync(full);
    console.log(`[remove-workbox-sw] removed ${name}`);
  }
}
