/**
 * Matches Discord role mentions.
 * @example <@&123456789012345678>
 *
 * The regex captures a 17-20 digit role ID inside <@&...> brackets.
 */
export const RoleMentionRegex = /^<@&(\d{17,20})>/;

/**
 * Matches Discord user mentions.
 *
 * @example <@123456789012345678> or <@!123456789012345678>
 *
 * The regex captures a 17-20 digit user ID, optionally preceded by "!".
 */
export const UserMentionRegex = /^<@!?(\d{17,20})>/;

/**
 * Matches the @everyone mention.
 */
export const EveryoneRegex = /^@everyone/;

/**
 * Matches the @here mention.
 */
export const HereRegex = /^@here/;

/**
 * This regex can capture the Guild, Channel, and Message ID based on a shareable Discord message link.
 *
 * The regex captures:
 * - guildId: the ID of the guild the message was sent in.
 * - channelId: the ID of the channel in that guild the message was sent in.
 * - messageId: the ID of the message itself.
 */
export const MessageLinkRegex =
  /(?:https:\/\/(?:ptb\.|canary\.)?|(?:^|\s)(?:ptb\.|canary\.)?)discord(?:app)?\.com\/channels\/(?<guildId>(?:\d{17,20}|@me))\/(?<channelId>\d{17,20})(?:\/(?<messageId>\d{17,20}))?/g;
