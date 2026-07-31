/**
 * Edge Functions の mahjong-engine をクライアント向けに同期する。
 * 正本: supabase/functions/_shared/mahjong-engine/
 * 出力: src/lib/mahjong/engine/ （手編集禁止）
 *
 * Deno は .ts 拡張子必須、Next は拡張子なし import が必要なため、
 * コピー時に import パスだけ書き換える。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(
  ROOT,
  "supabase",
  "functions",
  "_shared",
  "mahjong-engine",
);
const OUT_DIR = path.join(ROOT, "src", "lib", "mahjong", "engine");

const FILES = ["tile.ts", "shanten.ts", "chi-choices.ts"];

const BANNER = `/**
 * AUTO-GENERATED — DO NOT EDIT
 * Source: supabase/functions/_shared/mahjong-engine/
 * Regenerate: npm run sync:mahjong-engine
 *
 * ルール判定の正本はサーバー（Edge Functions）側。
 * UI 用の候補表示のために同一実装を同期しているだけです。
 */

`;

function rewriteImports(source) {
  return source.replace(
    /from\s+["']\.\/([^"']+)\.ts["']/g,
    'from "./$1"',
  );
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const file of FILES) {
  const inputPath = path.join(SRC_DIR, file);
  const outputPath = path.join(OUT_DIR, file);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Missing source file: ${inputPath}`);
  }
  const raw = fs.readFileSync(inputPath, "utf8");
  const withoutBanner = raw.replace(/^\/\*\*[\s\S]*?\*\/\s*/, (m) =>
    m.includes("AUTO-GENERATED") ? "" : m,
  );
  fs.writeFileSync(outputPath, BANNER + rewriteImports(withoutBanner), "utf8");
  console.log(`synced ${file}`);
}

// Clean up legacy hand-maintained copies if present
for (const legacy of ["tile.ts", "shanten.ts"]) {
  const p = path.join(ROOT, "src", "lib", "mahjong", legacy);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log(`removed legacy ${legacy}`);
  }
}

console.log("mahjong-engine sync complete → src/lib/mahjong/engine/");
