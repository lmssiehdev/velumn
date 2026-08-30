// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ServerMark } from "./forum-redesign"

describe("ServerMark", () => {
  it("shows initials when the server icon fails", () => {
    render(<ServerMark icon="missing" id="123" name="Velumn Community" />)

    fireEvent.error(screen.getByRole("presentation"))

    expect(screen.getByText("VC")).toBeTruthy()
  })
})
