import { describe, expect, it } from "vitest"

import { getManagementAccess } from "./management-access"

describe("management access", () => {
  it("does not distinguish missing from unauthorized servers", () => {
    expect(getManagementAccess(null)).toBe("not_found")
  })

  it("requires setup for incomplete lifecycle states", () => {
    expect(getManagementAccess("invite_required")).toBe("setup_required")
    expect(getManagementAccess("waiting_for_bot")).toBe("setup_required")
    expect(getManagementAccess("select_channels")).toBe("setup_required")
  })

  it("allows ready and disconnected management reads", () => {
    expect(getManagementAccess("ready")).toBe("allowed")
    expect(getManagementAccess("bot_disconnected")).toBe("allowed")
  })
})
