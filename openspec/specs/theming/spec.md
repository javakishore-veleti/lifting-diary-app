## Purpose

Defines how the application selects, applies, and remembers a color scheme: honouring the operating system preference by default, allowing the user to override it explicitly, persisting that choice across visits, and applying the resulting scheme without a visible flash of the wrong colors on load.

## Requirements

### Requirement: The operating system preference is the default

On a first visit, with no prior choice recorded, the application SHALL present the color scheme indicated by the operating system preference.

#### Scenario: First visit with a dark system preference

- **WHEN** a user with no recorded preference opens the application and their operating system is set to dark
- **THEN** the application presents in dark

#### Scenario: First visit with a light system preference

- **WHEN** a user with no recorded preference opens the application and their operating system is set to light
- **THEN** the application presents in light

#### Scenario: System preference changes while following the system

- **WHEN** the operating system preference changes while the application is open and the user has not set an explicit override
- **THEN** the application follows the change without requiring a reload

### Requirement: Users can override the color scheme

The application SHALL offer a control that lets a user select light, dark, or following the system preference. The selected scheme MUST take effect immediately.

#### Scenario: Choosing a scheme

- **WHEN** a user selects a color scheme from the control
- **THEN** the application presents in that scheme immediately
- **AND** no reload is required

#### Scenario: Returning to following the system

- **WHEN** a user who previously set an explicit override selects the system option
- **THEN** the application returns to following the operating system preference
- **AND** subsequent operating system changes are honoured again

#### Scenario: The control is reachable

- **WHEN** a user navigates the application by keyboard
- **THEN** the color scheme control is reachable and operable
- **AND** its current selection is exposed to assistive technology

### Requirement: An explicit choice persists across visits

An explicitly selected color scheme SHALL be remembered and reapplied on subsequent visits, and MUST take precedence over the operating system preference.

#### Scenario: Returning after choosing a scheme

- **WHEN** a user who selected dark closes the application and opens it again later
- **THEN** the application presents in dark

#### Scenario: Explicit choice conflicts with the system preference

- **WHEN** a user has explicitly selected light and their operating system is set to dark
- **THEN** the application presents in light

### Requirement: The active scheme applies without a flash

The correct color scheme SHALL be applied before first paint. A user MUST NOT see content rendered in one scheme and then change to another.

#### Scenario: Loading with dark selected

- **WHEN** a user whose recorded preference is dark loads any page
- **THEN** the page paints in dark from the first frame
- **AND** no light-colored flash is visible beforehand

#### Scenario: Loading a server-rendered page

- **WHEN** a server-rendered page reaches the browser
- **THEN** applying the recorded scheme produces no hydration mismatch warning

### Requirement: The scheme applies to every surface

The active color scheme SHALL apply to all interface surfaces, including third-party components and content rendered in overlays or modals.

#### Scenario: Opening an authentication screen in dark

- **WHEN** a user in dark opens a sign-in or sign-up screen
- **THEN** that screen presents in dark

#### Scenario: Switching scheme with an overlay open

- **WHEN** a user changes the color scheme while a dialog or overlay is open
- **THEN** the overlay adopts the new scheme along with the rest of the page

#### Scenario: Text remains legible in both schemes

- **WHEN** any screen is viewed in either scheme
- **THEN** text meets the contrast ratio required for its size by WCAG AA against its background
