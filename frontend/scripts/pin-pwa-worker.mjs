/**
 * After next-pwa build, copy hashed worker-*.js → worker-push.js and point sw.js at it.
 * Prevents push breakage when CDN/browser cache an old sw.js that imports a deleted worker hash.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const swPath = path.join(publicDir, "openhrm-sw.js");

if (!fs.existsSync(swPath)) {
  console.warn("[pin-pwa-worker] openhrm-sw.js not found, skip");
  process.exit(0);
}

let sw = fs.readFileSync(swPath, "utf8");
const match = sw.match(/importScripts\("(worker-[^"]+\.js)"\)/);
if (!match) {
  console.warn("[pin-pwa-worker] no worker import in openhrm-sw.js, skip");
  process.exit(0);
}

const hashed = match[1];
if (hashed === "worker-push.js") {
  console.log("[pin-pwa-worker] already pinned");
  process.exit(0);
}

const src = path.join(publicDir, hashed);
const dest = path.join(publicDir, "worker-push.js");
if (!fs.existsSync(src)) {
  console.error(`[pin-pwa-worker] missing ${hashed}`);
  process.exit(1);
}

fs.copyFileSync(src, dest);
sw = sw.replace(`importScripts("${hashed}")`, 'importScripts("worker-push.js")');
fs.writeFileSync(swPath, sw);
console.log(`[pin-pwa-worker] ${hashed} → worker-push.js`);
