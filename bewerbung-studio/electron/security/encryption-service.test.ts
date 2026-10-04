import { describe, expect, it } from "vitest";
import { defaultSettings } from "../../src/shared/schema";
import { EncryptionService, parseEncryptedWorkspace, validateNewPassword } from "./encryption-service";

const password = "Kaffee Zug Marburg Wolke 2026!";
const workspace = JSON.stringify({
  schemaVersion: 1, applications: [], profiles: [], events: [], attachments: [],
  todos: [], customCvDesigns: [], settings: defaultSettings,
  updatedAt: new Date().toISOString(),
});

describe("encrypted workspace envelope", () => {
  it("rejects obvious long passwords while allowing Unicode passphrases", () => {
    expect(() => validateNewPassword("password12345678")).toThrow();
    expect(() => validateNewPassword("11111111111111")).toThrow();
    expect(() => validateNewPassword("Kaffee Zug Marburg Wolke 2026! ä")).not.toThrow();
  });
  it("keeps secrets out of the envelope and opens with password or recovery key", async () => {
    const { service, recoveryKey, envelope } = await EncryptionService.create(password, workspace);
    expect(envelope.encryption).toMatchObject({ memoryCost: 32768, timeCost: 3, parallelism: 1 });
    expect(JSON.stringify(envelope)).not.toContain("autoBackupEnabled");
    expect(JSON.stringify(envelope)).not.toContain(password);
    expect(JSON.stringify(envelope)).not.toContain(recoveryKey);
    expect(service.decryptWorkspace()).toBe(workspace);
    service.lock();
    await expect(service.unlockWithPassword("wrong password 1234")).rejects.toThrow("nicht korrekt");
    expect(await service.unlockWithPassword(password)).toBe(workspace);
    service.lock();
    expect(() => service.unlockWithRecoveryKey("BM-0000")).toThrow();
    expect(service.unlockWithRecoveryKey(recoveryKey)).toBe(workspace);
  }, 30_000);

  it("rejects ciphertext tampering without exposing partial data", async () => {
    const { envelope } = await EncryptionService.create(password, workspace);
    const tampered = structuredClone(envelope);
    tampered.payload.ciphertext = `${tampered.payload.ciphertext[0] === "A" ? "B" : "A"}${tampered.payload.ciphertext.slice(1)}`;
    const service = EncryptionService.fromEnvelope(tampered);
    await expect(service.unlockWithPassword(password)).rejects.toThrow("nicht korrekt");
    expect(service.unlocked).toBe(false);
  }, 30_000);

  it("rewraps one DEK for a new password and rotates the recovery key", async () => {
    const { service, recoveryKey } = await EncryptionService.create(password, workspace);
    const oldPayload = service.currentEnvelope.payload;
    await service.changePassword(password, "Neue lange Passphrase mit Umlaut ä 2026");
    expect(service.currentEnvelope.payload).toEqual(oldPayload);
    service.lock();
    await expect(service.unlockWithPassword(password)).rejects.toThrow();
    await service.unlockWithPassword("Neue lange Passphrase mit Umlaut ä 2026");
    const rotated = await service.rotateRecoveryKey("Neue lange Passphrase mit Umlaut ä 2026");
    service.lock();
    expect(() => service.unlockWithRecoveryKey(recoveryKey)).toThrow();
    expect(service.unlockWithRecoveryKey(rotated.recoveryKey)).toBe(workspace);
  }, 45_000);

  it("encrypts binary files with a fresh nonce and rejects modifications", async () => {
    const { service } = await EncryptionService.create(password, workspace);
    const original = Buffer.from("Secret Company GmbH, Berlin");
    const first = service.encryptFile(original);
    const second = service.encryptFile(original);
    expect(first.equals(second)).toBe(false);
    expect(first.includes(original)).toBe(false);
    expect(service.decryptFile(first)).toEqual(original);
    first[first.length - 1] ^= 1;
    expect(() => service.decryptFile(first)).toThrow("verändert oder sind beschädigt");
  });

  it("rejects future encryption format versions", () => {
    expect(() => parseEncryptedWorkspace({ format: "bewerbungsmanager-encrypted-workspace", version: 2 })).toThrow("neueren Version");
  });
});
