const { S3Client } = require('@aws-sdk/client-s3');

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const sessionToken = process.env.AWS_SESSION_TOKEN;

const bucket =
  process.env.AWS_S3_BUCKET ||
  process.env.AWS_S3_BUCKET_NAME ||
  process.env.S3_BUCKET ||
  process.env.S3_BUCKET_NAME;
const publicUrlBase = process.env.AWS_S3_PUBLIC_URL_BASE || null;

const missing = [];
if (!region) missing.push('AWS_REGION');
if (!accessKeyId) missing.push('AWS_ACCESS_KEY_ID');
if (!secretAccessKey) missing.push('AWS_SECRET_ACCESS_KEY');
if (!bucket) missing.push('AWS_S3_BUCKET');

const isConfigured = missing.length === 0;

const client = isConfigured
  ? new S3Client({
      region,
      credentials: sessionToken ? { accessKeyId, secretAccessKey, sessionToken } : { accessKeyId, secretAccessKey },
    })
  : null;

const buildPublicUrl = (key) => {
  if (!key) return null;
  if (publicUrlBase) return `${publicUrlBase.replace(/\/+$/, '')}/${String(key).replace(/^\/+/, '')}`;
  if (!bucket || !region) return null;
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
};

module.exports = {
  s3Client: client,
  s3Bucket: bucket,
  s3Region: region,
  s3Configured: isConfigured,
  s3MissingEnv: missing,
  buildPublicUrl,
};
