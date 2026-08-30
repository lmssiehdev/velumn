import type { IndexMutation } from "./model";

export type PersistedIndexMutationKind =
	| "upsert_message"
	| "delete_message"
	| "delete_thread"
	| "reconcile_thread"
	| "upsert_channel"
	| "delete_channel"
	| "install_guild"
	| "upsert_guild"
	| "delete_guild"
	| "upsert_user"
	| "reconcile_bot_member_permissions"
	| "reconcile_role_permissions";

export const indexMutationKind = (
	mutation: IndexMutation,
): PersistedIndexMutationKind => {
	switch (mutation._tag) {
		case "UpsertMessage":
			return "upsert_message";
		case "DeleteMessage":
			return "delete_message";
		case "DeleteThread":
			return "delete_thread";
		case "ReconcileThread":
			return "reconcile_thread";
		case "UpsertChannel":
			return "upsert_channel";
		case "DeleteChannel":
			return "delete_channel";
		case "InstallGuild":
			return "install_guild";
		case "UpsertGuild":
			return "upsert_guild";
		case "DeleteGuild":
			return "delete_guild";
		case "UpsertUser":
			return "upsert_user";
		case "ReconcileBotMemberPermissions":
			return "reconcile_bot_member_permissions";
		case "ReconcileRolePermissions":
			return "reconcile_role_permissions";
	}
};
