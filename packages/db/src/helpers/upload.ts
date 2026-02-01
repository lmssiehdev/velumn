import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { MAX_FILE_SIZE_BYTES } from "@repo/utils/helpers/misc";

const MAX_RETRIES = 2;
const RETRY_DELAYS = [2000, 4000];

interface FileInput {
	id: string;
	name: string;
	contentType?: string;
	url: string;
}

interface UploadResult {
	success: true;
}

const r2Client = new S3Client({
	region: "auto",
	endpoint: process.env.R2_ENDPOINT,
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY || "",
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
	},
});

async function downloadFile(
	url: string,
): Promise<{ buffer: Buffer; contentType: string }> {
	const headResponse = await fetch(url, { method: "HEAD" });

	if (!headResponse.ok) {
		throw new Error(`HEAD request failed: ${headResponse.status}`);
	}

	const contentLength = headResponse.headers.get("content-length");
	if (contentLength) {
		const size = parseInt(contentLength, 10);
		if (size > MAX_FILE_SIZE_BYTES) {
			throw new Error(
				`FILE_TOO_LARGE: ${size} bytes exceeds ${MAX_FILE_SIZE_BYTES} bytes`,
			);
		}
	}

	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Download failed: ${response.status}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);

	if (buffer.length > MAX_FILE_SIZE_BYTES) {
		throw new Error(
			`FILE_TOO_LARGE: ${buffer.length} bytes exceeds ${MAX_FILE_SIZE_BYTES} bytes`,
		);
	}

	const contentType =
		response.headers.get("content-type") || "application/octet-stream";

	return { buffer, contentType };
}

export async function uploadFileFromUrl(
	file: FileInput,
): Promise<UploadResult | null> {
	if (!process.env.R2_ENDPOINT) return null;
	if (!file.id?.trim() || !file.name?.trim() || !file.url?.trim()) {
		console.error("upload_failed", { error: "Invalid input", file });
		return null;
	}

	try {
		new URL(file.url);
	} catch {
		console.error("upload_failed", { error: "Invalid URL", url: file.url });
		return null;
	}

	const startTime = Date.now();

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			const { buffer, contentType: detectedContentType } = await downloadFile(
				file.url,
			);

			const key = `${file.id}/${file.name}`;
			const contentType = file.contentType || detectedContentType;

			const command = new PutObjectCommand({
				Bucket: process.env.R2_BUCKET_NAME,
				Key: key,
				Body: buffer,
				ContentType: contentType,
				ContentDisposition: "inline",
			});

			await r2Client.send(command);

			const durationMs = Date.now() - startTime;

			console.info("upload_success", {
				fileId: file.id,
				fileName: file.name,
				key,
				sizeBytes: buffer.length,
				durationMs,
				attempts: attempt + 1,
			});

			return {
				success: true,
			};
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			const isFileTooLarge = errorMsg.includes("FILE_TOO_LARGE");
			const isLastAttempt = attempt === MAX_RETRIES - 1;

			const shouldRetry = !isFileTooLarge && !isLastAttempt;

			if (shouldRetry) {
				console.warn("upload_retry", {
					fileId: file.id,
					attempt: attempt + 1,
					error: errorMsg,
				});
				await new Promise((resolve) =>
					setTimeout(resolve, RETRY_DELAYS[attempt]),
				);
			} else {
				console.error("upload_failed", {
					fileId: file.id,
					fileName: file.name,
					attempts: attempt + 1,
					error: errorMsg,
				});
				return null;
			}
		}
	}

	return null;
}
