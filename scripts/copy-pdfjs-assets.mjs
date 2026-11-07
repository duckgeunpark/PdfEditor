// pdf.js needs these data files at runtime to render pages correctly:
// - cmaps/standard_fonts: non-embedded / CJK (Korean, etc.) text
// - wasm: JBIG2 / OpenJPEG image codecs used by scanned PDFs
// - iccs: ICC color profiles
// Without them, affected pages render blank, garbled, or with missing images.
import { cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(rootDir, "node_modules", "pdfjs-dist");
const dest = path.join(rootDir, "public", "pdfjs");

const assets = ["cmaps", "standard_fonts", "iccs", "wasm"];

if (!existsSync(src)) {
  console.error(`[copy-pdfjs-assets] pdfjs-dist not found at ${src}, skipping.`);
  process.exit(0);
}

for (const name of assets) {
  const from = path.join(src, name);
  const to = path.join(dest, name);
  if (!existsSync(from)) {
    console.warn(`[copy-pdfjs-assets] skipping missing ${from}`);
    continue;
  }
  cpSync(from, to, { recursive: true });
  console.log(`[copy-pdfjs-assets] copied ${name} -> public/pdfjs/${name}`);
}
