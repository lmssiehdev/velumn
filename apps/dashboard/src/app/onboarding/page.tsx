"use client";
import {
	CaretDownIcon,
	ChatsCircleIcon,
	CheckIcon,
	CircleNotchIcon,
	HashIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { DBChannel } from "@repo/db/schema/discord";
import { getServerIcon } from "@repo/utils/helpers/discord";
import { emojiToTwemoji } from "@repo/utils/helpers/twemoji";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PermissionFlagsBits } from "discord-api-types/v8";
import { ChannelType } from "discord-api-types/v10";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers";
import { useTRPC } from "@/lib/trpc";
import { Button, buttonVariants } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { Input } from "../../components/ui/input";
import type { Guild } from "./_fetchUserGuilds";

type SortChannel = DBChannel & { enabled: boolean };
type Step = "INVITING_SERVER" | "WAITING_FOR_BOT_TO_JOIN" | "SELECT_CHANNELS";
type OnboardingContextType = {
	step: Step;
	selectedGuildId: string | null;
	channels: SortChannel[];
	guilds: Guild[];

	selectGuild: (guildId: string) => void;
	setChannels: (channels: SortChannel[]) => void;
	toggleChannel: (channelId: string, enabled: boolean) => void;
	handleInviteCreation: (guildId: string) => void;
	trpc: ReturnType<typeof useTRPC>;
	inviteUrl: string | null;
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

export function OnboardingProvider({
	guilds,
	initialChannels,
	initialGuildId,
}: {
	guilds: Guild[];
	initialChannels: SortChannel[];
	initialGuildId: string | null;
}) {
	const trpc = useTRPC();
	const { user } = useAuth();
	const [inviteUrl, setInviteUrl] = useState<string | null>(null);
	const [step, setStep] = useState<Step>(
		user.serverId ? "SELECT_CHANNELS" : "INVITING_SERVER",
	);
	const [selectedGuildId, setSelectedGuildId] = useState(() => initialGuildId);
	const [channels, setChannels] = useState<SortChannel[]>(initialChannels);

	const inviteUrlMutation = useMutation(
		trpc.server.createServerInvite.mutationOptions({
			onError(error) {
				toast.error(error.message);
			},
			onSuccess({ inviteUrl }) {
				setInviteUrl(inviteUrl);
			},
		}),
	);

	const selectGuild = (guildId: string) => {
		setSelectedGuildId(guildId);
		setStep("WAITING_FOR_BOT_TO_JOIN");
	};

	const setChannelsAndAdvance = (newChannels: SortChannel[]) => {
		setChannels(newChannels);
		setStep("SELECT_CHANNELS");
	};

	const toggleChannel = (channelId: string, enabled: boolean) => {
		setChannels((prev) =>
			prev.map((c) => (c.id === channelId ? { ...c, enabled } : c)),
		);
	};

	// uh memo me
	const value: OnboardingContextType = {
		step,
		selectedGuildId,
		channels,
		guilds,
		selectGuild,
		setChannels: setChannelsAndAdvance,
		toggleChannel,
		trpc,
		handleInviteCreation: async (serverId: string) =>
			await inviteUrlMutation.mutateAsync({ serverId }),
		inviteUrl,
	};

	return (
		<OnboardingContext.Provider value={value}>
			<RenderStep />
		</OnboardingContext.Provider>
	);
}

export default function RenderStep() {
	const { step } = useOnboardingContext();
	switch (step) {
		case "INVITING_SERVER":
			return <PickAServer />;
		case "WAITING_FOR_BOT_TO_JOIN":
			return <WaitingForBotToJoin />;
		case "SELECT_CHANNELS":
			return <SelectChannels />;
	}
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
						Welcome to Velumn!{" "}
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
					<GuildListItem guild={guild} key={guild.id} />
				))}
			</div>
		</>
	);
}

function WaitingForBotToJoin() {
	const {
		selectedGuildId,
		guilds,
		setChannels,
		handleInviteCreation,
		inviteUrl,
	} = useOnboardingContext();
	const [now, setNow] = useState(Date.now());

	const [timeoutReached, setTimeoutReached] = useState(false);
	const guildId = selectedGuildId!;
	const guild = guilds.find((g) => g.id === guildId);

	const trpc = useTRPC();
	const userQuery = useQuery(
		trpc.server.getChannelsInServer.queryOptions(
			{
				serverId: guildId,
			},
			{
				enabled: inviteUrl != null,
				refetchIntervalInBackground: true,
				refetchInterval: 10_000,
			},
		),
	);

	useEffect(() => {
		const timeout = setTimeout(() => setTimeoutReached(true), 300_000);
		return () => clearTimeout(timeout);
	}, []);

	useEffect(() => {
		const interval = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		if (userQuery.isSuccess) {
			if (!userQuery.data.channels.length) {
				return;
			}
			setChannels(userQuery.data.channels);
			return;
		}
	}, [userQuery.isSuccess, userQuery.data, setChannels]);

	if (!(guildId && guild)) {
		return <div>Ooops, this shouldn't have happened try again.</div>;
	}

	if (timeoutReached) {
		return (
			<div className="my-10 flex flex-col items-center justify-center">
				<div className="my-10 flex flex-col items-center justify-center">
					<div className="flex flex-col items-center justify-center p-8 text-center">
						<div className="mb-2 font-semibold text-xl text-yellow-600">
							This is taking longer than usual
						</div>
						<div className="mb-4">
							The bot may need additional permissions, or Discord's servers
							might be experiencing delays.
						</div>
						<div className="space-y-2">
							<Button onClick={() => handleInviteCreation(guildId)}>
								Re-invite Bot
							</Button>
							<a
								className="block text-neutral-600 text-sm underline hover:text-neutral-700"
								href="/discord"
								rel="noopener noreferrer"
								target="_blank"
							>
								Need assistance? Join our discord server.
							</a>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<>
			<div className="my-10 flex flex-col items-center justify-center">
				<div className="my-10 flex flex-col items-center justify-center">
					<div className="flex items-center justify-center whitespace-pre-line font-semibold text-3xl text-gray-800 leading-normal tracking-tight">
						Almost there!{" "}
						<img
							alt="wave"
							className="ml-2 inline-block size-6"
							src={emojiToTwemoji("🎯")}
						/>
					</div>
					<div className="text-neutral-600">
						Add the bot to your server to continue
					</div>
				</div>
			</div>

			<div className="mx-auto w-full max-w-md space-y-8">
				<GuildListItem guild={guild} key={guild.id} />
				<div className="space-y-2 text-center">
					<div className="text-neutral-600">
						{inviteUrl
							? `Waiting for the bot to join your server... You'll be redirected automatically once it does.`
							: "Generating invitation link..."}
					</div>
					{userQuery?.dataUpdatedAt > 0 && (
						<div className="flex items-center justify-center gap-1 text-gray-500 text-sm">
							<span className={userQuery.isFetching ? "animate-pulse" : ""}>
								{userQuery.isFetching ? "Checking..." : "Last checked"}
							</span>
							{!userQuery.isFetching && (
								<span className="font-medium">
									{Math.max(
										Math.floor((now - userQuery.dataUpdatedAt) / 1000),
										1,
									)}{" "}
									seconds ago
								</span>
							)}
						</div>
					)}
				</div>
			</div>
		</>
	);
}

function GuildListItem({ guild }: { guild: Guild }) {
	const { step, selectGuild, handleInviteCreation, inviteUrl } =
		useOnboardingContext();
	const isWaitingForBotToJoin = step === "WAITING_FOR_BOT_TO_JOIN";
	const isSelectingChannels = step === "SELECT_CHANNELS";

	function onSelectGuild(selectedGuildId: string) {
		if (isWaitingForBotToJoin) {
			return;
		}
		// open the invite link in a new tab

		handleInviteCreation(selectedGuildId);
		selectGuild(selectedGuildId);
	}
	const initials = guild.name
		.split(" ")
		.map((x) => x[0])
		.join("");
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
			{isWaitingForBotToJoin &&
				(inviteUrl ? (
					<a
						className={buttonVariants({
							variant: "outline",
							className: "cursor-pointer rounded",
						})}
						href={inviteUrl}
						target="_blank"
					>
						Invite Bot
					</a>
				) : (
					<Button
						className="cursor-pointer rounded"
						disabled
						variant={"outline"}
					>
						<CircleNotchIcon className="size-4 animate-spin" />
						Generating invite
					</Button>
				))}
			{!isWaitingForBotToJoin &&
				(isSelectingChannels ? (
					<Button variant={"default"}>
						<CheckIcon className="size-4" />
						Joined
					</Button>
				) : (
					<Button
						className="cursor-pointer rounded"
						disabled={isWaitingForBotToJoin}
						onClick={() => onSelectGuild(guild.id)}
						variant={"outline"}
					>
						Setup
					</Button>
				))}
		</div>
	);
}

const _UI_TEST_GUILD = {
	id: "1418801587048157216",
	name: "Test",
	icon: null,
	owner: false,
	permissions: 10_000,
};
function SelectChannels() {
	const { guilds, channels, selectedGuildId, trpc, toggleChannel } =
		useOnboardingContext();
	const router = useRouter();

	const finishOnBoardingMutation = useMutation(
		trpc.server.finishOnboarding.mutationOptions({
			onError(error) {
				toast.error(error.message);
			},
			onSuccess() {
				toast.success("Indexing started!");
				router.push("/");
			},
		}),
	);

	const guild = guilds.find((g) => g.id === selectedGuildId);

	if (!guild) {
		return <div>Guild not found?</div>;
	}
	return (
		<>
			<div className="my-10 flex flex-col items-center justify-center">
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
			</div>

			<div className="mx-auto w-full max-w-md space-y-8">
				<GuildListItem guild={guild} key={guild.id} />
				<div className="my-1 space-y-8">
					<ChannelsSelector channels={channels} toggleChannel={toggleChannel} />
					<div className="flex items-center justify-between">
						<div>
							<div>
								{channels.filter((c) => c.enabled).length} channels ready to
								index
							</div>
							<div className="text-neutral-500 text-xs">
								(you can change this later)
							</div>
						</div>
						<Button
							disabled={finishOnBoardingMutation.isPending}
							className="flex items-center gap-2"
							onClick={() =>
								finishOnBoardingMutation.mutateAsync({
									payload: channels.map((c) => ({
										channelId: c.id,
										status: c.enabled,
									})),
								})
							}
						>
							Start Indexing
						</Button>
					</div>
				</div>
			</div>
		</>
	);
}

export function ChannelsSelector({
	channels,
	toggleChannel,
}: {
	channels: SortChannel[];
	toggleChannel: (channelId: string, enabled: boolean) => void;
}) {
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
				if (!isTypeEnabled) {
					return false;
				}
				if (!searchFilter) {
					return true;
				}
				return c.channelName
					?.toLowerCase()
					.includes(searchFilter.toLowerCase());
			})
			.sort((a, b) => b.type - a.type);
		return {
			channelsToDisplay,
			selectedChannels: channels.filter((c) => c.enabled).map((c) => c.id),
		};
	}, [searchFilter, channelFilterOptions, channels]);
	return (
		<>
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
				{channelsToDisplay.map((channel) => (
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
							{channel.channelName}
						</div>
					</div>
				))}
			</div>
		</>
	);
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
