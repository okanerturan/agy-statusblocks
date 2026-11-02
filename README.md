# agy-statusblocks

[![npm version](https://img.shields.io/npm/v/agy-statusblocks)](https://www.npmjs.com/package/agy-statusblocks)
[![license](https://img.shields.io/npm/l/agy-statusblocks)](package.json)

Adaptive, block-based status line for [Antigravity CLI](https://antigravity.google) (`agy`). Cards reflow into a pyramid layout based on available terminal width using an exhaustive bin-packing algorithm.

**Zero runtime dependencies.** Pure Node.js built-ins only.

## Install

Requires Node.js ≥ 20. Works on macOS, Linux, and Windows.

```sh
npx agy-statusblocks init
```

This copies the renderer to `~/.gemini/antigravity-cli/statusblocks/` and writes `statusLine.command` into `~/.gemini/antigravity-cli/settings.json` (creating it if needed). Restart Antigravity CLI (`agy`) to activate.

### Update

```sh
npx agy-statusblocks@latest update
```

Updates happen automatically — the statusline checks for new versions daily in the background. The `postinstall` hook also auto-updates when you run `npm update -g agy-statusblocks`. Set `AGY_STATUSBLOCKS_NO_UPDATE=1` to disable the background check.

## Cards

| Card | Shows |
|------|-------|
| **context** | Context window fill bar, percentage, used/total token count (supports 1M/2M context) |
| **model** | Active model name, tilde-shortened directory, reasoning effort level, plan tier, estimated cost, CLI version |
| **usage** | Rate limit utilization (5-hour, daily, and 7-day windows) with reset countdowns |
| **state** | Agent state pill (`● IDLE`, `● RUNNING`, `● TOOL USE`, `● REVIEW`) and live task/subagent/artifact counters |
| **git** | Branch, staged/modified file counts, lines added/removed |

## Layout

Cards are bin-packed into rows for optimal fit — blocks can be freely reordered across rows. Rows are sorted narrowest-on-top (pyramid shape). The algorithm tries every possible row assignment and picks the layout with fewest rows and most balanced widths.

On narrow/split-pane terminals, the layout degrades gracefully to stacked single-block rows.

## Configure

`~/.agy-statusblocks.json`:

```json
{
  "segments": ["context", "model", "usage", "state", "git"],
  "border": "rounded"
}
```

Border styles supported:
- `rounded` (default) — `╭─╮` `╰─╯` `│` `─`
- `square` — `┌─┐` `└─┘` `│` `─`
- `double` — `╔═╗` `╚═╝` `║` `═`
- `thick` — `┏━┓` `┗━┛` `┃` `━`
- `ascii` — `+-+` `+-+` `|` `-` (clean standard 7-bit ASCII)
- `none` — clean padded columns without frame borders

Or configure via environment variables:

```sh
AGY_STATUSBLOCKS_SEGMENTS=context,model,usage
AGY_STATUSBLOCKS_BORDER=double
```

Or pass via CLI flag:

```sh
npx agy-statusblocks preview --border double
```

## Preview

```sh
npx agy-statusblocks preview
```

Check the installed package version with `agy-statusblocks --version` (or `-v`).

## Development

```sh
npm run build       # compile TypeScript
npm run dev         # watch mode
npm test            # run vitest suite
npm run preview     # render with mock data
```

## License

[MIT](./LICENSE)
