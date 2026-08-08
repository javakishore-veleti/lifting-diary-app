## Why

Every screen this app still needs — logging a set, reviewing workout history, editing an exercise — is built from the same handful of primitives: buttons, inputs, forms, tables, dialogs. Without a shared component vocabulary, each feature invents its own markup and Tailwind classes, and the interface drifts apart faster than it can be corrected. Establishing that vocabulary now, while there is exactly one page to convert, is far cheaper than retrofitting it across a dozen screens later.

The app also currently presents two visual languages at once: Clerk's stock components in the header sit beside hand-written Tailwind, and the page body is still unmodified `create-next-app` template content.

## What Changes

- Adopt shadcn/ui as the component foundation: components are generated into the repository as owned source, not consumed from a versioned package.
- Replace the placeholder theme tokens in `app/globals.css` with the full shadcn token set, wired through Tailwind v4's CSS-first configuration. **BREAKING** for existing markup: the current `--background`/`--foreground` pair is superseded, and any class referencing the old tokens must be updated.
- Add the baseline component set the product needs first: button, input, label, field, card, table, dialog, select, dropdown menu, and toast notifications. (`field` rather than `form`: shadcn v4's `radix-nova` base ships no `form` component — see design.md.)
- Add class-based dark mode with a user-facing toggle, defaulting to the operating system preference and remembering an explicit choice across visits. This supersedes the current `prefers-color-scheme`-only behaviour, which users cannot override.
- Theme Clerk's components so sign-in, sign-up, and the user button adopt the same tokens and follow the active color scheme, and replace the hand-rolled purple Sign Up button in the header with the shared button component.
- Replace the `create-next-app` template content in `app/page.tsx` with a real screen built from the new components, proving the foundation works end to end.

## Capabilities

### New Capabilities

- `design-system`: The shared visual and interaction vocabulary — the component set available to feature work, the design tokens components draw from, accessibility guarantees those components carry, and the rule that all interface surfaces including third-party ones present a single consistent appearance.
- `theming`: How the application selects, applies, and remembers a color scheme, including honouring the operating system preference, allowing an explicit user override, and applying the active scheme without a visible flash on load.

### Modified Capabilities

None. Neither `data-persistence` nor `training-log` (proposed in `add-drizzle-db-setup`, not yet implemented) changes behaviour here. This change is independent of that one and the two may proceed in either order.

## Impact

**Dependencies added:** `next-themes` for color scheme management; `lucide-react` for icons; the utility packages shadcn's `init` installs for component styling (`clsx`, `tailwind-merge`, `class-variance-authority`, `tw-animate-css`), plus the `radix-ui` primitives package. `react-hook-form`, `zod`, and `@hookform/resolvers` are installed **explicitly** — under shadcn v4 they no longer arrive transitively via a `form` component, because that component ships no files in this base. `shadcn` itself is a code generator invoked with `npx`, so it belongs in devDependencies; `init` installs it as a runtime dependency and this change moves it.

**New code:** `components/ui/` (generated component source), `lib/utils.ts`, `components.json`, a theme provider, and a theme toggle component.

**Modified files:** `app/globals.css` (token set substantially rewritten), `app/layout.tsx` (theme provider, Clerk appearance config, header markup), `app/page.tsx` (template content replaced), `package.json`, `CLAUDE.md` (component conventions).

**Ownership shift:** generated components are project source code, reviewed and maintained here. Upstream fixes do not arrive automatically; adopting them is a deliberate act of re-running the generator and reading the diff.

**Existing systems:** Clerk continues to own authentication; only its visual presentation changes. No routing, data, or auth behaviour is affected.

**Constraint worth flagging:** Tailwind v4 has no `tailwind.config.*`, and `app/globals.css` currently carries a hand-written `@theme inline` block. shadcn's initialiser rewrites that file, so the existing token definitions must be reconciled rather than assumed to survive.
