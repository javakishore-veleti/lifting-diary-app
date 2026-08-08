## Purpose

Defines how the application chooses which authentication provider is active, the requirement that whichever provider is selected presents its flows at identical locations so switching changes what renders rather than where users go, and how the rest of the application obtains user identity without depending on which provider is in use.

## ADDED Requirements

### Requirement: Exactly one authentication provider is active

The application SHALL select one authentication provider through configuration. The hosted provider is the default when the setting is absent. Two providers MUST NOT be active simultaneously.

#### Scenario: Configuration is absent

- **WHEN** the application starts with no provider setting configured
- **THEN** the hosted provider is active

#### Scenario: The toggle is off

- **WHEN** the setting selects the application's own credentials provider
- **THEN** the credentials provider handles registration, sign-in, and password reset
- **AND** the hosted provider's components are not mounted and its interfaces are unreachable

#### Scenario: The toggle is on

- **WHEN** the setting selects the hosted provider
- **THEN** the hosted provider handles authentication
- **AND** the credentials provider's endpoints do not accept registrations or sign-in attempts

#### Scenario: The setting holds an unrecognised value

- **WHEN** the provider setting holds a value matching neither provider
- **THEN** startup fails with an error naming the setting and listing the accepted values
- **AND** the application does not start with authentication disabled

### Requirement: Both providers present their flows at identical locations

Each authentication flow SHALL be reachable at the same route and from the same interface position regardless of which provider is active. Changing providers MUST change what renders at a location, never which location a user must visit.

#### Scenario: Sign-in route under either provider

- **WHEN** a user opens the sign-in route
- **THEN** the active provider's sign-in interface renders there
- **AND** the route is the same under both providers

#### Scenario: Sign-up route under either provider

- **WHEN** a user opens the sign-up route
- **THEN** the active provider's registration interface renders there
- **AND** the route is the same under both providers

#### Scenario: Reaching password reset

- **WHEN** a user needs to recover a forgotten password
- **THEN** it is reached from within the sign-in interface under both providers
- **AND** not from a separate route present under only one of them

#### Scenario: Header controls while signed out

- **WHEN** a signed-out user views the header
- **THEN** controls to sign in and to register appear in the same positions under both providers
- **AND** they lead to the same routes

#### Scenario: Header controls while signed in

- **WHEN** a signed-in user views the header
- **THEN** a control to access their account and sign out appears in the same position under both providers

#### Scenario: A bookmarked authentication URL after switching providers

- **WHEN** a user bookmarks an authentication route, the active provider is changed, and the bookmark is opened
- **THEN** the route still resolves to the equivalent interface rather than returning not-found

### Requirement: Downstream code does not depend on the active provider

Code that acts on behalf of a user SHALL obtain the user's identifier through the shared accessor without branching on which provider is active. The accessor MUST behave identically under both providers, including refusing to yield an identifier when no session exists.

#### Scenario: Requesting identity under either provider

- **WHEN** server-side code requests the current user's identifier during an authenticated request
- **THEN** an identifier is returned regardless of which provider established the session

#### Scenario: Requesting identity with no session

- **WHEN** server-side code requests the current user's identifier with no session
- **THEN** the accessor raises under both providers alike

#### Scenario: Inspecting data-access code for provider knowledge

- **WHEN** data-access code is inspected
- **THEN** it contains no reference to a specific authentication provider
- **AND** no conditional branch on the provider setting

#### Scenario: Route protection under either provider

- **WHEN** a signed-out request targets a protected route
- **THEN** it is redirected to the sign-in route under both providers alike

### Requirement: Identifiers from different providers do not collide

User identifiers issued by the two providers SHALL be distinguishable, so that data owned by an account from one provider is never served to an account from the other.

#### Scenario: Records created under one provider, read under the other

- **WHEN** records are created while one provider is active and then read after switching to the other
- **THEN** those records are not returned to any account of the newly active provider

#### Scenario: The same email address exists under both providers

- **WHEN** an account exists with the same email address under each provider
- **THEN** they are treated as distinct owners
- **AND** neither can read the other's records

### Requirement: A misconfigured provider fails loudly rather than open

Selecting a provider whose required configuration is missing SHALL prevent the application from starting. The application MUST NOT fall back to another provider or to unauthenticated operation.

#### Scenario: Hosted provider selected without its keys

- **WHEN** the hosted provider is selected and its keys are absent
- **THEN** startup fails with an error naming the missing configuration

#### Scenario: Credentials provider selected without a database connection

- **WHEN** the credentials provider is selected and the database connection is not configured
- **THEN** startup fails with an error naming the missing configuration

#### Scenario: Credentials provider selected without an email service

- **WHEN** the credentials provider is selected and the email service is not configured
- **THEN** startup fails, because verification and password reset cannot function without it

#### Scenario: Misconfiguration does not disable protection

- **WHEN** provider configuration is invalid in any way
- **THEN** the application does not start and serve protected routes without authentication
