## Purpose

Defines how a developer brings the application's local backing services up, confirms they are ready to use, and shuts them down; the guarantee that data survives an ordinary stop and restart; and the requirement that adding a new service does not require editing the lifecycle commands.

## Requirements

### Requirement: One command brings the whole local stack up

A single command SHALL start every service the local stack defines, and MUST NOT report success until each service is ready to accept work — not merely started.

#### Scenario: Starting from nothing

- **WHEN** a developer runs the up command with no containers running
- **THEN** every defined service starts
- **AND** the command does not return success until each reports healthy

#### Scenario: A database that is still initialising

- **WHEN** a database service is started for the first time and is still performing initialisation
- **THEN** the up command waits for it to become ready before reporting success
- **AND** a command run immediately afterwards can connect on its first attempt

#### Scenario: Starting when already running

- **WHEN** the up command is run while the stack is already up
- **THEN** it completes successfully without duplicating or restarting healthy services

#### Scenario: A service fails to become healthy

- **WHEN** a service does not reach a healthy state within its allotted time
- **THEN** the command exits with a non-zero status
- **AND** it names the service that failed and how to inspect its logs

#### Scenario: Docker is not running

- **WHEN** the up command is run while the container engine is unavailable
- **THEN** it fails with a message identifying that as the cause
- **AND** it does not present the failure as a problem with a service

### Requirement: The stack's state is reportable

A command SHALL report, for each defined service, whether it is running and whether it is healthy, so a developer can distinguish "not started" from "started but not ready" from "ready".

#### Scenario: Reporting a healthy stack

- **WHEN** the status command runs with every service healthy
- **THEN** each service is listed as running and healthy

#### Scenario: Reporting a stopped stack

- **WHEN** the status command runs with nothing started
- **THEN** each defined service is listed as not running
- **AND** the command succeeds rather than treating a stopped stack as an error

#### Scenario: Reporting a partially ready stack

- **WHEN** a service is running but not yet healthy
- **THEN** it is reported as running and not healthy, distinctly from both other states

#### Scenario: Reporting a service's connection details

- **WHEN** the status command reports a running service
- **THEN** the published port it is reachable on is included

### Requirement: Stopping the stack preserves data by default

The down command SHALL stop services without destroying their data. Destroying persistent data MUST require an explicit, separate opt-in.

#### Scenario: Ordinary shutdown and restart

- **WHEN** a developer stops the stack and starts it again
- **THEN** data written before the shutdown is still present

#### Scenario: Requesting data destruction

- **WHEN** the down command is invoked with its explicit data-destroying option
- **THEN** persistent volumes are removed
- **AND** the command states that data was destroyed

#### Scenario: Destruction is not the default

- **WHEN** the down command is invoked with no options
- **THEN** no persistent volume is removed

#### Scenario: Stopping an already-stopped stack

- **WHEN** the down command runs with nothing running
- **THEN** it succeeds without error

### Requirement: Services are added without changing the lifecycle commands

The up, down, and status commands SHALL operate on whatever services the stack defines, discovering them rather than naming them individually.

#### Scenario: Adding a second service

- **WHEN** a developer adds a new service to the stack following the established layout
- **THEN** the up, down, and status commands include it
- **AND** none of those commands required editing

#### Scenario: Each service is self-contained

- **WHEN** a new service is added
- **THEN** its definition lives in its own location
- **AND** no existing service's definition is modified

### Requirement: The database is reachable at documented, stable coordinates

The local database SHALL be reachable on a fixed published port with fixed credentials, both documented, so that a connection string can be written once and keep working across restarts.

#### Scenario: Connecting with the documented connection string

- **WHEN** a developer uses the connection string given in the project documentation
- **THEN** it connects to the running local database

#### Scenario: Coordinates are stable across restarts

- **WHEN** the stack is stopped and started again
- **THEN** the database is reachable at the same port with the same credentials
- **AND** no connection string needs updating

#### Scenario: The database version is pinned

- **WHEN** the stack is started on a different machine or at a later date
- **THEN** the same major Postgres version is used
- **AND** it is a version supporting the schema features the application requires

#### Scenario: Local credentials are marked as local

- **WHEN** a developer reads the service definition
- **THEN** it is evident that the credentials are for local development only
- **AND** they are not presented as suitable for any deployed environment

### Requirement: Setting up the local stack is documented

A developer with no prior knowledge of the project SHALL be able to bring the stack up from the project documentation alone.

#### Scenario: Following the documented setup

- **WHEN** a developer follows the local setup steps in the project README
- **THEN** they learn what tooling must be installed beforehand
- **AND** they bring the stack up and confirm it is healthy using the documented commands

#### Scenario: Documentation names the connection string

- **WHEN** a developer needs to configure the application against the local database
- **THEN** the documentation provides the exact connection string to use
