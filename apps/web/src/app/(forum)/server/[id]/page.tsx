import {
  CaretLeftIcon,
  CaretRightIcon,
  ChatIcon,
  PushPinIcon,
} from '@phosphor-icons/react/ssr';
import { getAllThreads } from '@repo/db/helpers/servers';
import { snowflakeToReadableDate } from '@repo/utils/helpers/time';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { slugifyThreadUrl } from '@/lib/slugify';
import { getServerInfoCached } from '@/utils/cache';
import { FrontPageSidebar } from '../../layout';
import { anonymizeName } from '../../thread/[...id]/page';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const server = await getServerInfoCached(id);

  if (!server) {
    return {
      title: 'Server Not Found',
      openGraph: {
        title: 'Server Not Found',
      },
    };
  }
  return {
    title: server.name,
    describe: server.description,
    openGraph: {
      title: server.name,
      description: server.description,
    },
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: { page: string };
}) {
  const { id } = await params;

  const searchParamsPage = Number(searchParams.page ?? 1);

  const server = await getServerInfoCached(id);

  if (!server) {
    return <div>Server doesn't exist</div>;
  }

  const { threads, hasMore, page } = await getAllThreads('server', {
    id,
    page: searchParamsPage,
  });

  return (
    <div className="mx-auto p-4">
      <h2 className="mb-6 max-w-4xl text-balance font-medium text-3xl tracking-tight lg:text-4xl">
        Join a Discussion
      </h2>
      <div className="flex gap-6">
        <ThreadList
          hasMore={hasMore}
          page={page}
          serverId={id}
          threads={threads}
        />
        <FrontPageSidebar server={server} />
      </div>
    </div>
  );
}

type ThreadsData = Awaited<ReturnType<typeof getAllThreads>>;
export async function ThreadList({
  threads,
  page,
  hasMore,
  serverId,
}: {
  serverId: string;
} & ThreadsData) {
  if (threads.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="flex flex-col gap-2 text-neutral-500">
          No threads found
          {page > 1 && (
            <Button asChild variant={'secondary'}>
              <Link
                className="flex items-center gap-2 text-neutral-500 underline-offset-2 hover:underline"
                href={`/server/${serverId}`}
              >
                Clear Filters
              </Link>
            </Button>
          )}
        </div>
      </div>
    );
  }


  const { pinnedThread, otherThreads } = threads.reduce(
    (acc, t) => {
      if (t.pinned) {
        acc.pinnedThread = t;
        return acc;
      }
      acc.otherThreads.push(t);
      return acc;
    },
    {
      pinnedThread: null as unknown as ThreadsData['threads'][number],
      otherThreads: [] as ThreadsData['threads'],
    }
  );

  return (
    <div className="flex-1">
      <div>
        {pinnedThread && (
          <ThreadItem data={pinnedThread} key={pinnedThread.id} />
        )}
        {otherThreads.map((thread) => {
          return <ThreadItem data={thread} key={thread.id} />;
        })}
      </div>
      <div className="mt-6 flex items-center justify-end gap-4">
        {page > 1 && (
          <Button asChild variant={'ghost'}>
            <Link
              className="flex items-center gap-2 text-neutral-700 text-sm"
              href={`/server/${serverId}?page=${page - 1}`}
            >
              <CaretLeftIcon />
              Prev
            </Link>
          </Button>
        )}
        {hasMore && (
          <Button asChild variant={'ghost'}>
            <Link
              className="flex items-center gap-2 text-neutral-700 text-sm"
              href={`/server/${serverId}?page=${page + 1}`}
            >
              Next
              <CaretRightIcon />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function ThreadItem({ data }: { data: ThreadsData['threads'][number] }) {
  const { author, messagesCount, parent } = data;
  const authorName = anonymizeName(author!);

  return (
    <div className="flex items-center justify-between gap-4 rounded border-neutral-300 border-b py-4">
      <div>
        <div>
          <Link
            className="underline-offset-2 hover:underline"
            href={slugifyThreadUrl({
              id: data.id,
              name: data.channelName!,
            })}
          >
            {data.channelName}
          </Link>
          <div className="text-neutral-500 text-sm">
            by {authorName} • in{' '}
            <Link
              className="underline-offset-2 hover:underline"
              href={`/channel/${parent?.id}`}
            >
              #{parent?.channelName}
            </Link>{' '}
            • {snowflakeToReadableDate(data.id)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {data.pinned && <PushPinIcon className="size-5" />}
        <div className="flex items-center gap-2">
          <ChatIcon className="size-5" />
          <span className="text-sm">{messagesCount - 1}</span>
        </div>
      </div>
    </div>
  );
}
