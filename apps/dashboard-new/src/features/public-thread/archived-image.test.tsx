// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ArchivedImage } from "./discord-markdown"

describe("ArchivedImage", () => {
  it("uses the proxy before showing the unavailable state", () => {
    render(
      <ArchivedImage
        alt="Outfit preview"
        fallbackSrc="https://proxy.example.com/outfit.png"
        label="outfit.png"
        linkSrc="https://cdn.example.com/outfit.png"
        src="https://cdn.example.com/outfit.png"
      />
    )

    const image = screen.getByRole("img", { name: "Outfit preview" })
    fireEvent.error(image)
    expect(image.getAttribute("src")).toBe(
      "https://proxy.example.com/outfit.png"
    )

    fireEvent.error(image)
    const fallback = screen.getByRole("group", { name: "outfit.png" })
    const classes = fallback.className.split(" ")
    expect(classes).toContain("w-[min(100%,24rem)]")
    expect(classes).not.toContain("w-full")
    expect(screen.getByText("Image unavailable")).toBeTruthy()
    expect(screen.getByText("outfit.png")).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Open original image: outfit.png" })
        .getAttribute("href")
    ).toBe("https://cdn.example.com/outfit.png")
  })

  it("removes a decorative image when all sources fail", () => {
    const { container } = render(
      <ArchivedImage
        alt=""
        fallbackSrc="https://proxy.example.com/icon.png"
        label="Embedded image"
        linkSrc="https://cdn.example.com/icon.png"
        src="https://cdn.example.com/icon.png"
      />
    )

    const image = screen.getByRole("presentation")
    fireEvent.error(image)
    expect(image.getAttribute("src")).toBe("https://proxy.example.com/icon.png")
    fireEvent.error(image)

    expect(within(container).queryByText("Image unavailable")).toBeNull()
    expect(within(container).queryByRole("link")).toBeNull()
  })
})
