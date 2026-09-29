import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  APPLICATION_DATA_REMOTE,
  GitAutomationService,
  buildApplicationCommitMessage,
  inferApplicationGitChange,
} from "./git-automation";

describe("GitAutomationService", () => {
  const execFileAsync = promisify(execFile);
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
    );
  });

  it("builds a safe company, date and action commit message", () => {
    expect(
      buildApplicationCommitMessage(
        "Muster GmbH\nBerlin | intern",
        "absage",
        new Date(2026, 7, 29, 14, 5, 9),
      ),
    ).toBe("Muster GmbH Berlin intern | 2026-08-29 14:05:09 | absage");
  });

  it("only infers commits from company-specific application folders", () => {
    expect(
      inferApplicationGitChange(
        "Anschreiben/planen-bauen4.0_GmbH_31.08.2026/Full-Stack/planen-bauen4.0_GmbH_31.08.2026_Anschreiben.docx",
      ),
    ).toEqual({
      companyName: "planen-bauen4.0 GmbH",
      action: "anschreiben",
    });
    expect(
      inferApplicationGitChange(
        "Vorstellungsgespräch/Siemens_AG_2026-09-02/Notizen.txt",
      ),
    ).toEqual({
      companyName: "Siemens AG",
      action: "vorstellungsgespraech",
    });
    expect(
      inferApplicationGitChange("data/Setting/Settings/workspace.json"),
    ).toBeUndefined();
    expect(
      inferApplicationGitChange(
        "data/Muster/Lebenslauf/Modern Lebenslauf Muster.template.json",
      ),
    ).toBeUndefined();
  });

  it("writes and invokes the PowerShell synchronization script for the data repository", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "bewerbung-git-"));
    temporaryDirectories.push(root);
    const calls: string[][] = [];
    const service = new GitAutomationService(root, {
      watchFileChanges: false,
      now: () => new Date(2026, 7, 29, 10, 30, 0),
      runner: async (...values) => {
        calls.push(values);
      },
    });

    await service.initialize();
    service.queueCommit("Siemens AG", "vorstellungsgespraech");
    await service.waitForIdle();

    expect(calls).toEqual([
      [
        path.join(root, "data", "Setting", "Settings", "auto-git-sync.ps1"),
        root,
        APPLICATION_DATA_REMOTE,
        "Siemens AG | 2026-08-29 10:30:00 | vorstellungsgespraech",
      ],
    ]);
    const script = await readFile(
      path.join(root, "data", "Setting", "Settings", "auto-git-sync.ps1"),
      "utf8",
    );
    expect(script).toContain("push origin HEAD:main");
    expect(script).toContain("Assert-WorkspaceIntegrity");
    expect(script).not.toContain("pull --rebase --autostash");
    expect(script.indexOf("add --all")).toBeLessThan(
      script.indexOf("commit --message"),
    );
  });

  it.skipIf(process.platform !== "win32")(
    "commits safely and refuses to auto-merge a diverged remote",
    async () => {
      const base = await mkdtemp(path.join(tmpdir(), "bewerbung-git-e2e-"));
      temporaryDirectories.push(base);
      const repository = path.join(base, "applications");
      const remote = path.join(base, "remote.git");
      await execFileAsync("git", ["init", "--bare", remote]);
      await execFileAsync("git", ["init", "-b", "main", repository]);
      await execFileAsync("git", [
        "-C",
        repository,
        "config",
        "user.name",
        "Test User",
      ]);
      await execFileAsync("git", [
        "-C",
        repository,
        "config",
        "user.email",
        "test@example.com",
      ]);
      await writeFile(path.join(repository, "bewerbung.txt"), "content", "utf8");

      const service = new GitAutomationService(repository, {
        remoteUrl: remote,
        watchFileChanges: false,
        now: () => new Date(2026, 7, 29, 11, 0, 0),
      });
      await service.initialize();
      service.queueCommit("Test Firma", "bewerbung");
      await service.waitForIdle();

      const { stdout: commitMessage } = await execFileAsync("git", [
        "-C",
        repository,
        "log",
        "-1",
        "--pretty=%s",
      ]);
      const { stdout: remoteHead } = await execFileAsync("git", [
        "--git-dir",
        remote,
        "rev-parse",
        "refs/heads/main",
      ]);
      const { stdout: localHead } = await execFileAsync("git", [
        "-C",
        repository,
        "rev-parse",
        "HEAD",
      ]);

      expect(commitMessage.trim()).toBe(
        "Test Firma | 2026-08-29 11:00:00 | bewerbung",
      );
      expect(remoteHead.trim()).toBe(localHead.trim());

      const otherClone = path.join(base, "other-clone");
      await execFileAsync("git", ["clone", "--branch", "main", remote, otherClone]);
      await execFileAsync("git", [
        "-C",
        otherClone,
        "config",
        "user.name",
        "Other User",
      ]);
      await execFileAsync("git", [
        "-C",
        otherClone,
        "config",
        "user.email",
        "other@example.com",
      ]);
      await writeFile(path.join(otherClone, "remote.txt"), "remote", "utf8");
      await execFileAsync("git", ["-C", otherClone, "add", "--all"]);
      await execFileAsync("git", [
        "-C",
        otherClone,
        "commit",
        "-m",
        "remote update",
      ]);
      await execFileAsync("git", ["-C", otherClone, "push", "origin", "main"]);
      await writeFile(path.join(repository, "local.txt"), "local", "utf8");

      service.queueCommit("Test Firma", "update");
      await expect(service.waitForIdle()).rejects.toThrow("Git push failed");

      await expect(readFile(path.join(repository, "remote.txt"), "utf8")).rejects.toThrow();
      await expect(readFile(path.join(repository, "local.txt"), "utf8")).resolves.toBe("local");
      const { stdout: localCommitMessage } = await execFileAsync("git", [
        "-C",
        repository,
        "log",
        "-1",
        "--pretty=%s",
      ]);
      expect(localCommitMessage.trim()).toBe(
        "Test Firma | 2026-08-29 11:00:00 | update",
      );
      const { stdout: conflicts } = await execFileAsync("git", [
        "-C",
        repository,
        "diff",
        "--name-only",
        "--diff-filter=U",
      ]);
      expect(conflicts.trim()).toBe("");
    },
    15_000,
  );
});
