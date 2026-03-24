'use strict';

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { uploadBuffer } = require('../services/s3_upload');

const MAX_VIDEO_SIZE_BYTES = Number(process.env.UPLOAD_MAX_VIDEO_SIZE_BYTES) || 50 * 1024 * 1024; // 50MB
const MAX_PORTFOLIO_VIDEOS = 8;

const cleanName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'video';

const extFromMime = (mime) => {
  const m = String(mime || '').toLowerCase();
  if (m === 'video/mp4') return '.mp4';
  if (m === 'video/webm') return '.webm';
  if (m === 'video/quicktime') return '.mov';
  if (m === 'video/x-matroska') return '.mkv';
  if (m === 'video/3gpp') return '.3gp';
  return '';
};

const makeShortId = () => {
  const firstDigit =
    typeof crypto.randomInt === 'function' ? crypto.randomInt(1, 10) : (crypto.randomBytes(1)[0] % 9) + 1;
  const rest = BigInt(`0x${crypto.randomBytes(8).toString('hex')}`).toString(36).padStart(10, '0').slice(0, 10);
  return `${firstDigit}${rest}`;
};

const makePortfolioKey = ({ originalName, mimeType }) => {
  const parsed = path.parse(String(originalName || 'video'));
  const base = cleanName(parsed.name);
  const ext = (parsed.ext || extFromMime(mimeType) || '').toLowerCase();
  const unique = makeShortId();
  // Same format/prefix as portfolio images
  return `venues/portfolio/${unique}_${base}${ext}`;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_SIZE_BYTES, files: MAX_PORTFOLIO_VIDEOS },
  fileFilter: (req, file, cb) => {
    const mime = String(file?.mimetype || '').toLowerCase();
    if (!mime.startsWith('video/')) {
      return cb(new Error('Only video uploads are allowed'));
    }
    return cb(null, true);
  },
});

const uploadPortfolioVideoToS3 = (req, res, next) => {
  upload.any()(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: 'Invalid video upload', error: err.message || String(err) });
    }

    const files = Array.isArray(req.files)
      ? req.files.filter((f) => f && (f.fieldname === 'videos' || f.fieldname === 'video'))
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
        message: 'Unable to upload portfolio video',
        error: uploadErr.message || String(uploadErr),
      });
    }
  });
};

module.exports = { uploadPortfolioVideoToS3 };

