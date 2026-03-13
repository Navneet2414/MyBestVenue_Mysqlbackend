'use strict';

const path = require('path');
const crypto = require('crypto');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, s3Bucket, s3Configured, s3MissingEnv, buildPublicUrl } = require('../config/s3');

const makeKey = ({ prefix, originalName }) => {
  const safePrefix = String(prefix || '').replace(/^\/+|\/+$/g, '');
  const ext = path.extname(String(originalName || '')).slice(0, 16);
  const id = crypto.randomUUID();
  return `${safePrefix}/${Date.now()}-${id}${ext || ''}`.replace(/^\/+/, '');
};

const uploadBuffer = async ({ buffer, contentType, key }) => {
  if (!s3Configured || !s3Client) {
    const missingList = Array.isArray(s3MissingEnv) && s3MissingEnv.length ? s3MissingEnv.join(', ') : null;
    const err = new Error(
      `S3 is not configured. Missing env: ${missingList || 'AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET'}.`
    );
    err.code = 'S3_NOT_CONFIGURED';
    throw err;
  }

  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('uploadBuffer: buffer must be a Buffer');
  }

  const finalKey = String(key || '').trim();
  if (!finalKey) throw new Error('uploadBuffer: key is required');

  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: finalKey,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
    })
  );

  return {
    bucket: s3Bucket,
    key: finalKey,
    url: buildPublicUrl(finalKey),
  };
};

module.exports = {
  makeKey,
  uploadBuffer,
};
