import { botLogger } from "@repo/logger";
import type {
	GuildTextBasedChannel,
	Message,
	PublicThreadChannel,
} from "discord.js";
import type { IndexableChannels } from "./helpers";

/**
 * @fileoverview Enhanced Axiom logging for indexing operations with canonical structured logs
 * Captures sufficient metadata for debugging and safe retry operations
 */

export interface IndexingErrorContext {
	messageId?: string;
	channelId: string;
	threadId?: string;
	guildId: string;

	processingStage: "fetch" | "parse" | "store" | "validate";
	batchSize?: number;

	messageType?: number;
	messageFlags?: string[];
	channelType?: number;
	isThread?: boolean;
	isPartial?: boolean;

	errorCategory:
		| "discord_api"
		| "parsing"
		| "validation"
		| "database"
		| "processing";
	retryable: boolean;

	lastSuccessfullyProcessedId?: string;
	failedAtSnowflake?: string;
	estimatedRemainingCount?: number;
}

export interface IndexingSuccessContext {
	messageId: string;
	channelId: string;
	threadId?: string;
	guildId: string;
	processingStage: "fetch" | "parse" | "store";
	batchPosition?: number;
	batchSize?: number;
	messageType: number;
	attachmentCount?: number;
	embedCount?: number;
	componentCount?: number;
	processingTimeMs?: number;
}

export function logIndexingError(
	error: Error | unknown,
	context: IndexingErrorContext,
	additionalData?: Record<string, unknown>,
) {
	const logData = {
		event: "indexing_error",
		timestamp: new Date().toISOString(),
		error: {
			name: error instanceof Error ? error.name : "Unknown",
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		},
		context,
		...additionalData,
	};

	botLogger.error(`Indexing error: ${context.errorCategory}`, logData);
}

export function logBatchOperation(
	operation: "started" | "completed" | "failed",
	context: {
		channelId: string;
		threadId?: string;
		guildId: string;
		totalMessages: number;
		processedMessages: number;
		failedMessages: number;
		processingStage: "fetch" | "parse" | "store";
		durationMs?: number;
		error?: Error;
	},
) {
	const logData = {
		event: `batch_operation_${operation}`,
		timestamp: new Date().toISOString(),
		...context,
	};

	if (operation === "failed") {
		botLogger.error(
			`Batch operation failed: ${context.processingStage}`,
			logData,
		);
	} else {
		botLogger.info(
			`Batch operation ${operation}: ${context.processingStage}`,
			logData,
		);
	}
}

export function logParsingError(
	error: unknown,
	parsingTarget:
		| "embed"
		| "attachment"
		| "metadata"
		| "component"
		| "poll"
		| "sticker"
		| "snapshot",
	context: {
		messageId: string | null;
		channelId: string | null;
		guildId: string | null;
		threadId?: string | null;
		rawData?: unknown;
		validationErrors?: string[];
	},
) {
	const logData = {
		event: "parsing_error",
		timestamp: new Date().toISOString(),
		parsingTarget,
		error: {
			name: error instanceof Error ? error.name : "Unknown",
			message: error instanceof Error ? error.message : String(error),
		},
		context,
	};

	botLogger.error(`Failed to parse ${parsingTarget}`, logData);
}

export function logChannelIndexingSummary(
	channel: IndexableChannels | GuildTextBasedChannel,
	summary: {
		totalThreads: number;
		indexedThreads: number;
		totalMessages: number;
		processedMessages: number;
		failedMessages: number;
		durationMs: number;
		errors: Array<{
			type: string;
			count: number;
			sampleMessageId?: string;
		}>;
	},
) {
	const logData = {
		event: "channel_indexing_summary",
		timestamp: new Date().toISOString(),
		channel: {
			id: channel.id,
			name: channel.name,
			type: channel.type,
			guildId: channel.guildId,
			guildName: channel.guild.name,
		},
		summary,
	};

	botLogger.info("Channel indexing completed", logData);
}

export function logMessageProcessingSkipped(
	reason:
		| "system_message"
		| "ignored_user"
		| "nsfw_content"
		| "permissions"
		| "duplicate",
	context: {
		messageId: string;
		channelId: string;
		guildId: string;
		threadId?: string;
		authorId?: string;
	},
) {
	const logData = {
		event: "message_processing_skipped",
		timestamp: new Date().toISOString(),
		reason,
		context,
	};

	botLogger.info(`Message skipped: ${reason}`, logData);
}

export function extractIndexingContext(
	message: Message,
	processingStage: IndexingErrorContext["processingStage"],
): Omit<IndexingErrorContext, "errorCategory" | "retryable"> {
	return {
		messageId: message.id,
		channelId: message.channelId,
		threadId: message.channel.isThread() ? message.channel.id : undefined,
		guildId: message.guildId!,
		processingStage,
		messageType: message.type,
		messageFlags: message.flags?.toArray(),
		channelType: message.channel.type,
		isThread: message.channel.isThread(),
		isPartial: message.partial,
	};
}

// Helper function to extract context from channel/thread
export function extractChannelContext(
	channel: IndexableChannels | GuildTextBasedChannel | PublicThreadChannel,
) {
	return {
		channelId: channel.id,
		threadId: channel.isThread() ? channel.id : undefined,
		guildId: channel.guildId,
		channelType: channel.type,
		isThread: channel.isThread(),
		channelName: channel.name,
		guildName: channel.guild.name,
	};
}
