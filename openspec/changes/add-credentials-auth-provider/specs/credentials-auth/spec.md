## Purpose

Defines the application's own authentication provider: how accounts are registered with an email address and password, how credentials are stored and verified, how email addresses are confirmed, how a forgotten password is recovered, how sessions are issued and ended, and the abuse-resistance properties these flows must hold now that no hosted provider supplies them.

## ADDED Requirements

### Requirement: Users register with an email address and password

The system SHALL allow a visitor to create an account from an email address and a password. An email address MUST identify at most one account, and the comparison MUST be case-insensitive so that the same address in different casing cannot yield two accounts.

#### Scenario: Registering with an unused email address

- **WHEN** a visitor registers with an email address no account uses and a password meeting the strength policy
- **THEN** an account is created
- **AND** a verification message is sent to that address

#### Scenario: Registering with an address that differs only in casing

- **WHEN** a visitor registers with an address that matches an existing account except for letter casing
- **THEN** no second account is created

#### Scenario: Registering with a malformed email address

- **WHEN** a visitor submits an address that is not a valid email address
- **THEN** registration is rejected with a message identifying the address as invalid

#### Scenario: Registering with a password below policy

- **WHEN** a visitor submits a password that does not meet the strength policy
- **THEN** registration is rejected
- **AND** the message states what the policy requires rather than only that the password was refused

#### Scenario: Registering with an address that already has an account

- **WHEN** a visitor registers with an address that already has an account
- **THEN** the response is indistinguishable from registering a new address
- **AND** a message is sent to the address informing its owner of the attempt, rather than confirming to the visitor that the account exists

### Requirement: Passwords are never recoverable from stored data

Passwords SHALL be stored only as the output of a slow, salted, industry-accepted password-hashing function. The system MUST NOT store, log, or transmit a password in a form from which the original can be recovered.

#### Scenario: Inspecting stored account data

- **WHEN** the accounts table is inspected directly
- **THEN** no column contains a password in plaintext or in a reversibly encoded form
- **AND** each stored hash carries a distinct salt

#### Scenario: Two users choose the same password

- **WHEN** two accounts are created with identical passwords
- **THEN** their stored hashes differ

#### Scenario: A password appears in an error or log

- **WHEN** any authentication failure is logged or surfaced
- **THEN** the submitted password does not appear in the log or the message

### Requirement: Sign-in verifies credentials without revealing which part failed

The system SHALL grant a session only when the supplied email address and password both match an existing account. Failure responses MUST NOT distinguish an unknown address from an incorrect password.

#### Scenario: Signing in with correct credentials

- **WHEN** a user signs in with an email address and password matching a verified account
- **THEN** a session is established
- **AND** the user reaches the destination defined for signed-in users

#### Scenario: Signing in with an incorrect password

- **WHEN** a user signs in with a known address and the wrong password
- **THEN** no session is established
- **AND** the message does not indicate that the address was recognised

#### Scenario: Signing in with an unknown address

- **WHEN** a sign-in is attempted with an address no account uses
- **THEN** the failure message is identical to the incorrect-password message
- **AND** the response time does not reliably differ between the two cases

#### Scenario: Signing in before verifying the email address

- **WHEN** a user with an unverified email address signs in with correct credentials
- **THEN** access to protected content is refused
- **AND** the user is told verification is outstanding and offered a way to resend it

### Requirement: Email addresses are confirmed before access is granted

The system SHALL require an email address to be confirmed before the account may reach protected content. Confirmation MUST use a single-use token that expires.

#### Scenario: Following a valid verification link

- **WHEN** a user opens a verification link that has not been used and has not expired
- **THEN** the address is marked verified
- **AND** the account can reach protected content

#### Scenario: Reusing a verification link

- **WHEN** a user opens a verification link that has already been used
- **THEN** the address is not re-verified through it
- **AND** the user is told the link is no longer valid

#### Scenario: Following an expired verification link

- **WHEN** a user opens a verification link past its expiry
- **THEN** verification is refused
- **AND** the user is offered a way to request a new message

#### Scenario: Requesting a new verification message

- **WHEN** a user with an unverified address requests another verification message
- **THEN** a new message is sent and any previously issued token stops being accepted

### Requirement: A forgotten password can be reset by proving control of the email address

The system SHALL allow a user to request a password reset for an email address, and SHALL act on that request only through a message sent to the address itself. The request MUST NOT reveal whether an account exists.

#### Scenario: Requesting a reset for a known address

- **WHEN** a user requests a reset for an address that has an account
- **THEN** a reset message is sent to that address

#### Scenario: Requesting a reset for an unknown address

- **WHEN** a reset is requested for an address with no account
- **THEN** no message is sent
- **AND** the response shown is identical to the known-address response

#### Scenario: Completing a reset

- **WHEN** a user opens a valid reset link and submits a new password meeting the policy
- **THEN** the password is replaced
- **AND** the user can sign in with the new password and cannot sign in with the old one

#### Scenario: Reusing a reset link

- **WHEN** a reset link that has already been used is opened again
- **THEN** it is refused
- **AND** the password is not changed

#### Scenario: Following an expired reset link

- **WHEN** a reset link is opened past its expiry
- **THEN** it is refused
- **AND** the user is offered a way to request a new one

#### Scenario: Requesting a second reset before using the first

- **WHEN** a user requests a reset while an unused reset token already exists
- **THEN** the newly issued token is accepted
- **AND** the earlier token stops being accepted

#### Scenario: Inspecting stored reset tokens

- **WHEN** the stored reset tokens are inspected directly
- **THEN** no usable token value is present in readable form
- **AND** a leaked copy of the table does not permit resetting any password

### Requirement: Completing a reset ends other sessions

Resetting a password SHALL invalidate sessions established before the reset, so that recovering an account also removes access from anyone holding a session on it.

#### Scenario: Resetting while another session is active

- **WHEN** a user completes a password reset while a session on another device is active
- **THEN** that other session can no longer reach protected content

#### Scenario: The resetting user's own access

- **WHEN** a user completes a reset
- **THEN** they are able to sign in with the new password

### Requirement: Sessions are recorded and can be revoked

Sessions SHALL be recorded in the database so that validity is determined by server-side state rather than by an unverifiable token alone, and MUST expire after a bounded lifetime.

#### Scenario: Session cookie transport

- **WHEN** a session is established
- **THEN** its cookie is restricted from script access, restricted from cross-site sending, and marked for secure transport outside local development

#### Scenario: Revoking a session server-side

- **WHEN** a session record is deleted while the holder still possesses its cookie
- **THEN** that cookie no longer grants access to protected content

#### Scenario: Session reaches its expiry

- **WHEN** a session passes its expiry
- **THEN** it no longer grants access and the user is treated as signed out

#### Scenario: Signing out

- **WHEN** a user signs out
- **THEN** the session record is invalidated and its cookie cleared
- **AND** presenting the previous cookie again does not restore access

### Requirement: Authentication attempts are rate limited

Sign-in, registration, verification-resend, and reset-request SHALL each be rate limited, so that guessing credentials and generating mail volume are both bounded.

#### Scenario: Repeated failed sign-in attempts

- **WHEN** sign-in fails repeatedly for the same account beyond the configured threshold
- **THEN** further attempts are refused for a period
- **AND** the refusal does not reveal whether the address has an account

#### Scenario: Repeated reset requests

- **WHEN** reset requests for the same address exceed the configured threshold
- **THEN** further requests are refused for a period
- **AND** no additional messages are sent

#### Scenario: Correct credentials during a rate-limited period

- **WHEN** the correct password is supplied while the account is rate limited
- **THEN** the attempt is still refused until the period elapses

### Requirement: Authentication messages are delivered reliably or reported

The system SHALL send verification and reset messages through a transactional email service, and MUST surface a delivery failure rather than reporting success, since an undelivered message leaves the user unable to proceed.

#### Scenario: Message is accepted by the email service

- **WHEN** a verification or reset message is accepted for delivery
- **THEN** the user is told the message has been sent and where to look for it

#### Scenario: Email service rejects or is unreachable

- **WHEN** the email service returns an error or cannot be reached
- **THEN** the failure is logged with enough detail to diagnose it
- **AND** the user is shown that sending failed and offered a way to retry, rather than being told it succeeded

#### Scenario: Message contents

- **WHEN** a verification or reset message is composed
- **THEN** it contains a single-use link to this application
- **AND** it does not contain the user's password
