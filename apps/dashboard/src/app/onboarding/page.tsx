import { CheckIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { getGuildsCache } from "@/cache";
import { Button, buttonVariants } from "@/components/ui/button";
import { getCurrentUserOrRedirect } from "@/server/user";
import { GuildListItem, StageHeader } from "./_components";
export default async function Page() {
	const { user } = await getCurrentUserOrRedirect();
	const guilds = await getGuildsCache(user.id);

	if (typeof guilds === "object" && "error" in guilds) {
		return <div>Error: {guilds.error}</div>;
	}

	return (
		<div>
			<StageHeader
				title="Welcome to Velumn!"
				emoji="👋"
				subtitle="Pick a server to get started"
			/>
			<div className="max-w-md w-full mx-auto mb-20">
				{guilds.map((guild) => (
					<GuildListItem guild={guild} key={guild.id}>
						{guild.alreadyAdded ? (
							<Button variant="default" className=" rounded-none" disabled>
								<CheckIcon className="size-4" />
								Already Added
							</Button>
						) : (
							<Link
								className={buttonVariants({
									variant: "outline",
									className: "cursor-pointer rounded-none",
								})}
								href={`/onboarding/invite-bot/${guild.id}`}
							>
								Setup
							</Link>
						)}
					</GuildListItem>
				))}
			</div>
		</div>
	);
}
