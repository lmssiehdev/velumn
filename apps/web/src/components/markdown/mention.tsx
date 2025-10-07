import { cn } from "@/lib/utils";
import { ChatsCircleIcon, HashIcon } from "@phosphor-icons/react/dist/ssr";
import { DBMessage } from "@repo/db/schema/discord";
import { ChannelType } from "discord-api-types/v10";
type Type = "user" | "channel" | "role";

function ChannelIcon({ type }: { type: number }) {
  return (
    <>
      {type === ChannelType.GuildForum ? (
        <ChatsCircleIcon className="size-4" />
      ) : (
        <HashIcon className="size-4" weight="bold" />
      )}
    </>
  );
}

export function Mention({
  type,
  metadata,
  children,
}: {
  type?: Type;
  metadata?: DBMessage["metadata"];
  children: string;
}) {
  const className = "inline-block mx-[0.5px] text-purple-800 bg-purple-100 rounded";
  const key = `${type}s` as keyof NonNullable<DBMessage["metadata"]>;
  const prefix = type === "channel" ? "#" : "@";

  if (!type || !metadata || !(key in metadata) || !(children in metadata[key])) {
    return (
      <span className={className}>
        {prefix}
        {children}
      </span>
    );
  }

  if (key === "channels") {
    return (
      <span className={cn(className, "align-bottom")}>
        <span className="flex items-center space-x-0.5">
          <span className="inline-block">
            <ChannelIcon type={metadata[key]?.[children]?.type!} />
          </span>
          <span>{metadata[key][children]?.name ?? children}</span>
        </span>
      </span>
    );
  }

  if (key === "roles") {
    return (
      <span className={className}>
        {prefix}
        {metadata[key][children]?.name ?? children}
      </span>
    );
  }

  if (key === "users") {
    return (
      <span className={className}>
        {prefix}
        {metadata[key][children]?.username ?? children}
      </span>
    );
  }
  return null;
}
