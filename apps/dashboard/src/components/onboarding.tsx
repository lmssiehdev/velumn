import { webEnv } from '@repo/utils/env/web';
import { PermissionFlagsBits } from 'discord-api-types/v8';
import Link from 'next/link';
import type { Guild } from '@/app/onboarding/page';
import { Button } from './ui/button';

function getRoleText(guild: Guild) {
  if (guild.owner) {
    return 'Owner';
  }
  if (
    (BigInt(guild.permissions) & PermissionFlagsBits.Administrator) ===
    PermissionFlagsBits.Administrator
  ) {
    return 'Admin';
  }

  return 'Manager';
}

function getPermissionRank(guild: Guild) {
  if (guild.owner) {
    return 0;
  }

  if (
    (BigInt(guild.permissions) & PermissionFlagsBits.Administrator) ===
    PermissionFlagsBits.Administrator
  ) {
    return 1;
  }

  return 2;
}

export function OnboardingWrapper({ guilds }: { guilds: Guild[] }) {
  guilds.sort((a, b) => {
    return getPermissionRank(a) - getPermissionRank(b);
  });
  return (
    <div>
      <div className="my-10 flex flex-col items-center justify-center">
        <div className="flex items-center justify-center whitespace-pre-line font-semibold text-3xl text-gray-800 leading-normal tracking-tight">
          Welcome to discord!{' '}
          <img
            alt="wave"
            className="ml-2 inline-block size-6"
            src={emojiToTwemoji('👋')}
          />
        </div>
        <div className="text-neutral-600">Pick a server to get started</div>
      </div>
      <div className="mx-auto max-w-md space-y-2">
        {guilds.map((guild) => {
          const initials = guild.name
            .split(' ')
            .map((x) => x[0])
            .join('');
          return (
            <div
              className="flex items-center justify-between rounded p-4 transition-all hover:bg-accent"
              key={guild.id}
            >
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                  {guild.icon ? (
                    <img alt="guild icon" src={getServerIcon(guild)} />
                  ) : (
                    <div className="flex items-center font-bold">
                      {initials.toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <div>{guild.name}</div>
                  <span className="text-neutral-600 text-sm">
                    {getRoleText(guild)}
                  </span>
                </div>
              </div>
              <Button
                asChild
                className="cursor-pointer rounded"
                variant={'outline'}
              >
                <Link href={generateBotInviteLink(guild.id)}>Setup</Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getServerIcon(guild: { icon: string; id: string }) {
  const format = guild.icon.startsWith('a_') ? 'gif' : 'png';

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
    let r = [],
      c = 0,
      p = 0,
      i = 0;
    while (i < unicodeSurrogates.length) {
      c = unicodeSurrogates.charCodeAt(i++);
      if (p) {
        r.push(
          (0x1_00_00 + ((p - 0xd8_00) << 10) + (c - 0xdc_00)).toString(16)
        );
        p = 0;
      } else if (0xd8_00 <= c && c <= 0xdb_ff) {
        p = c;
      } else {
        r.push(c.toString(16));
      }
    }
    return r.join('-');
  }

  const filename = toCodePoint(emoji);

  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@${version}/assets/svg/${filename}.svg`;
}
