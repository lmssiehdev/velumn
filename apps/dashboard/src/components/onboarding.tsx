'use client';
import {
  CaretDownIcon,
  ChatsCircleIcon,
  CheckIcon,
  CircleNotchIcon,
  HashIcon,
} from '@phosphor-icons/react/dist/ssr';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PermissionFlagsBits } from 'discord-api-types/v8';
import { ChannelType } from 'discord-api-types/v10';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Guild } from '@/app/onboarding/page';
import { useAuth } from '@/app/providers';
import { useTRPC } from '@/lib/trpc';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Input } from './ui/input';

type Step = 'INVITING_SERVER' | 'WAITING_FOR_BOT_TO_JOIN' | 'SELECT_CHANNELS';

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
  handleInviteCreation: (guildId: string) => void;
};

const OnboardingContext = createContext<OnboardingContextType>(
  {} as OnboardingContextType
);

export function useOnboardingContext() {
  const context = useContext(OnboardingContext);

  if (!context) {
    throw new Error(
      'useOnboardingContext must be used within a OnboardingProvider'
    );
  }

  return context;
}

export function OnboardingProvider({ guilds }: { guilds: Guild[] }) {
  const [step, setStep] = useState<Step>('INVITING_SERVER');
  const [selectedGuildId, setSelectedGuildId] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);

  const { user } = useAuth();
  const trpc = useTRPC();
  const inviteUrlQuery = useMutation(
    trpc.server.createServerInvite.mutationOptions()
  );

  async function handleInviteCreation(guildId: string) {
    const { inviteUrl } = await inviteUrlQuery.mutateAsync({
      serverId: guildId,
      userId: user.id,
    });
    window.open(inviteUrl, '_blank');
    // TODO: handle errors here
  }

  const selectGuild = (guildId: string) => {
    setSelectedGuildId(guildId);
    setStep('WAITING_FOR_BOT_TO_JOIN');
  };

  const setChannelsAndAdvance = (newChannels: Channel[]) => {
    setChannels(newChannels);
    setStep('SELECT_CHANNELS');
  };

  const toggleChannel = (channelId: string, enabled: boolean) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, enabled } : c))
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
    handleInviteCreation,
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
    case 'INVITING_SERVER':
      return <PickAServer />;
    case 'WAITING_FOR_BOT_TO_JOIN':
      return <WaitingForBotToJoin />;
    case 'SELECT_CHANNELS':
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
            Welcome to discord!{' '}
            <img
              alt="wave"
              className="ml-2 inline-block size-6"
              src={emojiToTwemoji('👋')}
            />
          </div>
          <div className="text-neutral-600">Pick a server to get started</div>
        </div>
      </div>
      <div className="mx-auto max-w-md space-y-2">
        {guilds.map((guild) => (
          <GuildListItem guild={guild} key={guild.id} />
        ))}
      </div>
    </>
  );
}

function WaitingForBotToJoin() {
  const { selectedGuildId, handleInviteCreation, guilds, setChannels } =
    useOnboardingContext();
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
      }
    )
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
        <div className="mb-2 font-semibold text-lg text-yellow-600">
          Taking longer than expected
        </div>
        <div className="mb-4 text-gray-600">
          The bot might not have the right permissions, or Discord might be
          slow.
        </div>
        <div className="space-y-2">
          <Button onClick={() => handleInviteCreation(guildId)}>
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
        <div className="my-10 flex flex-col items-center justify-center">
          <div className="flex items-center justify-center whitespace-pre-line font-semibold text-3xl text-gray-800 leading-normal tracking-tight">
            Your move!{' '}
            <img
              alt="wave"
              className="ml-2 inline-block size-6"
              src={emojiToTwemoji('🎯')}
            />
          </div>
          <div className="text-neutral-600">
            Add our bot and let's get rolling!
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md space-y-8">
        <GuildListItem guild={guild} key={guild.id} />
        <div className="space-y-2 text-center">
          <div className="text-neutral-600">
            Waiting for the bot to join your server... you'll get auto redirect
            once it does
          </div>
          <Button
            onClick={() => handleInviteCreation(guildId)}
            size={'sm'}
            variant={'outline'}
          >
            Re-invite Bot
          </Button>
        </div>
      </div>
    </>
  );
}

function GuildListItem({ guild }: { guild: Guild }) {
  const { step, selectGuild, handleInviteCreation } = useOnboardingContext();
  const isWaitingForBotToJoin = step === 'WAITING_FOR_BOT_TO_JOIN';
  const isSelectingChannels = step === 'SELECT_CHANNELS';

  function onSelectGuild(selectedGuildId: string) {
    if (isWaitingForBotToJoin) return;
    // open the invite link in a new tab

    handleInviteCreation(selectedGuildId);
    selectGuild(selectedGuildId);
  }
  const initials = guild.name
    .split(' ')
    .map((x) => x[0])
    .join('');
  return (
    <div className="flex items-center justify-between gap-2 rounded p-4 transition-all hover:bg-accent">
      <div className="flex items-center gap-4">
        <div className="flex aspect-square size-12 min-w-12 items-center justify-center overflow-hidden rounded-full bg-gray-100">
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
        <Button variant={'default'}>
          <CheckIcon className="size-4" />
          Joined
        </Button>
      ) : (
        <Button
          className="cursor-pointer rounded"
          disabled={isWaitingForBotToJoin}
          onClick={() => onSelectGuild(guild.id)}
          variant={'outline'}
        >
          {isWaitingForBotToJoin ? (
            <CircleNotchIcon className="size-4 animate-spin" />
          ) : (
            'Setup'
          )}
        </Button>
      )}
    </div>
  );
}

function SelectChannels() {
  const { guilds, channels, selectedGuildId, toggleChannel } =
    useOnboardingContext();

  const [searchFilter, setSearchFilter] = useState('');
  const [channelFilterOptions, setChannelFilterOptions] = useState([
    { type: ChannelType.GuildForum, name: 'Forum', enabled: true },
    { type: ChannelType.GuildText, name: 'Text Channel', enabled: true },
  ]);

  const { channelsToDisplay, selectedChannels } = useMemo(() => {
    const channelsToDisplay = channels
      .filter((c) => {
        const isTypeEnabled = channelFilterOptions.find(
          (f) => f.type === c.type
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
    id: '490090',
    name: 'Test',
    icon: null,
    owner: false,
    permissions: 10_000,
  };

  if (!guild) return null;

  return (
    <>
      <div className="my-10 flex flex-col items-center justify-center">
        <div className="my-10 flex flex-col items-center justify-center">
          <div className="flex items-center justify-center whitespace-pre-line font-semibold text-3xl text-gray-800 leading-normal tracking-tight">
            Select channels to index!{' '}
            <img
              alt="wave"
              className="ml-2 inline-block size-6"
              src={emojiToTwemoji('✨')}
            />
          </div>
          <div className="text-neutral-600">We'll do the rest for you</div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md space-y-8">
        {/* @ts-expect-error TODO */}
        <GuildListItem guild={guild} key={guild.id} />
        <div className="flex items-center justify-between gap-2">
          <Input
            className="max-w-sm"
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter channels..."
            value={searchFilter}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="ml-auto" variant="outline">
                Channels <CaretDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {channelFilterOptions.map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    checked={column.enabled}
                    className="capitalize"
                    key={column.name}
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
                className="flex items-center gap-4 border-t border-r border-l p-2 last:border-b"
                key={channel.id}
              >
                <Checkbox
                  checked={channel.enabled}
                  onCheckedChange={(value) =>
                    toggleChannel(channel.id, value as boolean)
                  }
                />
                <div className="flex items-center gap-2">
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
          <div className="text-neutral-500 text-xs">
            (you can change this later)
          </div>
        </div>
      </div>
    </>
  );
}

function getServerIcon(guild: { icon: string; id: string }) {
  const format = guild.icon.startsWith('a_') ? 'gif' : 'png';

  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${format}?size={64}`;
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

  return `https://cdn.jsdelivr.net/npm/@twemoji/svg@15.0.0/${filename}.svg`;
}

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
