# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

SWE-Agent-Node is a TypeScript CLI tool and library for autonomous software engineering. It uses a mock LLM client (no external API keys needed for development/testing). See `README.md` and `DEVELOPMENT.md` for detailed documentation.

### Development commands

All standard commands are in `package.json` scripts:
- `pnpm test` — runs Jest (302 tests, all should pass)
- `pnpm run build` — compiles TypeScript to `dist/`
- `pnpm run lint` — runs ESLint (currently **no `.eslintrc` config exists** in the repo, so this command will fail with "couldn't find a configuration file")
- `pnpm run dev` — runs CLI via `ts-node` (pass CLI args after `--`, e.g. `pnpm dev -- analyze /workspace`)
- Built CLI: `node dist/cli.js --help`

### Non-obvious caveats

- **pnpm + node-linker**: The project uses `pnpm` (lockfile present). A `.npmrc` with `node-linker=hoisted` is required; without it, `ts-node` cannot resolve `typescript` from within the pnpm virtual store, and direct `node dist/cli.js` calls fail to find runtime deps like `commander`.
- **`fix` command mutates git state**: Running `node dist/cli.js fix ...` creates branches, backup directories (`.swe-backup/`), and commits in the target repo. Always run `git checkout . && git clean -fd` afterward if you need a clean working tree (e.g., before running tests).
- **Lint has no config**: The `pnpm run lint` script references `eslint src/**/*.ts` but the repo has no `.eslintrc*` or `eslint.config.*` file, so lint will always fail. This is a pre-existing issue, not an environment problem.
- **Some examples have TS errors**: `examples/basic-usage.ts` has a pre-existing type error (`maxKnowledgeSize` missing). `examples/autonomy-example.ts` works correctly.
