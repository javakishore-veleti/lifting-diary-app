# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev     # dev server (also regenerates the AGENTS.md rules block, see below)
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint (flat config, no args — lints the whole project)
npx tsc --noEmit  # typecheck; there is no `typecheck` script
```

No test framework is installed — there is no test command to run.

```bash
./DevOps/Local/docker-all-up.sh      # start local backing services, wait until healthy
./DevOps/Local/all-status.sh         # report running/healthy state per service
./DevOps/Local/docker-all-down.sh    # stop services, data preserved
```

## Authentication and access control

Clerk owns identity. `proxy.ts` (not `middleware.ts` — Next 16 renames it) enforces route access; `lib/auth.ts` is the only source of user identity for server code.

- **Routes are protected by default.** `proxy.ts` matches against a public list — `/`, `/sign-in(.*)`, `/sign-up(.*)` — and calls `auth.protect()` on everything else. A new route is protected until deliberately opened. **To make a route public, add it to that list**; there is nowhere else to do it.
- **Keep the `(.*)` suffixes on the auth patterns.** Clerk routes verification, second-factor, and password-reset steps through sub-paths. Without them the sign-in flow redirects to itself — an endless reload that only appears on multi-step flows, never on a plain sign-in.
- **Never narrow `config.matcher` to only protected paths.** It decides whether middleware runs at all; Clerk needs it on public routes to populate `<Show>` and `auth()`, and it governs `/__clerk/`. Protection goes in the middleware body.
- **Every Server Action and route handler must call `requireUserId()` as its first statement.** Middleware guards navigations, not these — they post to the page's own path and can be invoked directly. This is the layer that actually protects data, and its absence is invisible in browser testing because pages still redirect correctly.
- **Server code obtains identity only from `lib/auth.ts`** — never from request parameters, body, or headers. `requireUserId()` returns `Promise<string>` rather than `string | null` precisely so no call site can coerce a null into an empty owner and silently query the wrong rows. Use `getOptionalUserId()` when branching on session presence.
- Clerk redirects are configured by environment variable. Use the **`_FALLBACK_REDIRECT_URL`** variables, never `_FORCE_REDIRECT_URL`: forced redirects override a remembered destination and silently break deep linking while still passing a casual sign-in test.

## UI

`components/ui/` is **generated shadcn source, owned by this project** — committed, edited here, and never updated by `npm update`. Regenerating is a deliberate act (`npx shadcn@latest add <name>`), and upstream fixes do not arrive on their own. Treat it as vendored code: read it on arrival, then leave it alone unless a feature needs a change.

- **This project uses shadcn v4 with the `radix-nova` base.** The bare `form` component does not exist here — its registry entry has no files, so `shadcn add form` reports success and creates nothing. Use `@shadcn/field` (`Field`, `FieldLabel`, `FieldError`) instead.
- **`field` provides accessible markup, not validation.** `react-hook-form`, `zod`, and `@hookform/resolvers` are installed explicitly rather than arriving transitively as they did via the old `form` component. `FieldError` takes an `errors` array shaped like react-hook-form's, so build forms as `Field` + react-hook-form + a zod resolver.
- Namespaced names (`@shadcn/<item>`) are more reliable than bare names under a non-default base.
- **Dark mode is class-based via `next-themes`.** `prefers-color-scheme` must not be reintroduced into `app/globals.css` — the class strategy and a media query together mean an explicit light choice still renders dark on a dark-set OS. Tailwind v4 resolves `dark:` through `@custom-variant dark` in that file.
- `suppressHydrationWarning` on `<html>` in `app/layout.tsx` is load-bearing. The server cannot know the client's stored theme, so removing it produces a hydration error on every load.
- **`--font-sans` must point at `--font-geist-sans`.** `shadcn init` emitted a self-referential `--font-sans: var(--font-sans)`, which resolves to nothing and silently falls back to the browser default. Re-running init may reintroduce it.
- Clerk is themed through `appearance` variables on `<ClerkProvider>` pointing at the shadcn tokens, so it follows the active scheme without reading the theme. Do not style Clerk via its internal class names — they break on Clerk updates.

## Database

`db/` holds the persistence layer: `schema.ts` (exercises, workouts, sets), `index.ts` (the shared Drizzle client), `env.ts` (`DATABASE_URL` validation). Reachable as `@/db`.

- **Migrations are generated and committed.** `npm run db:generate` writes SQL into `drizzle/`; `npm run db:migrate` applies it. **`drizzle-kit push` is not used and no `db:push` script exists** — it diffs onto the database with no reviewable artifact.
- **`db/index.ts` and `db/env.ts` import `server-only`.** Importing `@/db` from a `"use client"` module fails the build by design; that is a spec requirement, not an accident.
- **`@neondatabase/serverless` is installed but intentionally unreferenced.** It exists so adopting a managed host later is a wiring change in `db/index.ts` rather than a dependency negotiation. Do not delete it as dead weight, and do not mistake it for the active driver — that is `node-postgres` (`pg`).
- **Interactive transactions work** (`db.transaction()`), because the driver is `node-postgres`. Neon's HTTP driver cannot do them, so switching drivers would break transactional code at runtime only. `add-credentials-auth-provider` depends on this capability.
- **`weight` uses `numeric(6,2)` with `mode: "number"`**, so it surfaces as a JS number rather than Drizzle's default string. Keep numeric columns on one mode; mixing them is how concatenation bugs appear.
- **`created_at` is immutable and database-assigned**, enforced by triggers in `drizzle/0001_created_at_immutable.sql` — a caller-supplied value is overwritten on insert and preserved on update. A `DEFAULT` alone does not do this. **drizzle-kit does not model triggers**, so `db:generate` will neither reproduce nor drop them; changing them means writing another `drizzle-kit generate --custom` migration.
- Ownership is enforced only by `where eq(table.userId, ...)` in queries. No database mechanism catches a missing predicate.

## Local development stack

`DevOps/Local/` holds the containerised backing services, **one directory per service** (`DevOps/Local/Postgres/docker-compose.yaml`). The three lifecycle scripts discover services by globbing `DevOps/Local/*/docker-compose.yaml`, so adding a service requires no script change.

- **Every service added here MUST define a healthcheck.** The scripts rely on `docker compose up --wait`, which has nothing to wait on otherwise — `up` returns exit 0 while the service may not yet be ready, silently losing the readiness guarantee for the entire stack. `all-status.sh` surfaces this as `NO HEALTHCHECK`.
- `docker-all-down.sh` preserves data. Volumes are removed only with the explicit `--destroy-data` flag.
- The Postgres credentials in the compose file are committed deliberately and are local-only; the port binds to `127.0.0.1`. Never reuse them for a deployed host.
- Changing the Postgres major image tag requires destroying the volume — a data directory cannot be read by a different major version.

## Stack and conventions

Next.js 16.3.0 App Router + React 19 + TypeScript (strict) + Tailwind CSS v4. Currently a bare `create-next-app` scaffold: `app/layout.tsx`, `app/page.tsx`, `app/globals.css` are still template content.

- **Read the bundled docs first.** `AGENTS.md` (imported above) is not boilerplate: this Next.js version diverges from older APIs and conventions. The authoritative docs ship in `node_modules/next/dist/docs/` (`01-app/` for App Router, `03-architecture/`, `index.md`). Consult them before writing routing, data-fetching, or caching code.
- **Route prop types are generated, not hand-written.** `app/layout.tsx` uses the global `LayoutProps<"/">`; pages use `PageProps<"/route">`. These come from `.next/types` and `.next/dev/types` (both in `tsconfig.json` `include`), so they only exist after a `dev`/`build` run. Don't replace them with hand-rolled interfaces.
- **Tailwind v4 is CSS-first.** There is no `tailwind.config.*`. Theme tokens live in `app/globals.css` under `@theme inline`, wired to CSS variables in `:root` (with a `prefers-color-scheme: dark` override). Add design tokens there, not in a JS config.
- **Import alias:** `@/*` resolves to the repo root (e.g. `@/app/...`).
- **`AGENTS.md` churn:** `next dev` rewrites the `<!-- BEGIN:nextjs-agent-rules -->` block in `AGENTS.md`. If it shows up as an uncommitted change, commit it alongside your work rather than reverting it.
