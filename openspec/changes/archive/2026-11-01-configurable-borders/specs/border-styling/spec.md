# Spec Delta

## Purpose

Provides configurable visual border styles for status blocks in agy-statusblocks, allowing users to customize block frame outlines to match their preferred terminal aesthetics or minimal ASCII requirements.

## ADDED Requirements

### Requirement: Supported Border Styles
The system SHALL support six distinct border styles: `rounded`, `square`, `double`, `thick`, `ascii`, and `none`.

#### Scenario: Default border style is rounded
- **WHEN** no border style configuration is provided
- **THEN** the system SHALL render boxes using rounded Unicode box drawing characters `╭`, `╮`, `╰`, `╯`, `│`, and `─`

#### Scenario: Square border style
- **WHEN** the border style is configured as `square`
- **THEN** the system SHALL render boxes using square Unicode box drawing characters `┌`, `┐`, `└`, `┘`, `│`, and `─`

#### Scenario: Double border style
- **WHEN** the border style is configured as `double`
- **THEN** the system SHALL render boxes using double-line Unicode characters `╔`, `╗`, `╚`, `╝`, `║`, and `═`

#### Scenario: Thick border style
- **WHEN** the border style is configured as `thick`
- **THEN** the system SHALL render boxes using heavy box drawing characters `┏`, `┓`, `┗`, `┛`, `┃`, and `━`

#### Scenario: ASCII border style
- **WHEN** the border style is configured as `ascii`
- **THEN** the system SHALL render boxes using standard 7-bit ASCII characters `+`, `-`, and `|`

#### Scenario: None border style
- **WHEN** the border style is configured as `none`
- **THEN** the system SHALL render blocks without horizontal or vertical frame border lines, padding content cleanly

### Requirement: Border Style Configuration Precedence
The system SHALL resolve the active border style by following explicit precedence across CLI arguments, environment variables, configuration files, and system defaults.

#### Scenario: CLI argument overrides environment and config
- **WHEN** the `--border` or `-b` flag is supplied on the CLI
- **THEN** the system SHALL use the CLI-specified border style regardless of environment variables or config file settings

#### Scenario: Environment variable overrides configuration file
- **WHEN** `AGY_STATUSBLOCKS_BORDER` is defined and no CLI flag is passed
- **THEN** the system SHALL use the environment variable's border style over any value in `~/.agy-statusblocks.json`

#### Scenario: Configuration file setting
- **WHEN** `"border": "<style>"` is set in `~/.agy-statusblocks.json` and neither CLI flag nor env var is provided
- **THEN** the system SHALL use the configured border style

#### Scenario: Invalid border style fallback
- **WHEN** an unrecognized border style string is provided
- **THEN** the system SHALL safely fall back to the default `rounded` style without throwing an unhandled exception
