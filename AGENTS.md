# Repository agent guidance

## Interface quality

- Load the relevant skills from `.agents/skills/` before changing user-facing interfaces. Use `better-interface` to coordinate broader flow work and `interface-review` for a final change-scoped review.
- Preserve the established component library, tokens, density, and product voice. References are behavioral and structural direction, not a reason to introduce a second design system.
- Inspect every changed flow in its rendered desktop and narrow-width states. Walk default, loading, empty, error, disabled, pending, success, and destructive states that the change can reach.
- Use spacing, borders, and background contrast for structure. Reserve shadows for genuinely elevated or floating surfaces; persistent status text must not look like a floating alert.
- Keep status feedback proportional to its importance. Routine success should be quiet, actionable pending states should be visible, and errors must explain the next step beside the control that failed.
- Before finishing frontend work, run formatting, lint, typecheck, relevant tests, and a quick `interface-review` of the working changes. Record any runtime state that could not be verified.

## Discord API reference

- For Discord payload, endpoint, message component, or serialization work, inspect `vendor/discord-api-spec/openapi.json` and verify it with `npm run discord-spec:check`.
- Treat the vendored OpenAPI document as a pinned preview reference. Confirm conclusions against Discord's developer documentation, the installed `discord-api-types` and discord.js versions, and representative runtime payload tests.
- Run `npm run discord-spec:update` deliberately when refreshing the snapshot, then review the changed spec and `vendor/discord-api-spec/source.json` together.
