import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
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
  maxCommitBodyLines,
  type ApplicationOperationResult,
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

/**
 * Records every Git command and how many ran at the same time. These scenarios check the whole synchronisation, so
 * `runOperation` waits for it here; the background behaviour itself is tested with the plain class below.
 */
class RecordingGitSync extends ApplicationGitSync {
  commands: string[][] = [];
  running = 0;
  maxRunning = 0;
  override async runOperation<T>(operation: () => Promise<T>): Promise<ApplicationOperationResult<T>> {
    const started = await super.runOperation(operation);
    return { ...started, gitSync: await started.completion };
  }
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
      body: "- Bewerbung aktualisiert: X\n- Status geändert: X",
    });
    expect(buildApplicationCommitMessage([{ companyName: "Y", action: "status", details: ["Bewerbung gesendet"] }]).subject)
      .toBe("Status geändert: Y – Bewerbung gesendet");
  });

  it("keeps the commit message of a change to hundreds of Bewerbungen below the Windows command-line limit", () => {
    const intents = Array.from({ length: 1000 }, (_, index) => ({
      companyName: `Fiktiv ${String(index).padStart(4, "0")} Gesellschaft mit beschränkter Haftung und langem Namen`,
      action: "lebenslauf" as const, position: "Softwareentwicklerin für webbasierte Formularsysteme im öffentlichen Dienst",
      details: ["Profil", "Design"],
    }));
    const message = buildApplicationCommitMessage(intents);
    expect(message.subject).toMatch(/\(\+999 weitere\)$/);
    const lines = message.body.split("\n");
    expect(lines).toHaveLength(maxCommitBodyLines + 1);
    expect(lines.at(-1)).toBe(`- … und ${1000 - maxCommitBodyLines} weitere`);
    expect(message.subject.length + message.body.length).toBeLessThan(20_000);
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
    await writeFile(path.join(root, ".gitignore"), "data/Setting/Backups/\n");
    git(root, "add", "README.md", ".gitignore");
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
    expect(remoteSubjects()[0]).toBe("Bewerbung angelegt: Müller & Söhne GmbH – Softwareentwickler");
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
    expect(remoteSubjects().slice(0, 2)).toEqual(["Bewerbung angelegt: Zweite GmbH – Softwareentwickler", "Bewerbung angelegt: Erste GmbH – Softwareentwickler"]);
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
    expect(remoteSubjects()[0]).toBe("Bewerbung aktualisiert: Speicher GmbH – Softwareentwickler – Notizen");
    expect(remoteSubjects()).toHaveLength(commits + 1);
    const folder = store.getWorkspace().applications[0].folderName;
    expect(git(remote, "show", `main:data/Bewerbungen/${folder}/bewerbung.json`)).toContain("Telefonat am Montag");
  });

  it("lists every changed document section without placing authored text in the commit message", async () => {
    await openStore();
    await create("Dokumente GmbH");
    const secretText = "Nur im lokalen Bewerbungsdokument sichtbarer Text";
    const { gitSync } = await save((application) => {
      application.notes = secretText;
      application.documents.coverMainBody = secretText;
      application.documents.resumeProfile = secretText;
      application.documents.deckblattStatement = secretText;
      application.documents.motivationIntroduction = secretText;
      application.interviewAt = "2026-10-20T09:00:00.000Z";
    });
    expect(gitSync).toEqual({ state: "synced", committed: true, pushed: true });
    const message = git(remote, "log", "-1", "--format=%B", "main");
    for (const section of ["Bewerbung aktualisiert", "Anschreiben aktualisiert", "Lebenslauf aktualisiert",
      "Deckblatt aktualisiert", "Motivationsschreiben aktualisiert", "Termin aktualisiert"])
      expect(message).toContain(section);
    expect(message).toContain("Softwareentwickler");
    expect(message).not.toContain(secretText);
    expect(message.split("\n").filter((line) => line.startsWith("- "))).toHaveLength(6);
  });

  it("commits an application appointment, attachment changes and rejection with their actual labels", async () => {
    await openStore();
    const id = (await create("Termine GmbH")).result.applications[0].id;
    await save((application) => { application.interviewAt = "2026-10-20T09:00:00.000Z"; });
    const event = structuredClone(store.getWorkspace().events.find((item) => item.applicationId === id && item.type === "interview")!);
    event.startAt = "2026-10-21T10:00:00.000Z";
    expect((await sync.runOperation(() => store.saveEvent(event))).gitSync.state).toBe("synced");
    expect(remoteSubjects()[0]).toContain("Termin aktualisiert: Termine GmbH – Softwareentwickler – Vorstellungsgespräch");

    const source = path.join(base, "fiktives-zeugnis.pdf");
    await writeFile(source, "%PDF-1.4\n%%EOF\n");
    expect((await sync.runOperation(() => store.addAttachment(id, "Zeugnisse", source))).gitSync.state).toBe("synced");
    expect(remoteSubjects()[0]).toContain("Anlagen aktualisiert: Termine GmbH – Softwareentwickler – Zeugnisse hinzugefügt");
    const attachment = structuredClone(store.getWorkspace().attachments[0]);
    attachment.description = "Fiktive Bescheinigung";
    expect((await sync.runOperation(() => store.saveAttachment(attachment))).gitSync.state).toBe("synced");
    expect(remoteSubjects()[0]).toContain("Zeugnisse geändert");
    expect((await sync.runOperation(() => store.removeAttachment(attachment.id))).gitSync.state).toBe("synced");
    expect(remoteSubjects()[0]).toContain("Zeugnisse entfernt");

    expect((await sync.runOperation(() => store.changeStatus(id, "Absage"))).gitSync.state).toBe("synced");
    expect(remoteSubjects()[0]).toContain("Status geändert: Termine GmbH – Softwareentwickler – Absage");
    const stored = JSON.parse(git(remote, "show", "main:data/Setting/Settings/workspace.json"));
    expect(JSON.parse(git(remote, "show", `main:${stored.applications[0].path}`)).status).toBe("Absage");
    expect(JSON.parse(git(remote, "show", `main:${stored.centralPath}`)).attachments).toHaveLength(0);
  });

  it("synchronises a status change so the remote holds the final state", async () => {
    await openStore();
    const { result } = await create("Status GmbH");
    const id = result.applications[0].id;

    const unchanged = await save(() => undefined);
    const status = await sync.runOperation(() => store.changeStatus(id, "Zusage"));

    expect(unchanged.gitSync.state).toBe("skipped");
    expect(status.gitSync).toEqual({ state: "synced", committed: true, pushed: true });
    expect(remoteSubjects()[0]).toBe("Status geändert: Status GmbH – Softwareentwickler – Zusage");
    expect(remoteSubjects()[1]).toBe("Bewerbung angelegt: Status GmbH – Softwareentwickler");
    const workspace = JSON.parse(git(remote, "show", "main:data/Setting/Settings/workspace.json"));
    expect(JSON.parse(git(remote, "show", `main:${workspace.applications[0].path}`)).status).toBe("Zusage");
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
    expect(localSubjects()[0]).toBe("Bewerbung angelegt: Offline GmbH – Softwareentwickler");

    await rename(offline, remote);
    await openStore();
    const recovered = await save((application) => { application.notes = "wieder online"; }, 0);
    expect(recovered.gitSync).toEqual({ state: "synced", committed: true, pushed: true });
    expect(remoteSubjects().slice(0, 2)).toEqual(["Bewerbung aktualisiert: Offline GmbH – Softwareentwickler – Notizen", "Bewerbung angelegt: Offline GmbH – Softwareentwickler"]);
  });

  it("commits interview notes as Vorstellungsgespräch preparation and keeps them when the push fails", async () => {
    await openStore();
    await create("Seidel GmbH & Co. KG");
    const id = store.getWorkspace().applications[0].id;
    await sync.runOperation(async () => {
      await store.changeStatus(id, "Vorstellungsgespräch");
      return store.saveApplication({ ...store.getApplication(id), interviewAt: new Date(2026, 9, 22, 10).toISOString() });
    });
    const first = await sync.runOperation(() =>
      store.createInterviewNote(id, "Frage 1: Was wissen Sie über uns?\nErklärung: Interesse\nAntwort: Viel."));
    expect(first.gitSync).toEqual({ state: "synced", committed: true, pushed: true });
    expect(remoteSubjects()[0]).toBe(
      "Vorstellungsgespräch vorbereitet: Seidel GmbH & Co. KG – Softwareentwickler – Vorstellungsgespräch_Seidel.md angelegt",
    );
    const note = "data/Vorstellungsgespräch/Seidel_GmbH_&_Co._KG_2026-10-22/Vorstellungsgespräch_Seidel.md";
    expect(remoteFiles().split("\n")).toContain(note);
    expect(git(remote, "-c", "core.quotePath=false", "show", `main:${note}`)).toContain("## Frage 1: Was wissen Sie über uns?");

    const offline = `${remote}-offline`;
    await rename(remote, offline);
    const second = await sync.runOperation(() => store.createInterviewNote(id, "Frage 1: Zweiter Block?\nAntwort: Ja."));
    expect(second.gitSync).toMatchObject({ state: "failed", code: "push-failed" });
    expect(second.result.file.fileName).toBe("Vorstellungsgespräch_Seidel_1.md");
    const local = path.join(root, "data", "Vorstellungsgespräch", "Seidel_GmbH_&_Co._KG_2026-10-22", "Vorstellungsgespräch_Seidel_1.md");
    expect(await readFile(local, "utf8")).toContain("## Frage 1: Zweiter Block?");
    expect(localSubjects()[0]).toBe(
      "Vorstellungsgespräch vorbereitet: Seidel GmbH & Co. KG – Softwareentwickler – Vorstellungsgespräch_Seidel_1.md angelegt",
    );
    await rename(offline, remote);
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
    expect(localSubjects()).toEqual(["Bewerbung angelegt: Konflikt GmbH – Softwareentwickler", "Initial"]);
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
    // Saves that finish before the first synchronisation takes the index share its commit.
    expect(remoteSubjects()[remoteSubjects().length - 2]).toMatch(/^Bewerbung angelegt: Parallel GmbH – Softwareentwickler( \(\+\d+ weitere\))?$/);
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

  it("keeps repository copies inside the data tree out of the sync (full backup with .git, unborn repository)", async () => {
    await openStore();
    await create("Vorher GmbH");
    // A legacy recovery copy can contain an embedded repository.
    const backup = path.join(paths.backupsRoot, "Migration_2026-10-09_08-00-00_abcdef12");
    await cp(path.join(root, ".git"), path.join(backup, ".git"), { recursive: true });
    await writeFile(path.join(backup, "workspace.json"), "{}");
    // A repository without a commit makes a plain `git add` fail ("does not have a commit checked out").
    const unborn = path.join(paths.applicationsData, "Neu_GmbH_2026-10-09", "Kopie");
    await mkdir(unborn, { recursive: true });
    git(unborn, "init", "--quiet");
    await writeFile(path.join(unborn, "notiz.txt"), "x");

    const { gitSync } = await save((application) => { application.notes = "nach der Sicherung"; });

    expect(gitSync).toEqual({ state: "synced", committed: true, pushed: true });
    expect(remoteSubjects()[0]).toBe("Bewerbung aktualisiert: Vorher GmbH – Softwareentwickler – Notizen");
    expect(remoteFiles()).not.toMatch(/Migration_2026-10-09|Neu_GmbH_2026-10-09/);
    expect(git(root, "ls-files", "-s").split("\n").filter((line) => line.startsWith("160000"))).toEqual([]);
  });

  it("leaves a tracked gitlink alone instead of moving it", async () => {
    const nested = path.join(paths.backupsRoot, "Migration_2026-09-26_11-21-51_72477534");
    await mkdir(nested, { recursive: true });
    git(nested, "init", "--quiet", "--initial-branch=main");
    git(nested, "config", "user.name", "Test Nutzer");
    git(nested, "config", "user.email", "test@example.invalid");
    await writeFile(path.join(nested, "a.txt"), "1");
    git(nested, "add", "a.txt");
    git(nested, "commit", "--quiet", "-m", "eins");
    const relative = path.relative(root, nested).split(path.sep).join("/");
    git(root, "add", "-f", relative);
    git(root, "commit", "--quiet", "-m", "Gitlink");
    git(root, "push", "--quiet", "origin", "main");
    const pinned = git(remote, "ls-tree", "main", relative);
    await writeFile(path.join(nested, "a.txt"), "2");
    git(nested, "commit", "--quiet", "-am", "zwei");
    await openStore();

    expect((await create("Gitlink GmbH")).gitSync).toEqual({ state: "synced", committed: true, pushed: true });
    expect(git(remote, "ls-tree", "main", relative)).toBe(pinned);
    expect(git(root, "diff", "--name-only")).toContain(relative);
  });

  it("reports another running Git process (index.lock) and keeps the change for the next sync", async () => {
    await openStore();
    await writeFile(path.join(root, ".git", "index.lock"), "");

    const busy = await create("Lock GmbH");
    expect(busy.gitSync).toMatchObject({ state: "failed", code: "repository-busy" });
    expect(busy.gitSync.state === "failed" && busy.gitSync.reason).toContain("anderer Git-Vorgang");
    expect(busy.result.applications[0].company.name).toBe("Lock GmbH");

    await rm(path.join(root, ".git", "index.lock"));
    expect((await save((application) => { application.notes = "danach"; })).gitSync.state).toBe("synced");
    const savedIndex = JSON.parse(git(remote, "show", "main:data/Setting/Settings/workspace.json"));
    expect(git(remote, "show", `main:${savedIndex.applications[0].path}`)).toContain("Lock GmbH");
    // The commit that finally carries the new Bewerbung also names it; nothing is described as a mere note change.
    expect(remoteSubjects()).toEqual([
      "Bewerbung angelegt: Lock GmbH – Softwareentwickler (+1 weitere)",
      "Initial",
    ]);
    expect(git(remote, "log", "-1", "--format=%b", "main")).toBe([
      "- Bewerbung angelegt: Lock GmbH – Softwareentwickler",
      "- Bewerbung aktualisiert: Lock GmbH – Softwareentwickler – Notizen",
    ].join("\n"));
  });

  it("keeps the unsaved wizard draft and half-written temporary files out of every commit", async () => {
    await openStore();
    await store.saveApplicationDraft({ company: { name: "Entwurf GmbH" } });
    await writeFile(path.join(paths.settingsRoot, "workspace.json.1234.tmp"), "{\"halb");

    expect((await create("Gespeichert GmbH")).gitSync.state).toBe("synced");

    const files = remoteFiles();
    expect(files).toContain("data/Setting/Settings/workspace.json");
    expect(files).not.toMatch(/new-application-draft|\.tmp$/m);
    expect(git(remote, "log", "-p", "main")).not.toContain("Entwurf GmbH");
    expect(git(root, "status", "--porcelain", "--", "data")).toMatch(/new-application-draft\.json/);
  });

  it("syncs when the user's .gitignore ignores excluded paths (draft backup *.bak, a tracked Electron session)", async () => {
    await openStore();
    await create("Erste GmbH");
    await mkdir(paths.electronSessionRoot, { recursive: true });
    await writeFile(path.join(paths.electronSessionRoot, "Preferences"), "{}");
    git(root, "add", "--", paths.electronSessionRoot);
    git(root, "commit", "--quiet", "-m", "Session (old sync)");
    await writeFile(path.join(root, ".gitignore"), "data/Setting/Backups/\n*.bak\nElectronSession/\n");
    git(root, "add", ".gitignore");
    git(root, "commit", "--quiet", "-m", "Ignore backups");
    await store.saveApplicationDraft({ company: { name: "Entwurf GmbH" } });
    await writeFile(`${paths.applicationDraftPath}.bak`, "{}");
    await writeFile(path.join(paths.electronSessionRoot, "Preferences"), "{\"changed\":true}");

    expect((await save((application) => { application.notes = "Nach dem Ignorieren"; })).gitSync.state).toBe("synced");

    expect(remoteSubjects()[0]).toMatch(/^Bewerbung aktualisiert: Erste GmbH/);
    expect(remoteFiles()).not.toMatch(/new-application-draft/m);
    expect(git(root, "diff", "--name-only")).toContain("data/Setting/ElectronSession/Preferences");
    expect(git(root, "diff", "--cached", "--name-only")).toBe("");
  });

  it("syncs application changes when the user's .gitignore excludes full recovery backups", async () => {
    await openStore();
    await create("Erste GmbH");
    const recoveryFile = path.join(paths.backupsRoot, "Migration_example", "workspace.json");
    await mkdir(path.dirname(recoveryFile), { recursive: true });
    await writeFile(recoveryFile, "{\"archived\":true}");

    expect((await save((application) => { application.notes = "Nach der Sicherung"; })).gitSync)
      .toEqual({ state: "synced", committed: true, pushed: true });
    expect(remoteFiles()).not.toContain("Migration_example");
    expect(await readFile(recoveryFile, "utf8")).toContain("archived");
  });

  it("leaves no difference behind when the app is opened again (no rewritten event timestamps)", async () => {
    await openStore();
    const id = (await create("Neustart GmbH")).result.applications[0].id;
    await save((application) => {
      application.interviewAt = "2099-10-20T09:00:00.000Z";
      application.deadlineAt = "2099-10-10T09:00:00.000Z";
    });
    await sync.runOperation(() => store.changeStatus(id, "Absage"));
    expect(git(root, "status", "--porcelain", "--", "data")).toBe("");

    await new Promise((resolve) => setTimeout(resolve, 5));
    const reopened = new DataStore(paths, sync);
    await reopened.initialize();

    expect(git(root, "status", "--porcelain", "--", "data")).toBe("");
  });

  it("commits the Bewerbungsfrist todo of a Bewerbung and the appointment labels of the calendar", async () => {
    await openStore();
    const id = (await create("Aufgaben GmbH")).result.applications[0].id;
    await save((application) => { application.deadlineAt = "2099-11-01T09:00:00.000Z"; });
    expect(remoteSubjects()[0]).toBe("Bewerbung aktualisiert: Aufgaben GmbH – Softwareentwickler – Bewerbungsfrist");

    const todo = structuredClone(store.getWorkspace().todos.find((item) => item.applicationId === id)!);
    todo.completed = true;
    const done = await sync.runOperation(() => store.saveTodo(todo));
    expect(done.gitSync).toEqual({ state: "synced", committed: true, pushed: true });
    expect(remoteSubjects()[0]).toBe("Termin aktualisiert: Aufgaben GmbH – Softwareentwickler – Aufgabe Bewerbungsfrist");

    const followUp = structuredClone(store.getWorkspace().events.find((item) =>
      item.applicationId === id && item.type === "application-deadline")!);
    followUp.startAt = "2099-11-02T09:00:00.000Z";
    await sync.runOperation(() => store.saveEvent(followUp));
    expect(remoteSubjects()[0]).toBe("Termin aktualisiert: Aufgaben GmbH – Softwareentwickler – Bewerbungsfrist");

    const manual = await sync.runOperation(() => store.saveTodo({
      id: "00000000-0000-4000-8000-0000000000aa", title: "Privat", description: "", priority: "low",
      completed: false, createdAt: "2026-10-12T10:00:00.000Z", updatedAt: "2026-10-12T10:00:00.000Z",
    }));
    expect(manual.gitSync).toEqual({ state: "skipped" });
  });

  it("describes Bewerbungsdatum, Vorstellungsgespräch and Lebenslauf layout in one commit per save", async () => {
    await openStore();
    await create("Daten GmbH");
    await save((application) => {
      application.sentAt = "2026-10-12T09:00:00.000Z";
      application.interviewAt = "2026-10-20T09:00:00.000Z";
      application.designSettings.resumePresentation = { sections: { experience: { order: 1 } } };
    });
    const message = git(remote, "log", "-1", "--format=%B", "main");
    expect(message).toContain("- Bewerbung aktualisiert: Daten GmbH – Softwareentwickler – Bewerbungsdatum");
    expect(message).toContain("- Termin aktualisiert: Daten GmbH – Softwareentwickler – Vorstellungsgespräch");
    expect(message).toContain("- Lebenslauf aktualisiert: Daten GmbH – Softwareentwickler – Abschnitte");
  });

  it("merges rapid concurrent saves of one Bewerbung without losing a field or a description", async () => {
    await openStore();
    await create("Schnell GmbH");
    const results = await Promise.all([
      save((application) => { application.notes = "erste Notiz"; }),
      save((application) => { application.contact.phone = "+49 30 000000"; }),
      save((application) => { application.documents.coverSubject = "Bewerbung"; }),
    ]);
    expect(results.every((result) => result.gitSync.state === "synced")).toBe(true);
    const saved = store.getWorkspace().applications[0];
    expect(saved.notes).toBe("erste Notiz");
    expect(saved.contact.phone).toBe("+49 30 000000");
    expect(saved.documents.coverSubject).toBe("Bewerbung");
    const history = git(remote, "log", "--format=%B", "main");
    for (const line of ["Notizen", "Kontakt", "Anschreiben aktualisiert: Schnell GmbH – Softwareentwickler – Betreff"])
      expect(history).toContain(line);
    expect(git(root, "status", "--porcelain", "--", "data")).toBe("");
    expect(git(root, "rev-parse", "HEAD")).toBe(git(remote, "rev-parse", "main"));
  });

  it("does not commit into an unfinished merge", async () => {
    await openStore();
    await writeFile(path.join(root, ".git", "MERGE_HEAD"), `${git(root, "rev-parse", "HEAD")}\n`);
    const before = git(root, "rev-parse", "HEAD");

    const { gitSync } = await create("Merge GmbH");

    expect(gitSync).toMatchObject({ state: "failed", code: "merge-in-progress" });
    expect(git(root, "rev-parse", "HEAD")).toBe(before);
    expect(remoteSubjects()).toEqual(["Initial"]);
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

  describe("background synchronisation", () => {
    /** The plain queue (no waiting in runOperation), with a slow or unreachable GitHub on demand. */
    class BackgroundGitSync extends ApplicationGitSync {
      pushDelayMs = 0;
      offline = false;
      pushes = 0;
      outcomes: Array<{ outcome: unknown; syncId: number }> = [];
      constructor(options: ConstructorParameters<typeof ApplicationGitSync>[0]) {
        super({ ...options, onSynchronized: (outcome, syncId) => this.outcomes.push({ outcome, syncId }) });
      }
      protected override async run(args: readonly string[]): Promise<GitCommandResult> {
        if (args[0] === "push") {
          this.pushes += 1;
          if (this.pushDelayMs) await new Promise((resolve) => setTimeout(resolve, this.pushDelayMs));
          if (this.offline) return { code: 128, stdout: "", stderr: "fatal: unable to access: Could not resolve host: github.com" };
        }
        return super.run(args);
      }
    }
    let background: BackgroundGitSync;
    const openBackground = async () => {
      background = new BackgroundGitSync({ paths, remoteUrl: remote });
      store = new DataStore(paths, background);
      await initializeWithProfile(store);
    };
    const createIn = (company: string) => background.runOperation(async () => {
      const workspace = await store.createApplication(applicationInput(company));
      await synchronizeDocuments(store, workspace.applications[0].id);
      return workspace;
    });
    const saveNotes = (notes: string) => background.runOperation(async () => {
      const application = structuredClone(store.getWorkspace().applications[0]);
      application.notes = notes;
      return store.saveApplication(application);
    });

    it("returns after the local save while a slow push goes on, then reports the push", async () => {
      await openBackground();
      background.pushDelayMs = 1500;
      const started = performance.now();
      const created = await createIn("Langsam GmbH");
      const localMs = performance.now() - started;

      expect(created.gitSync).toMatchObject({ state: "pending" });
      expect(created.result.applications[0].company.name).toBe("Langsam GmbH");
      expect(localMs).toBeLessThan(1500);
      // Saved on disk before GitHub has it.
      const reopened = new DataStore(paths);
      await reopened.initialize();
      expect(reopened.getWorkspace().applications.map((item) => item.company.name)).toContain("Langsam GmbH");

      expect(await created.completion).toEqual({ state: "synced", committed: true, pushed: true });
      expect(remoteSubjects()[0]).toBe("Bewerbung angelegt: Langsam GmbH – Softwareentwickler");
      const syncId = created.gitSync.state === "pending" ? created.gitSync.syncId : -1;
      expect(background.outcomes).toEqual([{ outcome: { state: "synced", committed: true, pushed: true }, syncId }]);
    });

    it("lets the next save run during a slow push and loses neither a change nor its commit description", async () => {
      await openBackground();
      await (await createIn("Folge GmbH")).completion;
      background.pushDelayMs = 2000;
      const first = await saveNotes("erste Notiz");
      // The first synchronisation is pushing now; the second save does not wait for GitHub.
      while (background.pushes < 2) await new Promise((resolve) => setTimeout(resolve, 10));
      const started = performance.now();
      const second = await background.runOperation(async () => {
        const application = structuredClone(store.getWorkspace().applications[0]);
        application.job.reference = "REF-42";
        return store.saveApplication(application);
      });
      expect(performance.now() - started).toBeLessThan(2000);
      expect(second.gitSync.state).toBe("pending");

      expect((await first.completion).state).toBe("synced");
      expect((await second.completion).state).toBe("synced");
      await background.whenSettled();
      const folder = store.getWorkspace().applications[0].folderName;
      const stored = git(remote, "show", `main:data/Bewerbungen/${folder}/bewerbung.json`);
      expect(stored).toContain("erste Notiz");
      expect(stored).toContain("REF-42");
      expect(remoteSubjects().slice(0, 2)).toEqual([
        "Bewerbung aktualisiert: Folge GmbH – Softwareentwickler – Stelle",
        "Bewerbung aktualisiert: Folge GmbH – Softwareentwickler – Notizen",
      ]);
      expect(git(root, "status", "--porcelain", "--", "data")).toBe("");
    });

    it("shares one commit among saves that finish while a synchronisation waits for them", async () => {
      await openBackground();
      await (await createIn("Bündel GmbH")).completion;
      const commits = remoteSubjects().length;
      const saves = await Promise.all([saveNotes("eins"), saveNotes("zwei"), saveNotes("drei")]);
      const outcomes = await Promise.all(saves.map((save) => save.completion));
      expect(outcomes.every((outcome) => outcome.state === "synced")).toBe(true);
      await background.whenSettled();
      expect(remoteSubjects().length - commits).toBeLessThanOrEqual(2);
      expect(git(remote, "show", `main:data/Bewerbungen/${store.getWorkspace().applications[0].folderName}/bewerbung.json`))
        .toContain("drei");
    });

    it("keeps the local save when GitHub is unreachable, says so, and pushes the commit on the next start", async () => {
      await openBackground();
      await (await createIn("Vorher GmbH")).completion;
      background.offline = true;
      const offline = await saveNotes("ohne Netz");
      expect(offline.gitSync.state).toBe("pending");
      expect(await offline.completion).toMatchObject({ state: "failed", code: "network", reason: "GitHub ist nicht erreichbar. Bitte die Internetverbindung prüfen." });
      expect(background.outcomes.at(-1)?.outcome).toMatchObject({ state: "failed", code: "network" });
      // Committed locally (the app may close now), not on GitHub.
      expect(localSubjects()[0]).toBe("Bewerbung aktualisiert: Vorher GmbH – Softwareentwickler – Notizen");
      expect(remoteSubjects()[0]).toBe("Bewerbung angelegt: Vorher GmbH – Softwareentwickler");

      // Next start: the unpushed commit goes out without a new save and without a new commit.
      await openBackground();
      const commitsBefore = localSubjects().length;
      expect(await background.pushPending()).toEqual({ state: "synced", committed: false, pushed: true });
      expect(remoteSubjects()[0]).toBe("Bewerbung aktualisiert: Vorher GmbH – Softwareentwickler – Notizen");
      expect(localSubjects()).toHaveLength(commitsBefore);
      expect(await background.pushPending()).toEqual({ state: "skipped" });
    });

    it("stays quiet on start when the folder cannot synchronise at all, but reports a due push that fails", async () => {
      git(root, "remote", "remove", "origin");
      await openBackground();
      expect(await background.pushPending()).toMatchObject({ state: "failed", code: "remote-missing" });
      expect(background.outcomes).toEqual([]);

      git(root, "remote", "add", "origin", remote);
      await openBackground();
      background.offline = true;
      await (await createIn("Später GmbH")).completion;
      background.outcomes.length = 0;
      expect(await background.pushPending()).toMatchObject({ state: "failed", code: "network" });
      expect(background.outcomes).toHaveLength(1);
    });

    it("waits for the commit (not the push) before the app quits or locks", async () => {
      await openBackground();
      await (await createIn("Ende GmbH")).completion;
      background.pushDelayMs = 3000;
      const save = await saveNotes("vor dem Beenden");
      const started = performance.now();
      await background.whenCommitted();
      expect(performance.now() - started).toBeLessThan(3000);
      expect(localSubjects()[0]).toBe("Bewerbung aktualisiert: Ende GmbH – Softwareentwickler – Notizen");
      expect(git(root, "status", "--porcelain", "--", "data")).toBe("");
      expect((await save.completion).state).toBe("synced");
    });

    it("never runs Git commands at the same time, also with saves during a background push", async () => {
      class CountingSync extends BackgroundGitSync {
        running = 0;
        maxRunning = 0;
        protected override async run(args: readonly string[]): Promise<GitCommandResult> {
          this.running += 1;
          this.maxRunning = Math.max(this.maxRunning, this.running);
          try { return await super.run(args); } finally { this.running -= 1; }
        }
      }
      const counting = new CountingSync({ paths, remoteUrl: remote });
      background = counting;
      store = new DataStore(paths, counting);
      await initializeWithProfile(store);
      counting.pushDelayMs = 300;
      const created = await createIn("Takt GmbH");
      const saves = [];
      for (const note of ["a", "b", "c", "d"]) {
        saves.push(await saveNotes(note));
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      await Promise.all([created.completion, ...saves.map((save) => save.completion)]);
      await counting.whenSettled();
      expect(counting.maxRunning).toBe(1);
      expect(git(root, "status", "--porcelain", "--", "data")).toBe("");
      expect(git(remote, "rev-parse", "main")).toBe(git(root, "rev-parse", "HEAD"));
      git(root, "fsck", "--no-progress");
    });
  });
});
