import { DBMessage } from "@repo/db/schema/discord";
import { CustomEmoji, Twemoji } from "./emoji";

export function Poll({ poll }: { poll: DBMessage["poll"] }) {
    if (!poll) return null;
    const totalVotes = Object.values(poll.answers).reduce((acc, curr) => acc + curr.voteCount, 0) ?? 0;
    if (totalVotes > 0) {
        console.log(poll)
    }
    return <div className="mt-2 p-4 space-y-3 border border-neutral-200">
        <div className="flex flex-col gap-1">
            {poll.question}
            {
                !poll.resultsFinalized && <span className="text-sm text-neutral-700">Join the server to vote</span>
            }
        </div>
        <div className="space-y-2">
            {Object.entries(poll.answers).map(([key, value]) => {
                const emoji = value.emoji;
                return <div key={key} className="cursor-pointer py-2 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-sm">
                    {emoji && <span className="mr-3">
                        {emoji.id ? <CustomEmoji
                            name={emoji.name}
                            key={key}
                            emojiId={emoji.id}
                            animated={emoji.animated}
                            className={"size-6"}
                        /> : <Twemoji name={emoji.name} className="size-6" />
                        }
                    </span>}
                    <span>
                        {value.text}
                    </span>
                </div>
            })}
        </div>
        <div className="space-x-2 text-sm text-neutral-700">
            <span>{totalVotes} votes</span>
            {
                poll.resultsFinalized &&

                <>
                    <span>•</span>
                    <span>Poll closed</span>
                </>
            }
        </div>
    </div>
}