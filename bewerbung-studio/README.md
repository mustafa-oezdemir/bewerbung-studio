# BewerbungsManager

A local desktop application for managing German job applications and creating a consistent set of cover sheet, cover letter, and CV documents.

## Technology

- Electron main process for the file system, dialogs, PDF export, and notifications
- React and TypeScript in strict mode for the interface
- Vite for development and builds
- Zustand for central UI state
- Zod for IPC and JSON validation
- Tailwind CSS 4 for the CSS toolchain
- Vitest for schema and validation tests

## Security model

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Only approved, typed IPC methods are exposed through the preload script
- The renderer cannot supply arbitrary file paths
- File names are normalized and sanitized
- External links are restricted to HTTP and HTTPS
- User input is escaped in document HTML
- JSON is written to a temporary file, synchronized, and replaced with a backup

### Optional workspace encryption

When opening a data set for the first time, you can enable or skip encryption. It is also available later under **Einstellungen → Datensicherheit & Verschlüsselung** (Settings → Data security & encryption). A master password of at least 14 characters and a separately stored recovery key unlock the data. If both are lost, there is no back door.

The application protects the contents of the managed `data` folder, including `workspace.json`, `bewerbung.json`, documents, and managed backups, with AES-256-GCM. Argon2id derives a key from the password to protect a random data key. The password, recovery key, and unencrypted data key are not stored in the application folder. If conversion is interrupted, a journal allows it to continue on the next unlock. Before enabling encryption, the application creates and verifies a complete backup. Conversion was tested with temporary test data; also back up your own data externally before enabling it for the first time.

**Limits:** Folder and file names remain visible. Earlier unencrypted file versions, copies, and Git commits are not removed retroactively. Decrypted files opened in external programs exist temporarily in plaintext; such temporary copies are removed on normal exit and at the next start. Secure deletion on SSDs cannot be guaranteed. PDFs and settings intentionally exported outside the data set remain unencrypted. Encryption does not provide complete protection while the application is unlocked or the operating system is compromised.

Optional device unlocking uses Electron `safeStorage` outside the application folder. When copying data to another computer, the master password and recovery key remain the portable ways to unlock it.

Technical references: [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [NIST SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final), and [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage).

## Data storage

On first launch, choose an application folder. The application stores its path in `bootstrap.json` in Electron's standard `userData` folder. Existing installations using `D:\bewerbung_mustafa\data\Settings\workspace.json` are detected automatically. `BEWERBUNG_ROOT_PATH` remains an override for development and tests. You can change the folder later under **Einstellungen → Speicherort / Bewerbungsordner** (Settings → Storage location / Application folder). Before moving it, the application creates a full backup with a manifest and verifies the copied files. The old folder remains as an additional recovery copy.

```text
<selected application folder>
└── data
    ├── Bewerbungen
    │   └── Firma_JJJJ-MM-TT
    │       └── Stellenbezeichnung
    │           ├── bewerbung.json
    │           ├── Anschreiben
    │           ├── Lebenslauf
    │           ├── Deckblatt
    │           ├── Email
    │           ├── Stellenanzeige
    │           └── Bewerbungsunterlagen
    ├── Zeugnisse
    ├── Zertifikate
    ├── Absagen
    └── Setting
        ├── Settings        (workspace.json, collections.json)
        ├── Profile         (one JSON file per main profile)
        ├── Backups
        └── Muster
```

`data/Setting/Settings/workspace.json` is a versioned index of settings and relative file references. Each application's `bewerbung.json` is the durable source of its application data, including its own profile. Main profiles and central collections are stored separately. Active applications, interviews, and rejections are views of the loaded application files.

The `sentAt` field is the primary source for an application's date; drafts use `createdAt` until a date is selected. The company folder is named `Firma_JJJJ-MM-TT`; two positions at the same company on the same day share that folder and each gets a subfolder named after the position. Dates in cover letters, Word content, and email files use `TT.MM.JJJJ`. Changing the date moves existing application folders without name collisions.

References and certificates remain in their central archive folders. An application stores only a relative link; the file is not copied for every application. On rejection, company-specific cover letters and CVs are moved to `Absagen`, while the record is retained.

Existing data can be imported under Settings with **Bisherigen data-Ordner migrieren** (migrate previous data folder). The application shows a preview and asks for explicit confirmation before copying. Source files are not deleted, and existing destination files are not overwritten.

## Commands

```powershell
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm start
npm run dist:win
```

For a renderer-only preview without Electron:

```powershell
$env:VITE_RENDERER_ONLY="1"
npm run dev
```

`npm run dist:win` checks the source code and creates a Windows installer, a portable build, `SHA256SUMS.txt`, and the [Windows installation guide](./WINDOWS-KURULUM.md) under `windows-release/`. The complete release checklist is in [RELEASE.md](./RELEASE.md). Public builds should be signed with a Windows code signing certificate before distribution.

## Features

- ToDo with an automatic application deadline task, separate from personal tasks
- Dashboard with status counts, success rate, deadlines, and due tasks
- Central application lists with search and status filters
- Automatic transitions for rejections, interviews, offers, and archiving
- Monthly calendar and agenda
- Automatic events from application, interview, and contract dates
- Follow-up after 7, 10, 14, or 21 days
- Native desktop notifications
- Validated application wizard
- CV templates (including Pehlione, Modern, Zweispaltig, and Kreativ) and three cover sheet designs
- Editable cover letter, CV, and cover sheet text
- PDF export of individual documents or the complete application package
- Central PDF storage for references and certificates
- Editable document metadata, categories, and application package order
- Preview, inclusion or exclusion, and safe deletion of managed PDF copies
- PDF merging in cover sheet, cover letter, CV, reference, and certificate order
- An editable, single-page DOCX cover sheet generated automatically and updated when application, profile, or attachment data changes
- Profiles, theme settings, and JSON backups
- Daily automatic JSON backups with configurable retention
- Validated restoration of complete backups with an emergency backup
- Separate export and import of application settings
- Locally cached application wizard drafts with automatic recovery
- Structured CV editor for work experience and education
- Drag and drop and accessible up/down sorting of entries
- CV sections that can be shown or hidden
- Job posting matching against the skills actually recorded in the profile
