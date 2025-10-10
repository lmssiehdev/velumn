import { SingleASTNode } from "@khanacademy/simple-markdown";
import { DBMessage } from "@repo/db/schema/discord";
import { ChannelIcon, ThreadIcon } from "./mention";
import { CaretRightIcon, ChatsCircleIcon, ChatTeardropIcon } from "@phosphor-icons/react/dist/ssr";
import { ChannelType } from "discord-api-types/v10";

export function Link({ target, content, message }: { target: string, content: string, message: DBMessage }) {
    const isInternalLink = message?.metadata?.internalLinks.find(x => x.original === target);

    if (isInternalLink) {
        const { original, channel, message } = isInternalLink;
        const shortenedMessage = (channel.name.length > 40) ? channel.name!.slice(0, 40) + "..." : channel.name;
        return <a href={original} target="_blank" rel="noreferrer" className="text-purple-800 bg-purple-100 rounded not-prose space-x-0.5 p-0.5">
            {
                (channel.parent?.type === ChannelType.GuildForum && message) && <span className="inline-block space-x-0.5">
                    <span className="inline-block space-x-0.5">
                        <ChannelIcon type={channel.parent?.type} />
                        <span>{channel.parent?.name}</span>
                    </span>
                    <CaretRightIcon className="text-purple-800 size-2.5  inline-block" />
                </span>
            }
            <ChannelIcon type={channel.type} />
            <span>
                {shortenedMessage}
            </span>
            {
                message && <span className="text-xs inline-block space-x-0.5">
                    <CaretRightIcon className="text-purple-800 size-2.5  inline-block" />
                    <ChatTeardropIcon size={32} weight="fill" className="text-purple-800 size-4 inline-block" />
                </span>
            }
        </a>
    }

    return (
        <a href={target} target="_blank" rel="noreferrer" >
            {content}
        </a>
    )

}