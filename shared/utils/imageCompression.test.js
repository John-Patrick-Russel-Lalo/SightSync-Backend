import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { compressImage, compressUploadedFile } from "./imageCompression.js";

// Builds a large, screenshot-like PNG (soft gradient + horizontal "receipt" rows)
// so the tests exercise real encoding instead of a flat colour, which PNG would
// shrink down to almost nothing on its own.
async function makeReceiptPng(width = 2400, height = 1400) {
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      const rowStripe = Math.floor(y / 40) % 2 === 0 ? 40 : 0;
      const colStripe = Math.floor(x / 60) % 2 === 0 ? 25 : 0;

      raw[offset] = (x / width) * 255 + colStripe;
      raw[offset + 1] = (y / height) * 255 + rowStripe;
      raw[offset + 2] = 200 - (x / width) * 120;
    }
  }

  return sharp(raw, { raw: { width, height, channels } })
    .png({ compressionLevel: 0 })
    .toBuffer();
}

describe("compressImage", () => {
  it("shrinks a large screenshot to at least half its original size", async () => {
    const original = await makeReceiptPng();
    const result = await compressImage(original);

    expect(result.compressed).toBe(true);
    expect(result.compressedSize).toBeLessThanOrEqual(Math.floor(original.length / 2));
    expect(result.ratio).toBeGreaterThanOrEqual(2);
    expect(result.mime).toBe("image/jpeg");
  });

  it("returns a decodable JPEG that is capped to the max edge", async () => {
    const original = await makeReceiptPng(2400, 1400);
    const result = await compressImage(original, { maxEdge: 800 });

    const meta = await sharp(result.buffer).metadata();

    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(800);
  });

  it("keeps the original bytes when they are already smaller", async () => {
    const original = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#ffffff" },
    })
      .jpeg({ quality: 95 })
      .toBuffer();

    const result = await compressImage(original);

    expect(result.compressed).toBe(false);
    expect(result.buffer).toBe(original);
    expect(result.compressedSize).toBe(original.length);
  });
});

describe("compressUploadedFile", () => {
  it("rewrites the multer file in place with the compressed image", async () => {
    const buffer = await makeReceiptPng();
    const file = {
      fieldname: "paymentProof",
      originalname: "gcash-receipt.png",
      mimetype: "image/png",
      size: buffer.length,
      buffer,
    };

    const result = await compressUploadedFile(file);

    expect(result.compressed).toBe(true);
    expect(file.buffer.length).toBe(result.compressedSize);
    expect(file.size).toBe(result.compressedSize);
    expect(file.mimetype).toBe("image/jpeg");
    expect(file.originalname).toBe("gcash-receipt.jpg");
    expect(file.buffer.length).toBeLessThanOrEqual(Math.floor(buffer.length / 2));
  });

  it("returns null and leaves the file alone when the image cannot be decoded", async () => {
    const buffer = Buffer.from("this is not an image");
    const file = {
      originalname: "broken.png",
      mimetype: "image/png",
      size: buffer.length,
      buffer,
    };

    const result = await compressUploadedFile(file);

    expect(result).toBeNull();
    expect(file.buffer).toBe(buffer);
  });

  it("ignores a request with no file attached", async () => {
    expect(await compressUploadedFile(undefined)).toBeNull();
  });
});
