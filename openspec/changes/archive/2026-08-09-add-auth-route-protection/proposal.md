## Why

Clerk is installed and users can sign in, but nothing in the application requires them to. `clerkMiddleware()` is invoked with no arguments, which by design leaves every route public, and no code anywhere calls `auth()`. The result is authentication that identifies users without restricting anything — a signed-out visitor reaches every route, and no server-side code can name the current user.

This blocks the features the product exists for. A training diary is inherently per-user: `add-drizzle-db-setup` keys every row to a Clerk `userId`, and without a trustworthy server-side way to obtain that identity, there is nothing to key rows to and no way to prevent one user's queries from reading another's data.

## What Changes

- Switch route protection from default-allow to default-deny: every route requires an authenticated session unless it appears on an explicit public list. **BREAKING** for any future route — a newly added route is protected until deliberately opened, reversing the current behaviour where it is public until deliberately closed.
- Define the public surface as the landing page and the authentication routes themselves. Everything else requires a session.
- Add dedicated `/sign-in` and `/sign-up` routes so unauthenticated users can be redirected to an in-application page rather than leaving the app, and so authentication URLs are linkable and survive a full page load.
- Add a server-side identity helper that returns the current user's identifier and refuses to return in an unauthenticated context, giving data-access code a single trustworthy source of identity rather than each call site consulting Clerk directly.
- Preserve the user's intended destination across sign-in, so a user sent to authenticate arrives where they were originally headed rather than at a generic landing page.
- Add a `/dashboard` route as the first protected page, so enforcement is exercised end to end rather than asserted.
- Update the header so its sign-in and sign-up controls navigate to the new routes.

## Capabilities

### New Capabilities

- `access-control`: Which parts of the application require an authenticated session, how unauthenticated requests to them are handled, how the user's intended destination survives authentication, and how server-side code obtains the current user's identity in a way it can rely on.

### Modified Capabilities

None. `data-persistence` and `training-log` (proposed in `add-drizzle-db-setup`) and `design-system` and `theming` (proposed in `add-shadcn-ui-foundation`) are all unimplemented and unchanged by this proposal. See Impact for how this change relates to them.

## Impact

**Dependencies added:** none. `@clerk/nextjs` ^7.7.0 is already installed; this change uses `createRouteMatcher` and `auth()` from `@clerk/nextjs/server`, both already available.

**New code:** `app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx`, `app/dashboard/page.tsx`, and a server-side auth helper module.

**Modified files:** `proxy.ts` (route protection logic), `app/layout.tsx` (header controls navigate rather than open modals), `.env.local` and `.env.example` (Clerk redirect URL variables), `CLAUDE.md` (the default-deny convention).

**Security posture:** this is the change that makes authentication load-bearing. Until it lands, any route added to the app is publicly reachable. Middleware protection is the outer boundary; the server-side helper is the inner one, and both are required — middleware alone does not protect Server Actions or route handlers invoked outside a matched path.

**Relationship to `add-drizzle-db-setup`:** that change's design records "ownership enforced only in application queries" as its principal risk, mitigated by centralising access behind functions that take `userId` as a required parameter. The helper proposed here is the trustworthy source of that `userId`. Neither change depends on the other to land first, but the data layer is not safe to expose to users until both have.

**Relationship to `add-shadcn-ui-foundation`:** both modify the header in `app/layout.tsx` — that change restyles its controls, this one changes what they do. They touch adjacent concerns in the same markup and whichever applies second will need to reconcile the header by hand.

**Constraint worth flagging:** the existing `proxy.ts` matcher deliberately excludes static files and Next.js internals. Protection logic must be added inside the middleware body rather than by narrowing that matcher, or static assets and Clerk's own auto-proxy path will start requiring a session and the sign-in page will be unable to load its own resources.
