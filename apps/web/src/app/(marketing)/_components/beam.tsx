"use client";

import {
	ArrowsClockwiseIcon,
	ChatCircleIcon,
	ChatIcon,
	ChatsTeardropIcon,
	HeartIcon,
	OpenAiLogoIcon,
	XLogoIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useRef, useState } from "react";
import { ThreadIcon } from "@/components/markdown/mention";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function AnimatedBeamDemo() {
	const containerRef = useRef<HTMLDivElement>(null);
	const discordUIRef = useRef<HTMLDivElement>(null);
	const velumnRef = useRef<HTMLDivElement>(null);
	const FinalResultRef = useRef<HTMLDivElement>(null);

	const data = {
		discord: {
			title: "Your Discord Community",
			description: "Active discussions, zero discoverability",
		},
		velumn: {
			title: "Automatically Synced & Indexed",
			description:
				"Discord threads become searchable, SEO friendly forum, no extra work",
		},
		final: {
			title: "Discoverable Everywhere",
			description:
				"Your community shows up in Google, AI tools, and wherever people search",
		},
	};

	const Description = ({ cat }: { cat: keyof typeof data }) => {
		const { title, description } = data[cat];
		return (
			<div>
				<div className="w-full max-w-[350px]">
					<h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
					<p className="text-neutral-800 mb-3">{description}</p>
				</div>
			</div>
		);
	};

	return (
		<div
			className="relative overflow-hidden p-10 w-full max-w-5xl mx-auto"
			ref={containerRef}
		>
			<div className="size-full items-stretch justify-between">
				<div className="grid grid-cols-1 items-center gap-50 lg:gap-20">
					<div className="z-10 w-full max-w-[350px]">
						<Description cat="discord" />
						<div ref={discordUIRef} className="border-2 bg-white shadow-xs">
							<DiscordView />
						</div>
					</div>

					<div className="z-10 w-full max-w-[350px] ml-auto">
						<Description cat="velumn" />
						<div ref={velumnRef} className="border-2 bg-white shadow-xs">
							<VelumnView />
						</div>
					</div>

					<div className="z-10 w-full max-w-[350px]">
						<Description cat="final" />
						<div
							ref={FinalResultRef}
							className="border-2 bg-white shadow-xs rounded-lg"
						>
							<RenderView />
						</div>
					</div>
				</div>
			</div>

			<AnimatedBeam
				duration={3}
				containerRef={containerRef}
				fromRef={discordUIRef}
				toRef={velumnRef}
			/>
			<AnimatedBeam
				duration={3}
				delay={3 * 3}
				reverse={true}
				curvature={-300}
				containerRef={containerRef}
				fromRef={velumnRef}
				toRef={FinalResultRef}
			/>
		</div>
	);
}

function DiscordView() {
	return (
		<div className="p-3 flex h-full flex-col">
			<div className="mb-3 border-b pb-2">
				<ThreadIcon className="size-4 mr-2 inline-block" />
				<span className="text-sm font-semibold text-gray-700">thread-name</span>
			</div>
			<div className="flex-1 space-y-3 overflow-hidden">
				<div className="flex gap-2">
					<div className="h-8 w-8 shrink-0 rounded-full bg-blue-400"></div>
					<div>
						<div className="mb-1 flex items-baseline gap-2">
							<span className="text-sm font-semibold text-gray-900">
								Username
							</span>
							<span className="text-xs text-gray-500">12:34 PM</span>
						</div>
						<p className="text-sm text-gray-800">Hey, check this out!</p>
					</div>
				</div>
				<div className="flex gap-2">
					<div className="h-8 w-8 shrink-0 rounded-full bg-green-400"></div>
					<div>
						<div className="mb-1 flex items-baseline gap-2">
							<span className="text-sm font-semibold text-gray-900">
								AnotherUser
							</span>
							<span className="text-xs text-gray-500">12:35 PM</span>
						</div>
						<p className="text-sm text-gray-800">
							This works with every platform?
						</p>
					</div>
				</div>
				<div className="flex gap-2">
					<div className="h-8 w-8 shrink-0 rounded-full bg-green-400"></div>
					<div>
						<div className="mb-1 flex items-baseline gap-2">
							<span className="text-sm font-semibold text-gray-900">
								AnotherUser
							</span>
							<span className="text-xs text-gray-500">12:35 PM</span>
						</div>
						<div className="text-sm text-gray-800 space-y-1">
							<div className="h-3 w-full rounded bg-gray-200"></div>
							<div className="h-3 w-4/6 rounded bg-gray-200"></div>
						</div>
					</div>
				</div>
			</div>
			<div className="mt-3 rounded bg-gray-100 px-3 py-2">
				<input
					type="text"
					disabled
					placeholder="Message #thread-name"
					className="w-full bg-transparent text-sm text-gray-400 outline-none"
				/>
			</div>
		</div>
	);
}

function VelumnView() {
	return (
		<>
			<div className="mb-3 flex items-center justify-center gap-2 border-b p-2 bg-gray-100">
				<div className="flex items-center gap-2">
					<div className="size-2.5 rounded-full bg-red-500"></div>
					<div className="size-2.5 rounded-full bg-yellow-500"></div>
					<div className="size-2.5 rounded-full bg-green-500"></div>
				</div>
				<div className="bg-gray-200 px-2 py-0.5 flex items-center w-full">
					<span className=" flex-1 text-sm">velumn.com/c/your_community</span>
				</div>
			</div>
			<div className="flex h-full flex-col p-3 pt-0">
				<div className="mb-3 flex items-center gap-1.5 border-b pb-2">
					<ChatsTeardropIcon className="size-4" />
					<span className="text-sm font-semibold text-gray-700">Velumn</span>
				</div>

				<div className="flex-1 space-y-3 overflow-hidden">
					<div className="flex gap-2">
						<div className="size-6 shrink-0 rounded-full bg-gray-300"></div>
						<div>
							<div className="mb-1 flex items-baseline gap-2">
								<span className="text-sm font-semibold text-gray-900">
									Username
								</span>
								<span className="text-xs text-gray-500">12:34 PM</span>
							</div>
							<p className="text-sm text-gray-800">Hey, check this out!</p>
						</div>
					</div>

					<div>
						<ChatIcon className="mr-1 size-3 inline-block" weight="duotone" />
						<span className="text-xs">38 Replies</span>
					</div>
					<Separator />

					<div className="flex gap-2">
						<div className="h-8 w-8 shrink-0 rounded-full bg-gray-300"></div>
						<div>
							<div className="mb-1 flex items-baseline gap-2">
								<span className="text-sm font-semibold text-gray-900">
									AnotherUser
								</span>
								<span className="text-xs text-gray-500">12:35 PM</span>
							</div>
							<p className="text-sm text-gray-800">
								This works with every platform?
							</p>
						</div>
					</div>

					<div className="flex gap-2">
						<div className="h-8 w-8 shrink-0 rounded-full bg-gray-300"></div>
						<div className="flex-1">
							<div className="mb-1 flex ">
								<div className="h-2.5 w-1/6 rounded bg-gray-200"></div>
							</div>
							<div className="text-sm text-gray-800 space-y-1">
								<div className="h-2.5 w-full rounded bg-gray-200"></div>
								<div className="h-2.5 w-4/6 rounded bg-gray-200"></div>
							</div>
						</div>
					</div>

					<div className="flex gap-2">
						<div className="h-8 w-8 shrink-0 rounded-full bg-gray-300"></div>
						<div className="flex-1">
							<div className="mb-1 flex ">
								<div className="h-2.5 w-1/6 rounded bg-gray-200"></div>
							</div>
							<div className="text-sm text-gray-800 space-y-1">
								<div className="h-2.5 w-full rounded bg-gray-200"></div>
								<div className="h-2.5 w-4/6 rounded bg-gray-200"></div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}

function RenderView() {
	const [tab, setTab] = useState<"search" | "chat" | "social">("search");

	const View = {
		search: <SearchView />,
		chat: <ChatView />,
		social: <SocialView />,
	} as const;

	return (
		<>
			<div className="flex border-b bg-gray-50">
				{Object.keys(View).map((key) => (
					<button
						key={key}
						onClick={() => setTab(key as keyof typeof View)}
						className={cn("flex-1 px-4 py-2.5 text-sm font-medium capitalize", {
							"text-purple-600 border-b-2 border-purple-600 bg-white":
								tab === key,
							"text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors":
								tab !== key,
						})}
					>
						{key}
					</button>
				))}
			</div>
			<div className="p-3 h-full">{View[tab]}</div>
		</>
	);
}

function ChatView() {
	return (
		<div className="flex h-full flex-col">
			<div className="mb-3 border-b pb-2">
				<OpenAiLogoIcon className="size-4 inline-block mr-1.5" />
				<span className="text-sm font-semibold text-gray-700">ChatGPT</span>
			</div>

			<div className="flex-1 space-y-4 overflow-y-auto px-1">
				<div className="flex justify-end">
					<div className="max-w-md rounded-2xl bg-gray-600 px-4 py-2 text-white">
						<p className="text-sm">This works with every platform?</p>
					</div>
				</div>

				<div className="flex justify-start">
					<div className="max-w-md space-y-3">
						<div className="rounded-2xl bg-gray-100 px-4 py-3 text-sm">
							<p>
								Yes, it works across most major platforms including Discord,
								Slack, Twitter/X, Reddit, and more. The integration is designed
								to be seamless regardless of where the conversation is
								happening.
							</p>
						</div>
					</div>
				</div>

				<div className="mt-3 text-xs w-fit flex items-center gap-2">
					<div>Sources:</div>
					<div className="px-1 py-0.5 gap-0.5 flex items-center bg-gray-100 rounded-[4px]">
						<div className="bg-white p-0.5 rounded-full flex items-center justify-center">
							<ChatsTeardropIcon className="size-3 inline-block " />
						</div>
						<div className="leading-normal">
							This works with every platform?
						</div>
					</div>
				</div>

				<div className="mt-3 rounded bg-gray-100 px-3 py-2">
					<input
						type="text"
						disabled
						placeholder="Ask anything..."
						className="w-full bg-transparent text-sm text-gray-700 outline-none"
					/>
				</div>
			</div>
		</div>
	);
}

function SearchView() {
	return (
		<div className="flex h-full flex-col">
			<div className="mb-4 flex items-center gap-3 border-b pb-3">
				<span className="text-xl font-bold ">G</span>
				<input
					type="text"
					disabled
					value="thread-name discord"
					className="flex-1 rounded-full border px-4 py-1.5 text-sm text-gray-700 outline-none"
				/>
			</div>

			<div className="flex-1 space-y-4 overflow-hidden">
				<div className="space-y-1">
					<div className="flex items-baseline gap-2">
						<span className="text-xs ">discord.com › thread</span>
					</div>
					<h3 className="text-lg font-normal text-blue-800 hover:underline cursor-pointer">
						This works with every platform? - Discord Thread
					</h3>
					<p className="text-sm text-gray-600">
						Hey, check this out! This works with every platform? Discussion in
						thread-name about seamless integration...
					</p>
				</div>

				<div className="space-y-1">
					<div className="h-3 w-32 rounded bg-gray-200"></div>
					<div className="h-4 w-3/4 rounded bg-gray-300"></div>
					<div className="h-3 w-full rounded bg-gray-200"></div>
				</div>

				<div className="space-y-1">
					<div className="h-3 w-36 rounded bg-gray-200"></div>
					<div className="h-4 w-2/3 rounded bg-gray-300"></div>
					<div className="h-3 w-5/6 rounded bg-gray-200"></div>
				</div>
			</div>
		</div>
	);
}

function SocialView() {
	return (
		<div className="flex h-full flex-col">
			<div className="mb-3 border-b pb-2">
				<XLogoIcon className="size-4 inline-block mr-1.5" />
			</div>

			<div className="flex-1 space-y-3 overflow-hidden">
				<div>
					<div className="flex gap-3">
						<div className="h-8 w-8 shrink-0 rounded-full bg-gray-200"></div>
						<div className="flex-1 space-y-1">
							<div className="mb-1 flex items-baseline gap-2">
								<span className="text-sm font-semibold text-gray-900">
									Username
								</span>
								<span className="text-xs text-gray-500">12:34 PM</span>
							</div>
							<p className="text-sm">
								Hey, check this out! This works with every platform? Discussion
								in thread-name about seamless integration...
							</p>
							<div className="flex justify-between items-center">
								<ChatCircleIcon className="size-4" weight="duotone" />
								<ArrowsClockwiseIcon className="size-4" weight="duotone" />
								<HeartIcon className="size-4" weight="duotone" />
							</div>
						</div>
					</div>
					<div className="ml-[52px] m-2">
						<Separator className="my-3" />
						<div className=" flex gap-3">
							<div className="h-8 w-8 shrink-0 rounded-full bg-gray-200"></div>
							<div className="flex-1">
								<div className="mb-1 flex items-baseline gap-2">
									<span className="text-sm font-semibold text-gray-900">
										ReplyUser
									</span>
									<span className="text-xs text-gray-500">12:36 PM</span>
								</div>
								<p className="text-sm text-gray-700">
									Yes! It integrates seamlessly across all platforms.
								</p>
							</div>
						</div>
						<Separator className="my-3" />
						<div className=" flex gap-3 mb-3">
							<div className="h-8 w-8 shrink-0 rounded-full bg-gray-200"></div>
							<div className="flex-1">
								<div className="mb-1 flex items-baseline gap-2">
									<div className="h-3 w-2/6 rounded bg-gray-200"></div>
								</div>
								<div className="space-y-1">
									<div className="h-3 w-5/6 rounded bg-gray-200"></div>
									<div className="h-3 w-3/6 rounded bg-gray-200"></div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
