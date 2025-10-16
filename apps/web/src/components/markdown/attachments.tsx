import { ArrowUpRightIcon, FileIcon } from '@phosphor-icons/react/dist/ssr';
import type { DBAttachments } from '@repo/db/helpers/validation';
import { isEmbeddableAttachment } from '@repo/utils/helpers/misc';
// @ts-expect-error no types - used once;
import bytes from 'bytes';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const isCode = (a: DBAttachments) =>
  !a.contentType?.startsWith('image/') || a.proxyURL?.endsWith('.svg');

export function Attachments({
  attachments,
}: {
  isSnapshot?: boolean;
  attachments: DBAttachments[];
}) {
  if (!attachments.length) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <ImageGallery images={attachments.filter(isEmbeddableAttachment)} />
      {attachments.filter(isCode).map((attachment) => (
        <FileShowcase attachment={attachment} key={attachment.id} />
      ))}
    </div>
  );
}

function FileShowcase({ attachment }: { attachment: DBAttachments }) {
  const { name, size } = attachment;

  return (
    <div className="group relative mt-2 flex w-full max-w-md gap-2.5 border border-neutral-300 p-4 shadow">
      <div className="flex items-center justify-center">
        <FileIcon className="size-10" weight="thin" />
      </div>
      <div className="flex flex-col overflow-hidden">
        <Link
          className="overflow-hidden text-ellipsis whitespace-nowrap underline-offset-2 hover:underline"
          href="#"
        >
          {name}
        </Link>
        <span className="text-neutral-500 text-sm">{bytes(size, 2)} </span>
      </div>
      <div className="group-hover:fade-in-0 group-hover:zoom-in-95 absolute top-0 right-0 translate-x-[50%] translate-y-[-50%] opacity-0 transition-opacity duration-300 group-hover:animate-in group-hover:opacity-100">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="cursor-pointer"
              size={'icon'}
              variant={'outline'}
            >
              <ArrowUpRightIcon className="size-6" weight={'bold'} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Open in discord</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// for quick testing
const MAX_IMAGES = 2;
const _dummyImages = Array.from({ length: 10 }, () => ({
  id: Math.random(),
  name: 'test.png',
  proxyURL:
    'https://discord-indexer.s3.us-east-1.amazonaws.com/1417376726077407343/troy-olson-O5UG81P7yzE-unsplash.jpg',
})).splice(0, MAX_IMAGES);

function ImageGallery({ images }: { images: DBAttachments[] }) {
  if (!images.length) {
    return null;
  }

  // TODO: discord heights
  const styles: Record<number, string> = {
    1: 'grid gap-1s',
    2: 'grid gap-1 grid-cols-2  ',
    3: 'grid gap-1 grid-cols-2 grid-rows-2  [&>*:first-child]:row-span-2',
    4: 'grid gap-1 grid-cols-2 grid-rows-2 ',
    5: 'grid gap-1 grid-cols-6 grid-rows-2 [&>*:nth-child(-n+2)]:col-span-3 [&>*:nth-child(n+3)]:col-span-2',
    6: 'grid gap-1 grid-cols-3 grid-rows-2 *:h-[181px]',
    7: 'grid gap-1 grid-cols-3 grid-rows-3 *:h-[181px] [&>*:first-child]:col-span-3',
    8: 'grid gap-1 grid-cols-6 grid-rows-3 *:h-[181px] [&>*:nth-child(n+3)]:col-span-2 [&>*:nth-child(-n+2)]:col-span-3',
    9: 'grid gap-1 grid-cols-3 grid-rows-3 *:h-[181px]',
    10: 'grid gap-1 grid-cols-3 grid-rows-4 *:h-[181px] [&>*:first-child]:col-span-3',
  };
  return (
    <div
      className={cn(
        'w-full max-w-[550px] overflow-hidden rounded py-0.5',
        styles[images.length]
      )}
    >
      {images.map(({ id, proxyURL, name }) => {
        return (
          <img
            alt={name}
            className="inline-block min-h-full min-w-full rounded object-cover"
            key={id}
            src={proxyURL}
          />
        );
      })}
    </div>
  );
}
