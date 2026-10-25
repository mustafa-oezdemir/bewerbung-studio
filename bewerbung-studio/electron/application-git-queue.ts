import { spawn } from "node:child_process";
import { readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ApplicationPaths } from "../src/config/application-paths";
import type { ApplicationGitSyncOutcome } from "../src/shared/ipc";
import { logDiagnostic } from "./diagnostics";

/** The only repository the Bewerbungsordner is pushed to. */
export const APPLICATION_DATA_REMOTE = "https://github.com/mustafa-oezdemir/bewerbung.git";

export type ApplicationGitAction =
  | "create"
  | "update"
  | "status"
  | "delete"
  | "anschreiben"
  | "lebenslauf"
  | "deckblatt"
  | "motivation"
  | "termin"
  | "anlagen"
  | "interview";

export type ApplicationGitDescription = { position?: string; details?: readonly string[] };

/** DataStore records what changed; the change is committed when the IPC operation finished all its files. */
export interface ApplicationGitCommitQueue {
  queueCommit(companyName: string, action: ApplicationGitAction, description?: ApplicationGitDescription): void;
}

type ApplicationGitIntent = { companyName: string; action: ApplicationGitAction } & ApplicationGitDescription;

const commitTitles: Record<ApplicationGitAction, string> = {
  create: "Bewerbung angelegt",
  update: "Bewerbung aktualisiert",
  status: "Status geändert",
  delete: "Bewerbung gelöscht",
  anschreiben: "Anschreiben aktualisiert",
  lebenslauf: "Lebenslauf aktualisiert",
  deckblatt: "Deckblatt aktualisiert",
  motivation: "Motivationsschreiben aktualisiert",
  termin: "Termin aktualisiert",
  anlagen: "Anlagen aktualisiert",
  interview: "Vorstellungsgespräch vorbereitet",
};

const commitPart = (value: string, maximum = 80) => value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);

export const applicationCommitLine = (companyName: string, action: ApplicationGitAction,
  description: ApplicationGitDescription = {}) => {
  const company = commitPart(companyName);
  const position = description.position ? commitPart(description.position, 60) : "";
  const details = [...new Set((description.details ?? []).map((item) => commitPart(item, 60)).filter(Boolean))];
  return `${commitTitles[action]}: ${company || "ohne Firmenname"}${position ? ` – ${position}` : ""}${details.length ? ` – ${details.join(", ")}` : ""}`;
};

/**
 * Most changes listed in a commit body. The message is a command-line argument of `git commit`: a profile change
 * touches every Bewerbung, and with several hundred of them the body exceeded the Windows limit of 32 767 characters,
 * so every following synchronisation failed as well.
 */
export const maxCommitBodyLines = 60;

/** One commit per flush: the first change is the subject, the distinct changes are listed in the body. */
export const buildApplicationCommitMessage = (intents: readonly ApplicationGitIntent[]) => {
  const lines = [...new Set(intents.map((intent) => applicationCommitLine(intent.companyName, intent.action, intent)))];
  if (lines.length <= 1) return { subject: lines[0] ?? "Bewerbungsdaten aktualisiert", body: "" };
  const listed = lines.slice(0, maxCommitBodyLines).map((line) => `- ${line}`);
  if (lines.length > maxCommitBodyLines) listed.push(`- … und ${lines.length - maxCommitBodyLines} weitere`);
  return {
    subject: `${lines[0]} (+${lines.length - 1} weitere)`,
    body: listed.join("\n"),
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
  "repository-busy": "Im Bewerbungsordner läuft gerade ein anderer Git-Vorgang (index.lock). Bitte später erneut speichern.",
  "merge-in-progress": "Im Bewerbungsordner ist ein Git-Merge nicht abgeschlossen. Bitte den Merge zuerst abschließen.",
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

/** Output of a local Git step (add, commit): another Git process holding the index is a reason of its own. */
const localFailure = (output: string, fallback: ApplicationGitFailureCode): ApplicationGitFailureCode =>
  /index\.lock/i.test(output) ? "repository-busy" : fallback;

/**
 * `git add` exits with 1 when an exclude pathspec names a path the user's .gitignore ignores (e.g. `*.bak` and the
 * draft backup), although it has staged everything else. That report alone is no failure: the path stays out either way.
 */
export const onlyExcludedPathsIgnored = (stderr: string, excluded: readonly string[]) => {
  const lines = stderr.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean);
  const header = lines.indexOf("The following paths are ignored by one of your .gitignore files:");
  if (header < 0) return false;
  const listed = lines.slice(header + 1).filter((line) => !/^(?:warning|hint):/.test(line));
  return listed.length > 0 && listed.every((line) => excluded.includes(line.replace(/\/$/, "")));
};

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
  paths: Pick<ApplicationPaths, "root" | "dataRoot" | "applicationDraftPath" | "logsRoot" | "crashDumpsRoot" |
    "electronSessionRoot" | "previewCache">;
  /** Defaults to {@link APPLICATION_DATA_REMOTE}; tests pass a local bare repository. */
  remoteUrl?: string;
  gitExecutable?: string;
  timeoutMs?: number;
  /**
   * Receives the outcome of every background synchronisation that did something, with its number (the `syncId` of
   * the "pending" results it settles); main forwards it to the renderer.
   */
  onSynchronized?: (outcome: ApplicationGitSyncOutcome, syncId: number) => void;
};

/**
 * One application operation: its value as soon as the local save is done, what Git does with it (`gitSync`:
 * "pending" while a commit and push follow in the background, "skipped" when the operation queued nothing) and
 * `completion`, which settles with the outcome of the synchronisation that contains the operation.
 */
export type ApplicationOperationResult<T> = {
  result: T;
  gitSync: ApplicationGitSyncOutcome;
  completion: Promise<ApplicationGitSyncOutcome>;
};

type ScheduledSync = {
  id: number;
  completion: Promise<ApplicationGitSyncOutcome>;
  resolve: (outcome: ApplicationGitSyncOutcome) => void;
};

/**
 * Commits and pushes the Bewerbungsdaten after an application operation of the Electron main process. DataStore
 * queues an intent after its persist; {@link runOperation} returns once the whole local operation (persist plus the
 * regenerated Word documents) has finished, and the commit and push follow in the background, one synchronisation
 * after the other. Git runs one command at a time, in `paths.root` only, stages only the managed `data` tree (without
 * logs, crash dumps, Electron session and caches) and pushes the current branch to `origin` without force. No
 * operation writes while Git stages or commits (a commit never holds half an operation); the push only reads the
 * repository, so local saves go on meanwhile. The local save is never undone when Git fails.
 */
export class ApplicationGitSync implements ApplicationGitCommitQueue {
  private readonly root: string;
  private readonly remoteUrl: string;
  private readonly gitExecutable: string;
  private readonly timeoutMs: number;
  private readonly pathspecs: string[];
  /** The paths below the data tree that are never staged, relative to the root. */
  private readonly excludedPaths: string[];
  private readonly onSynchronized?: (outcome: ApplicationGitSyncOutcome, syncId: number) => void;
  private lastSyncId = 0;
  private intents: ApplicationGitIntent[] = [];
  private activeOperations = 0;
  private idleWaiters: Array<() => void> = [];
  private operationQueue: Promise<void> = Promise.resolve();
  /** Background synchronisations, one after the other. */
  private syncChain: Promise<void> = Promise.resolve();
  /** The synchronisation that collects the operations finished since the last one took the index. */
  private next: ScheduledSync | null = null;
  /** Set while Git stages and commits: operations wait before they write. */
  private indexBusy: Promise<void> | null = null;
  /** Settles when every synchronisation scheduled so far has passed its commit. */
  private committed: Promise<void> = Promise.resolve();

  constructor(options: ApplicationGitSyncOptions) {
    this.root = path.resolve(options.paths.root);
    this.remoteUrl = options.remoteUrl ?? APPLICATION_DATA_REMOTE;
    this.gitExecutable = options.gitExecutable ?? "git";
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.onSynchronized = options.onSynchronized;
    const dataRoot = toPathspec(this.root, options.paths.dataRoot);
    if (!dataRoot || dataRoot.startsWith("..") || path.isAbsolute(dataRoot))
      throw new Error("Der Datenordner liegt nicht im Bewerbungsordner.");
    this.excludedPaths = [
      options.paths.logsRoot,
      options.paths.crashDumpsRoot,
      options.paths.electronSessionRoot,
      path.dirname(options.paths.previewCache),
      // The wizard draft is an unsaved editor state; only a created Bewerbung belongs to the history.
      options.paths.applicationDraftPath,
      `${options.paths.applicationDraftPath}.bak`,
    ].map((excluded) => toPathspec(this.root, excluded));
    this.pathspecs = [
      `:(literal)${dataRoot}`,
      ...this.excludedPaths.map((excluded) => `:(exclude,literal)${excluded}`),
      // A temporary file of an atomic write that is still being written is never staged.
      `:(exclude,glob)${dataRoot.replace(/[*?[\]\\]/g, "\\$&")}/**/*.tmp`,
    ];
  }

  queueCommit(companyName: string, action: ApplicationGitAction, description: ApplicationGitDescription = {}) {
    this.intents.push({ companyName, action, ...description });
  }

  /**
   * Runs one application operation and schedules its synchronisation. Operations run one after the other and never
   * while Git stages or commits; operations that finish while a synchronisation waits share its commit, which starts
   * when none of them is running, so no commit contains a half-written operation. A failed operation keeps its intents
   * for the next synchronisation.
   */
  async runOperation<T>(operation: () => Promise<T>): Promise<ApplicationOperationResult<T>> {
    this.activeOperations += 1;
    const previous = this.operationQueue;
    let release!: () => void;
    this.operationQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    // Never write an application file while the preceding batch is staging or committing data.
    while (this.indexBusy) await this.indexBusy;
    let result: T;
    try {
      result = await operation();
    } catch (error) {
      release();
      this.finishOperation();
      throw error;
    }
    release();
    const scheduled = this.intents.length ? this.schedule() : null;
    this.finishOperation();
    return scheduled
      ? { result, gitSync: { state: "pending", syncId: scheduled.id }, completion: scheduled.completion }
      : { result, gitSync: { state: "skipped" }, completion: Promise.resolve({ state: "skipped" }) };
  }

  /**
   * Pushes commits an earlier push could not deliver (the app was closed meanwhile or GitHub was not reachable),
   * without committing anything. Runs in the queue like every synchronisation.
   */
  pushPending(): Promise<ApplicationGitSyncOutcome> {
    const id = ++this.lastSyncId;
    let resolve!: (outcome: ApplicationGitSyncOutcome) => void;
    const completion = new Promise<ApplicationGitSyncOutcome>((done) => { resolve = done; });
    this.syncChain = this.syncChain.then(async () => {
      const startedAt = performance.now();
      let outcome: ApplicationGitSyncOutcome;
      let attempted = false;
      try {
        const branch = await this.verifyRepository();
        attempted = true;
        const pushed = await this.pushIfAhead(branch);
        outcome = pushed ? { state: "synced", committed: false, pushed: true } : { state: "skipped" };
      } catch (error) {
        outcome = this.failure(error, startedAt);
      }
      resolve(outcome);
      // A folder that cannot synchronise at all (no repository, another remote) is reported by the next save, not on
      // every start; a push that was due and failed is reported.
      if (outcome.state === "synced" || (outcome.state === "failed" && attempted)) this.onSynchronized?.(outcome, id);
    });
    return completion;
  }

  /** Settles when every synchronisation scheduled so far has committed (or failed before); its push may go on. */
  async whenCommitted() {
    for (;;) {
      const target = this.committed;
      await target;
      if (target === this.committed) return;
    }
  }

  /** Settles when every scheduled synchronisation, push included, has finished. */
  async whenSettled() {
    for (;;) {
      const target = this.syncChain;
      await target;
      if (target === this.syncChain) return;
    }
  }

  private finishOperation() {
    this.activeOperations -= 1;
    if (this.activeOperations > 0) return;
    this.idleWaiters.splice(0).forEach((wake) => wake());
  }

  private schedule() {
    if (this.next) return this.next;
    let resolve!: (outcome: ApplicationGitSyncOutcome) => void;
    const completion = new Promise<ApplicationGitSyncOutcome>((done) => { resolve = done; });
    const scheduled: ScheduledSync = { id: ++this.lastSyncId, completion, resolve };
    this.next = scheduled;
    let markCommitted!: () => void;
    const committed = new Promise<void>((done) => { markCommitted = done; });
    this.committed = this.committed.then(() => committed);
    this.syncChain = this.syncChain.then(async () => {
      const outcome = await this.synchronize(scheduled, markCommitted);
      markCommitted();
      scheduled.resolve(outcome);
      if (outcome.state !== "skipped") this.onSynchronized?.(outcome, scheduled.id);
    });
    return scheduled;
  }

  /** Waits until no operation runs and takes the index in the same step, so no operation starts writing in between. */
  private async acquireIndex() {
    while (this.activeOperations > 0) await new Promise<void>((wake) => this.idleWaiters.push(wake));
    let unlock!: () => void;
    this.indexBusy = new Promise<void>((done) => { unlock = done; });
    return () => { this.indexBusy = null; unlock(); };
  }

  private failure(error: unknown, startedAt: number): ApplicationGitSyncOutcome {
    const code = error instanceof GitSyncFailure ? error.code : "git-failed";
    logDiagnostic("warn", {
      event: "git_sync_failed", component: "git-sync", error_code: code,
      duration_ms: performance.now() - startedAt,
    });
    return { state: "failed", code, reason: failureReasons[code] };
  }

  /**
   * One synchronisation: checks the repository, then (no operation running) stages and commits the intents queued
   * until then, releases the index for the next operations and pushes.
   */
  private async synchronize(batch: ScheduledSync, markCommitted: () => void): Promise<ApplicationGitSyncOutcome> {
    const startedAt = performance.now();
    let intents: ApplicationGitIntent[] = [];
    let recorded = false;
    try {
      const branch = await this.verifyRepository();
      if ((await this.run(["rev-parse", "-q", "--verify", "MERGE_HEAD"])).code === 0) throw new GitSyncFailure("merge-in-progress");
      // A copy of a repository inside the data tree (a full backup copies the Bewerbungsordner with its .git) is never
      // staged: it would become a gitlink, and one without a commit makes `git add` fail.
      const embedded = await this.embeddedRepositories();
      const pathspecs = [...this.pathspecs, ...embedded.map((relative) => `:(exclude,literal)${relative}`)];
      const unlock = await this.acquireIndex();
      // Operations that finish from here on belong to the next synchronisation.
      if (this.next === batch) this.next = null;
      intents = this.intents.splice(0);
      let committed: boolean;
      try {
        const add = await this.run(["add", "--all", "--", ...pathspecs]);
        if (add.code !== 0 && !(add.code === 1 && onlyExcludedPathsIgnored(add.stderr, [...this.excludedPaths, ...embedded])))
          throw new GitSyncFailure(localFailure(add.stderr, "stage-failed"));
        const staged = await this.run(["diff", "--cached", "--quiet", "--", ...pathspecs]);
        if (staged.code !== 0 && staged.code !== 1) throw new GitSyncFailure("stage-failed");
        committed = staged.code === 1;
        if (committed) {
          const message = buildApplicationCommitMessage(intents);
          // --only keeps changes the user staged outside the managed data tree out of this commit.
          const commit = await this.run([
            "commit", "--quiet", "--only", "-m", message.subject,
            ...(message.body ? ["-m", message.body] : []),
            "--", ...pathspecs,
          ]);
          if (commit.code !== 0) throw new GitSyncFailure(localFailure(commit.stderr, "commit-failed"));
        }
        recorded = true;
      } finally {
        unlock();
      }
      markCommitted();
      const pushed = await this.pushIfAhead(branch);
      if (!committed && !pushed) return { state: "skipped" };
      logDiagnostic("info", {
        event: "git_sync_completed", component: "git-sync",
        duration_ms: performance.now() - startedAt,
      });
      return { state: "synced", committed, pushed };
    } catch (error) {
      if (this.next === batch) this.next = null;
      // Nothing was committed: the changes stay in the working tree, so their description goes with the next commit.
      // (After a commit only the push failed; the next synchronisation pushes that commit as it is.)
      if (!recorded) this.intents.unshift(...intents);
      return this.failure(error, startedAt);
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

  /**
   * Repositories nested in the managed tree, relative to the root: tracked gitlinks and untracked directories that hold a
   * `.git` of their own (also deeper inside a new, untracked folder).
   */
  private async embeddedRepositories() {
    const found = new Set<string>();
    const tracked = await this.expect(["ls-files", "-s", "-z", "--", ...this.pathspecs], "git-failed");
    for (const entry of tracked.stdout.split("\0")) {
      const match = /^160000 [0-9a-f]+ \d+\t(.+)$/.exec(entry);
      if (match) found.add(match[1]);
    }
    const untracked = await this.expect(
      ["ls-files", "-o", "--directory", "--no-empty-directory", "--exclude-standard", "-z", "--", ...this.pathspecs], "git-failed");
    const pending = untracked.stdout.split("\0").filter((entry) => entry.endsWith("/")).map((entry) => entry.slice(0, -1));
    while (pending.length) {
      const relative = pending.pop()!;
      const absolute = path.join(this.root, ...relative.split("/"));
      if (await stat(path.join(absolute, ".git")).then(() => true, () => false)) {
        found.add(relative);
        continue;
      }
      for (const entry of await readdir(absolute, { withFileTypes: true }).catch(() => []))
        if (entry.isDirectory() && !entry.isSymbolicLink()) pending.push(`${relative}/${entry.name}`);
    }
    return [...found];
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
