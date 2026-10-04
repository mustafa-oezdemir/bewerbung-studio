# Risk based test strategy

The test basis is the root and app README files, `RELEASE.md`, the Zod schemas,
and the storage, workspace, security, IPC, and document code. Tests use Vitest
and real temporary directories for persistence. The Electron startup smoke runs
on Windows CI with an isolated workspace.

| State or invariant | Existing coverage | Added coverage | Remaining condition |
| --- | --- | --- | --- |
| Workspace saves survive restart and retain profile links | `electron/storage.test.ts`, `electron/workspace-management.test.ts` | — | Multi-instance process test |
| External modification and lost lock prevent writes | `electron/storage.test.ts` | — | Disk full and rename failure injection |
| Invalid backup leaves current workspace intact | Settings import test | Corrupt backup import test | Copy/rename failure during restore |
| Workspace move preserves source on failure | `electron/workspace-management.test.ts` | — | Failure after partial copy |
| Encryption enable, lock, password/recovery unlock, disable | `electron/security/*.test.ts` | Wrong password preserves encrypted workspace bytes | Interrupted migration across process restart |
| Malformed IPC input is rejected safely | Zod handlers | `electron/ipc-boundary.test.ts` and real Electron smoke | More channel-specific authorization cases |
| Private data never enters diagnostics | — | `electron/diagnostics.test.ts`, `electron/ipc-boundary.test.ts` | Audit every future log event |
| Windows main, preload, React and IPC start | Manual smoke script | Isolated fixture and Windows CI job | Installer/portable launch after packaging |

Select further tests by risk and failure mode. Prioritize persistence rollback,
encryption migration, and filesystem permission failures before adding broad UI
automation. Keep real filesystem and crypto primitives in integration tests;
mock only OS dialogs or inaccessible platform APIs. A new test library is needed
only when a specific uncovered condition requires it.
