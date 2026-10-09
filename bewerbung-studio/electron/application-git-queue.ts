import { spawn } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ApplicationPaths } from "../src/config/application-paths";
import type { ApplicationGitSyncOutcome } from "../src/shared/ipc";
import { logDiagnostic } from "./diagnostics";

/** The only repository the Bewerbungsordner is pushed to. */
export const APPLICATION_DATA_REMOTE = "https://github.com/mustafa-oezdemir/bewerbung.git";

export type ApplicationGitAction =
  | "create"
  | "bewerbung"
  | "update"
  | "status"
  | "delete"
  | "absage"
  | "vorstellungsgespraech"
  | "anschreiben";

/** DataStore records what changed; the change is committed when the IPC operation finished all its files. */
export interface ApplicationGitCommitQueue {
  queueCommit(companyName: string, action: ApplicationGitAction): void;
}

type ApplicationGitIntent = { companyName: string; action: ApplicationGitAction };

const commitTitles: Record<ApplicationGitAction, string> = {
  create: "Bewerbung angelegt",
  bewerbung: "Bewerbung gesendet",
  update: "Bewerbung aktualisiert",
  status: "Status aktualisiert",
  delete: "Bewerbung gelöscht",
  absage: "Status aktualisiert (Absage)",
  vorstellungsgespraech: "Status aktualisiert (Vorstellungsgespräch)",
  anschreiben: "Anschreiben aktualisiert",
};

export const applicationCommitLine = (companyName: string, action: ApplicationGitAction) => {
  const company = companyName
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${commitTitles[action]}: ${company || "ohne Firmenname"}`;
};

/** One commit per flush: the first change is the subject, every distinct change is listed in the body. */
export const buildApplicationCommitMessage = (intents: readonly ApplicationGitIntent[]) => {
  const lines = [...new Set(intents.map((intent) => applicationCommitLine(intent.companyName, intent.action)))];
  if (lines.length <= 1) return { subject: lines[0] ?? "Bewerbungsdaten aktualisiert", body: "" };
  return {
    subject: `${lines[0]} (+${lines.length - 1} weitere)`,
    body: lines.map((line) => `- ${line}`).join("\n"),
  };
};

const githubRepositoryPath = /^\/?([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/;

/**
 * The repository a remote URL points to. GitHub URLs are equal when owner and repository match (case-insensitive,
 * with or without `.git` or a trailing slash) over HTTPS (port 443, optional user name) or SSH as `git`. Local paths
 * and `file://` URLs only serve as test remotes. Anything else is unknown and never matches.
 */
export const describeRemote = (rawUrl: string): { identity: string; hasCredentials: boolean } | null => {
  const url = rawUrl.trim();
  const github = (match: RegExpExecArray) => `github.com/${match[1]}/${match[2]}`.toLowerCase();
  const scp = /^git@github\.com:(.+)$/i.exec(url);
  if (scp) {
    const match = githubRepositoryPath.exec(scp[1]);
    return match ? { identity: github(match), hasCredentials: false } : null;
  }
  if (/^(?:https|ssh):\/\//i.test(url)) {
    let parsed: URL;
    try { parsed = new URL(url); } catch { return null; }
    if (parsed.hostname.toLowerCase() !== "github.com" || parsed.search || parsed.hash) return null;
    if (parsed.protocol === "https:" && parsed.port && parsed.port !== "443") return null;
    if (parsed.protocol === "ssh:" &&
        ((parsed.port && parsed.port !== "22") || parsed.username !== "git" || parsed.password)) return null;
    const match = githubRepositoryPath.exec(parsed.pathname);
    return match ? { identity: github(match), hasCredentials: Boolean(parsed.password) } : null;
  }
  let localPath: string | null = null;
  if (/^file:\/\//i.test(url)) {
    try { localPath = fileURLToPath(url); } catch { return null; }
  } else if (path.isAbsolute(url)) {
    localPath = url;
  }
  if (!localPath) return null;
  const resolved = path.resolve(localPath);
  return { identity: `file:${process.platform === "win32" ? resolved.toLowerCase() : resolved}`, hasCredentials: false };
};

const failureReasons = {
  "git-missing": "Git wurde nicht gefunden. Bitte Git für Windows installieren.",
  "not-repository": "Der Bewerbungsordner ist kein Git-Repository.",
  "not-repository-root": "Der Bewerbungsordner ist nicht die Wurzel seines Git-Repositorys.",
  "detached-head": "Im Git-Repository ist kein Branch ausgecheckt (detached HEAD).",
  "remote-missing": "Im Git-Repository ist kein Remote „origin“ eingerichtet.",
  "remote-mismatch": "Das Remote „origin“ zeigt nicht auf das Repository mustafa-oezdemir/bewerbung.",
  "remote-credentials": "Die Remote-URL von „origin“ enthält Zugangsdaten. Bitte die Git-Anmeldung von Windows verwenden.",
  "stage-failed": "Die Änderungen konnten nicht für Git vorgemerkt werden.",
  "commit-failed": "Der Git-Commit konnte nicht erstellt werden.",
  "non-fast-forward": "GitHub enthält neuere Commits. Bitte das Repository manuell zusammenführen; es wurde kein Force-Push ausgeführt.",
  "auth-failed": "Die Anmeldung bei GitHub ist fehlgeschlagen.",
  "network": "GitHub ist nicht erreichbar. Bitte die Internetverbindung prüfen.",
  "push-rejected": "GitHub hat den Push abgelehnt.",
  "push-failed": "Der Push zu GitHub ist fehlgeschlagen.",
  "timeout": "Git hat nicht rechtzeitig geantwortet.",
  "git-failed": "Ein Git-Befehl ist fehlgeschlagen.",
} as const;

export type ApplicationGitFailureCode = keyof typeof failureReasons;

class GitSyncFailure extends Error {
  constructor(readonly code: ApplicationGitFailureCode) {
    super(code);
  }
}

/** Push output is only classified here; it may contain URLs and is never shown or logged. */
export const classifyPushFailure = (output: string): ApplicationGitFailureCode => {
  if (/\[rejected\]|non-fast-forward|fetch first/i.test(output)) return "non-fast-forward";
  if (/\[remote rejected\]/i.test(output)) return "push-rejected";
  if (/authentication failed|could not read (?:username|password)|terminal prompts disabled|invalid username or password|permission denied|returned error: 40[13]|repository not found/i.test(output))
    return "auth-failed";
  if (/could not resolve host|failed to connect|couldn't connect|connection (?:timed out|refused|reset)|network is unreachable|timed out/i.test(output))
    return "network";
  return "push-failed";
};

// A GIT_DIR or GIT_WORK_TREE inherited from the launching shell would point Git at another repository.
const repositoryEnvironmentKeys = [
  "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR", "GIT_NAMESPACE", "GIT_PREFIX",
];

const gitEnvironment = () => {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C",
    LANGUAGE: "C",
  };
  for (const key of Object.keys(environment))
    if (repositoryEnvironmentKeys.includes(key.toUpperCase())) delete environment[key];
  return environment;
};

const toPathspec = (root: string, target: string) => path.relative(root, target).split(path.sep).join("/");

const samePath = async (left: string, right: string) => {
  const [a, b] = await Promise.all([realpath(left), realpath(right)]);
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
};

export type GitCommandResult = { code: number; stdout: string; stderr: string };

export type ApplicationGitSyncOptions = {
  paths: Pick<ApplicationPaths, "root" | "dataRoot" | "logsRoot" | "crashDumpsRoot" | "electronSessionRoot" | "previewCache">;
  /** Defaults to {@link APPLICATION_DATA_REMOTE}; tests pass a local bare repository. */
  remoteUrl?: string;
  gitExecutable?: string;
  timeoutMs?: number;
};

/**
 * Commits and pushes the Bewerbungsdaten after an application operation of the Electron main process. DataStore
 * queues an intent after its persist; {@link runOperation} commits once the whole IPC operation (persist plus the
 * regenerated Word documents) has finished. Git runs one command at a time, in `paths.root` only, stages only the
 * managed `data` tree (without logs, crash dumps, Electron session and caches) and pushes the current branch to
 * `origin` without force. The local save is never undone when Git fails.
 */
export class ApplicationGitSync implements ApplicationGitCommitQueue {
  private readonly root: string;
  private readonly remoteUrl: string;
  private readonly gitExecutable: string;
  private readonly timeoutMs: number;
  private readonly pathspecs: string[];
  private intents: ApplicationGitIntent[] = [];
  private activeOperations = 0;
  private waiting: Array<(outcome: ApplicationGitSyncOutcome) => void> = [];
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: ApplicationGitSyncOptions) {
    this.root = path.resolve(options.paths.root);
    this.remoteUrl = options.remoteUrl ?? APPLICATION_DATA_REMOTE;
    this.gitExecutable = options.gitExecutable ?? "git";
    this.timeoutMs = options.timeoutMs ?? 120_000;
    const dataRoot = toPathspec(this.root, options.paths.dataRoot);
    if (!dataRoot || dataRoot.startsWith("..") || path.isAbsolute(dataRoot))
      throw new Error("Der Datenordner liegt nicht im Bewerbungsordner.");
    this.pathspecs = [
      `:(literal)${dataRoot}`,
      ...[
        options.paths.logsRoot,
        options.paths.crashDumpsRoot,
        options.paths.electronSessionRoot,
        path.dirname(options.paths.previewCache),
      ].map((excluded) => `:(exclude,literal)${toPathspec(this.root, excluded)}`),
    ];
  }

  queueCommit(companyName: string, action: ApplicationGitAction) {
    this.intents.push({ companyName, action });
  }

  /**
   * Runs one application operation and synchronises afterwards. Concurrent operations share one commit that is made
   * when the last of them has finished, so no commit contains a half-written operation. A failed operation keeps its
   * intents for the next synchronisation.
   */
  async runOperation<T>(operation: () => Promise<T>): Promise<{ result: T; gitSync: ApplicationGitSyncOutcome }> {
    this.activeOperations += 1;
    let result: T;
    try {
      result = await operation();
    } catch (error) {
      this.finishOperation();
      throw error;
    }
    const gitSync = await new Promise<ApplicationGitSyncOutcome>((resolve) => {
      this.waiting.push(resolve);
      this.finishOperation();
    });
    return { result, gitSync };
  }

  private finishOperation() {
    this.activeOperations -= 1;
    if (this.activeOperations > 0 || !this.waiting.length) return;
    const waiting = this.waiting.splice(0);
    const intents = this.intents.splice(0);
    const run = this.queue.then(() =>
      intents.length ? this.synchronize(intents) : { state: "skipped" as const });
    this.queue = run.catch(() => undefined);
    void run.then((outcome) => waiting.forEach((resolve) => resolve(outcome)));
  }

  private async synchronize(intents: readonly ApplicationGitIntent[]): Promise<ApplicationGitSyncOutcome> {
    const startedAt = performance.now();
    try {
      const branch = await this.verifyRepository();
      await this.expect(["add", "--all", "--", ...this.pathspecs], "stage-failed");
      const staged = await this.run(["diff", "--cached", "--quiet", "--", ...this.pathspecs]);
      if (staged.code !== 0 && staged.code !== 1) throw new GitSyncFailure("stage-failed");
      const committed = staged.code === 1;
      if (committed) {
        const message = buildApplicationCommitMessage(intents);
        // --only keeps changes the user staged outside the managed data tree out of this commit.
        await this.expect([
          "commit", "--quiet", "--only", "-m", message.subject,
          ...(message.body ? ["-m", message.body] : []),
          "--", ...this.pathspecs,
        ], "commit-failed");
      }
      const pushed = await this.pushIfAhead(branch);
      logDiagnostic("info", {
        event: "git_sync_completed", component: "git-sync",
        duration_ms: performance.now() - startedAt,
      });
      return { state: "synced", committed, pushed };
    } catch (error) {
      const code = error instanceof GitSyncFailure ? error.code : "git-failed";
      logDiagnostic("warn", {
        event: "git_sync_failed", component: "git-sync", error_code: code,
        duration_ms: performance.now() - startedAt,
      });
      return { state: "failed", code, reason: failureReasons[code] };
    }
  }

  private async verifyRepository() {
    const toplevel = await this.run(["rev-parse", "--show-toplevel"]);
    if (toplevel.code !== 0 || !toplevel.stdout.trim()) throw new GitSyncFailure("not-repository");
    if (!(await samePath(toplevel.stdout.trim(), this.root).catch(() => false)))
      throw new GitSyncFailure("not-repository-root");
    const branch = await this.run(["symbolic-ref", "--quiet", "--short", "HEAD"]);
    if (branch.code !== 0 || !branch.stdout.trim()) throw new GitSyncFailure("detached-head");
    const fetchUrls = await this.run(["remote", "get-url", "--all", "origin"]);
    const pushUrls = await this.run(["remote", "get-url", "--push", "--all", "origin"]);
    if (fetchUrls.code !== 0 || pushUrls.code !== 0) throw new GitSyncFailure("remote-missing");
    const urls = `${fetchUrls.stdout}\n${pushUrls.stdout}`.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
    if (!urls.length) throw new GitSyncFailure("remote-missing");
    const expected = describeRemote(this.remoteUrl);
    for (const url of urls) {
      const remote = describeRemote(url);
      if (!expected || !remote || remote.identity !== expected.identity) throw new GitSyncFailure("remote-mismatch");
      if (remote.hasCredentials) throw new GitSyncFailure("remote-credentials");
    }
    return branch.stdout.trim();
  }

  /** Pushes when HEAD has commits origin does not know yet, also those of an earlier failed push. Never forces. */
  private async pushIfAhead(branch: string) {
    if ((await this.run(["rev-parse", "--verify", "--quiet", "HEAD"])).code !== 0) return false;
    const tracking = `refs/remotes/origin/${branch}`;
    if ((await this.run(["rev-parse", "--verify", "--quiet", tracking])).code === 0) {
      const ahead = await this.expect(["rev-list", "--count", `${tracking}..HEAD`], "git-failed");
      if (Number(ahead.stdout.trim()) === 0) return false;
    }
    const push = await this.run(["push", "--porcelain", "origin", `refs/heads/${branch}:refs/heads/${branch}`]);
    if (push.code !== 0) throw new GitSyncFailure(classifyPushFailure(`${push.stdout}\n${push.stderr}`));
    return true;
  }

  private async expect(args: readonly string[], failure: ApplicationGitFailureCode) {
    const result = await this.run(args);
    if (result.code !== 0) throw new GitSyncFailure(failure);
    return result;
  }

  /** Runs Git without a shell: every argument is passed to the process as it is. */
  protected run(args: readonly string[]): Promise<GitCommandResult> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timedOut = false;
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      const settle = (action: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        action();
      };
      // Application folders and document names easily exceed MAX_PATH; Git for Windows needs this to stage them.
      const options = process.platform === "win32" ? ["-c", "core.longpaths=true"] : [];
      const child = spawn(this.gitExecutable, [...options, ...args], {
        cwd: this.root,
        env: gitEnvironment(),
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, this.timeoutMs);
      child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
      child.once("error", (error: NodeJS.ErrnoException) =>
        settle(() => reject(new GitSyncFailure(error.code === "ENOENT" ? "git-missing" : "git-failed"))));
      child.once("close", (code) => settle(() => timedOut
        ? reject(new GitSyncFailure("timeout"))
        : resolve({
          code: code ?? -1,
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
        })));
    });
  }
}
