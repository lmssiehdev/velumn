import { eq, or } from "drizzle-orm";
import { db } from ".";
import { dbMessage } from "./schema";

export async function getAllThreads(
    getBy: 'server' | 'channel',
    config: {
        id: string;
        pinned?: boolean;
        page?: number;
    }
) {
    const { id, pinned = false, page = 1 } = config;
    const LIMIT_PER_PAGE = pinned ? 1 : 10;
    const result = await db.query.dbChannel.findMany({
        where: getBy === "server" ? {
            serverId: id,
            pinned,
            parentId: {
                isNotNull: true,
            },
        } : {
            parentId: id,
            pinned,
        },
        with: {
            author: true,
            parent: true,
        },
        extras: {
            messagesCount: (t) => db.$count(dbMessage, eq(dbMessage.primaryChannelId, t.id))
        },
        limit: LIMIT_PER_PAGE + 1,
        offset: (page - 1) * LIMIT_PER_PAGE,
        orderBy: {
            id: "desc"
        }
    });
    return {
        hasMore: result.length > LIMIT_PER_PAGE,
        threads: result.splice(0, LIMIT_PER_PAGE),
        page,
    };
}

const result = await getAllThreads("server", { id: "1385955477912948806" });
console.log(result);