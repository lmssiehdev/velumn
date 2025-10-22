import { ChatsCircleIcon, HashIcon } from '@phosphor-icons/react/dist/ssr';
import { getTopicsInServer } from '@repo/db/helpers/servers';
import type { DBServer } from '@repo/db/schema/index';
import { ChannelType } from 'discord-api-types/v10';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen flex-col">
      <div className="border-neutral-300 border-b">
        <div className="mx-auto max-w-screen-lg border-neutral-300 border-x p-2 px-4">
          <Link className="text-black text-xl" href="/">
            Velumn
          </Link>
        </div>
      </div>
      <div className="mx-auto w-full max-w-screen-lg flex-1 py-2 pb-10">
        {children}
      </div>
      <div className="mt-auto border-neutral-300 border-x border-t">
        <div className="mx-auto max-w-screen-lg border-neutral-300 p-2 px-4">
          Powered by Velumn
        </div>
      </div>
    </div>
  );
}

export async function FrontPageSidebar({
  server,
  activeChannelId,
}: {
  server: DBServer;
  activeChannelId?: string;
}) {
  return (
    <div className="hidden w-full max-w-xs space-y-6 md:block">
      <ServerInfo server={server} />
      <Boards activeChannelId={activeChannelId} serverId={server.id} />
    </div>
  );
}

export function ServerInfo({ server }: { server?: DBServer }) {
  if (!server) {
    return;
  }
  return (
    <div className="border border-neutral-300 p-4">
      <div className="text-lg">{server.name}</div>
      <div className="text-neutral-700 text-sm">
        {server.memberCount} members
      </div>
      <p className="my-3">{server.description}</p>
      <a
        className={buttonVariants({
          className:
            'pointer cursor-pointer bg-purple-100 text-purple-600 transition-all hover:bg-purple-200',
        })}
        href={`https://discord.gg/${server.serverInvite!}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        Join Server
      </a>
    </div>
  );
}

async function Boards({
  serverId,
  activeChannelId,
}: {
  serverId: string;
  activeChannelId?: string;
}) {
  // display forum channels first
  const topics = (await getTopicsInServer(serverId)).sort((a, b) =>
    a.type > b.type ? -1 : 1
  );

  return (
    <div className="border border-neutral-300 p-4">
      <div className="mb-2 flex items-center justify-between gap-2 pl-2">
        <div className="">Boards</div>
        {activeChannelId && (
          <Link
            className="cursor-pointer px-1 text-xs transition-all hover:bg-purple-200 hover:text-purple-500"
            href={`/server/${serverId}`}
          >
            {/* <XIcon className="size-3" weight="bold" /> */}
            show all
          </Link>
        )}
      </div>
      {topics.map((topic) => {
        return (
          <Link
            className={cn(
              'flex cursor-pointer items-center gap-2 p-2 transition-all duration-200 hover:bg-purple-100 hover:text-purple-600',
              {
                'bg-purple-100 text-purple-600': activeChannelId === topic.id,
              }
            )}
            href={`/channel/${topic.id}`}
            key={topic.id}
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
