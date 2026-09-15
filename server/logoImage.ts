import sharp from "sharp";
import { safeImage } from "./linkMetadataParse";

// ICO is not a libvips input format. Decode its largest bounded PNG or 32-bit
// bitmap entry before applying the same pixel validation as every other logo.
function iconInput(
  body: Buffer
): Buffer | { pixels: Buffer; width: number; height: number } | null {
  if (body.length < 22) return null;
  const count = body.readUInt16LE(4);
  if (!count || count > 64 || 6 + count * 16 > body.length) return null;
  const entries = Array.from({ length: count }, (_, i) => {
    const at = 6 + i * 16;
    return {
      width: body[at] || 256,
      height: body[at + 1] || 256,
      length: body.readUInt32LE(at + 8),
      offset: body.readUInt32LE(at + 12),
    };
  }).sort((a, b) => b.width * b.height - a.width * a.height);
  for (const e of entries) {
    if (e.offset < 6 + count * 16 || e.offset + e.length > body.length)
      continue;
    const data = body.subarray(e.offset, e.offset + e.length);
    if (data.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return data;
    if (
      data.length < 40 ||
      data.readUInt32LE(0) !== 40 ||
      data.readUInt16LE(14) !== 32 ||
      data.readUInt32LE(16) !== 0
    )
      continue;
    if (data.readInt32LE(4) !== e.width || data.readInt32LE(8) !== e.height * 2)
      continue;
    const bytes = e.width * e.height * 4;
    if (40 + bytes > data.length) continue;
    const rgba = Buffer.alloc(bytes);
    const hasAlpha = Array.from(
      { length: e.width * e.height },
      (_, i) => data[43 + i * 4]
    ).some(Boolean);
    const maskStride = Math.ceil(e.width / 32) * 4;
    for (let y = 0; y < e.height; y++)
      for (let x = 0; x < e.width; x++) {
        const src = 40 + ((e.height - 1 - y) * e.width + x) * 4;
        const dest = (y * e.width + x) * 4;
        rgba[dest] = data[src + 2];
        rgba[dest + 1] = data[src + 1];
        rgba[dest + 2] = data[src];
        const mask =
          data[40 + bytes + (e.height - 1 - y) * maskStride + (x >> 3)] ?? 0;
        rgba[dest + 3] = hasAlpha
          ? data[src + 3]
          : mask & (128 >> x % 8)
            ? 0
            : 255;
      }
    return { pixels: rgba, width: e.width, height: e.height };
  }
  return null;
}

/** Decode pixels, reject empty/broken artwork, and make light marks readable. */
export async function readableLogo(
  body: Buffer,
  contentType: string
): Promise<Buffer | null> {
  try {
    const safe = safeImage(body, contentType);
    if (!safe) return null;
    const input =
      safe.mime === "image/x-icon" ? iconInput(safe.body) : safe.body;
    if (!input) return null;
    const source = Buffer.isBuffer(input)
      ? sharp(input, {
          limitInputPixels: 8388608,
          failOn: "warning",
          density: 144,
        })
      : sharp(input.pixels, {
          raw: { width: input.width, height: input.height, channels: 4 },
        });
    const { data, info } = await source
      .timeout({ seconds: 3 })
      .rotate()
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .toColourspace("srgb")
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.width < 8 || info.height < 8) return null;
    let left = info.width,
      top = info.height,
      right = -1,
      bottom = -1;
    let weight = 0,
      luminance = 0,
      transparent = 0;
    const min = [255, 255, 255, 255],
      max = [0, 0, 0, 0];
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 4,
          a = data[i + 3];
        // Invisible RGB values must not make a blank transparent image look valid.
        for (let c = 0; c < 4; c++) {
          const value = c === 3 ? a : Math.round((data[i + c] * a) / 255);
          min[c] = Math.min(min[c], value);
          max[c] = Math.max(max[c], value);
        }
        if (a < 240) transparent++;
        if (a <= 24) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        weight += a / 255;
        luminance +=
          ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) *
            a) /
          255;
      }
    if (
      weight < 8 ||
      right - left < 3 ||
      bottom - top < 3 ||
      max.every((v, i) => v - min[i] < 12)
    )
      return null;
    // Preserve brand colours. Add a neutral dark backing only when a largely
    // transparent mark has little contrast on the application's white surface.
    const background =
      transparent > info.width * info.height * 0.1 && luminance / weight > 185
        ? "#17243b"
        : "#ffffff";
    return await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
      .flatten({ background })
      .extend({ top: 6, bottom: 6, left: 6, right: 6, background })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}
