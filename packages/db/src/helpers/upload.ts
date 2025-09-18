import { Readable } from 'node:stream';
import type { ReadableStream } from 'node:stream/web';
import { S3 } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const s3bucket = new S3({
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  region: 'us-east-1',
});

export async function uploadFileFromUrl(file: {
  id: string;
  name: string;
  contentType?: string;
  url: string;
}) {
  try {
    const res = await fetch(file.url);
    if (!res.ok || !res.body) {
      return null;
    }
    const stream = Readable.fromWeb(
      res.body as unknown as ReadableStream<Uint8Array>
    );
    return new Upload({
      client: s3bucket,
      params: {
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: `${file.id}/${file.name}`,
        Body: stream,
        ContentDisposition: 'inline',
        ContentType: file.contentType,
      },
    }).done();
  } catch (error) {
    console.error('Failed to upload file:', error);
    return null;
  }
}
