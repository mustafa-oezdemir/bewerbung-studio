# Contributing

Thank you for your interest in BewerbungsManager. Bug reports, ideas, documentation fixes and code contributions are
welcome. By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

Contributions are licensed under the [Apache License 2.0](LICENSE), like the rest of the project.

> [!IMPORTANT]
> BewerbungsManager works with personal data (addresses, phone numbers, e-mail addresses, résumés, certificates).
> Never commit real application data, and never post it in issues or pull requests. Use fictional names and
> contact details in tests, examples and screenshots.

## Development setup

Requirements: Windows, [Node.js](https://nodejs.org/) 24 (the version used by the CI) and Git.
The application lives in `bewerbung-studio`.

```bash
git clone https://github.com/mustafa-oezdemir/bewerbung_manager.git
cd bewerbung_manager/bewerbung-studio
npm ci
npm run dev
```

`npm run dev` starts Vite with the Electron plugin and opens the desktop application. `npm start` builds the current
sources before opening Electron. To work on the user interface in a browser without Electron, start
`npm run dev` with the environment variable `VITE_RENDERER_ONLY=1`.

Point the application to a throwaway data folder with the environment variable `BEWERBUNG_ROOT_PATH` while you
develop, so your real applications are never touched.

The dev server rewrites files in `bewerbung-studio/dist-electron`. They are generated from the current sources and
ignored by Git; do not commit them.

## Branch naming

Create a branch from `main` with a short prefix:

| Prefix | Use |
| --- | --- |
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `refactor/` | Code changes without behavior change |

Example: `fix/deadline-todo-duplicate`.

## Commit messages

The history uses short, imperative English subject lines that describe the change, for example
`Add selectable Deckblatt designs` or `Group applications of one company and day by position`.

- Subject in the imperative mood, no trailing period, about 70 characters at most
- Add a body when the reason for the change is not obvious
- One logical change per commit
- Conventional Commit prefixes (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`) are accepted but not required

## Pull requests

1. Open an issue first for larger changes, so the direction can be agreed before you invest time.
2. Keep the pull request focused. Do not mix unrelated refactoring with a fix.
3. Fill in the pull request template.
4. Make sure the CI passes. It runs `npm ci` and `npm run release:check` (typecheck, tests, production build).
5. Update the documentation when behavior, commands or the folder layout change.

## Tests

Run these in `bewerbung-studio` before you push:

```bash
npm ci
npm run release:check
```

`release:check` runs the TypeScript check, all Vitest tests and the production build, exactly like the CI. During
development `npm test` and `npm run typecheck` are faster.

Tests sit next to the code (`*.test.ts`, `*.test.tsx`). Add a test for every bug fix and every new rule. Code that
touches files uses a temporary folder and never the real data folder.

## Code style

- TypeScript in strict mode; validate data at the boundaries with Zod schemas (`src/shared/schema.ts`)
- No ESLint or Prettier configuration exists yet: follow the style and naming of the surrounding code
- Keep shared rules in `src/shared` so that preview, PDF and storage use the same logic; avoid copies in single views
- The user interface and its texts are German
- Do not add dependencies without a clear reason, and mention new dependencies and their licenses in the pull request

## Reporting bugs

Use the [bug report form](https://github.com/mustafa-oezdemir/bewerbung_manager/issues/new?template=bug_report.yml) and
include the application version, your Windows version, the steps to reproduce and what you expected to happen.

Remove personal data from logs and screenshots first. Do not report security vulnerabilities as public issues; follow
[SECURITY.md](SECURITY.md) instead.
