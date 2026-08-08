## Context

See `proposal.md` — Why. Design-relevant constraints only:

- **Tailwind v4, CSS-first.** There is no `tailwind.config.*`. Tokens live in `app/globals.css` under `@theme inline` against CSS variables in `:root`, with a `prefers-color-scheme` media override. shadcn's initialiser targets exactly this file, so the two token systems must be reconciled deliberately.
- **Next.js 16 App Router, React 19.** Server Components are the default. `next-themes` reads `localStorage` and `matchMedia`, so it is inherently a client concern and must not force the whole tree client-side.
- **Clerk is already in `app/layout.tsx`**, with `<ClerkProvider>` inside `<body>` wrapping a header. That header currently contains a hand-written purple Sign Up button — the concrete instance of the visual seam the specs forbid.
- **`app/layout.tsx` uses `LayoutProps<"/">`**, a type generated into `.next/types`. It is a project convention (see `CLAUDE.md`) and must survive this change.
- **No test framework.** Verification is manual plus `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- The existing `body` rule in `globals.css` hard-codes `font-family: Arial, Helvetica, sans-serif`, which overrides the Geist fonts the layout wires up. This change touches that file and should correct it.

This design covers a new architectural pattern (owned component source), several new dependencies, and a token migration, so it qualifies for a design document.

## Goals / Non-Goals

**Goals:**

- One token set that both shadcn components and hand-written markup draw from, with no parallel or orphaned definitions left in `globals.css`.
- Dark mode that is correct before first paint and produces no hydration mismatch.
- A single visual language across application and Clerk surfaces, in both schemes.
- Server Components preserved as the default; client boundaries introduced only where genuinely required.

**Non-Goals:**

- A custom brand palette. This change adopts a stock base color; brand identity is a later, separate decision.
- Component API customisation beyond what generation produces. Components land as generated; divergence happens when a feature needs it.
- Responsive layout system, navigation shell, or page-level information architecture.
- Storybook, visual regression testing, or component documentation tooling.
- Converting any screen other than the landing page — there are no others yet.

## Decisions

### shadcn/ui over a packaged component library

Components are generated into `components/ui/` as project source. The alternative — a versioned dependency such as MUI or Mantine — trades away the ability to edit a component directly in favour of upgrade automation.

Generated source wins here because the styling layer is already Tailwind, and shadcn components are Tailwind-native rather than wrapping a competing styling runtime. The cost is real and stated in the proposal's Impact: upstream fixes do not arrive on their own.

*Consequence for review.* `components/ui/` is generated but committed, and reviewers should treat it as vendored code — read on arrival, then largely left alone. Changes to it after generation are the interesting diffs.

### Reconcile tokens rather than let the initialiser overwrite

`npx shadcn@latest init` rewrites `app/globals.css`. The existing file defines `--background`/`--foreground` and maps the Geist font variables through `@theme inline`.

The font mappings must survive; the color pair is superseded by shadcn's `--background`/`--foreground` (same names, different values and a fuller surrounding set). The approach is to run `init`, then read the resulting file and re-add the font token mappings, rather than assuming either that the initialiser preserves them or that they can be dropped.

The `body { font-family: Arial... }` rule is deleted in the process — it currently defeats the `next/font` setup, and `@theme inline`'s `--font-sans` mapping replaces it correctly.

*Alternative considered.* Hand-writing the shadcn token set instead of running `init`. Rejected: the token set is large, `init` also produces `components.json` and `lib/utils.ts` consistently, and hand-transcription invites subtle omissions that surface as one unstyled component much later.

### Base color `neutral`

A stock gray base rather than a brand palette. It reads as deliberate rather than default, and swapping the base later is a token-value edit, not a component rewrite. Deferring brand color is explicitly a Non-Goal.

### `next-themes` with `class` strategy and `suppressHydrationWarning`

The specs require: system default, explicit override, persistence, and no flash before paint. Meeting all four by hand means a blocking inline script that reads `localStorage` and `matchMedia` and stamps a class on `<html>` before paint. `next-themes` is that script, plus the React state to drive a toggle.

Configuration: `attribute="class"`, `defaultTheme="system"`, `enableSystem`, and `suppressHydrationWarning` on `<html>`.

`suppressHydrationWarning` is load-bearing, not incidental. The server cannot know the client's stored theme, so the class it renders necessarily differs from what the pre-paint script stamps. Without the attribute this is a hydration error on every load; with it, React accepts the known-good difference on that one element. Omitting it is the most likely way to get this wrong.

*Consequence.* The existing `@media (prefers-color-scheme: dark)` block in `globals.css` must be removed. Leaving it produces two competing dark-mode mechanisms — the media query would apply dark styling even when the user explicitly chose light, directly violating the spec scenario where an explicit choice conflicts with the system preference. Tailwind v4 expresses the class strategy through `@custom-variant dark`.

### A narrow client boundary around theming

`next-themes`' provider is a client component. Wrapping the whole layout in it would not make every child a client component — children passed through `{children}` stay server-rendered — but the provider file itself must carry `"use client"`.

Structure: a thin `components/theme-provider.tsx` marked `"use client"` that re-exports the `next-themes` provider, and a `components/theme-toggle.tsx` also client-side because it uses the theme hook and handles clicks. `app/layout.tsx` stays a Server Component.

The toggle offers light, dark, and system — three states, not a two-way flip. The spec requires returning to system-following after an explicit choice, which a boolean toggle cannot express.

*Known pitfall.* The toggle must not render theme-dependent output during the server pass, since the resolved theme is unknown there. The standard remedy is to render a stable placeholder until mounted; otherwise the icon itself becomes a hydration mismatch.

### Clerk theming via `appearance` variables on the provider

Clerk renders in the same document, not an iframe, so it accepts an `appearance` prop mapping its variables to CSS values. Point those at the shadcn tokens so Clerk inherits the palette.

Because the tokens are CSS variables that already change with the `dark` class, Clerk follows the active scheme without needing to know the theme — a single configuration covers both schemes with no branching.

The hand-written purple Sign Up button is replaced by the shared button component passed as the `<SignUpButton>` child, which is why the seam closes rather than merely shrinking.

*Alternative considered.* Clerk's prebuilt `dark` base theme from `@clerk/themes`, selected reactively from the resolved theme. Rejected on two counts: it adds a dependency, and it requires reading the theme in a client component and passing it down, reintroducing the hydration timing problem the variable approach avoids entirely.

*Risk acknowledged.* Clerk's variable names are its own API surface and may not map one-to-one onto shadcn's token roles. Where a gap exists, accept Clerk's default for that specific element rather than fighting it — the spec requires no visible seam, not pixel identity.

### Component set scoped to demonstrated need

Generate: `button`, `input`, `label`, `form`, `card`, `table`, `dialog`, `select`, `sonner`.

Each maps to an interaction pattern named in `specs/design-system/spec.md`. Generating the full catalogue would fill `components/ui/` with unreviewed source that no screen exercises, and every file there is code this project now owns.

`sonner` is shadcn's current toast; the older `toast` component is deprecated upstream.

`form` pulls in `react-hook-form` and `zod`. That is a meaningful dependency addition justified by the spec's accessible-error requirements — field-to-error association, invalid state exposure, and clearing on correction are exactly what the wrapper provides, and hand-rolling them accessibly is more work than it appears.

### The landing page as the proof

`app/page.tsx` is rebuilt as a signed-out marketing panel and a signed-in placeholder dashboard, using `Card`, `Button`, and `Table`, gated by Clerk's `<Show>`.

This is scoped as proof that the foundation works, not as product design. It exercises the token set, both schemes, and Clerk's `<Show>` alongside shadcn components in one screen — which is where integration problems actually surface. The table renders static placeholder rows; there is no data layer yet, and `add-drizzle-db-setup` is unimplemented.

### File layout

```
components/
  ui/                  # generated shadcn source (committed)
  theme-provider.tsx   # "use client"
  theme-toggle.tsx     # "use client"
lib/
  utils.ts             # cn() helper from init
components.json        # shadcn generator config
```

`components/` and `lib/` sit at the repo root beside `app/`, reachable via the existing `@/*` alias. This is shadcn's default and matches the reasoning already applied to `db/` in `add-drizzle-db-setup`: the App Router treats `app/` as routable, so non-route modules there add noise.

## Risks / Trade-offs

**Initialiser overwrites the Geist font token mappings** → The most likely concrete breakage in this change, and it degrades quietly: the app keeps working, just in the wrong typeface. Mitigation: diff `globals.css` after `init` rather than trusting it, and verify the rendered font explicitly.

**Two dark-mode mechanisms left coexisting** → If the `prefers-color-scheme` block survives alongside the class strategy, an explicit light choice on a dark-set OS still renders dark. Mitigation: removing it is an explicit task, and the spec scenario for conflicting preferences is the check that catches it.

**Hydration mismatch from the theme toggle** → Distinct from the `<html>` mismatch that `suppressHydrationWarning` covers; this one is the toggle rendering a theme-dependent icon during the server pass. Mitigation: render a stable placeholder until mounted, and treat any console hydration warning as a defect rather than noise.

**Clerk variable coverage is incomplete** → Some Clerk internals may not be reachable through `appearance` variables. Mitigation: verify sign-in, sign-up, and the user button menu in both schemes; accept Clerk defaults for unreachable details rather than overriding with brittle CSS selectors into Clerk's internal class names, which would break on any Clerk update.

**Owned component source drifts from upstream** → Accepted deliberately and stated in the proposal. Mitigation: record in `CLAUDE.md` that `components/ui/` is generated, so future work neither hand-edits it casually nor expects `npm update` to touch it.

**Dependency footprint grows notably** → Radix primitives, `react-hook-form`, `zod`, `next-themes`, `lucide-react`. Mitigation: Radix primitives are per-component and tree-shakeable; the set is scoped to demonstrated need rather than generated wholesale. Bundle impact should be observed in the build output rather than assumed benign.

**`add-drizzle-db-setup` is open concurrently** → Both changes modify `package.json` and `CLAUDE.md`. Mitigation: they touch disjoint sections and neither depends on the other; whichever applies second resolves trivial conflicts in those two files.

## Migration Plan

No data migration. The change is additive apart from the `globals.css` token replacement and the `page.tsx` rewrite.

Rollout: run `init`, reconcile `globals.css`, generate components, add the theme provider and toggle, configure Clerk's appearance, rebuild the landing page, then verify both schemes.

Rollback: revert the commit. No persisted state, no external service configuration, and no schema is involved, so revert is complete — with the one exception that a user's stored theme choice remains in their `localStorage` and is simply ignored once `next-themes` is gone.

## Open Questions

- **Brand palette.** The stock `neutral` base is a placeholder for a real identity. Changing it later is a token-value edit that touches no component source, so this does not block anything here.
- **Toast placement and duration.** `sonner`'s defaults are adopted; tuning is cosmetic and best decided once real flows produce real notifications.
