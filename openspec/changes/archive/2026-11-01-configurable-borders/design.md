# Design

## Context

See `proposal.md` for motivation. Box drawing is currently centralized in `src/layout.ts` inside `boxify()` and `renderRow()`, which hardcode rounded glyphs (`╭`, `╮`, `╰`, `╯`, `│`, `─`). Configuration is loaded in `src/config.ts` from `~/.agy-statusblocks.json` and environment variables. The CLI in `src/cli.ts` parses commands and flags before calling `renderBlocks()`.

## Goals / Non-Goals

**Goals:**
- Provide a clean, extensible `BorderStyle` type (`rounded` | `square` | `double` | `thick` | `ascii` | `none`).
- Keep box width calculations and multi-block row alignment exact across all border styles.
- Support runtime resolution with precedence: CLI flag (`--border` / `-b`) > Environment variable (`AGY_STATUSBLOCKS_BORDER`) > Config file (`~/.agy-statusblocks.json`) > Default (`rounded`).
- Maintain zero runtime dependencies and 100% test coverage.

**Non-Goals:**
- Arbitrary custom glyph strings defined by users in JSON (presets cover standard terminal use cases cleanly).
- Multi-colored border gradients (borders retain existing muted gray styling).

## Decisions

### 1. Border Glyph Specification Table

We define a lookup table of glyphs for the borders:

```text
+---------+----+----+----+----+---+---+
| Style   | TL | TR | BL | BR | H | V |
+---------+----+----+----+----+---+---+
| rounded | ╭  | ╮  | ╰  | ╯  | ─ | │ |
| square  | ┌  | ┐  | └  | ┘  | ─ | │ |
| double  | ╔  | ╗  | ╚  | ╝  | ═ | ║ |
| thick   | ┏  | ┓  | ┗  | ┛  | ━ | ┃ |
| ascii   | +  | +  | +  | +  | - | | |
| none    |    |    |    |    |   |   |
+---------+----+----+----+----+---+---+
```

### 2. Handling the `none` Border Style

For `none`:
- The horizontal and vertical border glyphs are empty strings `''`.
- Content lines are padded with 1 leading space and 1 trailing space (total chrome = 2 spaces), or rendered without the extra border characters. To maintain visual balance without border lines, the top and bottom border rows are omitted, and row alignment equalizes line count by appending blank content lines.
- `BOX_CHROME` is 2 for `none` (just the inner padding spaces) and 4 for all bordered styles (2 border glyphs + 2 inner spaces).

### 3. Argument Parsing and Configuration

- `src/types.ts`:
  - Add `export type BorderStyle = 'rounded' | 'square' | 'double' | 'thick' | 'ascii' | 'none';`
  - Add `border?: BorderStyle;` to `StatusBlocksConfig`.
- `src/config.ts`:
  - Read `parsed.border` if valid.
  - Read `process.env['AGY_STATUSBLOCKS_BORDER']`.
- `src/cli.ts`:
  - Support `--border <style>` and `-b <style>`.
  - Pass resolved `border` style to `renderBlocks(data, config)`.

## Risks / Trade-offs

- **[Terminal font glyph missing]** → Fallback to `ascii` or `rounded`. `ascii` uses standard ASCII `+`, `-`, `|` guaranteed to render anywhere.
- **[Invalid style input]** → Normalize input string to lowercase; if not in allowed set, silently fallback to `'rounded'` without crashing.
