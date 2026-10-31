# agy-statusblocks

Adaptive, block-based status line for [Antigravity CLI](https://antigravity.google) (`agy`). Cards reflow into a pyramid layout based on available terminal width using an exhaustive bin-packing algorithm.

**Zero runtime dependencies.** Pure Node.js built-ins only.

## Install

Requires Node.js ≥ 20. Works on macOS, Linux, and Windows.

```sh
# Inside agy-statusblocks directory:
npm run build
node dist/cli.js init
```

This compiles and copies the renderer to `~/.gemini/antigravity-cli/statusblocks/` and configures `statusLine` in `~/.gemini/antigravity-cli/settings.json`. Restart Antigravity CLI (`agy`) to activate.

## Preview

```sh
npm run preview
```

## Cards

| Card | Shows |
|------|-------|
| **context** | Context window fill bar, percentage, used/total token count (supports 1M/2M context) |
| **model** | Active model name, directory (tilde-shortened), reasoning effort level, plan tier, estimated cost |
| **state** | Agent state pill (`● IDLE`, `● RUNNING`, `● TOOL USE`, `● REVIEW`) and live task/subagent/artifact counters |
| **git** | Branch, staged/modified file counts, lines added/removed |

## License

[MIT](./LICENSE)
