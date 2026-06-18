// Rasterize public/og-image.svg → public/og-image.png at 1200×630.
//
// Run automatically as part of `npm run build` (see package.json prebuild) so
// the PNG ships in dist/. Twitter/X requires raster (PNG/JPG/WEBP) for
// summary_large_image cards; Facebook/LinkedIn/iMessage accept SVG too but
// prefer PNG.
//
// Requires `sharp` (devDependency).

import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const src = resolve(root, "public/og-image.svg");
const dst = resolve(root, "public/og-image.png");

const svg = await readFile(src);
const png = await sharp(svg, { density: 200 })
  .resize(1200, 630, { fit: "fill" })
  .png({ compressionLevel: 9 })
  .toBuffer();

await writeFile(dst, png);
console.log(`[build-og] wrote ${dst} (${png.byteLength} bytes)`);
