'use strict';

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { uploadBuffer } = require('../services/s3_upload');

const MAX_FILE_SIZE_BYTES = Number(process.env.UPLOAD_MAX_FILE_SIZE_BYTES) || 5 * 1024 * 1024;
const MAX_PORTFOLIO_IMAGES = 8;

const cleanName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image';

const extFromMime = (mime) => {
  const m = String(mime || '').toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg') return '.jpg';
  if (m === 'image/png') return '.png';
  if (m === 'image/webp') return '.webp';
  if (m === 'image/gif') return '.gif';
  if (m === 'image/heic') return '.heic';
  if (m === 'image/heif') return '.heif';
  return '';
};

const makeShortId = () => {
  // Starts with a number and uses only [0-9a-z] (no '-' or '_' characters)
  // Example: 7k3m9x1p0q2 (11 chars)
  const firstDigit =
    typeof crypto.randomInt === 'function' ? crypto.randomInt(1, 10) : (crypto.randomBytes(1)[0] % 9) + 1;
  const rest = BigInt(`0x${crypto.randomBytes(8).toString('hex')}`).toString(36).padStart(10, '0').slice(0, 10);
  return `${firstDigit}${rest}`;
};

const makePortfolioKey = ({ originalName, mimeType }) => {
  const parsed = path.parse(String(originalName || 'image'));
  const base = cleanName(parsed.name);
  const ext = (parsed.ext || extFromMime(mimeType) || '').toLowerCase();
  const unique = makeShortId();
  return `venues/portfolio/${unique}_${base}${ext}`;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_PORTFOLIO_IMAGES },
  fileFilter: (req, file, cb) => {
    const mime = String(file?.mimetype || '').toLowerCase();
    if (!mime.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    return cb(null, true);
  },
});

const uploadPortfolioImageToS3 = (req, res, next) => {
  // Use `any()` so clients can send multiple files under the same field name
  // (e.g. `images` repeated 8 times) and preserve upload order.
  upload.any()(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: 'Invalid image upload', error: err.message || String(err) });
    }

    const files = Array.isArray(req.files)
      ? req.files.filter((f) => f && (f.fieldname === 'images' || f.fieldname === 'image'))
      : [];

    if (files.length === 0) return next();

    try {
      const uploaded = [];
      for (const file of files) {
        const key = makePortfolioKey({ originalName: file.originalname, mimeType: file.mimetype });
        const result = await uploadBuffer({
          buffer: file.buffer,
          contentType: file.mimetype,
          key,
        });
        uploaded.push({
          url: result.url,
          bucket: result.bucket,
          key: result.key,
          originalName: file.originalname,
          mimeType: file.mimetype,
        });
      }

      req.fileUrls = uploaded.map((u) => u.url);
      req.uploadedFiles = uploaded;
      req.fileUrl = uploaded[0]?.url;
      req.s3Object = uploaded[0] ? { bucket: uploaded[0].bucket, key: uploaded[0].key, url: uploaded[0].url } : null;
      return next();
    } catch (uploadErr) {
      return res.status(500).json({
        message: 'Unable to upload portfolio image',
        error: uploadErr.message || String(uploadErr),
      });
    }
  });
};

module.exports = { uploadPortfolioImageToS3 };
