import { ChannelType } from "discord-api-types/v10";

export const PUBLIC_PARENT_CHANNEL_TYPES = [
	ChannelType.GuildText,
	ChannelType.GuildForum,
	ChannelType.GuildAnnouncement,
] as const;

export const PUBLIC_THREAD_CHANNEL_TYPES = [
	ChannelType.PublicThread,
	ChannelType.AnnouncementThread,
] as const;

export type PublicThreadVisibilityFacts = {
	serverActive: boolean;
	threadType: number;
	parentBelongsToServer: boolean;
	parentIsUncategorized: boolean;
	parentCategoryBelongsToServer: boolean;
	parentCategoryType: number | null;
	parentType: number;
	parentIndexingEnabled: boolean;
	hasVisibleStarter: boolean;
};

export function isPublicThreadVisible(
	facts: PublicThreadVisibilityFacts,
): boolean {
	return (
		facts.serverActive &&
		PUBLIC_THREAD_CHANNEL_TYPES.includes(
			facts.threadType as (typeof PUBLIC_THREAD_CHANNEL_TYPES)[number],
		) &&
		facts.parentBelongsToServer &&
		(facts.parentIsUncategorized ||
			(facts.parentCategoryBelongsToServer &&
				facts.parentCategoryType === ChannelType.GuildCategory)) &&
		PUBLIC_PARENT_CHANNEL_TYPES.includes(
			facts.parentType as (typeof PUBLIC_PARENT_CHANNEL_TYPES)[number],
		) &&
		facts.parentIndexingEnabled &&
		facts.hasVisibleStarter
	);
}

export const PUBLIC_THREAD_VISIBILITY_MATRIX = [
	{
		state: "published",
		visible: true,
		detail:
			"Active server, public thread, enabled eligible parent, and visible starter",
	},
	{
		state: "disconnected_server",
		visible: false,
		detail: "The bot is no longer active in the server",
	},
	{
		state: "unsupported_thread_type",
		visible: false,
		detail: "The channel is not a public Discord thread",
	},
	{
		state: "invalid_parent",
		visible: false,
		detail:
			"The parent is missing, categorized outside its server, nested under a non-category, or unsupported",
	},
	{
		state: "disabled_parent",
		visible: false,
		detail: "Disabling indexing also unpublishes existing threads",
	},
	{
		state: "missing_starter",
		visible: false,
		detail: "The starter is missing or belongs to a user who opted out",
	},
] as const;
