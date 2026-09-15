import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { readableLogo } from "./logoImage";
import { sanitizeSvg } from "./linkMetadataParse";

const artwork = (fill = "#2463eb") =>
  `<svg width="80" height="40" xmlns="http://www.w3.org/2000/svg"><path fill="${fill}" d="M10 5h20v30H10zM40 5h30v10H40zM40 25h30v10H40z"/></svg>`;
describe("imported logo pixel validation", () => {
  it("accepts a full-resolution brand logo like the affected 3264 by 1305 PNG", async () => {
    const svg =
      '<svg width="3264" height="1305" xmlns="http://www.w3.org/2000/svg"><path fill="#ff4512" d="M150 100h1300v1100H150zM1800 100h1000v1100H1800z"/></svg>';
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const logo = await readableLogo(png, "image/png");
    expect(logo).not.toBeNull();
    expect((await sharp(logo!).metadata()).width).toBeLessThanOrEqual(524);
  });
  it("rejects transparent, uniform, tiny and undecodable images instead of saving a blank logo", async () => {
    for (const background of ["#ffffff", "#00000000"]) {
      const png = await sharp({
        create: { width: 64, height: 64, channels: 4, background },
      })
        .png()
        .toBuffer();
      expect(await readableLogo(png, "image/png")).toBeNull();
    }
    expect(
      await readableLogo(
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="131" height="59" fill="none"><rect width="131" height="59" fill="url(#missing)"/><defs/></svg>'
        ),
        "image/svg+xml"
      )
    ).toBeNull();
    expect(
      await readableLogo(
        Buffer.from("89504e470d0a1a0a0000000000000000", "hex"),
        "image/png"
      )
    ).toBeNull();
    const tiny = await sharp({
      create: { width: 1, height: 1, channels: 4, background: "#fff" },
    })
      .png()
      .toBuffer();
    expect(await readableLogo(tiny, "image/png")).toBeNull();
  });
  it("preserves a light logo's colours and places them against a dark background", async () => {
    const result = await readableLogo(
      Buffer.from(artwork("#ffffff")),
      "image/svg+xml"
    );
    expect(result).not.toBeNull();
    const { data } = await sharp(result!)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([...data.subarray(0, 3)]).toEqual([23, 36, 59]);
    expect(await sharp(result!).stats()).toMatchObject({ isOpaque: true });
    const white = await sharp(result!)
      .extract({ left: 10, top: 10, width: 1, height: 1 })
      .raw()
      .toBuffer();
    expect([...white]).toEqual([255, 255, 255]);
  });
  it("keeps dark and coloured logos on white while trimming unused transparent margins", async () => {
    const result = await readableLogo(Buffer.from(artwork()), "image/svg+xml");
    expect(result).not.toBeNull();
    const info = await sharp(result!).metadata();
    expect(info.width).toBeLessThan(160);
    const pixel = await sharp(result!)
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .raw()
      .toBuffer();
    expect([...pixel]).toEqual([255, 255, 255]);
  });
  it("preserves embedded PNG artwork in SVG patterns like the actual affected provider", async () => {
    const pixels = await sharp(Buffer.from(artwork())).png().toBuffer();
    const svg = `<svg width="80" height="40" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><rect width="80" height="40" fill="url(#pattern0)"/><defs><pattern id="pattern0" patternContentUnits="objectBoundingBox" width="1" height="1"><use xlink:href="#image0" transform="scale(0.0125 0.025)"/></pattern><image id="image0" width="80" height="40" xlink:href="data:image/png;base64,${pixels.toString("base64")}"/></defs></svg>`;
    expect(sanitizeSvg(svg)?.toString()).toContain(
      'patternContentUnits="objectBoundingBox"'
    );
    const logo = await readableLogo(Buffer.from(svg), "image/svg+xml");
    expect(logo).not.toBeNull();
    const stats = await sharp(logo!).stats();
    expect(stats.channels.some(c => c.stdev > 20)).toBe(true);
  });
  it("does not permit external or nested SVG image loads, even inside a pattern", () => {
    for (const href of [
      "https://evil.com/pixel",
      "file:///etc/passwd",
      "data:image/svg+xml;base64,PHN2Zy8+",
    ]) {
      const safe = sanitizeSvg(
        `<svg xmlns="http://www.w3.org/2000/svg"><defs><pattern id="p"><image href="${href}"/></pattern></defs><rect width="20" height="20" fill="url(#p)"/></svg>`
      );
      expect(safe?.toString()).not.toContain("<image");
    }
  });
  it("accepts a real PNG-backed favicon while rejecting oversized image dimensions", async () => {
    const png = await sharp(Buffer.from(artwork())).png().toBuffer();
    const header = Buffer.alloc(22);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);
    header[6] = 80;
    header[7] = 40;
    header.writeUInt32LE(png.length, 14);
    header.writeUInt32LE(22, 18);
    expect(
      await readableLogo(Buffer.concat([header, png]), "image/x-icon")
    ).not.toBeNull();
    expect(
      await readableLogo(
        Buffer.from(
          '<svg width="10000" height="10000" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10000v10000z"/></svg>'
        ),
        "image/svg+xml"
      )
    ).toBeNull();
  });
});
