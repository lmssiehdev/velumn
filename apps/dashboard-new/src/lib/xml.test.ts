import { describe, expect, it } from "vitest"

import { buildUrlSetXml } from "./xml"

describe("buildUrlSetXml", () => {
  it("escapes XML-sensitive URL characters", () => {
    expect(buildUrlSetXml([`https://example.com/?a=<&quote="'`])).toContain(
      "https://example.com/?a=&lt;&amp;quote=&quot;&apos;"
    )
  })
})
