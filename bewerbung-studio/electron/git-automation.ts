import { watch, type FSWatcher } from "node:fs";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { resolveApplicationPaths } from "../src/config/application-paths";

export const APPLICATION_DATA_REMOTE =
  "https://github.com/mustafa-oezdemir/bewerbung.git";

export type ApplicationGitAction =
  | "create"
  | "bewerbung"
  | "update"
  | "delete"
  | "absage"
  | "vorstellungsgespraech"
  | "anschreiben";

export interface ApplicationGitCommitQueue {
  queueCommit(companyName: string, action: ApplicationGitAction): void;
}

type PowerShellRunner = (
  scriptPath: string,
  repositoryPath: string,
  remoteUrl: string,
  commitMessage: string,
) => Promise<void>;

type GitAutomationOptions = {
  remoteUrl?: string;
  runner?: PowerShellRunner;
  watchFileChanges?: boolean;
  now?: () => Date;
};

const execFileAsync = promisify(execFile);

const powershellScript = `param(
  [Parameter(Mandatory = $true)][string]$RepositoryPath,
  [Parameter(Mandatory = $true)][string]$RemoteUrl,
  [Parameter(Mandatory = $true)][string]$CommitMessage
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArguments)
  & git -C $RepositoryPath @GitArguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($GitArguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

function Assert-WorkspaceIntegrity {
  $workspacePath = Join-Path $RepositoryPath "data\Setting\Settings\workspace.json"
  if (Test-Path -LiteralPath $workspacePath) {
    try {
      Get-Content -LiteralPath $workspacePath -Raw | ConvertFrom-Json -ErrorAction Stop | Out-Null
    } catch {
      throw "Workspace JSON is invalid. Git synchronization was stopped without changing repository history."
    }
  }
  $unmerged = @(& git -C $RepositoryPath diff --name-only --diff-filter=U)
  if ($LASTEXITCODE -ne 0 -or $unmerged.Count -gt 0) {
    throw "Unresolved Git conflicts detected. Git synchronization was stopped."
  }
}

$insideWorkTree = & git -C $RepositoryPath rev-parse --is-inside-work-tree 2>$null
if ($LASTEXITCODE -ne 0 -or $insideWorkTree.Trim() -ne "true") {
  throw "No Git repository found at $RepositoryPath."
}

$remotes = @(& git -C $RepositoryPath remote)
if ($LASTEXITCODE -ne 0) {
  throw "Unable to list Git remotes."
}
if ($remotes -notcontains "origin") {
  Invoke-Git remote add origin $RemoteUrl
} else {
  $originUrl = & git -C $RepositoryPath remote get-url origin
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to read the origin URL."
  }
  if ($originUrl.Trim() -ne $RemoteUrl) {
    Invoke-Git remote set-url origin $RemoteUrl
  }
}

Assert-WorkspaceIntegrity
Invoke-Git add --all
& git -C $RepositoryPath diff --cached --quiet
$diffExitCode = $LASTEXITCODE
if ($diffExitCode -eq 1) {
  Invoke-Git commit --message $CommitMessage
} elseif ($diffExitCode -ne 0) {
  throw "git diff --cached --quiet failed with exit code $diffExitCode."
}

& git -C $RepositoryPath push origin HEAD:main
if ($LASTEXITCODE -ne 0) {
  throw "Git push failed. Local application data and history were preserved without an automatic merge."
}
`;

const defaultRunner: PowerShellRunner = async (
  scriptPath,
  repositoryPath,
  remoteUrl,
  commitMessage,
) => {
  await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-RepositoryPath",
      repositoryPath,
      "-RemoteUrl",
      remoteUrl,
      "-CommitMessage",
      commitMessage,
    ],
    { windowsHide: true, timeout: 120_000, maxBuffer: 1024 * 1024 },
  );
};

const localTimestamp = (date: Date) => {
  const part = (value: number) => String(value).padStart(2, "0");
  return [
    `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`,
    `${part(date.getHours())}:${part(date.getMinutes())}:${part(date.getSeconds())}`,
  ].join(" ");
};

export const buildApplicationCommitMessage = (
  companyName: string,
  action: ApplicationGitAction,
  date = new Date(),
) => {
  const company = companyName
    .replace(/[\r\n|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${company || "Bewerbung"} | ${localTimestamp(date)} | ${action}`;
};

export const inferApplicationGitChange = (relativePath: string) => {
  const parts = relativePath.split(/[\\/]+/).filter(Boolean);
  const applicationRoots = [
    "Anschreiben",
    "Lebenslauf",
    "Absagen",
    "Vorstellungsgespräch",
  ];
  const knownRootIndex = applicationRoots.includes(parts[0])
    ? 0
    : parts[0] === "data" && parts[1] === "Bewerbungen"
      ? 1
      : -1;
  if (knownRootIndex < 0) return undefined;
  const category = parts[knownRootIndex];
  const folder = knownRootIndex >= 0 ? parts[knownRootIndex + 1] : undefined;
  if (!folder) return undefined;
  const companyName = folder
    .replace(/_(?:\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2}|Termin_offen)$/, "")
    .replace(/_/g, " ");
  const action: ApplicationGitAction =
    category === "Anschreiben"
      ? "anschreiben"
      : category === "Absagen"
        ? "absage"
        : category === "Vorstellungsgespräch"
          ? "vorstellungsgespraech"
          : "update";
  return { companyName, action };
};

const shouldIgnoreWatchEvent = (relativePath: string) => {
  const normalized = relativePath.replace(/\\/g, "/");
  const fileName = path.basename(normalized);
  return (
    normalized.startsWith(".git/") ||
    normalized.startsWith("data/Setting/Logs/") ||
    normalized.startsWith("data/Setting/Electron/") ||
    normalized.startsWith("data/Setting/ElectronSession/") ||
    normalized.startsWith("data/Setting/CrashDumps/") ||
    normalized.startsWith("data/Setting/cache/") ||
    fileName.startsWith("~$") ||
    /\.(?:tmp|temp|log|bak)$/i.test(fileName)
  );
};

export class GitAutomationService implements ApplicationGitCommitQueue {
  private readonly remoteUrl: string;
  private readonly runner: PowerShellRunner;
  private readonly watchFileChanges: boolean;
  private readonly now: () => Date;
  private readonly scriptPath: string;
  private readonly logPath: string;
  private pending: Promise<void> = Promise.resolve();
  private lastError?: Error;
  private watcher?: FSWatcher;
  private watchTimer?: NodeJS.Timeout;
  private pendingWatchChange?: {
    companyName: string;
    action: ApplicationGitAction;
  };

  constructor(
    private readonly repositoryPath: string,
    options: GitAutomationOptions = {},
  ) {
    this.remoteUrl = options.remoteUrl ?? APPLICATION_DATA_REMOTE;
    this.runner = options.runner ?? defaultRunner;
    this.watchFileChanges = options.watchFileChanges ?? true;
    this.now = options.now ?? (() => new Date());
    const paths = resolveApplicationPaths(repositoryPath);
    this.scriptPath = path.join(paths.settingsRoot, "auto-git-sync.ps1");
    this.logPath = path.join(paths.logsRoot, "git-automation.log");
  }

  async initialize() {
    await mkdir(path.dirname(this.scriptPath), { recursive: true });
    await mkdir(path.dirname(this.logPath), { recursive: true });
    await writeFile(this.scriptPath, powershellScript, "utf8");
    if (this.watchFileChanges) this.startWatcher();
  }

  queueCommit(companyName: string, action: ApplicationGitAction) {
    if (this.watchTimer) {
      clearTimeout(this.watchTimer);
      this.watchTimer = undefined;
      this.pendingWatchChange = undefined;
    }
    this.enqueueCommit(companyName, action);
  }

  private enqueueCommit(companyName: string, action: ApplicationGitAction) {
    const commitMessage = buildApplicationCommitMessage(
      companyName,
      action,
      this.now(),
    );
    this.pending = this.pending
      .then(() =>
        this.runner(
          this.scriptPath,
          this.repositoryPath,
          this.remoteUrl,
          commitMessage,
        ),
      )
      .catch((error) => {
        this.lastError =
          error instanceof Error ? error : new Error(String(error));
        return this.logFailure(commitMessage, error);
      });
  }

  async waitForIdle() {
    await this.pending;
    if (this.lastError) {
      const error = this.lastError;
      this.lastError = undefined;
      throw error;
    }
  }

  dispose() {
    if (this.watchTimer && this.pendingWatchChange) {
      clearTimeout(this.watchTimer);
      this.watchTimer = undefined;
      const change = this.pendingWatchChange;
      this.pendingWatchChange = undefined;
      this.enqueueCommit(change.companyName, change.action);
    }
    this.watcher?.close();
    this.watcher = undefined;
  }

  private startWatcher() {
    try {
      this.watcher = watch(
        this.repositoryPath,
        { recursive: true },
        (_eventType, fileName) => {
          if (!fileName) return;
          const relativePath = String(fileName);
          if (shouldIgnoreWatchEvent(relativePath)) return;
          const change = inferApplicationGitChange(relativePath);
          if (!change) return;
          this.pendingWatchChange = change;
          if (this.watchTimer) clearTimeout(this.watchTimer);
          this.watchTimer = setTimeout(() => {
            this.watchTimer = undefined;
            const pendingChange = this.pendingWatchChange;
            this.pendingWatchChange = undefined;
            if (pendingChange) {
              this.enqueueCommit(
                pendingChange.companyName,
                pendingChange.action,
              );
            }
          }, 2_500);
          this.watchTimer.unref();
        },
      );
      this.watcher.on("error", (error) => {
        void this.logFailure("Dateiüberwachung", error);
      });
    } catch (error) {
      void this.logFailure("Dateiüberwachung", error);
    }
  }

  private async logFailure(commitMessage: string, error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    await appendFile(
      this.logPath,
      `[${new Date().toISOString()}] ${commitMessage}: ${detail}\n`,
      "utf8",
    ).catch(() => undefined);
  }
}
