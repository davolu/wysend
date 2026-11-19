import { readFileSync, writeFileSync, existsSync } from "node:fs";

const brand = readFileSync("src/brand.ts", "utf8");
const name = brand.match(/PRODUCT_NAME = "([^"]+)"/)?.[1];
const tagline = brand.match(/PRODUCT_TAGLINE = "([^"]+)"/)?.[1];
if (!name || !tagline) {
  throw new Error("Could not read the product name from src/brand.ts");
}

const manifest = {
  manifest_version: 3,
  name,
  version: "1.0.0",
  description: tagline,
  minimum_chrome_version: "139",
  permissions: ["storage", "sidePanel", "tabs", "activeTab", "contextMenus"],
  host_permissions: ["<all_urls>"],
  background: {
    service_worker: "background.js",
    type: "module",
  },
  action: {
    default_title: name,
    default_icon: {
      "16": "icons/16.png",
      "32": "icons/32.png",
      "48": "icons/48.png",
      "128": "icons/128.png",
    },
  },
  icons: {
    "16": "icons/16.png",
    "32": "icons/32.png",
    "48": "icons/48.png",
    "128": "icons/128.png",
  },
  side_panel: {
    default_path: "sidepanel.html",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["content.js"],
      run_at: "document_start",
      all_frames: true,
    },
  ],
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'",
  },
};

writeFileSync("dist/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

for (const file of ["dist/manifest.json", "dist/background.js", "dist/content.js", "dist/sidepanel.html", "dist/icons/128.png"]) {
  if (!existsSync(file)) throw new Error(`Build is missing ${file}`);
}

console.log(`Assembled ${name} into dist/`);
