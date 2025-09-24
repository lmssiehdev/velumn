import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChatsCircleIcon, HashIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { getTopicsInServer } from "@repo/db/helpers/servers";
import { DBServer } from "@repo/db/schema/index";
import { ChannelType } from "discord-api-types/v10";
import Link from "next/link";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="px-2 m-10 max-w-screen-lg mx-auto">{children}</div>;
}

export async function FrontPageSidebar({
  server,
  activeChannelId,
}: {
  server: DBServer;
  activeChannelId?: string;
}) {
  return (
    <div className="max-w-xs w-full space-y-6 ">
      <ServerInfo server={server} />
      <Boards serverId={server.id} activeChannelId={activeChannelId} />
    </div>
  );
}

export function ServerInfo({ server }: { server?: DBServer }) {
  if (!server) return undefined;
  return (
    <div className="border border-neutral-300 p-4">
      <div className="text-lg">{server.name}</div>
      <div className="text-sm text-neutral-700">
        {server.memberCount} members
      </div>
      <p className="my-3">{server.description}</p>
      <Button className="cursor-pointer pointer hover:bg-purple-200 text-purple-600 bg-purple-100 transition-all">
        Join Server
      </Button>
    </div>
  )
}

async function Boards({
  serverId,
  activeChannelId,
}: {
  serverId: string;
  activeChannelId?: string;
}) {
  const topics = await getTopicsInServer(serverId);
  if (topics.length <= 1) return;

  return (
    <div className="border border-neutral-300 p-4">
      <div className="pl-2 mb-2 flex gap-2 items-center justify-between">
        <div className="">Boards</div>
        {
          activeChannelId && (<Link href={`/server/${serverId}`} className="text-xs cursor-pointer px-1 hover:bg-purple-200 hover:text-purple-500 transition-all">
            {/* <XIcon className="size-3" weight="bold" /> */}
            show all
          </Link>)
        }
      </div>
      {topics.map((topic) => {
        return (
          <Link
            key={topic.id}
            href={`/channel/${topic.id}`}
            className={cn(
              "flex gap-2 p-2 hover:text-purple-600 hover:bg-purple-100 transition-all duration-200 cursor-pointer items-center",
              {
                "text-purple-600 bg-purple-100": activeChannelId === topic.id,
              },
            )}
          >
            <div>
              {topic.type === ChannelType.GuildForum ? (
                <ChatsCircleIcon className="size-4" />
              ) : (
                <HashIcon className="size-4" weight="bold" />
              )}
            </div>
            <div>{topic.channelName}</div>
          </Link>
        );
      })}
    </div>
  );
}
