import type { SingleASTNode } from '@khanacademy/simple-markdown';
import type { DBSnapshotSchema } from '@repo/db/helpers/validation';
import type {
  DBMessage,
  DBMessageWithRelations,
} from '@repo/db/schema/discord';
import dayjs from 'dayjs';
import { parse } from 'discord-markdown-parser';
import type React from 'react';
import { Attachments } from './attachments';
import { Code } from './code';
import { Embeds } from './embed';
import { CustomEmoji, getEmojiSize, Twemoji } from './emoji';
import { Link } from './link';
import { Mention } from './mention';
import { Poll } from './poll';
import { Snapshot } from './snapshot';
import { Spoiler } from './spoiler';

function renderASTNode(
  node: SingleASTNode | SingleASTNode[],
  index: number,
  parent: SingleASTNode | SingleASTNode[] | null,
  isReferenceReply = false,
  message?: DBMessage
): React.ReactNode {
  if (Array.isArray(node)) {
    return node.map((child, i) =>
      renderASTNode(child, i, node, isReferenceReply, message)
    );
  }

  if (
    isReferenceReply &&
    ['br', 'inlineCode', 'codeBlock'].includes(node.type)
  ) {
    return ' ';
  }

  const key = index;

  function renderNodes(content: SingleASTNode | SingleASTNode[]) {
    return renderASTNode(content, key + 1, node, isReferenceReply, message);
  }

  switch (node.type) {
    case 'text':
      return <span key={index}>{node.content}</span>;

    case 'br':
      return <br key={key} />;

    case 'heading': {
      const Tag = `h${node.level}`;
      return (
        // @ts-expect-error
        <Tag key={key}>{renderNodes(node.content)}</Tag>
      );
    }

    case 'guildNavigation':
      return <div>10000</div>;

    case 'strikethrough':
      return <s key={key}>{renderNodes(node.content)}</s>;

    case 'strong':
      return <strong key={key}>{renderNodes(node.content)}</strong>;

    case 'em':
      return <em key={key}>{renderNodes(node.content)}</em>;

    case 'underline':
      return <u key={key}>{renderNodes(node.content)}</u>;

    case 'inlineCode':
      return <Code code={node.content} isInline key={key} />;

    case 'link':
    case 'url':
      return (
        <Link
          content={renderNodes(node.content) as string}
          key={key}
          message={message!}
          target={node.target}
        />
      );

    case 'emoji': {
      return (
        <CustomEmoji
          animated={node.animated}
          className={getEmojiSize(parent as SingleASTNode[])}
          emojiId={node.id}
          key={key}
          name={node.name}
        />
      );
    }

    case 'twemoji':
      return (
        <Twemoji
          className={getEmojiSize(parent as SingleASTNode[])}
          key={key}
          name={node.name}
        />
      );

    // discord specific
    case 'user':
    case 'channel':
    case 'role':
      return (
        <Mention key={key} message={message!} type={node.type!}>
          {node.id}
        </Mention>
      );

    case 'everyone':
      return <Mention key={key}>everyone</Mention>;

    case 'here':
      return <Mention key={key}>here</Mention>;

    case 'timestamp':
      return <Timestamp key={key}>{node.timestamp}</Timestamp>;

    case 'codeBlock':
      return <Code code={node.content} key={key} language={node.lang} />;

    case 'spoiler':
      return <Spoiler key={key}>{renderNodes(node.content)}</Spoiler>;

    case 'blockQuote':
      return <blockquote key={key}>{renderNodes(node.content)}</blockquote>;

    case 'list':
      return (
        <List
          items={node.items as SingleASTNode[][]}
          key={key}
          ordered={node.ordered}
        />
      );
    default:
      return null;
  }
}

export const DiscordMarkdown = ({
  children,
  isReferenceReply = false,
  message,
}: {
  children: string | null;
  isReferenceReply?: boolean;
  message: DBMessage | DBSnapshotSchema;
}) => {
  if (!children) {
    return null;
  }
  const parsed = parse(children, 'normal');
  return (
    <div className="prose">
      {/* !! update the types to accept snapshot too */}
      {renderASTNode(parsed, 0, null, isReferenceReply, message as DBMessage)}
    </div>
  );
};

export function DiscordMessageWithMetadata({
  message,
}: {
  message: DBMessageWithRelations;
}) {
  if (message.snapshot) {
    return <Snapshot snapshot={message.snapshot} />;
  }
  return (
    <>
      <DiscordMarkdown message={message}>{message.content}</DiscordMarkdown>
      <Attachments attachments={message.attachments!} />
      <Embeds embeds={message.embeds} />
      <Poll poll={message.poll} />
    </>
  );
}

export function DiscordSnapshotMessageWithMetadata({
  message,
}: {
  message: DBSnapshotSchema;
}) {
  return (
    <>
      <DiscordMarkdown message={message}>{message.content}</DiscordMarkdown>
      <Attachments attachments={message.attachments!} />
      <Embeds embeds={message.embeds} />
    </>
  );
}

function List({
  items,
  ordered,
}: {
  items: SingleASTNode[][];
  ordered?: boolean;
}) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className="my-0!">
      {items.map((item, idx) => {
        return (
          <li className="marker:text-black" key={idx}>
            {item.map((i, childIdx) =>
              renderASTNode(i, childIdx + idx + 1, item, true)
            )}
          </li>
        );
      })}
    </Tag>
  );
}

function Timestamp({ children }: { children: string }) {
  // TODO: needs more testing;
  return (
    <span className="rounded bg-neutral-200">
      {dayjs.unix(Number(children)).format('MMMM D, YYYY')}
    </span>
  );
}
