import { Readable } from 'node:stream';
import type { ReadableStream } from 'node:stream/web';
import { S3 } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { logger } from '@repo/logger';

const s3bucket = new S3({
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  endpoint: process.env.R2_ENDPOINT!,
  region: "auto",
  forcePathStyle: true,
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
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: `${file.id}/${file.name}`,
        Body: stream,
        ContentDisposition: 'inline',
        ContentType: file.contentType,
      },
    }).done();
  } catch (error) {
    const { id, name, contentType, url } = file;;
    logger.error("failed_to_upload_file", { error, id, name, contentType, url });
    return null;
  }
}
