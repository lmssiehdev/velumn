import React from "react";
import { parse } from "discord-markdown-parser";
import { type SingleASTNode } from "@khanacademy/simple-markdown";
import { Code } from "./code";
import { Spoiler } from "./spoiler";
import dayjs from "dayjs";
import { CustomEmoji, getEmojiSize, Twemoji } from "./emoji";
import { DBMessage } from "@repo/db/schema/discord";
import { Mention } from "./mention";
import { Link } from "./link";

function renderASTNode(
  node: SingleASTNode | SingleASTNode[],
  index = 0,
  parent: SingleASTNode | SingleASTNode[] | null,
  isReferenceReply = false,
  message?: DBMessage,
): React.ReactNode {
  if (Array.isArray(node)) {
    return node.map((child, i) => renderASTNode(child, i, node, isReferenceReply, message));
  }

  if (isReferenceReply && ["br", "inlineCode", "codeBlock"].includes(node.type)) return " ";

  const key = index;

  function renderNodes(content: SingleASTNode | SingleASTNode[]) {
    return renderASTNode(content, key + 1, node, isReferenceReply, message)
  }


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
          {renderNodes(node.content)}
        </Tag>
      );
    }

    case "guildNavigation":
      return <div>10000</div>;



    case "strikethrough":
      return (
        <s key={key}>{renderNodes(node.content)}</s>
      );

    case "strong":
      return (
        <strong key={key}>
          {renderNodes(node.content)}
        </strong>
      );

    case "em":
      return (
        <em key={key}>{renderNodes(node.content)}</em>
      );

    case "underline":
      return (
        <u key={key}>{renderNodes(node.content)}</u>
      );

    case "inlineCode":
      return <Code code={node.content} key={key} isInline></Code>;

    case "link":
    case "url":
      return <Link key={key} target={node.target} content={renderNodes(node.content) as string} message={message!} />

    case "emoji": {
      return (
        <CustomEmoji
          name={node.name}
          key={key}
          emojiId={node.id}
          animated={node.animated}
          className={getEmojiSize(parent as SingleASTNode[])}
        />
      );
    }

    case "twemoji":
      return (
        <Twemoji name={node.name} key={key} className={getEmojiSize(parent as SingleASTNode[])} />
      );

    // discord specific
    case "user":
    case "channel":
    case "role":
      return (
        <Mention type={node.type!} key={key} message={message!}>
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
          {renderNodes(node.content)}
        </Spoiler>
      );

    case "blockQuote":
      return (
        <blockquote key={key}>
          {renderNodes(node.content)}
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
  message,
}: {
  children: string | null;
  isReferenceReply?: boolean;
  message: DBMessage;
}) => {
  if (!children) return null;
  const parsed = parse(children, "normal");
  return <div className="prose">{renderASTNode(parsed, 0, null, isReferenceReply, message)}</div>;
};


function List({ items, ordered }: { items: SingleASTNode[][]; ordered?: boolean }) {
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

function Timestamp({ children }: { children: string }) {
  // TODO: needs more testing;
  return (
    <span className="bg-neutral-200 rounded">
      {dayjs.unix(Number(children)).format("MMMM D, YYYY")}
    </span>
  );
}