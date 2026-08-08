## Why

Authentication is currently possible only through Clerk, a hosted third party. That means user accounts live outside the application's own database, the sign-in experience depends on an external service being reachable, and running the app — locally, in CI, or in a course or demo setting — requires provisioning a Clerk workspace and holding valid keys.

An application-owned alternative removes that dependency: accounts, credentials, and sessions live in the same Postgres database as the training data, and the app can run and be developed against with no external identity provider. Keeping Clerk available behind a toggle means neither path has to be abandoned, and the choice can be made per environment rather than once for the project.

## What Changes

- Add a feature toggle selecting the active authentication provider. Clerk is the default; when the toggle is off, the application's own credentials provider is used instead. Exactly one provider is active at a time.
- Add application-owned authentication backed by Postgres tables: registration with email and password, sign-in, email verification, forgot-password request, and password reset.
- Mount the credentials flows at **the same locations Clerk occupies today** — the same `/sign-in` and `/sign-up` routes, the same header controls, and password reset reached from within the sign-in interface rather than from a separate sibling route. Switching providers changes what renders, never where a user goes to find it.
- Add transactional email delivery for verification and password-reset messages, which the credentials provider requires and Clerk previously handled on the application's behalf.
- Add security controls that a hosted provider supplied implicitly: password hashing, database-backed sessions that can be revoked, single-use expiring reset tokens stored hashed, rate limiting on sign-in and reset requests, and identical responses for known and unknown email addresses so accounts cannot be enumerated.
- Make the server-side identity accessor provider-agnostic, so data-access code obtains a user identifier without knowing which provider produced it.

## Capabilities

### New Capabilities

- `credentials-auth`: The application's own authentication provider — how accounts are registered, how credentials are stored and verified, how email addresses are confirmed, how a forgotten password is recovered, how sessions are issued and ended, and the abuse-resistance properties these flows must hold.
- `auth-provider-selection`: How the application chooses which authentication provider is active, the requirement that both providers present their flows at identical locations, and how the rest of the application obtains user identity without depending on which provider is in use.

### Modified Capabilities

None. `access-control` (proposed in `add-auth-route-protection`) is written in terms of authenticated sessions and identity rather than naming Clerk, so its requirements hold unchanged for either provider — the credentials provider must satisfy that existing spec rather than alter it. It is not yet in `openspec/specs/`, so there is nothing to write a delta against.

## Impact

**Depends on `add-drizzle-db-setup`.** This is the first change in this project with a hard ordering dependency: authentication tables need Drizzle and a Postgres connection, so that change (currently 0/40) must land first. The other three open changes remain order-independent.

**Fortunate compatibility:** `add-drizzle-db-setup` stores record ownership as `user_id text` with no foreign key to a users table, because Clerk owned identity. That decision accommodates local user identifiers without a schema change — so no already-planned table needs revising.

**Dependencies added:** `better-auth` and its Drizzle adapter; `resend` for transactional email; a password-hashing implementation as required by the auth library.

**New code:** auth server configuration and its route handler, credentials sign-in / sign-up / forgot-password / reset-password interfaces, auth table definitions in the Drizzle schema and their generated migration, email-sending module with verification and reset templates, and a provider-selection module.

**Modified files:** `lib/auth.ts` (the identity accessor becomes provider-agnostic), `app/layout.tsx` (provider-conditional header and provider mounting), `app/sign-in/[[...sign-in]]/page.tsx` and `app/sign-up/[[...sign-up]]/page.tsx` (render either provider's interface), `proxy.ts` (session checks work for either provider), `db/schema.ts`, `.env.local`, `.env.example`, `README.md`, `CLAUDE.md`.

**Security posture — the significant consequence of this change.** Clerk currently supplies password policy, breach detection, bot defence, session management, and email deliverability. Taking authentication in-house transfers all of it to this codebase. Every property listed under What Changes is one the project becomes responsible for holding, permanently, with no test suite in place to detect regression. Two authentication paths also means two paths to keep correct: a defect fixed in one does not fix the other.

**Operational consequence:** the credentials provider requires a reachable email service. A verification or reset email that fails to send locks a user out of their account with no in-app recovery path, making email deliverability an availability dependency of authentication itself.

**Constraint worth flagging:** Clerk renders password reset inside its own sign-in component on `/sign-in` sub-paths rather than at a separate route. Matching Clerk's locations therefore means the credentials reset flow lives under the `/sign-in` tree too — a sibling `/forgot-password` route would place it somewhere Clerk never does and break the requirement that both providers present their flows identically.
