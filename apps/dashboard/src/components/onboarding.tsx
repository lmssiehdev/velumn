import { Guild } from "@/app/onboarding/page"
import { PermissionFlagsBits } from "discord-api-types/v8";
import { Button } from "./ui/button";
import { webEnv } from "@repo/utils/env/web";
import Link from "next/link";

function getRoleText(guild: Guild) {
    if (guild.owner) {
        return "Owner";
    }
    if ((BigInt(guild.permissions) & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator) {
        return "Admin";
    }

    return "Manager";
}

function getPermissionRank(guild: Guild) {
    if (guild.owner) {
        return 0;
    }

    if ((BigInt(guild.permissions) & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator) {
        return 1;
    }

    return 2;
}


export function OnboardingWrapper({ guilds }: { guilds: Guild[] }) {
    guilds.sort((a, b) => {
        return getPermissionRank(a) - getPermissionRank(b);
    });
    return <div>
        <div className="my-10 flex flex-col items-center justify-center">
            <div className="whitespace-pre-line text-3xl font-semibold leading-normal tracking-tight text-gray-800 flex items-center justify-center">Welcome to discord! <img src={emojiToTwemoji("👋")} className="inline-block size-6 ml-2" alt="wave" /></div>
            <div className="text-neutral-600">Pick a server to get started</div>
        </div>
        <div className="space-y-2 max-w-md mx-auto">
            {guilds.map((guild) => {
                const initials = guild.name.split(" ").map((x) => x[0]).join("");
                return (
                    <div key={guild.id} className="flex rounded justify-between transition-all items-center hover:bg-accent p-4">
                        <div className="flex gap-4 items-center">
                            <div className="rounded-full overflow-hidden size-12 bg-gray-100 flex items-center justify-center">
                                {guild.icon ? (
                                    <img src={getServerIcon(guild)} alt="guild icon" />
                                ) : (
                                    <div className="font-bold flex items-center">{initials.toUpperCase()}</div>
                                )}
                            </div>
                            <div>
                                <div>{guild.name}</div>
                                <span className="text-sm text-neutral-600">{getRoleText(guild)}</span>
                            </div>
                        </div>
                        <Button asChild className="cursor-pointer rounded" variant={"outline"}>
                            <Link href={generateBotInviteLink(guild.id)} >
                                Setup
                            </Link>
                        </Button>
                    </div>
                );
            })}
        </div>
    </div>
}

function getServerIcon(guild: { icon: string; id: string }) {
    const format = guild.icon.startsWith("a_") ? "gif" : "png";

    return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${format}?size={64}`;
}

// const permissions = [
//     PermissionFlagsBits.CreateInstantInvite,
//     PermissionFlagsBits.AddReactions,
//     PermissionFlagsBits.ViewChannel,
//     PermissionFlagsBits.SendMessages,
//     PermissionFlagsBits.EmbedLinks,
//     PermissionFlagsBits.ReadMessageHistory,
//     PermissionFlagsBits.UseApplicationCommands,
//     PermissionFlagsBits.ManageThreads,
//     PermissionFlagsBits.CreatePublicThreads,
//     PermissionFlagsBits.SendMessagesInThreads
// ];
// // to avoid importing PermissionsBitField 
// const permission = permissions.reduce((acc, perm) => acc | perm, BigInt(0)).toString();
function generateBotInviteLink(guildId: string) {
    return `https://discord.com/oauth2/authorize?client_id=${webEnv.DISCORD_CLIENT_ID}&permissions=328565083201&scope=bot+applications.commands&guild_id=${guildId}&disable_guild_select=true`;
}

// TODO: share this

/**
 * Converts Unicode emoji to Twemoji SVG URL
 * 
 * @see https://github.com/twitter/twemoji/blob/d94f4cf793e6d5ca592aa00f58a88f6a4229ad43/scripts/build.js#L571C7-L589C8
 */
function emojiToTwemoji(emoji: string, version = '14.0.2') {
    function toCodePoint(unicodeSurrogates: string) {
        var
            r = [],
            c = 0,
            p = 0,
            i = 0;
        while (i < unicodeSurrogates.length) {
            c = unicodeSurrogates.charCodeAt(i++);
            if (p) {
                r.push((0x10000 + ((p - 0xD800) << 10) + (c - 0xDC00)).toString(16));
                p = 0;
            } else if (0xD800 <= c && c <= 0xDBFF) {
                p = c;
            } else {
                r.push(c.toString(16));
            }
        }
        return r.join('-');
    }

    const filename = toCodePoint(emoji)

    return `https://cdn.jsdelivr.net/gh/twitter/twemoji@${version}/assets/svg/${filename}.svg`;
}