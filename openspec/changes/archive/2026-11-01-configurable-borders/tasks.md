# Tasks

## 1. Types and Configuration

- [x] 1.1 Add `BorderStyle` type and update `StatusBlocksConfig` in `src/types.ts`, verifying TypeScript compilation with `npx tsc --noEmit`.
- [x] 1.2 Update `src/config.ts` to parse `border` from JSON configuration and `AGY_STATUSBLOCKS_BORDER` environment variable with fallback to `rounded`.

## 2. Layout Engine

- [x] 2.1 Implement `BORDER_STYLES` dictionary and update `boxify()` and `renderRow()` in `src/layout.ts` to support all 6 styles (`rounded`, `square`, `double`, `thick`, `ascii`, `none`).
- [x] 2.2 Add comprehensive unit tests in `src/layout.test.ts` for all border styles and verify with `npm test`.

## 3. CLI and Documentation

- [x] 3.1 Add `--border` and `-b` CLI options to `src/cli.ts`, wire into the preview and render commands, and verify help text displays the option.
- [x] 3.2 Update `README.md` with configuration options and verify end-to-end rendering via `node dist/cli.js preview --border double` and `node dist/cli.js preview --border ascii`.
