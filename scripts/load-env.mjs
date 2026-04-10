import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");

export function loadEnvLocal() {
  if (!fs.existsSync(envPath)) {
    console.warn(`[env] .env.local not found at: ${envPath}`);
    return;
  }
  // Оставляем краткий лог, чтобы сразу видеть какой файл подхватился.
  console.log(`[env] loading: ${envPath}`);
  const raw = fs.readFileSync(envPath, "utf8");
  const seen = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    // Для этих скриптов .env.local должен иметь приоритет над текущим окружением.
    process.env[k] = v;
    seen.push(k);
  }

  console.log(`[env] loaded keys: ${seen.length}`);
}
