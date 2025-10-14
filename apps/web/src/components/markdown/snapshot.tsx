import { DBSnapshotSchema } from "@repo/db/helpers/validation";
import { Attachments } from "./attachments";
import { ArrowBendUpRightIcon } from "@phosphor-icons/react/dist/ssr";

export function Snapshot({ snapshot }: { snapshot: DBSnapshotSchema | null }) {
  if (!snapshot) return null;
  console.log(snapshot.attachments)
  return <div className="prose">
    <blockquote className="quote">
      <div className="space-x-1">
        <ArrowBendUpRightIcon className="size-4 inline-flex" />
        <span className="text-sm text-neutral-700">Forwarded</span>
      </div>
      <div className="[&_img]:my-0">
        {snapshot.content}
        <Attachments attachments={snapshot.attachments} />
      </div>
    </blockquote>
  </div>
}
