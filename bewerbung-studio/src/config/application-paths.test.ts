import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_BEWERBUNG_ROOT_PATH,
  resolveApplicationPaths,
  resolveBewerbungRootPath,
} from "./application-paths";

describe("application paths", () => {
  it("uses the requested Windows root by default", () => {
    expect(resolveBewerbungRootPath({})).toBe(
      path.resolve(DEFAULT_BEWERBUNG_ROOT_PATH),
    );
  });

  it("supports one central environment override", () => {
    const root = path.resolve("D:\\custom-bewerbung");
    expect(
      resolveBewerbungRootPath({ BEWERBUNG_ROOT_PATH: root }),
    ).toBe(root);
    const paths = resolveApplicationPaths(root);
    expect(paths.dataRoot).toBe(path.join(root, "data"));
    expect(paths.settingRoot).toBe(path.join(root, "data", "Setting"));
    expect(paths.settingsRoot).toBe(path.join(root, "data", "Setting", "Settings"));
    expect(paths.profileRoot).toBe(path.join(root, "data", "Setting", "Profile"));
    expect(paths.backupsRoot).toBe(path.join(root, "data", "Setting", "Backups"));
    expect(paths.anschreibenDocuments).toBe(path.join(root, "data", "Anschreiben"));
    expect(paths.lebenslaufDocuments).toBe(path.join(root, "data", "Lebenslauf"));
    expect(paths.zeugnisseArchive).toBe(path.join(root, "data", "Zeugnisse"));
    expect(paths.zertifikateArchive).toBe(path.join(root, "data", "Zertifikate"));
    expect(paths.absagenRoot).toBe(path.join(root, "data", "Absagen"));
    expect(paths.interviewsRoot).toBe(
      path.join(root, "data", "Vorstellungsgespräch"),
    );
  });
});
