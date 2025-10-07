import { cn } from "@/lib/utils";
import { SingleASTNode } from "@khanacademy/simple-markdown";
import { emojiToTwemoji } from "@repo/utils/helpers/twemoji";

function customEmojiUrl(id: string, animated: boolean = false) {
  const extension = animated ? "gif" : "webp";
  return `https://cdn.discordapp.com/emojis/${id}.${extension}?size=128`;
}

export function getEmojiSize(parent: SingleASTNode[]): string {
  const emojiWithText = parent?.every(
    (n) => ["twemoji", "emoji"].includes(n.type) || (n.type === "text" && n.content === " "),
  );

  return emojiWithText ? "size-12" : "size-[1.375rem]";
}
type Props = {
  name: string;
  className?: string;
  emojiId?: string;
  animated?: boolean;
};

export function CustomEmoji({ emojiId, animated, name, className = "size-12" }: Props) {
  return (
    <EmojiBase
      src={customEmojiUrl(emojiId!, animated)}
      animated
      name={name}
      className={className}
    />
  );
}

export function Twemoji({ name, className = "size-12" }: Props) {
  return <EmojiBase src={emojiToTwemoji(name)} name={name} className={className} />;
}

export function EmojiBase({ name, src, className }: Props & { src: string }) {
  return (
    <img
      className={cn("inline-block not-prose", className)}
      loading="lazy"
      title={name}
      aria-label={name}
      alt={name}
      draggable="false"
      src={src}
    />
  );
}
