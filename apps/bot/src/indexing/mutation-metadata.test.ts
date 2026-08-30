import { assert, describe, it } from "@effect/vitest";
import type { IndexMutation } from "./model";
import {
	indexMutationKind,
	type PersistedIndexMutationKind,
} from "./mutation-metadata";

const expectedKinds = {
	UpsertMessage: "upsert_message",
	DeleteMessage: "delete_message",
	DeleteThread: "delete_thread",
	ReconcileThread: "reconcile_thread",
	UpsertChannel: "upsert_channel",
	DeleteChannel: "delete_channel",
	InstallGuild: "install_guild",
	UpsertGuild: "upsert_guild",
	DeleteGuild: "delete_guild",
	UpsertUser: "upsert_user",
	ReconcileBotMemberPermissions: "reconcile_bot_member_permissions",
	ReconcileRolePermissions: "reconcile_role_permissions",
} as const satisfies Record<IndexMutation["_tag"], PersistedIndexMutationKind>;

describe("index mutation metadata", () => {
	it("maps every persisted mutation tag to its stable kind", () => {
		for (const [tag, expected] of Object.entries(
			expectedKinds,
		) as ReadonlyArray<
			readonly [IndexMutation["_tag"], PersistedIndexMutationKind]
		>) {
			assert.equal(indexMutationKind({ _tag: tag } as IndexMutation), expected);
		}
	});
});
