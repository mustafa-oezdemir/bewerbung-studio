# Privacy policy

BewerbungsManager is a local Windows desktop application. This policy describes the application code in the
[official repository](https://github.com/mustafa-oezdemir/bewerbung-studio); it does not govern GitHub, websites
opened in a browser, or third-party programs used to view exported documents.

## Data stored on your computer

The application processes job advertisements, applicant profiles, contact details, résumés, cover letters,
certificates, tasks and related documents. It saves them in the workspace you select. The workspace contains
`data/Setting/Settings/workspace.json`, application folders, attachments and local backups. A small local bootstrap
file records the workspace location. The application does not require a BewerbungsManager account or cloud
synchronization. Optional workspace encryption and backup/export controls are described in the [README](README.md).

## Network behavior

The reviewed application code has no telemetry, analytics or automatic update request. It uploads the workspace
only through its Git synchronization: if the workspace folder is a Git repository whose `origin` is
`https://github.com/mustafa-oezdemir/bewerbung.git`, creating an application, saving a changed section in the
Bewerbungen view or changing an application status commits the managed `data` folder and pushes the current branch
to that repository with a normal `git push`, using the Git credentials already configured on your computer. The
application never changes the remote, never force-pushes and stores no credentials; in any other setup nothing is
pushed and the change stays local. When you explicitly open a job posting,
repository or other HTTP/HTTPS link, the application hands it to your system's external browser; that browser and
website may exchange data under their own privacy policies. You may also choose to export, copy or share application
documents yourself. Development tools and GitHub Actions have separate network behavior and do not run as part of
the installed desktop application.

## Control and retention

Your workspace and its backups remain on your computer or at a location you choose. You can move, back up, export
or delete them. Exports and files opened in other programs can leave unencrypted copies outside the managed
workspace. Previously created copies or Git commits are not removed automatically. Uninstalling the app does not
automatically delete your chosen workspace. See [README — Daten & Datenschutz](README.md#daten--datenschutz)
for storage, encryption and backup details.

## Security reports

If you find a privacy or security issue, follow the private reporting instructions in [SECURITY.md](SECURITY.md).
