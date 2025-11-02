
import ThreadsTable from "@/components/threads-table";
import { Button } from "@/components/ui/button";
import { getCurrentUserOrRedirect } from "@/server/user";
import { ArrowUpRightIcon, DiscordLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { getAllThreads } from "@repo/db/helpers/servers";
import { emojiToTwemoji } from "@repo/utils/helpers/twemoji";
import Link from "next/link";

export default async function Page() {
  const { user } = await getCurrentUserOrRedirect();
  if (!user.serverId) {
    return <div>No server linked.</div>
  }
  const latestThreads = await getAllThreads('server', {
    id: user.serverId,
    pinned: false,
    page: 1,
  });

  if (latestThreads.threads?.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-6">
        <div className="text-center space-y-3 max-w-lg">
          <h2 className="text-2xl font-semibold">Getting your threads ready <img src={emojiToTwemoji("⏳")} alt="emoji" className="inline-block w-6 h-6" /></h2>
          <p className="text-muted-foreground text-lg">
            We're indexing your Discord channels. This usually takes a few minutes for your first time.
          </p>
        </div>

        <div className="w-full max-w-lg space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            While you wait, here's what happens next:
          </p>
          <div className="grid gap-3 text-sm">
            <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-4">
              <span className="text-2xl">✓</span>
              <span className="text-left">Your threads will appear here automatically</span>
            </div>
            <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-4">
              <span className="text-2xl">✓</span>
              <span className="text-left">No action needed - just grab a coffee ☕</span>
            </div>
          </div>
        </div>

        <div className="border-t pt-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Been waiting a while?
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" asChild size="sm">
              <Link href="/channels">
                <ArrowUpRightIcon />
                Check Channel Settings
              </Link>
            </Button>
            <Button variant="ghost" asChild size="sm">
              <a href="https://discord.gg/YOUR_INVITE_CODE" target="_blank" rel="noopener noreferrer">
                <DiscordLogoIcon /> Get Help on Discord
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>
    <ThreadsTable data={latestThreads.threads} />
  </>
}
