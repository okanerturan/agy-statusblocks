# Proposal

## Why

`agy-statusblocks` currently renders all segment boxes using hardcoded rounded Unicode characters (`╭─╮`, `╰─╯`, `│`, `─`). Terminal environments, themes, and personal preferences vary widely: some users prefer sharp square corners (`┌─┐`, `└─┘`), double-line borders (`╔═╗`, `╚═╝`), thick frames (`┏━┓`, `┗━┛`), pure ASCII characters (`+-+`, `|`, `-`) for minimal or legacy terminals, or no visible box border at all. Providing configurable border styles enhances terminal customization without increasing runtime dependencies.

## What Changes

- Add border style definitions: `rounded` (default), `square`, `double`, `thick`, `ascii`, and `none`.
- Update `StatusBlocksConfig` type to support an optional `border` property (`rounded` | `square` | `double` | `thick` | `ascii` | `none`).
- Support loading border preference from:
  1. `~/.agy-statusblocks.json` (`"border": "..."`)
  2. `AGY_STATUSBLOCKS_BORDER` environment variable
  3. CLI flags `--border <style>` and `-b <style>` (takes highest precedence)
- Update `boxify` and `renderRow` in `src/layout.ts` to respect the configured border style.
- Update `agy-statusblocks preview` and help output to document and showcase border styles.
- Add unit tests verifying border styling and character rendering across all supported styles.

## Capabilities

### New Capabilities
- `border-styling`: Configurable box border styles for segment blocks across CLI flags, environment variables, and configuration files.

### Modified Capabilities
<!-- No existing capabilities yet as this is the first OpenSpec specification in the repository -->

## Impact

- Affected files:
  - `src/types.ts`: Extend `StatusBlocksConfig` and add `BorderStyle` type.
  - `src/layout.ts`: Parameterize border glyphs in `boxify` and `renderBlocks`.
  - `src/config.ts`: Parse `border` from config JSON and `AGY_STATUSBLOCKS_BORDER`.
  - `src/cli.ts`: Parse `--border` / `-b` CLI argument and update preview / help.
  - `src/layout.test.ts`: Add test cases for each border style.
- Dependencies: Zero runtime dependencies preserved.
- Backward compatibility: Fully backward compatible. Defaults to `rounded` if not specified.
