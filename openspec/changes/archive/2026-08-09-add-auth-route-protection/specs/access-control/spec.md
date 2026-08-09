## Purpose

Defines which parts of the application require an authenticated session, how unauthenticated requests to them are handled, how a user's intended destination survives the authentication detour, and how server-side code obtains the current user's identity in a form it can rely on for authorization decisions.

## ADDED Requirements

### Requirement: Access is denied by default

Every route SHALL require an authenticated session unless it is explicitly listed as public. A route that is neither listed as public nor deliberately opened MUST be treated as protected.

#### Scenario: Unauthenticated request to a protected route

- **WHEN** a request with no authenticated session targets a route that is not on the public list
- **THEN** the request is not served the protected content
- **AND** the user is redirected to the sign-in route

#### Scenario: Authenticated request to a protected route

- **WHEN** a request with a valid authenticated session targets a protected route
- **THEN** the route is served normally

#### Scenario: A new route is added without configuration

- **WHEN** a developer adds a route and makes no change to the public list
- **THEN** that route requires an authenticated session

#### Scenario: Session expires while browsing

- **WHEN** a user's session becomes invalid and they then request a protected route
- **THEN** they are redirected to the sign-in route rather than served stale protected content

### Requirement: A minimal public surface is reachable without a session

The landing page and the authentication routes SHALL be reachable without an authenticated session, so that a new or signed-out visitor can learn what the product is and can sign in or register.

#### Scenario: Signed-out visitor opens the landing page

- **WHEN** a visitor with no session requests the landing page
- **THEN** the page is served
- **AND** controls to sign in and to register are presented

#### Scenario: Signed-out visitor opens the sign-in route

- **WHEN** a visitor with no session requests the sign-in route
- **THEN** the sign-in interface is served
- **AND** it is not redirected, since redirecting the sign-in route to itself would loop

#### Scenario: Static assets are reachable

- **WHEN** the browser requests the static assets, fonts, or styles a public page depends on
- **THEN** those requests are served without requiring a session

### Requirement: Authentication is reachable at stable application routes

Sign-in and sign-up SHALL each be available at a stable in-application URL that can be linked to, bookmarked, and loaded directly, rather than existing only as transient overlays.

#### Scenario: Opening the sign-in URL directly

- **WHEN** a user navigates straight to the sign-in URL, with no prior in-app navigation
- **THEN** the sign-in interface renders

#### Scenario: Reloading during authentication

- **WHEN** a user reloads the page while on the sign-in or sign-up route
- **THEN** the interface renders again rather than being lost

#### Scenario: Moving between sign-in and sign-up

- **WHEN** a user on the sign-in interface indicates they need to register instead
- **THEN** they reach the sign-up route without leaving the application

#### Scenario: Authentication renders in the application's own layout

- **WHEN** a user views the sign-in or sign-up interface
- **THEN** it is presented within the application rather than on an externally hosted page

### Requirement: The intended destination survives authentication

When an unauthenticated user is redirected away from a protected route, the system SHALL remember where they were going and return them there once authentication succeeds.

#### Scenario: Deep link to a protected route while signed out

- **WHEN** a signed-out user requests a protected route and then completes sign-in
- **THEN** they arrive at the route they originally requested
- **AND** not at the landing page or a generic default

#### Scenario: Signing in from the landing page

- **WHEN** a user signs in from the landing page with no prior protected destination
- **THEN** they arrive at a defined default destination for signed-in users

#### Scenario: Registering from a deep link

- **WHEN** a signed-out user requests a protected route and completes registration rather than sign-in
- **THEN** they arrive at the route they originally requested

#### Scenario: A returning destination cannot be trusted

- **WHEN** the remembered destination points outside the application
- **THEN** it is discarded and the user arrives at the default signed-in destination

### Requirement: Server-side code obtains identity from a single trustworthy source

Server-side code that acts on behalf of a user SHALL obtain that user's identifier through one shared accessor rather than reading it from request input. The accessor MUST refuse to yield an identifier when there is no authenticated session, so that a caller cannot proceed with an absent or caller-supplied identity.

#### Scenario: Protected server code runs with a session

- **WHEN** server-side code requests the current user's identifier during an authenticated request
- **THEN** the identifier for that session's user is returned

#### Scenario: Protected server code runs without a session

- **WHEN** server-side code requests the current user's identifier with no authenticated session
- **THEN** the accessor raises rather than returning an absent or empty value
- **AND** the calling code does not proceed to act on data

#### Scenario: Identity is supplied by the caller

- **WHEN** a request includes a user identifier in its parameters, body, or headers
- **THEN** that value is ignored for authorization purposes
- **AND** the identifier from the authenticated session is used instead

#### Scenario: Reading whether a user is signed in without requiring it

- **WHEN** code needs to branch on whether a session exists rather than demand one
- **THEN** a means to determine that is available which does not raise when no session is present

### Requirement: Protection does not rely on route matching alone

Server Actions and route handlers SHALL verify the session themselves rather than depending solely on route-level protection, because they can be invoked by paths that route matching does not cover.

#### Scenario: Server Action invoked without a session

- **WHEN** a Server Action that acts on user data is invoked with no authenticated session
- **THEN** it refuses to perform the action
- **AND** it does not rely on route-level protection having already rejected the request

#### Scenario: Route handler invoked directly

- **WHEN** a route handler is requested directly with no authenticated session
- **THEN** it responds with an unauthorized status rather than performing the work

### Requirement: Signing out ends access

Signing out SHALL invalidate the session so that protected routes are no longer reachable, and MUST leave the user on a route that remains reachable without a session.

#### Scenario: Signing out from a protected route

- **WHEN** a user signs out while viewing a protected route
- **THEN** they are moved to a route that is reachable without a session
- **AND** they are not left on a protected route that they can no longer load

#### Scenario: Returning to a protected route after signing out

- **WHEN** a signed-out user navigates back to a protected route they previously viewed
- **THEN** they are redirected to sign in rather than shown previously rendered content
