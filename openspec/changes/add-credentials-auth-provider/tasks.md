## 1. Confirm prerequisites

- [ ] 1.1 Confirm `add-drizzle-db-setup` is implemented — Drizzle, the Postgres connection, and `npm run db:generate` / `db:migrate` must all work before auth tables can exist
- [ ] 1.2 Confirm `add-auth-route-protection` is implemented — this change extends its `/sign-in` and `/sign-up` routes, its `lib/auth.ts`, and its `proxy.ts` protection rather than creating parallel versions
- [ ] 1.3 If either is unimplemented, stop and land it first; building against a guessed shape means reworking this change afterwards
- [ ] 1.4 Verify Clerk still works end to end before changing anything, establishing the baseline this change must not break

## 2. Provider resolution

- [ ] 2.1 Create `lib/provider.ts` reading `AUTH_PROVIDER`, accepting `clerk` and `credentials`, defaulting to `clerk` when unset
- [ ] 2.2 Throw at startup on an unrecognised value, naming the variable and listing accepted values
- [ ] 2.3 Do **not** use a `NEXT_PUBLIC_` name — it would inline into the client bundle at build time and freeze the provider at build rather than per environment
- [ ] 2.4 Validate the selected provider's required configuration at startup: Clerk keys for `clerk`; `DATABASE_URL` and the Resend key for `credentials`
- [ ] 2.5 Confirm there is no fallback path — an invalid configuration must prevent startup, never start with authentication disabled
- [ ] 2.6 Verify: set `AUTH_PROVIDER=credentials` with no Resend key and confirm startup fails naming it

## 3. Auth tables and migration

- [ ] 3.1 Install `better-auth` and its Drizzle adapter
- [ ] 3.2 Generate Better Auth's table definitions into `db/schema.ts` so they share one migration history with the training tables
- [ ] 3.3 Run `npm run db:generate` and review the generated SQL by hand
- [ ] 3.4 Run `npm run db:migrate` and confirm the auth tables exist
- [ ] 3.5 Confirm no auth table collides in name with `exercises`, `workouts`, or `sets`
- [ ] 3.6 Confirm `db.transaction()` works before relying on it — `add-drizzle-db-setup` uses `node-postgres`, which supports it, but verify rather than assume since the auth flows depend on it

## 4. Email delivery

- [ ] 4.1 Install `resend`, obtain an API key, and verify a sender address
- [ ] 4.2 Add `RESEND_API_KEY` and the sender address to `.env.local` and placeholders to `.env.example`
- [ ] 4.3 Create `lib/email.ts` with verification and password-reset templates, each containing a single-use link into this application and no password
- [ ] 4.4 Propagate send failures to the caller rather than swallowing them; a silent failure leaves an account permanently unverifiable with no signal to anyone
- [ ] 4.5 Verify a real verification email arrives, and that a deliberately invalid API key produces a surfaced error with a retry rather than a success message

## 5. Better Auth server and endpoint

- [ ] 5.1 Create `lib/auth-server.ts` configuring Better Auth with the Drizzle adapter, email/password enabled, and the email sender from `lib/email.ts`
- [ ] 5.2 Require email verification before protected access
- [ ] 5.3 Enable database-backed sessions with a bounded lifetime; confirm cookies are http-only, same-site restricted, and secure outside local development
- [ ] 5.4 Enable session invalidation on password reset — this is not universally default
- [ ] 5.5 Configure rate limiting for sign-in, registration, verification-resend, and reset-request, persisted in the database rather than in memory, since per-invocation counters limit nothing in serverless
- [ ] 5.6 Enable enumeration-resistant responses so known and unknown addresses are indistinguishable
- [ ] 5.7 Configure reset links to point into the `/sign-in` tree, matching where Clerk places its reset steps
- [ ] 5.8 Create `app/api/auth/[...all]/route.ts` mounting the handler
- [ ] 5.9 Add the auth API path to the public matcher in `proxy.ts` — sign-in requests arrive with no session by definition, so default-deny would otherwise reject the endpoint that creates sessions. Symptoms otherwise look like a broken form, not a routing problem
- [ ] 5.10 Create `lib/auth-client.ts` for the credentials forms

## 6. Credentials interfaces at Clerk's locations

- [ ] 6.1 Create the credentials sign-in form in `components/auth/`, using shadcn components if `add-shadcn-ui-foundation` has landed
- [ ] 6.2 Create the credentials registration form with the password policy stated in the interface, not only on rejection
- [ ] 6.3 Create the forgot-password request form and the reset form
- [ ] 6.4 Make `app/sign-in/[[...sign-in]]/page.tsx` render Clerk's `<SignIn />` or the credentials form based on the flag, as a Server Component
- [ ] 6.5 Make `app/sign-up/[[...sign-up]]/page.tsx` render the equivalent for registration
- [ ] 6.6 Place the reset flow on `/sign-in` sub-paths — reached from within the sign-in interface, matching Clerk. Do **not** add a sibling `/forgot-password` route, which would exist under one provider only and break the identical-locations requirement
- [ ] 6.7 Verify both providers serve `/sign-in` and `/sign-up` at the same URLs, and that a URL bookmarked under one resolves under the other

## 7. Identity seam

- [ ] 7.1 Modify `lib/auth.ts` so `requireUserId()` and `getOptionalUserId()` branch internally on the flag — Clerk's `auth()` on one side, Better Auth's session lookup on the other
- [ ] 7.2 Keep both signatures unchanged; `requireUserId(): Promise<string>` must still throw when no session exists
- [ ] 7.3 Prefix local identifiers so they cannot collide with Clerk's `user_...` values, making cross-provider ownership overlap structurally impossible rather than merely unlikely
- [ ] 7.4 Confirm `lib/auth.ts` is the only module referencing the flag for identity purposes
- [ ] 7.5 Verify no data-access code references a provider or branches on the flag
- [ ] 7.6 Verify protected routes redirect signed-out users to `/sign-in` under both providers

## 8. Header parity

- [ ] 8.1 Render provider-conditional header subtrees in fixed positions: sign-in and sign-up links to the same routes under both providers
- [ ] 8.2 Render Clerk's `<UserButton>` or a credentials account menu with sign-out in the same position
- [ ] 8.3 Determine signed-in state for the credentials branch from `getOptionalUserId()` in the Server Component — `<Show>` is Clerk-specific and unavailable
- [ ] 8.4 Verify the header is positionally identical under both providers, signed in and signed out

## 9. Verify credentials flows

- [ ] 9.1 Register with an unused address; confirm the account is created and a verification email arrives
- [ ] 9.2 Attempt sign-in before verifying; confirm protected access is refused and a resend option is offered
- [ ] 9.3 Follow the verification link; confirm access is granted, then reuse the link and confirm it is refused
- [ ] 9.4 Register with an address differing only in letter casing; confirm no second account is created
- [ ] 9.5 Register with an existing address; confirm the response matches the new-address response and that the owner is notified instead of the visitor being told the account exists
- [ ] 9.6 Sign in with correct credentials; confirm a session and arrival at the signed-in destination
- [ ] 9.7 Sign in with a wrong password and with an unknown address; confirm the messages are identical
- [ ] 9.8 Compare response timing for wrong-password against unknown-address and confirm no reliable difference
- [ ] 9.9 Request a reset for a known address and an unknown one; confirm identical responses and that only the known one sends mail
- [ ] 9.10 Complete a reset; confirm the new password works and the old one does not
- [ ] 9.11 Reuse the reset link and confirm refusal with no password change
- [ ] 9.12 Request a second reset before using the first; confirm the newer token works and the earlier one stops being accepted
- [ ] 9.13 Complete a reset while a session is active on another browser; confirm that session loses protected access
- [ ] 9.14 Sign out, then present the previous session cookie again and confirm access is not restored
- [ ] 9.15 Delete a session row while its cookie is still held and confirm access stops
- [ ] 9.16 Exceed the sign-in rate limit; confirm refusal, that it persists even with the correct password, and that it does not reveal whether the address exists
- [ ] 9.17 Exceed the reset-request rate limit; confirm refusal and that no further mail is sent

## 10. Verify stored data

- [ ] 10.1 Inspect the accounts table and confirm no password is present in plaintext or reversible form
- [ ] 10.2 Create two accounts with identical passwords and confirm the stored hashes differ
- [ ] 10.3 Inspect stored reset tokens and confirm no usable token value is readable — a leaked table must not permit resetting a password
- [ ] 10.4 Confirm no authentication log or error message contains a submitted password

## 11. Verify provider selection

- [ ] 11.1 With `AUTH_PROVIDER` unset, confirm Clerk is active
- [ ] 11.2 With `credentials` selected, confirm Clerk components are not mounted and its interfaces are unreachable
- [ ] 11.3 With `clerk` selected, confirm the credentials endpoints accept neither registrations nor sign-in attempts
- [ ] 11.4 Set an unrecognised value and confirm startup fails listing the accepted values
- [ ] 11.5 Create records under one provider, switch, and confirm they are not served to any account of the newly active provider
- [ ] 11.6 Confirm no misconfiguration causes the app to start and serve protected routes without authentication

## 12. Documentation and checks

- [ ] 12.1 Document in `README.md` how to select a provider and what configuration each requires
- [ ] 12.2 Record in `CLAUDE.md` that `lib/auth.ts` is the only place the provider flag may be read for identity, and that feature code must never branch on it
- [ ] 12.3 Record that reset URLs under `/sign-in` are embedded in delivered email and must not be casually restructured
- [ ] 12.4 State plainly in `README.md` that no automated tests guard these security properties, so auth-touching changes require re-running the group 9 and 10 checks by hand
- [ ] 12.5 Run `npx tsc --noEmit` and confirm it passes
- [ ] 12.6 Run `npm run lint` and confirm it passes
- [ ] 12.7 Run `npm run build` and confirm it succeeds under both provider settings
