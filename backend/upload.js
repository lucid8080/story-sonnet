import dotenv from 'dotenv';
import multiparty from 'multiparty';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { verifyBearerToken } from './lib/clerk-verify.js';
import { getProfileByUserId } from './lib/profile.js';
import { getSql } from './lib/db.js';

dotenv.config();

const r2Configured = () =>
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET &&
  process.env.R2_PUBLIC_BASE_URL;

function getS3Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

function publicUrlForKey(key) {
  const base = process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, '');
  return `${base}/${key}`;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!r2Configured()) {
    console.error('[Upload] R2 env not fully configured');
    return res.status(500).json({ error: 'Upload storage is not configured' });
  }

  const auth = await verifyBearerToken(req.headers.authorization);
  if (!auth?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const profile = await getProfileByUserId(auth.userId);
  if (profile?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const form = new multiparty.Form();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[Upload] Error parsing form', err);
      return res.status(400).json({ error: 'Invalid upload form data' });
    }

    const bucket = fields.bucket?.[0];
    const file = files.file?.[0];

    if (!bucket || !file) {
      return res.status(400).json({ error: 'Missing bucket or file' });
    }

    const safePrefix = bucket === 'covers' || bucket === 'audio' ? bucket : 'misc';

    try {
      const path = `${safePrefix}/${Date.now()}-${file.originalFilename}`;
      const fileBuffer = await fsReadFile(file.path);
      const contentType =
        file.headers['content-type'] || 'application/octet-stream';

      const client = getS3Client();
      await client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: path,
          Body: fileBuffer,
          ContentType: contentType,
        })
      );

      const publicUrl = publicUrlForKey(path);

      const sql = getSql();
      await sql`
        insert into public.uploads (file_name, file_type, file_url, storage_path, uploaded_by)
        values (
          ${file.originalFilename},
          ${contentType},
          ${publicUrl},
          ${path},
          ${auth.userId}
        )
      `;

      return res.status(200).json({
        fileUrl: publicUrl,
        storagePath: path,
      });
    } catch (e) {
      console.error('[Upload] Unexpected error', e);
      return res.status(500).json({ error: 'Upload failed' });
    }
  });
}

function fsReadFile(path) {
  return new Promise((resolve, reject) => {
    import('fs').then((fs) => {
      fs.readFile(path, (readErr, data) => {
        if (readErr) reject(readErr);
        else resolve(data);
      });
    });
  });
}
