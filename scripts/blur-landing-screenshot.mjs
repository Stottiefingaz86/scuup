/**
 * Anonymise the landing hero screenshot — blur narrative text and
 * mask card headers so no brand names or logos are readable.
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "public/landing/app-overview.png");
const OUT = SRC;

/** [left, top, width, height] at 2× (3040×1880) */
const BLUR_REGIONS = [
  [24, 108, 520, 96],
  [548, 68, 920, 80],
  [548, 228, 1180, 420],
  [1680, 340, 1320, 220],
  [520, 1340, 1900, 540],
];

/** Card header masks — solid fill over logo + name + domain only */
const MASK_REGIONS = [
  [568, 920, 640, 180],
  [1210, 920, 640, 180],
  [1852, 920, 640, 180],
  [2494, 920, 540, 180],
];

const BLUR_SIGMA = 20;
const MASK_RGBA = { r: 18, g: 18, b: 20, alpha: 1 };

const meta = await sharp(SRC).metadata();
const { width, height } = meta;

const composites = [];

for (const [left, top, w, h] of BLUR_REGIONS) {
  const cropLeft = Math.max(0, left);
  const cropTop = Math.max(0, top);
  const cropW = Math.min(w, width - cropLeft);
  const cropH = Math.min(h, height - cropTop);
  if (cropW <= 0 || cropH <= 0) continue;

  const patch = await sharp(SRC)
    .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
    .blur(BLUR_SIGMA)
    .toBuffer();

  composites.push({ input: patch, left: cropLeft, top: cropTop });
}

for (const [left, top, w, h] of MASK_REGIONS) {
  const cropLeft = Math.max(0, left);
  const cropTop = Math.max(0, top);
  const cropW = Math.min(w, width - cropLeft);
  const cropH = Math.min(h, height - cropTop);
  if (cropW <= 0 || cropH <= 0) continue;

  const mask = await sharp({
    create: {
      width: cropW,
      height: cropH,
      channels: 4,
      background: MASK_RGBA,
    },
  })
    .png()
    .toBuffer();

  composites.push({ input: mask, left: cropLeft, top: cropTop });
}

const tmp = OUT + ".tmp";
await sharp(SRC).composite(composites).png().toFile(tmp);
await fs.rename(tmp, OUT);

console.log(
  `Anonymised ${OUT} — ${BLUR_REGIONS.length} blurred, ${MASK_REGIONS.length} masked`
);
