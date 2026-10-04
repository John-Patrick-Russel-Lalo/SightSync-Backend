import sharp from "sharp";

// Payment proofs are stored as BYTEA inside Postgres, so every byte saved here is
// a byte saved on the database (and on every backup of it). Phone cameras and
// screenshots are far larger than an admin needs to read a receipt, so the proof
// is re-encoded: longest side capped, metadata dropped, and the JPEG quality
// walked down until the result is at least half the size of the upload.

export const COMPRESS_TARGET_RATIO = 2;
export const COMPRESS_MAX_EDGE = 1600;
export const COMPRESS_MIN_QUALITY = 40;
export const COMPRESS_OUTPUT_MIME = "image/jpeg";

// Descending quality ladder. The first rung that hits the target wins; if none
// do, the smallest result is used instead.
const QUALITY_LADDER = [72, 62, 54, 48, COMPRESS_MIN_QUALITY];

function renameToJpg(filename) {
    const base = String(filename || "payment-proof")
        .replace(/\.[^.]+$/, "")
        .replace(/[\\/:*?"<>|]/g, "-")
        .trim();
    return `${base || "payment-proof"}.jpg`;
}

async function encodeJpeg(buffer, { maxEdge, quality }) {
    const { data, info } = await sharp(buffer, { failOn: "warning" })
        .rotate()
        .resize({
            width: maxEdge,
            height: maxEdge,
            fit: "inside",
            withoutEnlargement: true,
        })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:2:0" })
        .toBuffer({ resolveWithObject: true });

    return { buffer: Buffer.isBuffer(data) ? data : Buffer.from(data), size: info.size, quality };
}

// Re-encodes an image so it lands at roughly `targetRatio` times smaller than the
// original. Never returns anything larger than the input: if the source is
// already tiny (or already well compressed) the original bytes win.
export async function compressImage(
    buffer,
    {
        targetRatio = COMPRESS_TARGET_RATIO,
        maxEdge = COMPRESS_MAX_EDGE,
        qualityLadder = QUALITY_LADDER,
    } = {}
) {
    const originalSize = buffer.length;
    const fallback = {
        buffer,
        mime: COMPRESS_OUTPUT_MIME,
        filename: null,
        originalSize,
        compressedSize: originalSize,
        ratio: 1,
        quality: null,
        compressed: false,
    };

    const targetBytes = Math.floor(originalSize / targetRatio);
    let best = null;

    for (const quality of qualityLadder) {
        const attempt = await encodeJpeg(buffer, { maxEdge, quality });

        if (!best || attempt.size < best.size) {
            best = attempt;
        }

        if (attempt.size <= targetBytes) {
            break;
        }
    }

    if (!best || best.size >= originalSize) {
        return fallback;
    }

    return {
        buffer: best.buffer,
        mime: COMPRESS_OUTPUT_MIME,
        filename: null,
        originalSize,
        compressedSize: best.size,
        ratio: Number((originalSize / best.size).toFixed(2)),
        quality: best.quality,
        compressed: true,
    };
}

// Compresses a multer memory-storage file in place, so everything downstream
// (controller, service, INSERT) sees the shrunken image. A proof that cannot be
// decoded is stored untouched rather than blocking the booking.
export async function compressUploadedFile(file, options = {}) {
    if (!file?.buffer?.length) {
        return null;
    }

    let result;

    try {
        result = await compressImage(file.buffer, options);
    } catch (error) {
        console.warn("Payment proof compression failed, storing original image:", error?.message);
        return null;
    }

    if (!result.compressed) {
        return result;
    }

    file.buffer = result.buffer;
    file.size = result.compressedSize;
    file.mimetype = result.mime;
    file.originalname = renameToJpg(file.originalname);

    return result;
}

export default { compressImage, compressUploadedFile, COMPRESS_TARGET_RATIO, COMPRESS_MAX_EDGE };
