# BewerbungsManager – Installation unter Windows

## Downloads

Für Windows x64 gibt es zwei Varianten:

- `BewerbungsManager-<Version>-x64-Setup.exe`: Installiert die Anwendung auf dem Computer.
- `BewerbungsManager-<Version>-x64-Portable.exe`: Läuft ohne Installation.

Veröffentlichte Versionen finden Sie unter [GitHub Releases](https://github.com/mustafa-oezdemir/bewerbung-studio/releases/latest) im Bereich **Assets**. Ein lokal erzeugter Build liegt im Ordner `windows-release`.

Mit `SHA256SUMS.txt` können Sie die Datei prüfen. Führen Sie dazu in PowerShell im Ordner der Datei den folgenden Befehl aus und vergleichen Sie den ausgegebenen Wert mit der Liste:

```powershell
Get-FileHash -Algorithm SHA256 .\BewerbungsManager-<Version>-x64-Setup.exe
```

## Installation mit Setup

1. Schließen Sie alle geöffneten BewerbungsManager-Fenster.
2. Starten Sie die `...-Setup.exe` und folgen Sie den Installationsschritten.
3. Öffnen Sie die Anwendung über das Startmenü. Wählen Sie beim ersten Start, falls Sie danach gefragt werden, mit **Neuen Bewerbungsordner auswählen** einen Datenordner für Ihre Bewerbungen. Vorhandene Daten öffnen Sie mit **Workspace-Datei auswählen …**.
4. Den aktuellen Speicherort finden Sie später unter **Einstellungen → Speicherort**.

## Windows-Warnungen

Der Signaturstatus jeder veröffentlichten Version steht auf ihrer Release-Seite. Lokal erzeugte Builds sind normalerweise nicht signiert. Bei nicht signierten Dateien kann Windows eine Warnung anzeigen; ist die Intelligente App-Steuerung aktiviert, kann Windows sie auch vollständig blockieren. Führen Sie nur Dateien aus, deren Herkunft und Prüfsumme Sie geprüft haben.

## Portable-Version

Legen Sie die `...-Portable.exe` in einen beliebigen Ordner und starten Sie sie. Wenn Sie denselben Datenordner auch mit der Setup-Version verwenden, öffnen Sie nicht beide Versionen gleichzeitig. Das Löschen der Portable-EXE entfernt keine Bewerbungsdaten, die Sie in einem separaten Ordner aufbewahren.

## Update und Datensicherheit

Erstellen Sie vor der Installation einer neuen Version unter **Einstellungen → Übertragen & Sicherung** mit **Jetzt sichern** eine Sicherung und kopieren Sie diese an einen anderen Ort. Über **Backup-Ordner öffnen** gelangen Sie zum Ablageort. Schließen Sie anschließend die Anwendung und starten Sie die neue Setup-Datei. Die Bewerbungsdaten liegen getrennt von den Programmdateien in einem eigenen Bewerbungsordner. Prüfen Sie nach dem Update, ob derselbe Datenordner geöffnet wurde und Ihr Profil sichtbar ist.

Wenn ein Fehler auftritt, teilen Sie bitte die vollständige Meldung, die Anwendungsversion und den Arbeitsschritt mit, bei dem er aufgetreten ist. Fügen Sie persönliche Bewerbungsdaten oder Passwörter nicht in öffentliche GitHub-Issues ein.
