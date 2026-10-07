# Windows-Release

Derzeit gibt es noch keinen öffentlichen Windows-Release. Der offizielle Download-Ort ist ausschließlich
[GitHub Releases](https://github.com/mustafa-oezdemir/bewerbung-studio/releases); dort veröffentlichte
Production-Binärdateien müssen aus den Quellen des
[offiziellen Repositories](https://github.com/mustafa-oezdemir/bewerbung-studio) mit GitHub Actions gebaut sein.
Die [Code signing policy](../CODE_SIGNING.md) und die [Datenschutzerklärung](../PRIVACY.md) gelten auch für Releases.

## Vollständigen Release erstellen

```powershell
npm run dist:win
```

Der Befehl führt Typprüfung, Tests und Produktions-Build aus und erzeugt
anschließend unter `windows-release/`:

- `BewerbungsManager-<Version>-x64-Setup.exe`
- `BewerbungsManager-<Version>-x64-Portable.exe`
- `SHA256SUMS.txt`
- `WINDOWS-KURULUM.md` (Windows kurulum kılavuzu)

## Vor der Weitergabe

- Versionsnummer in `package.json` aktualisieren.
- Typprüfung, Tests und Build müssen ohne Fehler durchlaufen.
- Setup auf einem sauberen Windows-Benutzerkonto installieren.
- Startmenüeintrag und optionalen Desktop-Link prüfen.
- Eine Bewerbung anlegen und die Anwendung schließen.
- Neue Version über die vorhandene Installation installieren.
- Prüfen, dass Daten unter dem konfigurierten `BEWERBUNG_ROOT_PATH` erhalten
  bleiben; Standard ist `D:\bewerbung_mustafa`.
- Eine Migration nur über die bestätigte Funktion in den Einstellungen
  ausführen. Die bisherige Quelle muss nach dem Kopieren unverändert bleiben.
- Portable Ausgabe starten und denselben Datenbestand prüfen.
- PDF-Export und JSON-Wiederherstellung testen.
- SHA-256-Prüfsummen mit den ausgelieferten Dateien veröffentlichen.

## Signierung

Lokale Test-Builds sind normalerweise nicht signiert. Für eine lokale Prüfung des bisherigen Zertifikatswegs können
Zertifikat und Passwort ausschließlich für die aktuelle PowerShell-Sitzung gesetzt werden:

```powershell
$env:WIN_CSC_LINK = 'C:\sicherer-ordner\codesigning.pfx'
$env:WIN_CSC_KEY_PASSWORD = '<Passwort lokal eingeben>'
npm run dist:win:signed
```

`dist:win:signed` verwendet SHA-256 und einen RFC-3161-Zeitstempel. Der Build
schlägt fehl, wenn keine Signatur erzeugt wurde. Anschließend werden Setup und
Portable-Ausgabe mit `Get-AuthenticodeSignature` geprüft. Ein solcher lokaler Build ist kein offizieller Download;
Production-Binärdateien werden nur im GitHub-Actions-Release-Workflow gebaut.

Zertifikate, private Schlüssel und Passwörter dürfen nicht in dieses Repository
kopiert oder eingecheckt werden.

Der bestehende `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD`-Weg bleibt bis zu einer separat geprüften Umstellung
erhalten. SignPath Foundation hat dieses Projekt noch nicht angenommen; der Workflow enthält weder eine
SignPath-Anbindung noch SignPath-Secrets oder erfundene Organisations-/Projektkennungen. Ziel bleibt ein signierter
`v1.0.0`-Release. Die Herkunft und der tatsächliche Signaturstatus jedes öffentlichen Downloads müssen in dessen
Release Notes stehen. Wird später SignPath Foundation verwendet, muss die Release-Seite die in der
[Code signing policy](../CODE_SIGNING.md) festgelegte SignPath-Nennung enthalten.

### Bootstrap vor einer SignPath-Zusage

SignPath Foundation verlangt, dass das Projekt bereits in der Form veröffentlicht wurde, die signiert werden soll.
Ein möglicher Bootstrap ist ein **separater, ausdrücklich „UNSIGNED/PREVIEW“ genannter GitHub-Prerelease** mit
Setup- und Portable-Datei aus einem manuellen GitHub-Actions-Lauf. Vor einer solchen Veröffentlichung wären Build,
Prüfsummen, Installation und ein eindeutiger Hinweis auf die fehlende Signatur zu prüfen. Der bestehende
Versions-Tag-Workflow veröffentlicht ohne Zertifikat nichts; deshalb lässt sich dieser Bootstrap nicht einfach
durch einen `v1.0.0`-Tag auslösen. `v1.0.0` bleibt für den angestrebten signierten Production-Release reserviert.

**Offen:** SignPath muss bestätigen, ob ein so gekennzeichneter Prerelease seine „already released in the form that
should be signed“-Bedingung tatsächlich erfüllt. Die Veröffentlichung eines Preview-Releases wird hier nur
bewertet, nicht ausgelöst. Bis ein öffentlicher Download mit korrektem Signaturstatus verfügbar ist, bleibt das
optionale „Download URL“-Feld einer SignPath-Bewerbung leer.

## GitHub Actions

Die Workflows liegen unter `.github/workflows/` und rufen die vorhandenen
npm-Skripte auf; es gibt keine eigene Build-Logik.

**CI** (`ci.yml`, Node.js 24, `ubuntu-latest`) läuft bei jedem Pull Request und
bei jedem Push auf `main` oder `codex/clean-release`:

```text
npm ci → npm run release:check   (Typprüfung → Tests → Produktions-Build)
```

Schlägt einer der Schritte fehl, ist die CI rot. Es werden keine Secrets
verwendet und es entsteht kein Release.

**Windows Release** (`release.yml`, Node.js 24, `windows-latest`) startet nur bei
einem Versions-Tag `vX.Y.Z`:

```powershell
git tag -a v1.0.0 -m "BewerbungsManager v1.0.0"
git push origin v1.0.0
```

Danach führt GitHub Actions automatisch aus:

1. Tag und Version in `package.json` und `package-lock.json` vergleichen
   (Abweichung bricht ab).
2. `npm run release:check` als Qualitätsschranke.
3. `npm run dist:win:signed`, wenn die Secrets `WIN_CSC_LINK` und
   `WIN_CSC_KEY_PASSWORD` gesetzt sind. Fehlen sie bei einem Versions-Tag, bricht der Lauf vor dem Release ab.
   Nur ein manueller Lauf ohne Tag darf `npm run dist:win` (unsigniert) als internes Workflow-Artefakt ausführen.
   Die Secrets stehen nur in diesem Build-Schritt und werden nie ausgegeben.
4. Dateien prüfen (`scripts/verify-release-artifacts.ps1`): Setup, Portable und
   `SHA256SUMS.txt` für genau diese Version vorhanden und nicht leer,
   SHA-256-Werte aus den echten Dateien neu berechnet, keine Schlüsseldateien.
5. Die vier Dateien als Workflow-Artefakt `bewerbungsmanager-windows-v<Version>`
   speichern (14 Tage).
6. Mit dem Schreibrecht nur in diesem Job: Prüfsummen erneut prüfen und mit
   `gh release create` ein GitHub Release mit Setup, Portable,
   `SHA256SUMS.txt` und `WINDOWS-KURULUM.md` veröffentlichen. Existiert das Release schon, bricht der
   Lauf ab, statt Dateien zu überschreiben.

Ein manueller Lauf (`workflow_dispatch`) baut und speichert das Artefakt;
er veröffentlicht nur, wenn er auf einem `vX.Y.Z`-Tag gestartet und „publish“
angehakt wird. Pull Requests und Pushes auf `main` oder `codex/clean-release` erzeugen nie ein Release.

Empfohlener Ablauf: Feature-/Fix-Branch → Pull Request → CI → Merge nach `main`
→ Versionsnummer mit `package.json` und `package-lock.json` abgleichen → Tag `vX.Y.Z`
→ Tag pushen → signierter Windows-Build → GitHub Release. Diesen Ablauf erst starten, wenn die für die gewählte
Signierungsart nötigen Zugangsdaten und Freigaben tatsächlich vorliegen.

### Empfohlener Branch-Schutz

Unter GitHub → Settings → Branches / Rulesets für `main` einrichten (wird nicht
vom Repository erzwungen):

- Pull Request erforderlich
- Status-Check `CI` erforderlich
- Branch muss aktuell sein („up to date“)
- Force-Push deaktiviert
