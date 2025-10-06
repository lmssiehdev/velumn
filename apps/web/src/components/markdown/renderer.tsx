import React from "react";
import { parse } from "discord-markdown-parser";
import { type SingleASTNode } from "@khanacademy/simple-markdown";
import { Code } from "./code";
import { Spoiler } from "./spoiler";
import dayjs from "dayjs";
import { CustomEmoji, getEmojiSize, Twemoji } from "./emoji";
import { DBMessage } from "@repo/db/schema/discord";
import { Mention } from "./mention";

function Timestamp({ children }: { children: string }) {
  // TODO: needs more testing;
  return (
    <span className="bg-neutral-200 rounded">
      {dayjs.unix(Number(children)).format("MMMM D, YYYY")}
    </span>
  );
}

export function List({ items, ordered }: { items: SingleASTNode[][]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className="my-0!">
      {items.map((item, idx) => {
        return (
          <li className="marker:text-black" key={idx}>
            {item.map((i, childIdx) => renderASTNode(i, childIdx + idx + 1, item, true))}
          </li>
        );
      })}
    </Tag>
  );
}

function renderASTNode(
  node: SingleASTNode | SingleASTNode[],
  index = 0,
  parent: SingleASTNode | SingleASTNode[] | null,
  isReferenceReply = false,
  metadata?: DBMessage["metadata"],
): React.ReactNode {
  if (Array.isArray(node)) {
    return node.map((child, i) => renderASTNode(child, i, node, isReferenceReply, metadata));
  }

  if (isReferenceReply && ["br", "inlineCode", "codeBlock"].includes(node.type)) return " ";

  const key = index;

  switch (node.type) {
    case "text":
      return <span key={index}>{node.content}</span>;

    case "br":
      return <br key={key} />;

    case "heading": {
      const Tag = `h${node.level}`;
      return (
        // @ts-expect-error
        <Tag key={key}>
          {renderASTNode(node.content, key + 1, node, isReferenceReply, metadata)}
        </Tag>
      );
    }

    case "guildNavigation":
      return <div>10000</div>;

    case "url":
      return (
        <a key={key} href={node.target} target="_blank" rel="noreferrer">
          {renderASTNode(node.content, key + 1, node, isReferenceReply, metadata)}
        </a>
      );

    case "strikethrough":
      return (
        <s key={key}>{renderASTNode(node.content, key + 1, node, isReferenceReply, metadata)}</s>
      );

    case "strong":
      return (
        <strong key={key}>
          {renderASTNode(node.content, key + 1, node, isReferenceReply, metadata)}
        </strong>
      );

    case "em":
      return (
        <em key={key}>{renderASTNode(node.content, key + 1, node, isReferenceReply, metadata)}</em>
      );

    case "underline":
      return (
        <u key={key}>{renderASTNode(node.content, key + 1, node, isReferenceReply, metadata)}</u>
      );

    case "inlineCode":
      return <Code code={node.content} key={key} isInline></Code>;

    case "link":
      return (
        <a key={key} href={node.target} target="_blank" rel="noreferrer">
          {renderASTNode(node.content, key + 1, node, isReferenceReply, metadata)}
        </a>
      );

    case "emoji": {
      return (
        <CustomEmoji
          name={node.name}
          key={key}
          emojiId={node.id}
          animated={node.animated}
          className={getEmojiSize(parent)}
        />
      );
    }

    case "twemoji":
      return <Twemoji name={node.name} key={key} className={getEmojiSize(parent)} />;

    // discord specific
    case "user":
    case "channel":
    case "role":
      return (
        <Mention type={node.type!} key={key} metadata={metadata!}>
          {node.id}
        </Mention>
      );

    case "everyone":
      return <Mention key={key}>everyone</Mention>;

    case "here":
      return <Mention key={key}>here</Mention>;

    case "timestamp":
      return <Timestamp key={key}>{node.timestamp}</Timestamp>;

    case "codeBlock":
      return <Code code={node.content} language={node.lang} key={key}></Code>;

    case "spoiler":
      return (
        <Spoiler key={key}>
          {renderASTNode(node.content, key + 1, node, isReferenceReply, metadata)}
        </Spoiler>
      );

    case "blockQuote":
      return (
        <blockquote key={key}>
          {renderASTNode(node.content, key + 1, node, isReferenceReply, metadata)}
        </blockquote>
      );

    case "list":
      return <List key={key} items={node.items as SingleASTNode[][]} />;
    default:
      return null;
  }
}

export const DiscordMarkdown = ({
  children,
  isReferenceReply = false,
  metadata,
}: {
  children: string | null;
  isReferenceReply?: boolean;
  metadata: DBMessage["metadata"];
}) => {
  if (!children) return null;
  const parsed = parse(children, "normal");
  return <div className="prose">{renderASTNode(parsed, 0, null, isReferenceReply, metadata)}</div>;
};
