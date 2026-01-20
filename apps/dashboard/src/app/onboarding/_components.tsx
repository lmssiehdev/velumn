import { getServerIcon } from "@repo/utils/helpers/discord";
import { emojiToTwemoji } from "@repo/utils/helpers/twemoji";
import { PermissionFlagsBits } from "discord-api-types/v8";
import type { RawDiscordGuild } from "./_fetchUserGuilds";

export function StageHeader({
	title,
	emoji,
	subtitle,
}: {
	title: string;
	emoji: string;
	subtitle: string;
}) {
	return (
		<div className="my-10 flex flex-col items-center justify-center">
			<div className="my-10 flex flex-col items-center justify-center">
				<div className="flex items-center justify-center whitespace-pre-line font-semibold text-3xl text-gray-800 leading-normal tracking-tight">
					{title}{" "}
					<img
						alt="emoji"
						className="ml-2 inline-block size-6"
						src={emojiToTwemoji(emoji)}
					/>
				</div>
				<div className="text-neutral-600">{subtitle}</div>
			</div>
		</div>
	);
}

export function GuildListItem({
	guild,
	children,
}: {
	guild: RawDiscordGuild;
	children: React.ReactNode;
}) {
	const { alreadyAdded } = guild;

	const initials = guild.name
		.split(" ")
		.map((word) => word[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();

	return (
		<div
			className={`flex items-center justify-between gap-2 rounded p-4 transition-all ${
				alreadyAdded ? "opacity-75" : "hover:bg-accent"
			}`}
		>
			<div className="flex items-center gap-4">
				<div className="flex aspect-square size-12 min-w-12 items-center justify-center overflow-hidden rounded-full bg-gray-100">
					{guild.icon ? (
						<img alt={`${guild.name} icon`} src={getServerIcon(guild)} />
					) : (
						<div className="flex items-center font-bold">{initials}</div>
					)}
				</div>
				<div>
					<div>{guild.name}</div>
					<span className="text-sm text-neutral-600">{getRoleText(guild)}</span>
				</div>
			</div>
			{children}
		</div>
	);
}
function getRoleText(guild: RawDiscordGuild) {
	if (guild.owner) return "Owner";
	if (
		(BigInt(guild.permissions) & PermissionFlagsBits.Administrator) ===
		PermissionFlagsBits.Administrator
	) {
		return "Admin";
	}
	return "Manager";
}
