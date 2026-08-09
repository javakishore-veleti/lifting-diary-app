## Context

See `proposal.md` — Why. Design-relevant constraints only:

- **Clerk is implemented and working.** `@clerk/nextjs` ^7.7.0, `<ClerkProvider>` in `app/layout.tsx`, `clerkMiddleware()` in `proxy.ts`. This change must not break it — it remains the default path.
- **`add-auth-route-protection` is planned, unimplemented.** It defines `/sign-in` and `/sign-up` catch-all routes, `lib/auth.ts` with `requireUserId()`, and default-deny protection in `proxy.ts`. This change extends those files rather than inventing parallel ones, so that change should land first — if it does not, this change must create them, doing that work anyway.
- **`add-drizzle-db-setup` is planned, unimplemented.** It supplies Drizzle, the Postgres connection, and the migration workflow this change needs for its tables. Hard dependency.
- **Next.js 16 App Router, React 19, TypeScript strict.** Middleware lives in `proxy.ts`. `auth()` from Clerk is async.
- **No test framework.** Every security property in the specs is verified by hand, once, and has nothing guarding it afterwards. This is the single most uncomfortable fact about this change.

This design covers a new external dependency, new data model, a security boundary, and a branching architecture, so it plainly warrants a design document.

## Goals / Non-Goals

**Goals:**

- A provider seam narrow enough that feature code never learns which provider is active.
- Identical routes and interface positions under both providers, as the specs require.
- Security properties that a hosted provider gave away for free, held explicitly and verifiably.
- Failing closed on misconfiguration — never degrading to unauthenticated operation.

**Non-Goals:**

- Migrating accounts between providers. Switching is an environment-level decision, not a user-facing account move.
- Running both providers at once, or federating identities across them.
- Social or OAuth sign-in. Email and password only.
- Multi-factor authentication, passkeys, or magic links.
- Styling beyond what `add-shadcn-ui-foundation` provides; the credentials forms use its components.
- Replacing Clerk. It stays the default.

## Decisions

### Better Auth with its Drizzle adapter

Better Auth supplies email/password registration, email verification, password reset, and database-backed sessions, with a Drizzle adapter that generates and owns its tables in the same Postgres database as the training data.

The alternative that matters is how much security code gets hand-written. Auth.js's Credentials provider deliberately implements none of password verification, reset tokens, or verification email, and its default JWT sessions cannot be revoked server-side — which the specs require. Choosing it would mean writing exactly the code most likely to be subtly wrong. A fully hand-rolled implementation means writing more of it still.

*Consequence.* Better Auth owns its table shapes. Those tables are generated into `db/schema.ts` and migrated through the workflow `add-drizzle-db-setup` establishes, so there is one migration history rather than two.

*Transactions are available.* `add-drizzle-db-setup` uses `node-postgres` against local Postgres, so `db.transaction()` works and Better Auth's multi-row flows need no workaround. This was not always true — an earlier plan for that change used Neon's HTTP driver, which cannot do interactive transactions, and the switch to local Postgres removed the constraint. The dependency runs the other way now: adopting a managed host later must not silently reintroduce it, which is why that change records the same warning against activating Neon's HTTP driver.

### A server-side provider flag, deliberately not `NEXT_PUBLIC_`

`AUTH_PROVIDER` with values `clerk` (default) and `credentials`, read only on the server.

The temptation is `NEXT_PUBLIC_CLERK_ENABLED` so client components can branch. Rejected for two reasons. `NEXT_PUBLIC_` values are inlined into the client bundle at build time, so the provider would be frozen at build rather than configurable per environment. And branching in client components is unnecessary: `app/layout.tsx` and both auth pages are Server Components, so they can read a server-only variable and render the correct subtree. The client receives only the outcome.

*Consequence.* Changing providers requires a server restart, not a rebuild. That is the better trade.

The flag is validated at startup alongside the provider's required configuration, in the module that already validates `DATABASE_URL`.

### Fail closed on misconfiguration, with no fallback

If the selected provider's configuration is incomplete, startup throws. There is deliberately no fallback to the other provider and no "auth disabled" mode.

A fallback is the dangerous convenience here: a deploy with a typo'd `AUTH_PROVIDER` or a missing Clerk key would silently start with no authentication, serving every protected route to anyone, and would look healthy. Refusing to start turns a silent security failure into an obvious deployment failure.

This is also why the credentials provider requires the email service at startup rather than at first send. Without it, registration succeeds and then no one can verify or recover an account — a broken state discovered only by users.

### The seam lives in `lib/auth.ts`, and nowhere else

`requireUserId()` and `getOptionalUserId()` gain an internal branch on the flag: Clerk's `auth()` on one side, Better Auth's session lookup on the other. Their signatures do not change — `requireUserId(): Promise<string>` still throws when there is no session.

This is the whole architectural point. The specs require that data-access code contain no provider reference and no branch on the flag. Concentrating the branch in one module means the seam is auditable by reading one file, and the rest of the codebase is written against a single accessor that existed before this change and behaves identically after it.

*Alternative considered.* A provider interface with two implementations selected by a factory. Rejected as ceremony: there are exactly two providers, one branch point, and no third implementation in prospect. An interface would spread the seam across more files than it consolidates.

### Prefixed user identifiers to guarantee non-collision

Local identifiers are stored with a distinguishing prefix, so they cannot coincide with Clerk's `user_...` identifiers.

The specs require that records owned under one provider never be served to an account under the other. Both providers produce opaque strings into the same `user_id text` column, and while collision between a Clerk ID and a UUID is vanishingly unlikely, "unlikely" is the wrong standard for a cross-tenant data leak. A structural prefix makes it impossible rather than improbable, and makes a row's origin readable during debugging.

### Route composition: one route, provider-conditional content

`app/sign-in/[[...sign-in]]/page.tsx` stays the single sign-in route. As a Server Component it reads the flag and renders either Clerk's `<SignIn />` or the credentials sign-in form. Same for sign-up.

The catch-all segment already required by Clerk is now doubly useful: it lets the credentials reset flow live on sub-paths of `/sign-in` — `/sign-in/forgot-password` and `/sign-in/reset-password` — which is where Clerk puts its own reset steps.

This directly satisfies the spec requirement that reset be reached from within the sign-in interface under both providers. A sibling `/forgot-password` route was rejected precisely because Clerk has no such route, so adding one would create a location that exists under one provider only — the thing the requirement forbids.

*Consequence.* The reset link emailed to users points into the `/sign-in` tree. That URL is baked into sent messages, so it should not be casually restructured later; old emails would break.

### Better Auth's handler mounted under a route that middleware permits

Better Auth needs a catch-all API route. Its path must be added to the public matcher in `proxy.ts` — sign-in and registration requests arrive with no session by definition, and default-deny would otherwise reject the very endpoint that establishes sessions.

This is a likely first failure: the forms submit, the endpoint 302s to `/sign-in`, and nothing indicates why.

### Header parity through a small pair of components

The header renders provider-conditional subtrees in fixed positions: signed-out shows sign-in and sign-up links to the same routes under both providers; signed-in shows Clerk's `<UserButton>` or a credentials account menu with sign-out.

Only the rendered component differs; positions and destinations do not. `<Show>` is Clerk-specific, so the credentials branch determines signed-in state from `getOptionalUserId()` in the Server Component rather than a client-side equivalent.

### Security controls, and where each lives

- **Password hashing** — Better Auth's default (a slow salted KDF). Not overridden; a hand-tuned alternative is a way to get this wrong for no gain.
- **Rate limiting** — Better Auth's built-in limiter, configured for sign-in, registration, verification-resend, and reset-request. Persisted in the database, since in-memory counters reset per serverless invocation and would not limit anything.
- **Enumeration resistance** — registration and reset-request return identical responses for known and unknown addresses. Better Auth supports this; it must be explicitly enabled, as informative defaults are the norm. The spec's "registering an existing address notifies the owner instead of the visitor" behaviour is the deliberately unintuitive part and is easy to drop by accident.
- **Reset tokens** — single-use, expiring, stored hashed. Verified by inspecting the table, because a library storing them in plaintext is a real possibility and not visible from behaviour.
- **Session invalidation on reset** — must be explicitly enabled; not universally default.
- **Timing equivalence** — hashing runs even for unknown addresses, so response time does not distinguish them.

### Email through Resend

HTTP API rather than SMTP, which suits serverless where long-lived connections do not. One dependency, one API key.

Delivery failures propagate to the user rather than being swallowed: a silent failure presents as an account permanently stuck unverified, with no signal to anyone. The specs require surfacing it.

*Consequence.* Local development needs a real Resend key and a verified sender, or verification and reset cannot be exercised. There is no offline path — accepted as the cost of a real delivery mechanism, and mitigated by Resend's test-mode addresses.

### File layout

```
lib/
  auth.ts              # modified: provider-conditional identity accessor
  auth-server.ts       # Better Auth configuration
  auth-client.ts       # Better Auth client for the credentials forms
  email.ts             # Resend sender, verification and reset templates
  provider.ts          # AUTH_PROVIDER validation and resolution
app/
  api/auth/[...all]/route.ts
  sign-in/[[...sign-in]]/page.tsx    # modified: provider-conditional
  sign-up/[[...sign-up]]/page.tsx    # modified: provider-conditional
components/auth/                      # credentials forms
db/schema.ts           # modified: Better Auth tables
```

## Risks / Trade-offs

**No test suite guards any of this** → Every security property is verified once by hand and then unguarded. A later refactor can silently remove enumeration resistance or session invalidation, and nothing will fail. This is the most serious risk in the change and it has no adequate mitigation within the current scope; the honest recommendation is that a test framework precede exposing credentials auth to real users.

**Two authentication paths, permanently** → A defect fixed in one is not fixed in the other, and every future auth-touching feature needs verifying twice. Mitigation: the seam is one module, and the specs are written provider-neutrally so both paths are checked against the same scenarios. The deeper mitigation is deciding, eventually, that one provider wins.

**The credentials path is the less-travelled one** → Clerk is the default, so in practice the credentials path gets exercised less and its defects surface later. Mitigation: verify both paths in the task list rather than only the default.

**Enumeration resistance quietly regresses** → It depends on non-default configuration and on responses being identical, which is invisible unless specifically probed. Mitigation: distinct verification tasks comparing known and unknown addresses for both message text and response timing.

**Middleware blocks the auth endpoint** → Symptoms look like a broken form rather than a routing problem. Mitigation: the auth API path is added to the public matcher as an explicit, early task.

**Email is an availability dependency of authentication** → Resend being down means no one can register or recover. Mitigation: surface failures with a retry rather than reporting false success; accept that this is inherent to self-hosted credentials.

**A future managed-host switch could remove transactions from under this change** → Once auth flows rely on `db.transaction()`, moving the database to Neon's HTTP driver breaks them at runtime, in production, in flows that were verified locally. Mitigation: `add-drizzle-db-setup` records this against its deferred host decision; any host adopted after this change lands must support interactive transactions.

**Reset URLs are embedded in sent email** → Restructuring the `/sign-in` tree later breaks links already delivered. Mitigation: treat those paths as a published contract.

**Depends on two unimplemented changes** → Building on `add-drizzle-db-setup` and `add-auth-route-protection` before either lands means guessing at their final shape. Mitigation: land them first; the task list opens by verifying both.

## Migration Plan

No data migration — no accounts exist under the credentials provider.

Ordering is a hard constraint, not a preference: `add-drizzle-db-setup`, then `add-auth-route-protection`, then this change. Within it: provider resolution and validation, then the Better Auth tables and migration, then the auth handler and its middleware exemption, then the forms, then the identity seam, then the header. Clerk stays default throughout, so the app keeps working while the credentials path is built alongside.

Rollback: set `AUTH_PROVIDER=clerk`, which is also the default when unset. The credentials tables and code are inert while Clerk is active, so no revert is needed for safety — only to remove the code. Any accounts registered under the credentials provider become unreachable but are not destroyed.

## Open Questions

- **Password strength policy specifics.** The specs require a policy and that its requirements be stated to the user; the exact minimum length and composition rules are a product decision that changes no structure.
- **Session lifetime and whether it slides on activity.** Better Auth's defaults are adopted initially. Tuning affects configuration only.
- **Whether Clerk remains the default long term.** Deferred deliberately — the seam makes reversing it a one-variable change, and the answer depends on how the credentials path holds up in practice.
