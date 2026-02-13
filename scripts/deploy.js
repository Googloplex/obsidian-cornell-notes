const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const OBSIDIAN_EXE =
  "C:\\Users\\dimfe\\AppData\\Local\\Programs\\obsidian\\Obsidian.exe";

const PLUGIN_DIR =
  "C:\\Users\\dimfe\\OneDrive\\Рабочий стол\\Main Knowledge Base\\.obsidian\\plugins\\cornell-notes";
const RELEASE_DIR = path.join(__dirname, "..", "release", "cornell-notes");
const FILES = ["main.js", "manifest.json", "styles.css"];

// 1. Close Obsidian
console.log("Closing Obsidian...");
try {
  execSync("taskkill /IM Obsidian.exe /F", { stdio: "ignore" });
} catch {
  console.log("Obsidian was not running");
}

// 2. Wait for process to fully exit, then copy and reopen
setTimeout(() => {
  // 3. Copy files
  fs.mkdirSync(PLUGIN_DIR, { recursive: true });
  for (const f of FILES) {
    const src = path.join(RELEASE_DIR, f);
    if (!fs.existsSync(src)) {
      console.error(`Missing: ${src} — run "npm run release" first`);
      process.exit(1);
    }
    fs.copyFileSync(src, path.join(PLUGIN_DIR, f));
    console.log(`Copied ${f}`);
  }

  // 4. Reopen Obsidian (detached so script exits immediately)
  console.log("Opening Obsidian...");
  const child = spawn(OBSIDIAN_EXE, [], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  console.log("Done!");
}, 2000);
