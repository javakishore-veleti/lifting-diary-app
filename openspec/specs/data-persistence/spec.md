## Purpose

Defines how the application connects to its relational database, validates its database configuration at startup, and evolves the database schema over time through versioned, reviewable migrations.

## Requirements

### Requirement: Database configuration is validated at startup

The application SHALL validate the presence and format of its database connection configuration before any query is attempted. When configuration is absent or malformed, the application SHALL fail immediately with a message naming the missing or invalid variable.

#### Scenario: Connection string is missing

- **WHEN** the application starts with no database connection string configured
- **THEN** startup fails with an error naming the missing variable
- **AND** the error message states that the variable must be set for the application to run

#### Scenario: Connection string is malformed

- **WHEN** the application starts with a database connection string that is not a valid Postgres connection URL
- **THEN** startup fails with an error identifying the variable as invalid
- **AND** the failure occurs before any connection attempt is made

#### Scenario: Configuration is valid

- **WHEN** the application starts with a well-formed database connection string
- **THEN** startup proceeds without a configuration error
- **AND** the connection string value is never written to logs or error output

### Requirement: Database access is server-side only

Database credentials and query capability SHALL be reachable only from server-side execution contexts. The system MUST NOT expose the connection string or query interface to code that is sent to the browser.

#### Scenario: Client component imports the database module

- **WHEN** a module marked for client-side execution imports the database access module
- **THEN** the build fails with an error identifying the invalid import
- **AND** no database credentials are present in any browser bundle

#### Scenario: Inspecting the production browser bundle

- **WHEN** the production build output served to browsers is searched for the database connection string
- **THEN** no occurrence of the connection string or its credentials is found

### Requirement: Schema changes are applied through versioned migrations

Every change to the database schema SHALL be expressed as a versioned migration artifact stored in version control. Migrations MUST be applied in a deterministic order, and each migration MUST be applied at most once per database.

#### Scenario: Applying migrations to an empty database

- **WHEN** the migration command is run against a database with no tables
- **THEN** all migrations are applied in order
- **AND** the resulting schema matches the schema definition in the codebase

#### Scenario: Applying migrations to an up-to-date database

- **WHEN** the migration command is run against a database that already has every migration applied
- **THEN** no schema changes are made
- **AND** the command reports success

#### Scenario: Schema definition changes

- **WHEN** a developer modifies the schema definition and runs the migration generation command
- **THEN** a new migration artifact is produced describing only the difference from the previous schema state
- **AND** that artifact is written to a location tracked by version control

#### Scenario: Uncommitted schema drift

- **WHEN** the schema definition has changed but no corresponding migration has been generated
- **THEN** the generation command reports the pending difference rather than leaving it silent

### Requirement: Database setup is reproducible from documentation

A developer with no prior knowledge of the project SHALL be able to bring up a working database from the repository documentation alone, without reading source code.

#### Scenario: New developer sets up the project

- **WHEN** a developer follows the database setup steps in the project README
- **THEN** they start a database, configure its connection string, and apply migrations
- **AND** the application starts and can execute queries against the resulting schema

#### Scenario: Database is not running

- **WHEN** the application is started with a valid connection string but no database listening at it
- **THEN** the failure names the database as unreachable rather than presenting as an unrelated application error
- **AND** the message indicates how to start the local database

#### Scenario: Required variables are discoverable

- **WHEN** a developer inspects the repository for required environment variables
- **THEN** an example environment file lists every required database variable with a placeholder value
- **AND** that file contains no real credentials
