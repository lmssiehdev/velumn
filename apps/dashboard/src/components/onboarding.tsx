"use client";
import {
  CaretDownIcon,
  ChatsCircleIcon,
  CheckIcon,
  CircleNotchIcon,
  HashIcon,
} from "@phosphor-icons/react/dist/ssr";
import { webEnv } from "@repo/utils/env/web";
import { useQuery } from "@tanstack/react-query";
import { PermissionFlagsBits } from "discord-api-types/v8";
import { ChannelType } from "discord-api-types/v10";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Guild } from "@/app/onboarding/page";
import { useTRPC } from "@/lib/trpc";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";

type Step = "INVITING_SERVER" | "WAITING_FOR_BOT_TO_JOIN" | "SELECT_CHANNELS";

type Channel = {
  id: string;
  name: string;
  type: ChannelType;
  enabled: boolean;
};
type OnboardingContextType = {
  step: Step;
  selectedGuildId: string;
  channels: Channel[];
  guilds: Guild[];

  selectGuild: (guildId: string) => void;
  setChannels: (channels: Channel[]) => void;
  toggleChannel: (channelId: string, enabled: boolean) => void;
};

const OnboardingContext = createContext<OnboardingContextType>(
  {} as OnboardingContextType,
);

export function useOnboardingContext() {
  const context = useContext(OnboardingContext);

  if (!context) {
    throw new Error(
      "useOnboardingContext must be used within a OnboardingProvider",
    );
  }

  return context;
}

export function OnboardingProvider({ guilds }: { guilds: Guild[] }) {
  const [step, setStep] = useState<Step>("INVITING_SERVER");
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);

  const selectGuild = (guildId: string) => {
    setSelectedGuildId(guildId);
    setStep("WAITING_FOR_BOT_TO_JOIN");
  };

  const setChannelsAndAdvance = (newChannels: Channel[]) => {
    setChannels(newChannels);
    setStep("SELECT_CHANNELS");
  };

  const toggleChannel = (channelId: string, enabled: boolean) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, enabled } : c)),
    );
  };

  // uh memo me
  const value = {
    step,
    selectedGuildId,
    channels,
    guilds,
    selectGuild,
    setChannels: setChannelsAndAdvance,
    toggleChannel,
  };

  return (
    <OnboardingContext.Provider value={value}>
      <RenderStep />
    </OnboardingContext.Provider>
  );
}

function RenderStep() {
  const { step } = useOnboardingContext();
  switch (step) {
    case "INVITING_SERVER":
      return <PickAServer />;
    case "WAITING_FOR_BOT_TO_JOIN":
      return <WaitingForBotToJoin />;
    case "SELECT_CHANNELS":
      return <SelectChannels />;
  }
  return;
}

function PickAServer() {
  const { guilds } = useOnboardingContext();

  if (guilds.length === 0) {
    // TODO: a better message here
    return <div>No servers found</div>;
  }

  return (
    <>
      <div className="my-10 flex flex-col items-center justify-center">
        <div className="my-10 flex flex-col items-center justify-center">
          <div className="flex items-center justify-center whitespace-pre-line font-semibold text-3xl text-gray-800 leading-normal tracking-tight">
            Welcome to discord!{" "}
            <img
              alt="wave"
              className="ml-2 inline-block size-6"
              src={emojiToTwemoji("👋")}
            />
          </div>
          <div className="text-neutral-600">Pick a server to get started</div>
        </div>
      </div>
      <div className="mx-auto max-w-md space-y-2">
        {guilds.map((guild) => (
          <GuildListItem key={guild.id} guild={guild} />
        ))}
      </div>
    </>
  );
}

function WaitingForBotToJoin() {
  const { selectedGuildId, guilds, setChannels } = useOnboardingContext();
  const [timeoutReached, setTimeoutReached] = useState(false);
  const guildId = selectedGuildId;
  const guild = guilds.find((g) => g.id === guildId);

  const trpc = useTRPC();
  const userQuery = useQuery(
    trpc.server.getChannelsInServer.queryOptions(
      {
        serverId: guildId,
      },
      {
        refetchIntervalInBackground: true,
        refetchInterval: 10_000,
      },
    ),
  );

  useEffect(() => {
    const timeout = setTimeout(() => setTimeoutReached(true), 120_000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (userQuery.isSuccess) {
      if (!userQuery.data.channels.length) return;
      setChannels(userQuery.data.channels);
    }
  }, [userQuery.isSuccess, userQuery.data]);

  if (!guildId || !guild) {
    return <div>Ooops, this shouldn't have happened try again.</div>;
  }

  if (timeoutReached) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="text-yellow-600 text-lg font-semibold mb-2">
          Taking longer than expected
        </div>
        <div className="text-gray-600 mb-4">
          The bot might not have the right permissions, or Discord might be
          slow.
        </div>
        <div className="space-y-2">
          <Button
            onClick={() =>
              window.open(generateBotInviteLink(guildId), "_blank")
            }
          >
            Re-invite Bot
          </Button>
          // TODO: add a join discord for support button here
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="my-10 flex flex-col items-center justify-center">
        <div className="flex items-center justify-center whitespace-pre-line font-semibold text-3xl text-gray-800 leading-normal tracking-tight">
          Your move!{" "}
          <img
            alt="wave"
            className="ml-2 inline-block size-6"
            src={emojiToTwemoji("🎯")}
          />
        </div>
        <div className="text-neutral-600">
          Add our bot and let's get rolling!
        </div>
      </div>
      <div className="mx-auto max-w-md w-full space-y-8 ">
        <GuildListItem key={guild.id} guild={guild} />
        <div className="space-y-2 text-center">
          <div className="text-neutral-600 ">
            Waiting for the bot to join your server... you'll get auto redirect
            once it does
          </div>
          <Button
            variant={"outline"}
            size={"sm"}
            onClick={() =>
              window.open(generateBotInviteLink(guildId), "_blank")
            }
          >
            Re-invite Bot
          </Button>
        </div>
      </div>
    </>
  );
}

function GuildListItem({ guild }: { guild: Guild }) {
  const { step, selectGuild } = useOnboardingContext();
  const isWaitingForBotToJoin = step === "WAITING_FOR_BOT_TO_JOIN";
  const isSelectingChannels = step === "SELECT_CHANNELS";
  function onSelectGuild(selectedGuildId: string) {
    if (isWaitingForBotToJoin) return;
    // open the invite link in a new tab
    window.open(generateBotInviteLink(selectedGuildId), "_blank");
    selectGuild(selectedGuildId);
  }
  const initials = guild.name
    .split(" ")
    .map((x) => x[0])
    .join("");
  return (
    <div className="flex items-center justify-between rounded p-4 transition-all hover:bg-accent gap-2">
      <div className="flex items-center gap-4">
        <div
          className="flex size-12 items-center justify-center overflow-hidden rounded-full bg-gray-100 aspect-square min-w-12
"
        >
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
          <span className="text-neutral-600 text-sm">{getRoleText(guild)}</span>
        </div>
      </div>
      {isSelectingChannels ? (
        <Button variant={"default"}>
          <CheckIcon className="size-4" />
          Joined
        </Button>
      ) : (
        <Button
          onClick={() => onSelectGuild(guild.id)}
          className="cursor-pointer rounded"
          variant={"outline"}
          disabled={isWaitingForBotToJoin}
        >
          {isWaitingForBotToJoin ? (
            <CircleNotchIcon className="size-4 animate-spin" />
          ) : (
            "Setup"
          )}
        </Button>
      )}
    </div>
  );
}

function SelectChannels() {
  const { guilds, channels, selectedGuildId, toggleChannel } =
    useOnboardingContext();

  const [searchFilter, setSearchFilter] = useState("");
  const [channelFilterOptions, setChannelFilterOptions] = useState([
    { type: ChannelType.GuildForum, name: "Forum", enabled: true },
    { type: ChannelType.GuildText, name: "Text Channel", enabled: true },
  ]);

  const { channelsToDisplay, selectedChannels } = useMemo(() => {
    const channelsToDisplay = channels
      .filter((c) => {
        const isTypeEnabled = channelFilterOptions.find(
          (f) => f.type === c.type,
        )?.enabled;
        if (!isTypeEnabled) return false;
        if (!searchFilter) return true;
        return c.name.toLowerCase().includes(searchFilter.toLowerCase());
      })
      .sort((a, b) => b.type - a.type);
    return {
      channelsToDisplay,
      selectedChannels: channels.filter((c) => c.enabled).map((c) => c.id),
    };
  }, [searchFilter, channelFilterOptions, channels]);

  const guild = guilds.find((g) => g.id === selectedGuildId) ?? {
    id: "490090",
    name: "Test",
    icon: null,
    owner: false,
    permissions: 10000,
  };

  if (!guild) return null;

  return (
    <>
      <div className="my-10 flex flex-col items-center justify-center">
        <div className="flex items-center justify-center whitespace-pre-line font-semibold text-3xl text-gray-800 leading-normal tracking-tight">
          Select channels to index!{" "}
          <img
            alt="wave"
            className="ml-2 inline-block size-6"
            src={emojiToTwemoji("✨")}
          />
        </div>
        <div className="text-neutral-600">We'll do the rest for you</div>
      </div>

      <div className="mx-auto max-w-md w-full space-y-8">
        <GuildListItem key={guild.id} guild={guild} />
        <div className="flex gap-2 items-center justify-between">
          <Input
            placeholder="Filter channels..."
            className="max-w-sm"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                Channels <CaretDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {channelFilterOptions.map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.name}
                    className="capitalize"
                    checked={column.enabled}
                    onCheckedChange={(value) => {
                      // TODO: unselect the selected channel of the type
                      setChannelFilterOptions((prevState) => {
                        const newState = [...prevState];
                        newState[
                          prevState.findIndex((c) => c.type === column.type)
                        ].enabled = value;
                        return newState;
                      });
                    }}
                  >
                    {column.name}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="">
          {channelsToDisplay.map((channel) => {
            return (
              <div
                key={channel.id}
                className="p-2 flex gap-4 items-center border-l border-r border-t last:border-b"
              >
                <Checkbox
                  checked={channel.enabled}
                  onCheckedChange={(value) =>
                    toggleChannel(channel.id, value as boolean)
                  }
                />
                <div className="flex gap-2 items-center">
                  {channel.type === ChannelType.GuildForum ? (
                    <ChatsCircleIcon className="size-4" />
                  ) : (
                    <HashIcon className="size-4" weight="bold" />
                  )}
                  {channel.name}
                </div>
              </div>
            );
          })}
        </div>
        <div className="my-1">
          <div>{selectedChannels.length} channels ready to index</div>
          <div className="text-xs text-neutral-500">
            (you can change this later)
          </div>
        </div>
      </div>
    </>
  );
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
  return `https://discord.com/oauth2/authorize?client_id=${webEnv.NEXT_PUBLIC_DISCORD_CLIENT_ID}&permissions=328565083201&scope=bot+applications.commands&guild_id=${guildId}&disable_guild_select=true`;
}

// TODO: share this

/**
 * Converts Unicode emoji to Twemoji SVG URL
 *
 * @see https://github.com/twitter/twemoji/blob/d94f4cf793e6d5ca592aa00f58a88f6a4229ad43/scripts/build.js#L571C7-L589C8
 */
function emojiToTwemoji(emoji: string, version = "14.0.2") {
  function toCodePoint(unicodeSurrogates: string) {
    let r = [],
      c = 0,
      p = 0,
      i = 0;
    while (i < unicodeSurrogates.length) {
      c = unicodeSurrogates.charCodeAt(i++);
      if (p) {
        r.push(
          (0x1_00_00 + ((p - 0xd8_00) << 10) + (c - 0xdc_00)).toString(16),
        );
        p = 0;
      } else if (0xd8_00 <= c && c <= 0xdb_ff) {
        p = c;
      } else {
        r.push(c.toString(16));
      }
    }
    return r.join("-");
  }

  const filename = toCodePoint(emoji);

  return `https://cdn.jsdelivr.net/npm/@twemoji/svg@15.0.0/${filename}.svg`;
}

function getRoleText(guild: Guild) {
  if (guild.owner) {
    return "Owner";
  }
  if (
    (BigInt(guild.permissions) & PermissionFlagsBits.Administrator) ===
    PermissionFlagsBits.Administrator
  ) {
    return "Admin";
  }

  return "Manager";
}
