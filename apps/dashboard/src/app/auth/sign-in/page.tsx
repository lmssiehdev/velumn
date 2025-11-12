"use client";

import {
	ArrowsClockwiseIcon,
	DiscordLogoIcon,
	LightningIcon,
	MagnifyingGlassIcon,
	UsersIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

// TODO: add a pretty description and tidy things up :)
export default function SignIn() {
	async function handleSingIn() {
		await authClient.signIn.social({
			provider: "discord",
			errorCallbackURL: "/error",
			/**
			 * A URL to redirect if the user is newly registered
			 */
			newUserCallbackURL: "/onboarding",
			callbackURL: "/",
		});
	}

	return (
		<div className="flex h-screen flex-col items-center justify-center">
			<div className="w-full max-w-md border bg-white p-10 shadow">
				<div className="mb-8 space-y-3">
					<div className="font-bold text-xl">Why Velumn?</div>
					<div className="flex items-center gap-3 text-gray-700">
						<LightningIcon
							className="size-5 text-purple-500"
							weight="duotone"
						/>
						<span>Live in minutes</span>
					</div>
					<div className="flex items-center gap-3 text-gray-700">
						<ArrowsClockwiseIcon
							className="size-5 text-purple-500"
							weight="duotone"
						/>
						<span>Threads auto-syncs</span>
					</div>
					<div className="flex items-center gap-3 text-gray-700">
						<MagnifyingGlassIcon
							className="size-5 text-purple-500"
							weight="duotone"
						/>
						<span>Actually ranks on Google</span>
					</div>
					<div className="flex items-center gap-3 text-gray-700">
						<UsersIcon className="size-5 text-purple-500" weight="duotone" />
						<span>Focus on your community</span>
					</div>
				</div>

				{/* Divider */}
				<div className="my-8 border-t" />

				{/* Login */}
				<Button
					className="w-full rounded-none bg-purple-600 font-semibold text-white transition-all hover:bg-purple-700"
					onClick={() => handleSingIn()}
				>
					<DiscordLogoIcon className="mr-2 size-5" />
					Continue with Discord
				</Button>
			</div>
		</div>
	);
}
