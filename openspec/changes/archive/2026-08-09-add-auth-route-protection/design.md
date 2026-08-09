## Context

See `proposal.md` — Why. Design-relevant constraints only:

- **`proxy.ts` already exists** with `clerkMiddleware()` taking no arguments, and a matcher that excludes Next.js internals and static files while explicitly including `/__clerk/:path*` and `/(api|trpc)(.*)`. That matcher is correct and must not be narrowed; protection belongs in the middleware body.
- **Next.js 16 names this file `proxy.ts`**, not `middleware.ts`. The export shape is otherwise unchanged.
- **`@clerk/nextjs` ^7.7.0.** `auth()` from `@clerk/nextjs/server` is async and must be awaited. This version uses `<Show when="signed-in">` rather than the deprecated `<SignedIn>`.
- **`app/layout.tsx` currently renders `<SignInButton>` and `<SignUpButton>` as modal triggers** inside a `<Show when="signed-out">` header block. Those become navigation.
- **Only `app/page.tsx` exists.** There is no protected route yet, so enforcement has nothing to act on until this change adds one.
- **No test framework.** Verification is manual plus `npx tsc --noEmit`, `npm run lint`, `npm run build`.

This design covers a security boundary and a change in default posture, so it qualifies for a design document.

## Goals / Non-Goals

**Goals:**

- A protected-by-default posture where forgetting to configure a route fails closed.
- Two independent enforcement layers, so a gap in either does not expose data on its own.
- One accessor that server code uses for identity, which cannot silently yield nothing.
- Destination preservation through the authentication detour.

**Non-Goals:**

- Roles, permissions, or organizations. Every authenticated user has identical access. Clerk supports organizations; adopting them is a separate decision.
- Row-level authorization. This change establishes *who* the user is; ensuring queries filter to that user belongs to the data layer, as `add-drizzle-db-setup` records.
- Styling the sign-in and sign-up pages beyond Clerk's defaults. `add-shadcn-ui-foundation` owns appearance.
- Real dashboard content. `/dashboard` exists to prove enforcement.
- Rate limiting, bot protection, or session-duration policy — all configured in the Clerk dashboard, not in code.

## Decisions

### Default-deny via `createRouteMatcher` over a public list

The middleware body matches the request against a list of public routes and calls Clerk's protection for everything else:

```
const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)'])
```

The inversion is the whole point. A default-allow list of protected prefixes fails open — forget to add `/workouts` and it is silently public, with nothing in the type system or the build to catch it. Default-deny fails closed: forget to list a new public page and it demands a session, which is immediately visible the first time anyone loads it. A noisy failure beats a silent exposure.

*Alternative considered.* Per-route protection using `auth.protect()` in each page. Rejected as the primary mechanism for the same fail-open reason — protection you must remember per file is protection that gets forgotten — though it remains the second layer below.

### `(.*)` suffixes on the auth routes

`/sign-in(.*)` rather than `/sign-in`. Clerk's catch-all routes serve sub-paths for verification steps, factor-two prompts, and SSO callbacks. Matching only the exact path leaves those sub-paths protected, so the middleware redirects the sign-in flow to sign-in — a loop that presents as the page reloading endlessly.

This is the most likely way to get the matcher subtly wrong, because the initial page loads fine and only multi-step flows break.

### Protection logic in the body, never by narrowing the matcher

The existing `config.matcher` stays byte-for-byte as it is. The `isPublicRoute` check goes inside the middleware callback.

Narrowing the matcher to only protected paths seems equivalent and is not: the matcher decides whether middleware *runs at all*, and Clerk needs it to run on public routes too in order to populate session state for `<Show>` and `auth()`. It also governs `/__clerk/:path*`, Clerk's own auto-proxy path — excluding that breaks authentication outright.

### Catch-all routes for sign-in and sign-up

`app/sign-in/[[...sign-in]]/page.tsx` and `app/sign-up/[[...sign-up]]/page.tsx`, each rendering Clerk's `<SignIn />` / `<SignUp />`.

The optional catch-all segment is required, not stylistic: Clerk routes its multi-step flows through sub-paths beneath these URLs, and a plain `page.tsx` returns 404 for every step after the first. This pairs with the `(.*)` matcher decision above — both exist for the same reason and omitting either breaks the same flows.

### Redirect configuration through environment variables

Destination behaviour is set with `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, and the fallback-redirect variables pointing at `/dashboard`.

Environment variables over props on the components: the values are read by `clerkMiddleware()` and by Clerk's components alike, and defining them once avoids the failure where middleware redirects to one URL while a component's prop points elsewhere.

The `fallback` redirect variables are deliberately chosen over the older forced-redirect ones. Fallback applies *only* when no destination was remembered, which is what the spec requires — a forced redirect would override the remembered destination and break deep linking, satisfying the "signing in from the landing page" scenario while failing the "deep link while signed out" one.

*Consequence.* These are `NEXT_PUBLIC_` variables and reach the browser. They are route paths, not secrets, so this is fine — but it means they must not be repurposed to carry anything sensitive.

### Destination preservation is delegated to Clerk, and its trust boundary noted

Clerk's middleware appends the original path as a query parameter on the sign-in redirect and returns the user there afterwards. No custom logic is written.

The spec requires that a destination pointing outside the application be discarded. Clerk validates redirect targets against its configured allowed origins, so this is satisfied by the library rather than by our code — but it is satisfied by *configuration*, which makes it worth verifying rather than assuming. The task list checks it explicitly with a hand-crafted external destination.

### A `requireUserId()` accessor that throws, plus a non-throwing companion

Two functions in `lib/auth.ts`:

- `requireUserId()` — awaits `auth()`, throws a named error if `userId` is absent, otherwise returns it as a non-optional `string`.
- `getOptionalUserId()` — returns `string | null` for code that branches on session presence.

The throwing variant is the important one, and the reason is the type signature. `auth()` yields `userId: string | null`, so every call site must handle null; the ones that handle it by coercing (`userId!`, `userId ?? ''`) produce queries scoped to an empty owner, which silently return or write the wrong rows. `requireUserId(): Promise<string>` removes the null from the type, so there is nothing to coerce and the unsafe path stops being expressible.

Splitting out the non-throwing variant keeps callers from reaching back to raw `auth()` when they legitimately need to branch — which would reintroduce the nullable type they were meant to avoid.

Both import `server-only`. `add-drizzle-db-setup` establishes the same boundary for `db/`; identity deserves it for the same reason.

*Alternative considered.* A single function returning `string | null` and trusting callers. Rejected: that is what `auth()` already is, and it is precisely the shape that invites unsafe coercion.

### Both layers enforce, and the reason is Server Actions

Middleware guards navigations. It does not reliably guard Server Actions, which post to the page's own path and can be invoked by a crafted request, nor route handlers reached by a path the matcher does not cover.

So every Server Action and route handler calls `requireUserId()` as its first statement. Middleware is the outer boundary that produces good redirects for humans; the accessor is the inner boundary that actually protects data. Treating middleware as sufficient is the single most common way Next.js applications leak — the protection looks present in review and is absent at the only layer that matters.

### `/dashboard` as the enforcement probe

A minimal Server Component that calls `requireUserId()` and renders the identifier. It exists so the spec's scenarios can be executed rather than reasoned about — signed-out redirect, deep-link return, sign-out behaviour, and the accessor's throwing path all need a protected route to act on.

Content is intentionally trivial; `add-shadcn-ui-foundation` separately plans a signed-in dashboard panel on the landing page, and reconciling the two is later work.

### Header controls navigate rather than open modals

`<SignInButton>` and `<SignUpButton>` are replaced with links to `/sign-in` and `/sign-up`. Keeping the modals alongside dedicated routes would mean two flows with different destination-preservation behaviour — the modal has no notion of a remembered destination — and inconsistency there is a bug that only appears on deep links.

`<UserButton>` stays as-is; it is a menu, not an auth entry point. Its sign-out target is configured to a public route so the spec's sign-out scenario holds — the default would leave a signed-out user on a page they can no longer load, which presents as a redirect immediately after signing out.

### File layout

```
lib/auth.ts                          # requireUserId, getOptionalUserId; imports server-only
app/sign-in/[[...sign-in]]/page.tsx
app/sign-up/[[...sign-up]]/page.tsx
app/dashboard/page.tsx
proxy.ts                             # modified: public-route matcher
```

`lib/` at the repo root, reachable via the existing `@/*` alias. `add-shadcn-ui-foundation` also creates `lib/` for its `cn()` helper; the two coexist as separate files.

## Risks / Trade-offs

**Auth routes matched without `(.*)`** → Multi-step flows (email verification, second factor, SSO callback) redirect to sign-in from inside sign-in, producing an endless reload. Mitigation: the matcher uses `(.*)`, and the task list tests a multi-step flow rather than only the first page load, since a single-step sign-in hides this entirely.

**Matcher narrowed instead of body-checked** → Clerk stops running on public routes, so `<Show>` misreports state and `/__clerk/` breaks. Mitigation: the existing `config.matcher` is left untouched, and the task list verifies the landing page still reflects signed-in state.

**Middleware treated as sufficient** → Server Actions remain callable without a session, so data is reachable even though every page redirects correctly. This is the highest-severity risk here, and it is invisible in manual browser testing because the UI behaves properly. Mitigation: `requireUserId()` as the first statement in every action and handler, recorded as a convention in `CLAUDE.md` so it survives beyond this change.

**Forced-redirect variables used instead of fallback** → Deep linking silently breaks: users always land on `/dashboard` regardless of where they were headed. Passes casual testing, fails the spec. Mitigation: the fallback variables are specified by name, and the deep-link scenario is a distinct task.

**Landing page must stay public** → It is currently the only page. Omitting `/` from the public list locks every visitor out of the application entirely, with no way in. Mitigation: `/` is first on the list, and the signed-out landing check is an early task.

**Header conflict with `add-shadcn-ui-foundation`** → Both changes edit the same header block for different reasons. Mitigation: whichever lands second reconciles by hand. The changes are small and adjacent, not overlapping in intent — one changes appearance, the other changes destinations.

**Sign-out target left at the default** → The user signs out on a protected route, cannot load it, and is bounced — correct in outcome but jarring. Mitigation: configure the sign-out redirect to `/` explicitly.

**No authorization beyond authentication** → Every signed-in user has identical access. Acceptable for a single-user-per-account diary and stated as a Non-Goal, but it means this change must not be read as protecting one user's data from another. That protection lives in query filtering, in the data layer.

## Migration Plan

No data migration. No existing users are affected, since nothing is currently protected and the app has no production deployment.

Rollout: add `lib/auth.ts`, add the auth routes, add `/dashboard`, set the environment variables, then change `proxy.ts` last. Ordering matters — flipping to default-deny before `/sign-in` exists makes the app unreachable, since the redirect target would 404 while every other route demands a session.

Rollback: revert `proxy.ts` to argument-free `clerkMiddleware()`, which restores default-allow. The routes and helper are additive and harmless if left. Reverting the whole commit is also clean; no persisted state is involved beyond Clerk-side session cookies, which expire on their own.

## Open Questions

- **Where signed-in users should land by default.** `/dashboard` is the placeholder. Once real screens exist the answer may be a workout list or today's session. Changing it is one environment variable and alters no code.
- **Whether the landing page stays public once the product matures.** Some diary apps redirect signed-in visitors straight past it. This is a product decision that does not change the mechanism — only the public list's contents.
