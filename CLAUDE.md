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
