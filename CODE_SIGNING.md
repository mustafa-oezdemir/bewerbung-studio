# Code signing policy

BewerbungsManager is an [Apache-2.0](LICENSE) open-source project. Its official source repository is
<https://github.com/mustafa-oezdemir/bewerbung-studio>. The only official publication location for Windows
downloads is [GitHub Releases](https://github.com/mustafa-oezdemir/bewerbung-studio/releases).
Production Windows binaries are built from this repository by GitHub Actions; local builds are for testing and are
not official downloads. The release process and its current signing route are documented in
[bewerbung-studio/RELEASE.md](bewerbung-studio/RELEASE.md).

The project has one maintainer. The [repository owner](https://github.com/mustafa-oezdemir) currently holds these
responsibilities:

| Role | Responsible person |
| --- | --- |
| Committer / Reviewer | Repository owner |
| Approver of signing requests | Repository owner |

Changes proposed by outside contributors are reviewed by the owner before merge. The owner also makes the release
decision. Having one person in both roles does **not** establish that self-review or self-approval meets SignPath
Foundation's requirements. SignPath must confirm whether this arrangement is acceptable before the project uses its
certificate. Each future SignPath signing request will require manual approval under the approved policy.

Repository and SignPath access require multi-factor authentication (MFA). The owner's GitHub MFA enrollment and any
SignPath MFA setup must be checked in the respective account settings; credentials, recovery codes, signing keys and
tokens must never be stored in this repository.

The [privacy policy](PRIVACY.md) describes local storage and user-initiated external links. The app does not contain
automatic telemetry, cloud synchronization or an automatic update request in the reviewed application code.

The project has **not** been accepted by SignPath Foundation and does **not** currently claim SignPath-signed
binaries. If free code signing is approved and used, the download/release page will display this exact credit:

> Free code signing provided by SignPath.io, certificate by SignPath Foundation

Until then, that sentence describes a planned attribution, not the signature status of any existing build. An
official release page must state the actual signature status of its attached files. The existing certificate-based
`WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` path remains in the workflow; no SignPath integration is configured yet.

The [SignPath Foundation conditions](https://signpath.org/terms.html) also require an existing release in the form
to be signed. The proposed unsigned preview and its unresolved eligibility are documented in
[the release guide](bewerbung-studio/RELEASE.md#bootstrap-vor-einer-signpath-zusage).
