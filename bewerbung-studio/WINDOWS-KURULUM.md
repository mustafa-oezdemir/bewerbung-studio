# BewerbungsManager — Windows installation

## Downloads

There are two options for Windows x64:

- `BewerbungsManager-<Version>-x64-Setup.exe`: installs the application on your computer.
- `BewerbungsManager-<Version>-x64-Portable.exe`: runs without installation.

Published versions are available under **Assets** on [GitHub Releases](https://github.com/mustafa-oezdemir/bewerbung-studio/releases/latest). A locally built version is placed in `windows-release`.

Use `SHA256SUMS.txt` to verify the file. Run the following command in PowerShell from the file's folder and compare the output with the checksum list:

```powershell
Get-FileHash -Algorithm SHA256 .\BewerbungsManager-<Version>-x64-Setup.exe
```

## Install with Setup

1. Close all open BewerbungsManager windows.
2. Run `...-Setup.exe` and follow the installation steps.
3. Open the application from the Start menu. On first launch, if prompted, use **Neuen Bewerbungsordner auswählen** (select a new application folder) to choose where your data will be stored. To open existing data, use **Workspace-Datei auswählen …** (select workspace file).
4. You can later find the current location under **Einstellungen → Speicherort** (Settings → Storage location).

## Windows warnings

Each published version's release page states its signing status. Locally built versions are normally unsigned. Windows may warn about unsigned files; if Smart App Control is enabled, it may block them entirely. Run only files whose source and checksum you have verified.

## Portable version

Place `...-Portable.exe` in any folder and run it. If you use the same data folder with the Setup version, do not run both versions at once. Deleting the portable EXE does not delete application data stored in a separate folder.

## Updates and data safety

Before installing a new version, create a backup under **Einstellungen → Übertragen & Sicherung → Jetzt sichern** (Settings → Transfer & Backup → Back up now) and copy it to another location. **Backup-Ordner öffnen** (open backup folder) shows where it was saved. Then close the application and run the new Setup file. Application data is stored in its own folder, separate from program files. After the update, check that the same data folder is open and your profile is visible.

If an error occurs, report the complete message, application version, and step at which it happened. Do not include personal application data or passwords in public GitHub issues.
