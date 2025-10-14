import { getAllThreads } from '@repo/db/helpers/servers';
import { ThreadList } from '@/app/(forum)/server/[id]/page';
import { getChannelInfoCached } from '@/utils/cache';
import { FrontPageSidebar } from '../../layout';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const data = await getChannelInfoCached(id);

  if (!data?.channel) {
    return {
      title: 'Channel Not Found',
      openGraph: {
        title: 'Channel Not Found',
      },
    };
  }
  return {
    title: data.channel?.channelName,
    // TODO: sync description?
    // describe: data.channel?.description,
    openGraph: {
      title: data.channel?.channelName,
      // description: data.channel?.description,
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
  const { id: channelId } = await params;
  const data = await getChannelInfoCached(channelId);
  const searchParamsPage = Number((await searchParams.page) ?? 1);

  if (!data) {
    return <div>Channel doesn't exist</div>;
  }

  // TODO: is channel needed here?
  const { channel, server } = data;

  const { threads, hasMore, page } = await getAllThreads('channel', {
    id: channelId,
    page: searchParamsPage,
  });

  const { threads: pinnedThread } = await getAllThreads('channel', {
    id: channelId,
    pinned: true,
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
          serverId={channelId}
          threads={threads.concat(pinnedThread)}
        />
        <FrontPageSidebar activeChannelId={channel.id} server={server} />
      </div>
    </div>
  );
}
