
import React from 'react';
import { parse } from 'discord-markdown-parser';
import { type SingleASTNode } from '@khanacademy/simple-markdown';
import { Code } from './code';
import { Spoiler } from './spoiler';
import dayjs from 'dayjs';
import { cn } from '@/lib/utils';
import { emojiToTwemoji } from '@repo/utils/helpers/twemoji';

function Mention({ type = "user", children }: { type?: "user" | "channel", children: string }) {
  const prefix = type === "user" ? "@" : "#";
  return <span className='inline-block mx-[0.5px] text-purple-800 bg-purple-100 rounded'>{prefix}{children}</span>;
}

function Timestamp({ children }: { children: string }) {
  // TODO: needs more testing;
  return <span className='bg-neutral-200 rounded'>{dayjs.unix(Number(children)).format('MMMM D, YYYY')}</span>;
}

export function Twemoji({ name, className = "size-12" }: { name: string, className?: string }) {
  return <img className={cn('inline-block not-prose', className)} loading="lazy" aria-label={name} alt={name} draggable="false" src={emojiToTwemoji(name)}></img>
}

function renderASTNode(node: SingleASTNode | SingleASTNode[], index = 0, parent: SingleASTNode | SingleASTNode[] | null): React.ReactNode {
  if (Array.isArray(node)) {
    return node.map((child, i) => renderASTNode(child, i, node));
  }

  const key = index;

  switch (node.type) {
    case 'text':
      return <span key={index}>{node.content}</span>;

    case 'br':
      return <br key={key} />;

    case 'heading': {
      const Tag = `h${node.level}`;
      // @ts-expect-error
      return <Tag key={key}>{renderASTNode(node.content, key + 1, node)}</Tag>;
    }

    case 'url':
      return (
        <a key={key} href={node.target} target="_blank" rel="noreferrer">
          {renderASTNode(node.content, key + 1, node)}
        </a>
      );

    case 'strikethrough':
      return <s key={key}>{renderASTNode(node.content, key + 1, node)}</s>;

    case 'strong':
      return <strong key={key}>{renderASTNode(node.content, key + 1, node)}</strong>;

    case 'em':
      return <em key={key}>{renderASTNode(node.content, key + 1, node)}</em>;

    case "underline":
      return <u key={key}>{renderASTNode(node.content, key + 1, node)}</u>;

    case 'inlineCode':
      return (
        <Code code={node.content} key={key} isInline>
        </Code>
      );

    case 'link':
      return <a key={key} href={node.target} target="_blank" rel="noreferrer">
        {renderASTNode(node.content, key + 1, node)}
      </a>

    // TODO: handle custom discord emoji
    case 'emoji':
      return node.name;

    // discord specific
    case 'user':
      return <Mention key={key}>{node.id}</Mention>;

    case 'channel':
      return <Mention key={key}>{node.id}</Mention>;

    case 'role':
      return <Mention key={key}>{node.id}</Mention>;

    case 'everyone':
      return <Mention key={key}>everyone</Mention>;

    case 'here':
      return <Mention key={key}>here</Mention>;

    case 'timestamp':
      return <Timestamp key={key}>{node.timestamp}</Timestamp>;

    case 'codeBlock':
      return <Code code={node.content} language={node.lang} key={key}></Code>;

    case 'spoiler':
      return <Spoiler key={key}>{renderASTNode(node.content, key + 1, node)}</Spoiler>

    case 'blockQuote':
      return <blockquote key={key}>{renderASTNode(node.content, key + 1, node)}</blockquote>

    case 'twemoji':
      const size = parent?.every((n: { type: string, content?: string }) => n.type === "twemoji" || (n.type === 'text' && n?.content === " ")) ? 'size-12' : 'size-[1.375rem]';
      return <Twemoji name={node.name} key={key} className={size} />;

    default:
      return null;
  }
}

export const DiscordMarkdown = ({ children }: { children: string | null }) => {
  if (!children) return null;
  const parsed = parse(children, 'normal');
  return <div className='prose'>
    {renderASTNode(parsed, 0, null)}
  </div>;
}
