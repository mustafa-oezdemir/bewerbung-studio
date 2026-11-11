# Windows releases

There is currently no public Windows release. The only official download location is [GitHub Releases](https://github.com/mustafa-oezdemir/bewerbung-studio/releases). Production binaries published there must be built from the [official repository](https://github.com/mustafa-oezdemir/bewerbung-studio) by GitHub Actions. The [code signing policy](../CODE_SIGNING.md) and [privacy policy](../PRIVACY.md) also apply to releases.

## Create a complete release build

```powershell
npm run dist:win
```

This command runs type checking, tests, and a production build, then creates the following files under `windows-release/`:

- `BewerbungsManager-<Version>-x64-Setup.exe`
- `BewerbungsManager-<Version>-x64-Portable.exe`
- `SHA256SUMS.txt`
- `WINDOWS-KURULUM.md` (Windows installation guide)

## Before distribution

- Update the version in `package.json`.
- Type checking, tests, and build must pass.
- Install Setup with a clean Windows user account.
- Check the Start menu entry and optional desktop shortcut.
- Create an application and close the program.
- Install the new version over the existing installation.
- Verify that data remains at the configured `BEWERBUNG_ROOT_PATH`; the default is `D:\bewerbung_mustafa`.
- Run migration only through the confirmed action in Settings. The source must remain unchanged after copying.
- Start the portable build and check the same data set.
- Test PDF export and JSON restoration.
- Publish SHA-256 checksums with the distributed files.

## Signing

Local test builds are normally unsigned. To test the existing certificate method locally, set the certificate and password for the current PowerShell session only:

```powershell
$env:WIN_CSC_LINK = 'C:\secure-folder\codesigning.pfx'
$env:WIN_CSC_KEY_PASSWORD = '<enter password locally>'
npm run dist:win:signed
```

`dist:win:signed` uses SHA-256 and an RFC 3161 timestamp. The build fails if it cannot produce a signature. Setup and Portable are then checked with `Get-AuthenticodeSignature`. Such a local build is not an official download; production binaries are built only in the GitHub Actions release workflow.

Do not copy or commit certificates, private keys, or passwords to this repository.

The existing `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` method remains until a separately reviewed replacement is ready. SignPath Foundation has not accepted this project. The workflow contains no SignPath integration, SignPath secrets, or invented organization or project identifiers. The goal remains a signed `v1.0.0` release. Each public download's release notes must state its origin and actual signing status. If SignPath Foundation is used later, the release page must include the acknowledgement required by the [code signing policy](../CODE_SIGNING.md).

### Bootstrap before SignPath approval

SignPath Foundation requires the project to have been released in the form to be signed. One possible bootstrap is a **separate GitHub prerelease explicitly named UNSIGNED/PREVIEW**, containing Setup and Portable files from a manual GitHub Actions run. Before publishing it, verify the build, checksums, installation, and clear notice that the files are unsigned. The current version-tag workflow publishes nothing without a certificate, so a `v1.0.0` tag cannot trigger this bootstrap. `v1.0.0` remains reserved for the intended signed production release.

**Open question:** SignPath must confirm whether such a clearly labelled prerelease satisfies its “already released in the form that should be signed” condition. This document evaluates the preview option; it does not trigger publication. Until a public download with accurate signing status is available, leave the optional “Download URL” field in a SignPath application empty.

## GitHub Actions

The workflows in `.github/workflows/` call the existing npm scripts; they do not implement a separate build process.

**CI** (`ci.yml`, Node.js 24, `ubuntu-latest`) runs on every pull request and every push to `main` or `codex/clean-release`:

```text
npm ci → npm run release:check   (type check → tests → production build)
```

If any step fails, CI fails. It uses no secrets and creates no release.

**Windows Release** (`release.yml`, Node.js 24, `windows-latest`) starts only for a version tag `vX.Y.Z`:

```powershell
git tag -a v1.0.0 -m "BewerbungsManager v1.0.0"
git push origin v1.0.0
```

GitHub Actions then:

1. Compares the tag with the versions in `package.json` and `package-lock.json` and stops on a mismatch.
2. Runs `npm run release:check` as a quality gate.
3. Runs `npm run dist:win:signed` if `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` secrets are set. A version tag without them fails before publication. Only a manual run without a tag may create `npm run dist:win` unsigned files as an internal workflow artifact. Secrets are available only to this build step and are never printed.
4. Checks artifacts with `scripts/verify-release-artifacts.ps1`: Setup, Portable, and `SHA256SUMS.txt` for exactly this version must exist and be nonempty; SHA-256 values are recalculated from the actual files; no key files are present.
5. Stores the four files as a workflow artifact named `bewerbungsmanager-windows-v<Version>` for 14 days.
6. With write permission limited to this job, rechecks the checksums and uses `gh release create` to publish Setup, Portable, `SHA256SUMS.txt`, and `WINDOWS-KURULUM.md`. If the release already exists, the job fails instead of overwriting files.

A manual `workflow_dispatch` run builds and stores the artifact. It publishes only when started on a `vX.Y.Z` tag with “publish” selected. Pull requests and pushes to `main` or `codex/clean-release` never create a release.

Recommended sequence: feature or fix branch → pull request → CI → merge into `main` → match the versions in `package.json` and `package-lock.json` → create tag `vX.Y.Z` → push the tag → signed Windows build → GitHub Release. Start this sequence only when the credentials and approvals required by the chosen signing method are actually available.

### Recommended branch protection

Configure GitHub → Settings → Branches / Rulesets for `main` (this is not enforced by the repository):

- Require a pull request
- Require the `CI` status check
- Require the branch to be up to date
- Disable force pushes
