import { ArrowBendUpRightIcon } from '@phosphor-icons/react/dist/ssr';
import type { DBSnapshotSchema } from '@repo/db/helpers/validation';
import { DiscordSnapshotMessageWithMetadata } from './renderer';

export function Snapshot({ snapshot }: { snapshot: DBSnapshotSchema | null }) {
  if (!snapshot) {
    return null;
  }
  return (
    <div className="prose">
      <blockquote className="quote">
        <div className="space-x-1">
          <ArrowBendUpRightIcon className="inline-flex size-4" />
          <span className="text-neutral-700 text-sm">Forwarded</span>
        </div>
        <div className="[&_img]:my-0">
          <DiscordSnapshotMessageWithMetadata message={snapshot} />
        </div>
      </blockquote>
    </div>
  );
}
