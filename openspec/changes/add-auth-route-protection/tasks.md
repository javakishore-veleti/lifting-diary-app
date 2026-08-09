## 1. Server-side identity accessor

- [x] 1.1 Create `lib/auth.ts` importing `server-only`
- [x] 1.2 Add `requireUserId()` that awaits `auth()` from `@clerk/nextjs/server`, throws a named error when `userId` is absent, and returns `Promise<string>` — a non-optional string, so no call site can coerce a null
- [x] 1.3 Add `getOptionalUserId()` returning `Promise<string | null>` for code that branches on session presence rather than demanding one
- [x] 1.4 Confirm `auth()` is awaited — it is async in `@clerk/nextjs` 7 and a missing await yields a truthy Promise that passes null checks
- [x] 1.5 Confirm the thrown error message names the failure without embedding request data

## 2. Authentication routes

- [x] 2.1 Create `app/sign-in/[[...sign-in]]/page.tsx` rendering Clerk's `<SignIn />`
- [x] 2.2 Create `app/sign-up/[[...sign-up]]/page.tsx` rendering Clerk's `<SignUp />`
- [x] 2.3 Confirm both use the optional catch-all segment `[[...slug]]` — a plain `page.tsx` returns 404 for every step of a multi-step flow after the first
- [x] 2.4 Verify `/sign-in` and `/sign-up` each render when navigated to directly with no prior in-app navigation
- [x] 2.5 Verify reloading while on each route re-renders rather than losing the interface
- [ ] 2.6 Verify the link from sign-in to sign-up stays within the application

## 3. Protected probe route

- [x] 3.1 Create `app/dashboard/page.tsx` as a Server Component calling `requireUserId()` and rendering the returned identifier
- [x] 3.2 Keep the content trivial — this route exists to exercise enforcement, and `add-shadcn-ui-foundation` separately plans real signed-in content

## 4. Redirect configuration

- [x] 4.1 Add `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` to `.env.local`
- [x] 4.2 Add the sign-in and sign-up **fallback** redirect variables pointing at `/dashboard`
- [x] 4.3 Confirm the fallback variables were used, not the forced-redirect ones — a forced redirect overrides the remembered destination and silently breaks deep linking while still passing a casual sign-in test
- [x] 4.4 Add all four variables to `.env.example` with these same path values; they are route paths, not secrets
- [x] 4.5 Confirm no secret is placed in a `NEXT_PUBLIC_` variable, since those reach the browser

## 5. Header controls

- [x] 5.1 Replace `<SignInButton>` and `<SignUpButton>` in `app/layout.tsx` with links to `/sign-in` and `/sign-up`
- [x] 5.2 Configure `<UserButton>`'s sign-out redirect to `/`, so a user signing out from a protected route is not left on a page they can no longer load
- [x] 5.3 Leave `<UserButton>` otherwise as-is and keep both `<Show>` blocks intact
- [x] 5.4 Note that `add-shadcn-ui-foundation` also edits this header; if that change has already landed, preserve its styling while changing the destinations

## 6. Flip to default-deny

- [x] 6.1 Confirm tasks 1–5 are complete before this group — flipping to default-deny while `/sign-in` does not yet exist makes the app unreachable, because the redirect target 404s while every other route demands a session
- [x] 6.2 In `proxy.ts`, add `createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)'])` from `@clerk/nextjs/server`
- [x] 6.3 In the `clerkMiddleware()` callback, protect any request that does not match the public list
- [x] 6.4 Confirm `(.*)` is present on both auth patterns — without it, verification and second-factor sub-paths are protected and the sign-in flow redirects to itself in a loop
- [x] 6.5 Confirm `config.matcher` is unchanged from its current contents; narrowing it stops Clerk running on public routes and breaks `/__clerk/`
- [x] 6.6 Confirm `/` is on the public list — omitting it locks every visitor out with no route left to enter through

## 7. Verify access control

- [x] 7.1 Signed out, load `/` and confirm it renders with sign-in and sign-up controls
- [x] 7.2 Signed out, request `/dashboard` and confirm redirection to `/sign-in`
- [ ] 7.3 Signed in, request `/dashboard` and confirm it renders the user identifier
- [x] 7.4 Confirm static assets, fonts, and styles load on the signed-out landing page
- [x] 7.5 Confirm the landing page still reflects signed-in state through `<Show>`, proving middleware still runs on public routes
- [ ] 7.6 Complete a multi-step sign-up including email verification, confirming no redirect loop and no 404 at any step
- [ ] 7.7 Deep link: signed out, request `/dashboard`, complete sign-in, and confirm arrival at `/dashboard` rather than `/`
- [ ] 7.8 Deep link via registration: signed out, request `/dashboard`, complete sign-up, and confirm arrival at `/dashboard`
- [ ] 7.9 Sign in from `/` with no prior destination and confirm arrival at `/dashboard`
- [ ] 7.10 Hand-craft a sign-in URL whose remembered destination points at an external origin, and confirm the user lands on `/dashboard` rather than being sent off-site
- [ ] 7.11 Sign out while on `/dashboard` and confirm arrival on a route reachable without a session
- [ ] 7.12 After signing out, navigate back to `/dashboard` and confirm redirection to sign-in rather than cached protected content
- [x] 7.13 Add a throwaway route with no configuration, confirm it requires a session, then delete it — this verifies the default-deny posture rather than assuming it

## 8. Documentation and checks

- [x] 8.1 Record in `CLAUDE.md` that routes are protected by default and new public routes must be added to the matcher in `proxy.ts`
- [x] 8.2 Record in `CLAUDE.md` that every Server Action and route handler must call `requireUserId()` as its first statement — middleware does not reliably guard them, and this is the layer that actually protects data
- [x] 8.3 Record that server code obtains identity only from `lib/auth.ts`, never from request parameters, body, or headers
- [x] 8.4 Run `npx tsc --noEmit` and confirm it passes
- [x] 8.5 Run `npm run lint` and confirm it passes
- [x] 8.6 Run `npm run build` and confirm it succeeds
