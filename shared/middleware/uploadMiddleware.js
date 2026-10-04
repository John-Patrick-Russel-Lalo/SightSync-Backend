import multer from "multer";
import { compressUploadedFile } from "../utils/imageCompression.js";

export const PAYMENT_PROOF_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_PAYMENT_PROOF_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

// Payment proofs are held in memory and written straight into Postgres as BYTEA.
// Nothing touches the local disk, which is ephemeral on the production host.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PAYMENT_PROOF_MAX_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_PAYMENT_PROOF_MIME_TYPES.has(file.mimetype)) {
      const error = new Error("Payment proof must be a JPG, PNG, or WEBP image.");
      error.code = "UNSUPPORTED_PAYMENT_PROOF_TYPE";
      return cb(error, false);
    }
    cb(null, true);
  },
});

export const uploadPaymentProof = upload.single("paymentProof");

// Wraps the multer middleware so upload failures (wrong file type, oversized
// file) come back as JSON instead of falling through to Express' HTML error page.
// The proof is compressed before it leaves here, so only the shrunken image ever
// reaches the service and the database.
export function withPaymentProofUpload(req, res, next) {
  uploadPaymentProof(req, res, async (error) => {
    if (error) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? `Payment proof must be ${PAYMENT_PROOF_MAX_BYTES / (1024 * 1024)}MB or smaller.`
          : error.message || "Failed to upload the payment proof.";

      return res.status(400).json({ error: message });
    }

    if (req.file) {
      const result = await compressUploadedFile(req.file);

      if (result?.compressed) {
        console.log(
          `Payment proof compressed ${(result.originalSize / (1024 * 1024)).toFixed(2)}MB -> ` +
          `${(result.compressedSize / (1024 * 1024)).toFixed(2)}MB (${result.ratio}x smaller, quality ${result.quality}).`
        );
      }
    }

    next();
  });
}

export default { uploadPaymentProof, withPaymentProofUpload, PAYMENT_PROOF_MAX_BYTES };