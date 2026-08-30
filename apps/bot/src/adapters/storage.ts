import {
	DeleteObjectsCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { MAX_FILE_SIZE_BYTES } from "@repo/utils/helpers/misc";
import {
	Context,
	Effect,
	Layer,
	Option,
	Redacted,
	Schema,
	type Scope,
} from "effect";
import { BotConfig } from "../config/bot-config";

const allowedAttachmentHosts = new Set([
	"cdn.discordapp.com",
	"media.discordapp.net",
]);
const R2_DELETE_OBJECTS_MAX_KEYS = 1_000;

export interface UploadFromUrlInput {
	readonly id: string;
	readonly name: string;
	readonly contentType?: string;
	readonly url: string;
}

export interface PutObjectInput {
	readonly key: string;
	readonly body: Uint8Array | string;
	readonly contentType: string;
	readonly contentDisposition?: string;
}

export interface StoredObject {
	readonly key: string;
	readonly publicUrl: string;
	readonly contentType: string;
	readonly sizeBytes: number;
}

export class StorageNotConfiguredError extends Schema.TaggedError<StorageNotConfiguredError>()(
	"StorageNotConfiguredError",
	{},
) {}

export class StorageValidationError extends Schema.TaggedError<StorageValidationError>()(
	"StorageValidationError",
	{
		field: Schema.Literals(["id", "name", "key", "url"]),
		message: Schema.String,
	},
) {}

export class StorageFileTooLargeError extends Schema.TaggedError<StorageFileTooLargeError>()(
	"StorageFileTooLargeError",
	{
		sizeBytes: Schema.Number,
		maximumBytes: Schema.Number,
	},
) {}

export class StorageDownloadError extends Schema.TaggedError<StorageDownloadError>()(
	"StorageDownloadError",
	{
		status: Schema.NullOr(Schema.Number),
		cause: Schema.Defect(),
	},
) {}

export class StorageRequestError extends Schema.TaggedError<StorageRequestError>()(
	"StorageRequestError",
	{
		operation: Schema.Literals(["putObject", "deleteObjects"]),
		cause: Schema.Defect(),
	},
) {}

export type AttachmentStorageError =
	| StorageNotConfiguredError
	| StorageValidationError
	| StorageFileTooLargeError
	| StorageDownloadError
	| StorageRequestError;

const validateKey = (key: string) =>
	key.trim().length === 0
		? Effect.fail(
				new StorageValidationError({
					field: "key",
					message: "Storage key must not be empty",
				}),
			)
		: Effect.succeed(key);

const parseAttachmentUrl = (input: string) =>
	Schema.decodeUnknownEffect(Schema.URLFromString)(input).pipe(
		Effect.mapError(
			() =>
				new StorageValidationError({
					field: "url",
					message: "Attachment URL is invalid",
				}),
		),
		Effect.filterOrFail(
			(url) =>
				url.protocol === "https:" && allowedAttachmentHosts.has(url.hostname),
			() =>
				new StorageValidationError({
					field: "url",
					message: "Attachment URL must use an approved Discord CDN host",
				}),
		),
	);

export const makeAttachmentStorage = (): Effect.Effect<
	AttachmentStorage["Service"],
	never,
	BotConfig | Scope.Scope
> =>
	Effect.gen(function* () {
		const config = yield* BotConfig;
		if (Option.isNone(config.r2)) {
			const unavailable = Effect.fail(new StorageNotConfiguredError());
			return AttachmentStorage.of({
				uploadFromUrl: () => unavailable,
				putObject: () => unavailable,
				deleteObjects: () => unavailable,
			});
		}

		const r2 = config.r2.value;
		const client = yield* Effect.acquireRelease(
			Effect.sync(
				() =>
					new S3Client({
						region: "auto",
						endpoint: r2.endpoint,
						credentials: {
							accessKeyId: Redacted.value(r2.accessKeyId),
							secretAccessKey: Redacted.value(r2.secretAccessKey),
						},
					}),
			),
			(client) => Effect.sync(() => client.destroy()),
		);
		const publicBaseUrl = r2.publicBaseUrl.endsWith("/")
			? r2.publicBaseUrl
			: `${r2.publicBaseUrl}/`;

		const putObject = Effect.fn("AttachmentStorage.putObject")(function* (
			input: PutObjectInput,
		) {
			const key = yield* validateKey(input.key);
			yield* Effect.tryPromise({
				try: (signal) =>
					client.send(
						new PutObjectCommand({
							Bucket: r2.bucketName,
							Key: key,
							Body: input.body,
							ContentType: input.contentType,
							ContentDisposition: input.contentDisposition,
						}),
						{ abortSignal: signal },
					),
				catch: (cause) =>
					new StorageRequestError({ operation: "putObject", cause }),
			});
		});

		const uploadFromUrl = Effect.fn("AttachmentStorage.uploadFromUrl")(
			function* (input: UploadFromUrlInput) {
				if (input.id.trim().length === 0) {
					return yield* new StorageValidationError({
						field: "id",
						message: "Attachment ID must not be empty",
					});
				}
				if (input.name.trim().length === 0) {
					return yield* new StorageValidationError({
						field: "name",
						message: "Attachment name must not be empty",
					});
				}
				const url = yield* parseAttachmentUrl(input.url);
				const response = yield* Effect.tryPromise({
					try: (signal) => fetch(url, { signal }),
					catch: (cause) => new StorageDownloadError({ status: null, cause }),
				});
				if (!response.ok) {
					return yield* new StorageDownloadError({
						status: response.status,
						cause: `Discord CDN returned ${response.status}`,
					});
				}

				const declaredSize = Number(response.headers.get("content-length"));
				if (
					Number.isFinite(declaredSize) &&
					declaredSize > MAX_FILE_SIZE_BYTES
				) {
					return yield* new StorageFileTooLargeError({
						sizeBytes: declaredSize,
						maximumBytes: MAX_FILE_SIZE_BYTES,
					});
				}
				const body = new Uint8Array(
					yield* Effect.tryPromise({
						try: () => response.arrayBuffer(),
						catch: (cause) =>
							new StorageDownloadError({ status: response.status, cause }),
					}),
				);
				if (body.byteLength > MAX_FILE_SIZE_BYTES) {
					return yield* new StorageFileTooLargeError({
						sizeBytes: body.byteLength,
						maximumBytes: MAX_FILE_SIZE_BYTES,
					});
				}

				const key = `${input.id}/${input.name}`;
				const contentType =
					input.contentType ??
					response.headers.get("content-type") ??
					"application/octet-stream";
				yield* putObject({
					key,
					body,
					contentType,
					contentDisposition: "inline",
				});
				return {
					key,
					publicUrl: new URL(
						`${encodeURIComponent(input.id)}/${encodeURIComponent(input.name)}`,
						publicBaseUrl,
					).toString(),
					contentType,
					sizeBytes: body.byteLength,
				};
			},
		);

		const deleteObjects = Effect.fn("AttachmentStorage.deleteObjects")(
			function* (keys: readonly string[]) {
				const validKeys = yield* Effect.forEach(keys, validateKey);
				if (validKeys.length === 0) return;
				for (
					let offset = 0;
					offset < validKeys.length;
					offset += R2_DELETE_OBJECTS_MAX_KEYS
				) {
					const chunk = validKeys.slice(
						offset,
						offset + R2_DELETE_OBJECTS_MAX_KEYS,
					);
					yield* Effect.tryPromise({
						try: (signal) =>
							client.send(
								new DeleteObjectsCommand({
									Bucket: r2.bucketName,
									Delete: {
										Objects: chunk.map((Key) => ({ Key })),
										Quiet: true,
									},
								}),
								{ abortSignal: signal },
							),
						catch: (cause) =>
							new StorageRequestError({
								operation: "deleteObjects",
								cause,
							}),
					});
				}
			},
		);

		return AttachmentStorage.of({ uploadFromUrl, putObject, deleteObjects });
	});

export class AttachmentStorage extends Context.Service<
	AttachmentStorage,
	{
		readonly uploadFromUrl: (
			input: UploadFromUrlInput,
		) => Effect.Effect<StoredObject, AttachmentStorageError>;
		readonly putObject: (
			input: PutObjectInput,
		) => Effect.Effect<void, AttachmentStorageError>;
		readonly deleteObjects: (
			keys: readonly string[],
		) => Effect.Effect<void, AttachmentStorageError>;
	}
>()("velumn/bot/adapters/AttachmentStorage") {
	static readonly layerWithConfig = Layer.effect(
		AttachmentStorage,
		makeAttachmentStorage(),
	);
}
