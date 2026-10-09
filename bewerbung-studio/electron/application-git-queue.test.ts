import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./diagnostics", () => ({ logDiagnostic: vi.fn() }));

import { resolveApplicationPaths, type ApplicationPaths } from "../src/config/application-paths";
import { defaultDocumentDesign } from "../src/shared/documentDesign";
import { profileSchema, type Application, type ApplicationInput } from "../src/shared/schema";
import {
  APPLICATION_DATA_REMOTE,
  ApplicationGitSync,
  buildApplicationCommitMessage,
  classifyPushFailure,
  describeRemote,
  type GitCommandResult,
} from "./application-git-queue";
import { logDiagnostic } from "./diagnostics";
import { DataStore } from "./storage";
import { createDefaultCoverLetterDocument } from "./templates/default-cover-letter";
import { createDefaultDeckblattDocument } from "./templates/default-deckblatt";

const applicationInput = (company: string): ApplicationInput => ({
  company: { name: company, street: "", postalCode: "10115", city: "Berlin", country: "Deutschland", website: "" },
  contact: { salutation: "", firstName: "", lastName: "", position: "", email: "", phone: "" },
  job: {
    title: "Softwareentwickler", reference: "", source: "", url: "", fullText: "",
    workModel: "Hybrid", contractType: "Unbefristet", salaryExpectation: "",
  },
  templateId: "classic-professional",
  accentColor: "#155e58",
  secondaryColor: "#244766",
  designSettings: defaultDocumentDesign,
  notes: "",
});

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim();

/** Records every Git command and how many ran at the same time. */
class RecordingGitSync extends ApplicationGitSync {
  commands: string[][] = [];
  running = 0;
  maxRunning = 0;
  protected override async run(args: readonly string[]): Promise<GitCommandResult> {
    this.commands.push([...args]);
    this.running += 1;
    this.maxRunning = Math.max(this.maxRunning, this.running);
    try {
      return await super.run(args);
    } finally {
      this.running -= 1;
    }
  }
}

/** The Word documents main.ts regenerates after every create and save (without Electron's image conversion). */
const synchronizeDocuments = async (store: DataStore, id: string) => {
  const context = store.getTemplateDocumentContext(id);
  await Promise.all([
    createDefaultCoverLetterDocument(context.targetDirectories.anschreiben, context.requestedBaseName, { ...context.data }),
    createDefaultDeckblattDocument(context.targetDirectories.deckblatt, context.requestedBaseNames.deckblatt, { ...context.data }),
  ]);
};

/** The Deckblatt needs the applicant's name, as in the wizard; a profile is not a Bewerbung change. */
const initializeWithProfile = async (store: DataStore) => {
  await store.initialize();
  if (store.getWorkspace().profiles.length) return;
  await store.saveProfile(profileSchema.parse({
    id: crypto.randomUUID(), isDefault: true, firstName: "Erika", lastName: "Beispiel",
    email: "erika@example.test", updatedAt: new Date().toISOString(),
  }));
};

const environmentKeys = ["GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "GIT_CEILING_DIRECTORIES"] as const;
const savedEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
let fixtureRoot: string;

beforeAll(async () => {
  // The user's Git configuration (credential helpers, hooks, signing) must not take part in the tests.
  fixtureRoot = await mkdtemp(path.join(tmpdir(), "bm-git-sync-"));
  const globalConfig = path.join(fixtureRoot, "gitconfig");
  await writeFile(globalConfig, "");
  process.env.GIT_CONFIG_GLOBAL = globalConfig;
  process.env.GIT_CONFIG_NOSYSTEM = "1";
  // A Git repository above the temp folder must not turn the "no repository" case into another one.
  process.env.GIT_CEILING_DIRECTORIES = fixtureRoot;
});

afterAll(async () => {
  for (const key of environmentKeys) {
    if (savedEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnvironment[key];
  }
  await rm(fixtureRoot, { recursive: true, force: true });
});

describe("remote and commit message rules", () => {
  it("accepts only safe spellings of mustafa-oezdemir/bewerbung", () => {
    const target = describeRemote(APPLICATION_DATA_REMOTE)!.identity;
    for (const url of [
      "https://github.com/mustafa-oezdemir/bewerbung.git",
      "https://github.com/mustafa-oezdemir/bewerbung",
      "https://github.com/mustafa-oezdemir/bewerbung/",
      "HTTPS://GitHub.com/Mustafa-Oezdemir/Bewerbung.git",
      "https://mustafa-oezdemir@github.com/mustafa-oezdemir/bewerbung.git",
      "https://github.com:443/mustafa-oezdemir/bewerbung.git",
      "git@github.com:mustafa-oezdemir/bewerbung.git",
      "ssh://git@github.com/mustafa-oezdemir/bewerbung.git",
    ]) expect(describeRemote(url)?.identity, url).toBe(target);
    for (const url of [
      "https://github.com/mustafa-oezdemir/bewerbung-studio.git",
      "https://github.com/someone-else/bewerbung.git",
      "https://github.com.evil.example/mustafa-oezdemir/bewerbung.git",
      "https://gitlab.com/mustafa-oezdemir/bewerbung.git",
      "http://github.com/mustafa-oezdemir/bewerbung.git",
      "https://github.com:8443/mustafa-oezdemir/bewerbung.git",
      "https://github.com/mustafa-oezdemir/bewerbung.git?x=1",
      "https://github.com/mustafa-oezdemir/bewerbung/tree/main",
      "ssh://root@github.com/mustafa-oezdemir/bewerbung.git",
      "mustafa-oezdemir/bewerbung",
      "",
    ]) expect(describeRemote(url)?.identity ?? null, url).not.toBe(target);
    expect(describeRemote("https://user:ghp_secret@github.com/mustafa-oezdemir/bewerbung.git"))
      .toEqual({ identity: target, hasCredentials: true });
  });

  it("builds short deterministic commit messages", () => {
    expect(buildApplicationCommitMessage([{ companyName: "Müller GmbH", action: "create" }]))
      .toEqual({ subject: "Bewerbung angelegt: Müller GmbH", body: "" });
    expect(buildApplicationCommitMessage([{ companyName: " A\nB\tC ", action: "update" }]).subject)
      .toBe("Bewerbung aktualisiert: A B C");
    expect(buildApplicationCommitMessage([
      { companyName: "X", action: "update" },
      { companyName: "X", action: "status" },
      { companyName: "X", action: "update" },
    ])).toEqual({
      subject: "Bewerbung aktualisiert: X (+1 weitere)",
      body: "- Bewerbung aktualisiert: X\n- Status aktualisiert: X",
    });
    expect(buildApplicationCommitMessage([{ companyName: "Y", action: "bewerbung" }]).subject)
      .toBe("Bewerbung gesendet: Y");
  });

  it("classifies push failures without using the output itself", () => {
    expect(classifyPushFailure("!\trefs/heads/main:refs/heads/main\t[rejected] (fetch first)")).toBe("non-fast-forward");
    expect(classifyPushFailure(" ! [rejected] main -> main (non-fast-forward)")).toBe("non-fast-forward");
    expect(classifyPushFailure("fatal: Authentication failed for 'https://github.com/x/y.git/'")).toBe("auth-failed");
    expect(classifyPushFailure("fatal: unable to access 'https://github.com/x/y.git/': The requested URL returned error: 403")).toBe("auth-failed");
    expect(classifyPushFailure("fatal: unable to access 'https://github.com/x/y.git/': Could not resolve host: github.com")).toBe("network");
    expect(classifyPushFailure("! [remote rejected] main -> main (protected branch hook declined)")).toBe("push-rejected");
    expect(classifyPushFailure("fatal: something else")).toBe("push-failed");
  });
});

describe("ApplicationGitSync with a local bare remote", { timeout: 30_000 }, () => {
  let base: string;
  let root: string;
  let remote: string;
  let paths: ApplicationPaths;
  let sync: RecordingGitSync;
  let store: DataStore;

  const remoteSubjects = (repository = remote) =>
    git(repository, "log", "--format=%s", "main").split("\n").filter(Boolean);
  const remoteFiles = (repository = remote) =>
    git(repository, "-c", "core.quotePath=false", "ls-tree", "-r", "--name-only", "main");
  const localSubjects = () => git(root, "log", "--format=%s").split("\n").filter(Boolean);

  const openStore = async (options: Partial<ConstructorParameters<typeof ApplicationGitSync>[0]> = {}) => {
    sync = new RecordingGitSync({ paths, remoteUrl: remote, ...options });
    store = new DataStore(paths, sync);
    await initializeWithProfile(store);
  };

  const create = (company: string) => sync.runOperation(async () => {
    const workspace = await store.createApplication(applicationInput(company));
    await synchronizeDocuments(store, workspace.applications[0].id);
    return workspace;
  });

  const save = (change: (application: Application) => void, index = 0) =>
    sync.runOperation(async () => {
      const application = structuredClone(store.getWorkspace().applications[index]);
      change(application);
      const workspace = await store.saveApplication(application);
      await synchronizeDocuments(store, application.id);
      return workspace;
    });

  beforeEach(async () => {
    base = await mkdtemp(path.join(fixtureRoot, "case-"));
    root = path.join(base, "Bewerbungsordner");
    remote = path.join(base, "remote.git");
    await mkdir(root);
    git(base, "init", "--quiet", "--bare", "--initial-branch=main", remote);
    git(root, "init", "--quiet", "--initial-branch=main");
    git(root, "config", "user.name", "Test Nutzer");
    git(root, "config", "user.email", "test@example.invalid");
    git(root, "remote", "add", "origin", remote);
    await writeFile(path.join(root, "README.md"), "Bewerbungsordner\n");
    git(root, "add", "README.md");
    git(root, "commit", "--quiet", "-m", "Initial");
    git(root, "push", "--quiet", "-u", "origin", "main");
    paths = resolveApplicationPaths(root);
    vi.mocked(logDiagnostic).mockClear();
  });

  afterEach(async () => {
    await rm(base, { recursive: true, force: true });
  });

  it("commits and pushes a new Bewerbung with its generated documents after the operation", async () => {
    await openStore();
    const { result, gitSync } = await create("Müller & Söhne GmbH");

    expect(gitSync).toEqual({ state: "synced", committed: true, pushed: true });
    expect(remoteSubjects()[0]).toBe("Bewerbung angelegt: Müller & Söhne GmbH");
    const files = remoteFiles();
    const folder = result.applications[0].folderName;
    expect(files).toContain("data/Setting/Settings/workspace.json");
    expect(files).toContain(`data/Bewerbungen/${folder}/bewerbung.json`);
    expect(files.split("\n").filter((file) => file.startsWith(`data/Bewerbungen/${folder}/`) && file.endsWith(".docx"))
      .length).toBeGreaterThanOrEqual(2);
    expect(git(root, "status", "--porcelain", "--", "data")).toBe("");
    expect(git(root, "rev-parse", "HEAD")).toBe(git(remote, "rev-parse", "main"));
  });

  it("pushes a second Bewerbung created while the app stays open", async () => {
    await openStore();
    await create("Erste GmbH");
    const { gitSync } = await create("Zweite GmbH");

    expect(gitSync.state).toBe("synced");
    expect(remoteSubjects().slice(0, 2)).toEqual(["Bewerbung angelegt: Zweite GmbH", "Bewerbung angelegt: Erste GmbH"]);
  });

  it("commits a real Bereich-speichern change and skips an unchanged save", async () => {
    await openStore();
    await create("Speicher GmbH");
    const commits = remoteSubjects().length;

    const unchanged = await save(() => undefined);
    expect(unchanged.gitSync).toEqual({ state: "skipped" });
    expect(remoteSubjects()).toHaveLength(commits);
    expect(localSubjects()).toHaveLength(commits);

    const changed = await save((application) => { application.notes = "Telefonat am Montag"; });
    expect(changed.gitSync).toEqual({ state: "synced", committed: true, pushed: true });
    expect(remoteSubjects()[0]).toBe("Bewerbung aktualisiert: Speicher GmbH");
    expect(remoteSubjects()).toHaveLength(commits + 1);
    const folder = store.getWorkspace().applications[0].folderName;
    expect(git(remote, "show", `main:data/Bewerbungen/${folder}/bewerbung.json`)).toContain("Telefonat am Montag");
  });

  it("synchronises a status change so the remote holds the final state", async () => {
    await openStore();
    const { result } = await create("Status GmbH");
    const id = result.applications[0].id;

    const unchanged = await save(() => undefined);
    const status = await sync.runOperation(() => store.changeStatus(id, "Zusage"));

    expect(unchanged.gitSync.state).toBe("skipped");
    expect(status.gitSync).toEqual({ state: "synced", committed: true, pushed: true });
    expect(remoteSubjects()[0]).toBe("Status aktualisiert: Status GmbH");
    expect(remoteSubjects()[1]).toBe("Bewerbung angelegt: Status GmbH");
    const workspace = JSON.parse(git(remote, "show", "main:data/Setting/Settings/workspace.json"));
    expect(workspace.applications[0].status).toBe("Zusage");
  });

  it("keeps the local Bewerbung when the push fails and pushes it with the next change", async () => {
    await openStore();
    await create("Vorher GmbH");
    const offline = `${remote}-offline`;
    await rename(remote, offline);

    const failed = await create("Offline GmbH");
    expect(failed.gitSync).toMatchObject({ state: "failed", code: "push-failed" });
    expect(failed.result.applications.map((item) => item.company.name)).toContain("Offline GmbH");
    const reopened = new DataStore(paths);
    await reopened.initialize();
    expect(reopened.getWorkspace().applications.map((item) => item.company.name)).toContain("Offline GmbH");
    expect(localSubjects()[0]).toBe("Bewerbung angelegt: Offline GmbH");

    await rename(offline, remote);
    await openStore();
    const recovered = await save((application) => { application.notes = "wieder online"; }, 0);
    expect(recovered.gitSync).toEqual({ state: "synced", committed: true, pushed: true });
    expect(remoteSubjects().slice(0, 2)).toEqual(["Bewerbung aktualisiert: Offline GmbH", "Bewerbung angelegt: Offline GmbH"]);
  });

  it("refuses to push to another remote and never rewrites origin", async () => {
    const other = path.join(base, "other.git");
    git(base, "init", "--quiet", "--bare", "--initial-branch=main", other);
    git(root, "remote", "set-url", "origin", other);
    await openStore();
    const before = git(root, "rev-parse", "HEAD");

    const { result, gitSync } = await create("Falsch GmbH");

    expect(gitSync).toMatchObject({ state: "failed", code: "remote-mismatch" });
    expect(result.applications[0].company.name).toBe("Falsch GmbH");
    expect(git(root, "rev-parse", "HEAD")).toBe(before);
    expect(git(root, "remote", "get-url", "origin")).toBe(other);
    expect(git(other, "for-each-ref")).toBe("");
    expect(remoteSubjects()).toEqual(["Initial"]);
    expect(sync.commands.filter((args) =>
      ["add", "commit", "push"].includes(args[0]) || (args[0] === "remote" && args[1] !== "get-url"))).toEqual([]);
  });

  it("requires origin, a branch and the repository root", async () => {
    git(root, "remote", "remove", "origin");
    await openStore();
    expect((await create("Ohne Remote GmbH")).gitSync).toMatchObject({ state: "failed", code: "remote-missing" });

    git(root, "remote", "add", "origin", remote);
    git(root, "checkout", "--quiet", "--detach");
    expect((await create("Detached GmbH")).gitSync).toMatchObject({ state: "failed", code: "detached-head" });
    expect(sync.commands.some((args) => args[0] === "push")).toBe(false);

    const plain = path.join(base, "ohne-git");
    await mkdir(plain);
    paths = resolveApplicationPaths(plain);
    await openStore();
    expect((await create("Kein Repo GmbH")).gitSync).toMatchObject({ state: "failed", code: "not-repository" });

    const nested = path.join(root, "Unterordner");
    await mkdir(nested);
    paths = resolveApplicationPaths(nested);
    await openStore();
    expect((await create("Verschachtelt GmbH")).gitSync).toMatchObject({ state: "failed", code: "not-repository-root" });
  });

  it("does not force-push or rebase when GitHub has newer commits", async () => {
    const elsewhere = path.join(base, "elsewhere");
    git(base, "clone", "--quiet", remote, elsewhere);
    git(elsewhere, "config", "user.name", "Anderer Rechner");
    git(elsewhere, "config", "user.email", "other@example.invalid");
    await writeFile(path.join(elsewhere, "anderer-rechner.txt"), "x");
    git(elsewhere, "add", "anderer-rechner.txt");
    git(elsewhere, "commit", "--quiet", "-m", "Anderer Rechner");
    git(elsewhere, "push", "--quiet", "origin", "main");
    const remoteHead = git(remote, "rev-parse", "main");
    await openStore();

    const { gitSync } = await create("Konflikt GmbH");

    expect(gitSync).toMatchObject({ state: "failed", code: "non-fast-forward" });
    expect(git(remote, "rev-parse", "main")).toBe(remoteHead);
    expect(localSubjects()).toEqual(["Bewerbung angelegt: Konflikt GmbH", "Initial"]);
    const flat = sync.commands.flat();
    expect(flat.some((arg) => /^--force|^-f$|^\+/.test(arg))).toBe(false);
    expect(sync.commands.some((args) => ["rebase", "reset", "pull", "merge", "fetch"].includes(args[0]))).toBe(false);
  });

  it("reports a missing Git executable without touching the local save", async () => {
    await openStore({ gitExecutable: path.join(base, "kein-git", "git.exe") });

    const { result, gitSync } = await create("Ohne Git GmbH");

    expect(gitSync).toMatchObject({ state: "failed", code: "git-missing" });
    expect(gitSync.state === "failed" && gitSync.reason).toBe("Git wurde nicht gefunden. Bitte Git für Windows installieren.");
    expect(result.applications[0].company.name).toBe("Ohne Git GmbH");
    expect(remoteSubjects()).toEqual(["Initial"]);
  });

  it("runs concurrent synchronisations one Git command at a time", async () => {
    await openStore();
    const extraFile = (name: string) => sync.runOperation(async () => {
      const target = path.join(paths.applicationsData, `${name}.txt`);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, name);
      sync.queueCommit(name, "update");
      return name;
    });

    const first = create("Parallel GmbH");
    while (sync.running === 0) await new Promise((resolve) => setTimeout(resolve, 5));
    const others = [extraFile("Beta"), extraFile("Gamma")];
    await new Promise((resolve) => setTimeout(resolve, 30));
    const outcomes = await Promise.all([first, ...others, extraFile("Delta")]);

    expect(outcomes.map((outcome) => outcome.gitSync.state)).toEqual(["synced", "synced", "synced", "synced"]);
    expect(sync.maxRunning).toBe(1);
    const files = remoteFiles();
    for (const name of ["Beta", "Gamma", "Delta"]) expect(files).toContain(`data/Bewerbungen/${name}.txt`);
    expect(remoteSubjects()[remoteSubjects().length - 2]).toBe("Bewerbung angelegt: Parallel GmbH");
    expect(remoteSubjects().length).toBeLessThanOrEqual(5);
    expect(git(root, "status", "--porcelain", "--", "data")).toBe("");
    git(root, "fsck", "--no-progress");
  });

  it("stages document paths longer than MAX_PATH without a global core.longpaths", async () => {
    await openStore();
    const folder = path.join(paths.applicationsData, "Sehr_lange_Firmenbezeichnung_GmbH_und_Co_KG_2026-10-08".repeat(2),
      "Senior_Softwareentwicklerin_fuer_verteilte_Systeme", "Anschreiben");
    const file = path.join(folder, `${"Anschreiben_Erika_Beispiel_".repeat(3)}.docx`);
    expect(file.length).toBeGreaterThan(260);

    const { gitSync } = await sync.runOperation(async () => {
      await mkdir(folder, { recursive: true });
      await writeFile(file, "docx");
      sync.queueCommit("Lange GmbH", "update");
    });

    expect(gitSync).toEqual({ state: "synced", committed: true, pushed: true });
    expect(remoteFiles()).toContain(path.relative(root, file).split(path.sep).join("/"));
  });

  it("commits only the managed data tree", async () => {
    await openStore();
    await writeFile(path.join(root, "Notizen.md"), "privat");
    await writeFile(path.join(root, "README.md"), "geändert\n");
    git(root, "add", "README.md");
    for (const directory of [paths.logsRoot, paths.electronSessionRoot, paths.crashDumpsRoot, paths.previewCache]) {
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, "laufzeit.txt"), "x");
    }

    expect((await create("Bereich GmbH")).gitSync.state).toBe("synced");

    const files = remoteFiles();
    expect(files).not.toMatch(/Notizen\.md|Logs\/|ElectronSession\/|CrashDumps\/|cache\//);
    expect(git(remote, "show", "main:README.md")).toBe("Bewerbungsordner");
    expect(git(root, "diff", "--cached", "--name-only")).toBe("README.md");
  });

  it("keeps credentials out of commits, results and logs", async () => {
    const secret = "ghp_TESTSECRET0000000000000000000000";
    git(root, "remote", "set-url", "origin", `https://bm-test:${secret}@github.com/mustafa-oezdemir/bewerbung.git`);
    paths = resolveApplicationPaths(root);
    sync = new RecordingGitSync({ paths });
    store = new DataStore(paths, sync);
    await initializeWithProfile(store);

    const refused = await create("Geheim GmbH");
    expect(refused.gitSync).toMatchObject({ state: "failed", code: "remote-credentials" });
    expect(JSON.stringify(refused.gitSync)).not.toContain(secret);
    expect(sync.commands.some((args) => args[0] === "push")).toBe(false);

    git(root, "remote", "set-url", "origin", remote);
    await openStore();
    await create("Sauber GmbH");
    const history = git(remote, "log", "--format=%B%n%an%n%ae", "main");
    expect(history).not.toContain(secret);
    expect(history).not.toMatch(/github\.com|remote\.git/);
    const logged = JSON.stringify(vi.mocked(logDiagnostic).mock.calls);
    expect(logged).not.toContain(secret);
    expect(logged).not.toContain(path.basename(base));
    expect(vi.mocked(logDiagnostic).mock.calls.every(([, fields]) =>
      Object.keys(fields).every((key) => ["event", "component", "error_code", "duration_ms"].includes(key)))).toBe(true);
    expect(await readFile(path.join(root, ".git", "config"), "utf8")).not.toContain(secret);
  });
});
