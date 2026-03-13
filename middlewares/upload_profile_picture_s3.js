'use strict';

const multer = require('multer');
const { makeKey, uploadBuffer } = require('../services/s3_upload');

const MAX_FILE_SIZE_BYTES = Number(process.env.UPLOAD_MAX_FILE_SIZE_BYTES) || 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const mime = String(file?.mimetype || '').toLowerCase();
    if (!mime.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed (profilePicture)'));
    }
    return cb(null, true);
  },
});

const uploadVenueProfilePictureToS3 = (req, res, next) => {
  upload.single('profilePicture')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: 'Invalid profile picture upload', error: err.message || String(err) });
    }

    if (!req.file) return next();

    try {
      const key = makeKey({
        prefix: 'venues/profile-pictures',
        originalName: req.file.originalname,
      });

      const result = await uploadBuffer({
        buffer: req.file.buffer,
        contentType: req.file.mimetype,
        key,
      });

      req.imageUrl = result.url;
      req.s3Object = { bucket: result.bucket, key: result.key, url: result.url };
      return next();
    } catch (uploadErr) {
      return res.status(500).json({
        message: 'Unable to upload profile picture',
        error: uploadErr.message || String(uploadErr),
      });
    }
  });
};

module.exports = { uploadVenueProfilePictureToS3 };

