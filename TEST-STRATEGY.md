# Risk based test strategy

The test basis is the root and app README files, `RELEASE.md`, the Zod schemas,
and the storage, workspace, security, IPC, and document code. Tests use Vitest
and real temporary directories for persistence. The Electron startup smoke runs
on Windows CI with an isolated workspace.

| State or invariant | Existing coverage | Added coverage | Remaining condition |
| --- | --- | --- | --- |
| Workspace saves survive restart and retain profile links | `electron/storage.test.ts`, `electron/workspace-management.test.ts` | Real Electron E2E creates a linked application, restarts, reloads, and checks a simultaneous second instance cannot write | — |
| External modification and lost lock prevent writes | `electron/storage.test.ts` | `electron/storage-faults.test.ts` injects disk full and rename failures | — |
| Invalid backup leaves current workspace intact | Settings import test | Corrupt import and injected emergency-copy/restore-rename failures | — |
| Workspace move preserves source on failure | `electron/workspace-management.test.ts` | Injected failure after a partial copy; bootstrap and source remain unchanged | — |
| Encryption enable, lock, password/recovery unlock, disable | `electron/security/*.test.ts` | Wrong password, staged verification failure, and migration resumption in a new OS process | — |
| Malformed IPC input is rejected safely | Zod handlers | `electron/ipc-boundary.test.ts` and real Electron E2E rejection without persisted side effects | More channel-specific authorization cases as new channels are added |
| Private data never enters diagnostics | — | `electron/diagnostics.test.ts`, `electron/ipc-boundary.test.ts` | Audit every future log event |
| Windows main, preload, React and IPC start | Manual smoke script | Multi-step Electron E2E plus portable and silently installed NSIS application launch in Windows CI | — |

Select further tests by risk and failure mode. Prioritize persistence rollback,
encryption migration, and filesystem permission failures before adding broad UI
automation. Keep real filesystem and crypto primitives in integration tests;
mock only OS dialogs or inaccessible platform APIs. A new test library is needed
only when a specific uncovered condition requires it.

Run `npm run release:check` for unit, integration, type and build checks. On
Windows, `npm run build && npm run test:electron:e2e` covers real renderer,
preload, IPC, persistence and two concurrent instances. After building Windows
artifacts with `node scripts/build-windows.mjs all`, run
`npm run test:windows:package` on an isolated Windows machine or CI runner; the
test silently installs and uninstalls the NSIS build. Locally,
`npm run test:windows:package -- --portable-only` checks only the portable EXE.
