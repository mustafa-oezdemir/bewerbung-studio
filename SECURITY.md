# Security Policy

## Supported versions

Security fixes are provided for the latest release only. Please update to the
[latest release](https://github.com/mustafa-oezdemir/bewerbung-studio/releases/latest) before you report a problem.

| Version | Supported |
| --- | --- |
| Latest release | Yes |
| Older releases | No |

## Reporting a vulnerability

**Please do not report security vulnerabilities as public GitHub issues, discussions or pull requests.**

Use GitHub's private reporting instead:

1. Open the [Security tab](https://github.com/mustafa-oezdemir/bewerbung-studio/security) of this repository.
2. Choose **Advisories**, then **Report a vulnerability**.
3. Describe the problem, the affected version and the steps to reproduce it.

If the option is not available, contact the maintainer through the contact options on their GitHub profile,
[https://github.com/mustafa-oezdemir](https://github.com/mustafa-oezdemir), and share no details in public. If no
private contact option exists there, open an issue that only asks for a private way to get in touch.

This is a volunteer project. Reports are handled on a best-effort basis: expect an acknowledgement first and a fix in
a later release. Please allow time for a fix before you disclose a problem publicly.

### What is in scope

BewerbungsManager is a local desktop application. Relevant reports include, for example, unsafe file access or path
handling, flaws in the Electron isolation (`contextIsolation`, `sandbox`, IPC), unsafe handling of imported files or
templates, and leaking of personal data from the application folder.

## Sensitive data

BewerbungsManager processes personal data such as addresses, phone numbers, e-mail addresses, résumés and
certificates.

- Do not attach real application documents, résumés, certificates or the `workspace.json` of your data folder to a
  report. Use fictional data that reproduces the problem.
- Remove personal data from logs and screenshots before you share them.
- Never commit real application data, credentials or signing certificates (`.pfx`, `.p12`) to this repository. If you
  find such data in the repository or its history, report it privately as described above.
