import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { argon2idAsync } from "@noble/hashes/argon2.js";
import { z } from "zod";
import { workspaceSchema } from "../../src/shared/schema";

const FORMAT = "bewerbungsmanager-encrypted-workspace";
const VERSION = 1;
const FILE_MAGIC = Buffer.from("BMENC\x01", "binary");
const WORKSPACE_AAD = Buffer.from("BM:workspace:1");
const FILE_AAD = Buffer.from("BM:file:1");
const PASSWORD_AAD = Buffer.from("BM:password-wrap:1");
const RECOVERY_AAD = Buffer.from("BM:recovery-wrap:1");
// New workspaces use a stronger desktop profile. Existing envelopes retain their
// recorded KDF costs and remain readable without migration.
const KDF = { memoryCost: 32768, timeCost: 3, parallelism: 1 } as const;

const encoded = z.string().min(1).regex(/^[A-Za-z0-9+/]+={0,2}$/);
const sealedSchema = z.object({
  nonce: encoded,
  ciphertext: encoded,
  authTag: encoded,
}).strict();
const encryptionSchema = z.object({
  cipher: z.literal("AES-256-GCM"),
  kdf: z.literal("argon2id"),
  salt: encoded,
  memoryCost: z.number().int().min(19456).max(262144),
  timeCost: z.number().int().min(2).max(10),
  parallelism: z.number().int().min(1).max(4),
  wrappedKey: sealedSchema,
  recoverySalt: encoded,
  recoveryWrappedKey: sealedSchema,
}).strict();
export const encryptedWorkspaceSchema = z.object({
  format: z.literal(FORMAT),
  version: z.literal(VERSION),
  encryption: encryptionSchema,
  payload: sealedSchema,
}).strict();
export type EncryptedWorkspace = z.infer<typeof encryptedWorkspaceSchema>;
type Sealed = z.infer<typeof sealedSchema>;

const decode = (value: string) => Buffer.from(value, "base64");
const encode = (value: Buffer) => value.toString("base64");

const seal = (key: Buffer, plaintext: Buffer, aad: Buffer): Sealed => {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { nonce: encode(nonce), ciphertext: encode(ciphertext), authTag: encode(cipher.getAuthTag()) };
};

const open = (key: Buffer, value: Sealed, aad: Buffer) => {
  const nonce = decode(value.nonce);
  const tag = decode(value.authTag);
  if (nonce.length !== 12 || tag.length !== 16) throw new Error("Die verschlüsselten Daten wurden verändert oder sind beschädigt.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(decode(value.ciphertext)), decipher.final()]);
  } catch {
    throw new Error("Die verschlüsselten Daten wurden verändert oder sind beschädigt.");
  }
};

const derivePasswordKey = async (
  password: string,
  salt: Buffer,
  costs: { memoryCost: number; timeCost: number; parallelism: number } = KDF,
) => {
  const input = Buffer.from(password, "utf8");
  try {
    return Buffer.from(await argon2idAsync(input, salt, {
      m: costs.memoryCost, t: costs.timeCost, p: costs.parallelism, dkLen: 32,
      maxmem: Math.max(32 * 1024 * 1024, costs.memoryCost * 1024 * 2),
    }));
  } finally { input.fill(0); }
};

const recoveryKeyFromText = (text: string) => {
  const normalized = text.trim().replace(/^BM-/i, "").replaceAll("-", "");
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) throw new Error("Der Wiederherstellungsschlüssel ist ungültig.");
  return Buffer.from(normalized, "hex");
};

const recoveryKek = (key: Buffer, salt: Buffer) =>
  Buffer.from(hkdfSync("sha256", key, salt, "BM recovery KEK v1", 32));

export const formatRecoveryKey = (bytes: Buffer) =>
  `BM-${bytes.toString("hex").toUpperCase().match(/.{1,4}/g)!.join("-")}`;

export const validateNewPassword = (password: string) => {
  if (Array.from(password).length < 14 || password.length > 1024)
    throw new Error("Das Master-Passwort muss mindestens 14 Zeichen haben.");
  const normalized = password.trim().toLocaleLowerCase().replace(/[\s._-]/g, "");
  if ((/^\d+$/.test(normalized) && normalized.length < 24) || /^(.)\1{13,}$/.test(normalized) ||
      /^(password|passwort|bewerbung|mustafa|admin|qwerty|letmein|welcome)[\d!@#$%^&*]*$/.test(normalized))
    throw new Error("Bitte wählen Sie ein weniger leicht zu erratendes Passwort.");
};

export const parseEncryptedWorkspace = (raw: unknown): EncryptedWorkspace | null => {
  if (!raw || typeof raw !== "object" || !("format" in raw) || raw.format !== FORMAT) return null;
  if ("version" in raw && raw.version !== VERSION)
    throw new Error("Dieser verschlüsselte Datenbestand wurde mit einer neueren Version erstellt.");
  return encryptedWorkspaceSchema.parse(raw);
};

export const isEncryptedFileBytes = (bytes: Buffer) =>
  bytes.length >= FILE_MAGIC.length && bytes.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC);

export class EncryptionService {
  private dek: Buffer | null = null;
  private failedAttempts = 0;

  private constructor(private envelope: EncryptedWorkspace) {}

  static fromEnvelope(envelope: EncryptedWorkspace) { return new EncryptionService(envelope); }

  static async create(password: string, plaintextWorkspace: string) {
    validateNewPassword(password);
    workspaceSchema.parse(JSON.parse(plaintextWorkspace));
    const dek = randomBytes(32);
    const salt = randomBytes(16);
    const recovery = randomBytes(32);
    const recoverySalt = randomBytes(16);
    const kek = await derivePasswordKey(password, salt);
    const rKek = recoveryKek(recovery, recoverySalt);
    try {
      const envelope: EncryptedWorkspace = {
        format: FORMAT,
        version: VERSION,
        encryption: {
          cipher: "AES-256-GCM", kdf: "argon2id", salt: encode(salt), ...KDF,
          wrappedKey: seal(kek, dek, PASSWORD_AAD),
          recoverySalt: encode(recoverySalt),
          recoveryWrappedKey: seal(rKek, dek, RECOVERY_AAD),
        },
        payload: seal(dek, Buffer.from(plaintextWorkspace, "utf8"), WORKSPACE_AAD),
      };
      const service = new EncryptionService(envelope);
      service.dek = dek;
      return { service, recoveryKey: formatRecoveryKey(recovery), envelope };
    } catch (error) {
      dek.fill(0);
      throw error;
    } finally {
      kek.fill(0);
      rKek.fill(0);
      recovery.fill(0);
    }
  }

  get unlocked() { return this.dek !== null; }
  get header() { return structuredClone(this.envelope.encryption); }
  get currentEnvelope() { return structuredClone(this.envelope); }
  restoreEnvelope(previous: EncryptedWorkspace) {
    this.assertKey();
    this.envelope = structuredClone(previous);
  }

  private assertKey() {
    if (!this.dek) throw new Error("Der Datenbestand ist gesperrt.");
    return this.dek;
  }

  private verifyDek(candidate: Buffer) {
    try {
      const plaintext = open(candidate, this.envelope.payload, WORKSPACE_AAD);
      workspaceSchema.parse(JSON.parse(plaintext.toString("utf8")));
      this.dek?.fill(0);
      this.dek = candidate;
      this.failedAttempts = 0;
      return plaintext.toString("utf8");
    } catch {
      candidate.fill(0);
      throw new Error("Das Passwort ist nicht korrekt oder der Datenbestand konnte nicht entschlüsselt werden.");
    }
  }

  async unlockWithPassword(password: string) {
    if (this.failedAttempts > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(this.failedAttempts * 700, 3500)));
    const info = this.envelope.encryption;
    const kek = await derivePasswordKey(password, decode(info.salt), info);
    try { return this.verifyDek(open(kek, info.wrappedKey, PASSWORD_AAD)); }
    catch {
      this.failedAttempts += 1;
      throw new Error("Das Passwort ist nicht korrekt oder der Datenbestand konnte nicht entschlüsselt werden.");
    } finally { kek.fill(0); }
  }

  unlockWithRecoveryKey(text: string) {
    const secret = recoveryKeyFromText(text);
    const kek = recoveryKek(secret, decode(this.envelope.encryption.recoverySalt));
    try { return this.verifyDek(open(kek, this.envelope.encryption.recoveryWrappedKey, RECOVERY_AAD)); }
    catch { throw new Error("Der Wiederherstellungsschlüssel ist ungültig oder der Datenbestand ist beschädigt."); }
    finally { secret.fill(0); kek.fill(0); }
  }

  unlockWithDeviceKey(key: Buffer) { return this.verifyDek(Buffer.from(key)); }
  deviceKeyCopy() { return Buffer.from(this.assertKey()); }

  decryptWorkspace(envelope: EncryptedWorkspace = this.envelope) {
    const plaintext = open(this.assertKey(), envelope.payload, WORKSPACE_AAD).toString("utf8");
    workspaceSchema.parse(JSON.parse(plaintext));
    return plaintext;
  }

  encryptWorkspace(plaintext: string) {
    workspaceSchema.parse(JSON.parse(plaintext));
    this.envelope = { ...this.envelope, payload: seal(this.assertKey(), Buffer.from(plaintext, "utf8"), WORKSPACE_AAD) };
    return JSON.stringify(this.envelope, null, 2);
  }

  encryptFile(bytes: Buffer) {
    const sealed = seal(this.assertKey(), bytes, FILE_AAD);
    return Buffer.concat([FILE_MAGIC, decode(sealed.nonce), decode(sealed.ciphertext), decode(sealed.authTag)]);
  }

  decryptFile(bytes: Buffer) {
    if (!isEncryptedFileBytes(bytes) || bytes.length < FILE_MAGIC.length + 12 + 16)
      throw new Error("Eine Datei im verschlüsselten Datenbestand liegt unverschlüsselt oder beschädigt vor.");
    const nonce = bytes.subarray(FILE_MAGIC.length, FILE_MAGIC.length + 12);
    const tag = bytes.subarray(bytes.length - 16);
    const ciphertext = bytes.subarray(FILE_MAGIC.length + 12, bytes.length - 16);
    return open(this.assertKey(), { nonce: encode(nonce), ciphertext: encode(ciphertext), authTag: encode(tag) }, FILE_AAD);
  }

  async changePassword(oldPassword: string, newPassword: string) {
    validateNewPassword(newPassword);
    const info = this.envelope.encryption;
    const oldKek = await derivePasswordKey(oldPassword, decode(info.salt), info);
    try {
      const candidate = open(oldKek, info.wrappedKey, PASSWORD_AAD);
      if (!candidate.equals(this.assertKey())) throw new Error("wrong");
      candidate.fill(0);
    } catch { throw new Error("Das bisherige Passwort ist nicht korrekt."); }
    finally { oldKek.fill(0); }
    const salt = randomBytes(16);
    const newKek = await derivePasswordKey(newPassword, salt);
    try {
      this.envelope.encryption = { ...info, ...KDF, salt: encode(salt), wrappedKey: seal(newKek, this.assertKey(), PASSWORD_AAD) };
      return this.currentEnvelope;
    } finally { newKek.fill(0); }
  }

  async rotateRecoveryKey(password: string) {
    const info = this.envelope.encryption;
    const kek = await derivePasswordKey(password, decode(info.salt), info);
    try {
      const candidate = open(kek, info.wrappedKey, PASSWORD_AAD);
      if (!candidate.equals(this.assertKey())) throw new Error("wrong");
      candidate.fill(0);
    } catch { throw new Error("Das Passwort ist nicht korrekt."); }
    finally { kek.fill(0); }
    const recovery = randomBytes(32);
    const salt = randomBytes(16);
    const rKek = recoveryKek(recovery, salt);
    try {
      this.envelope.encryption = { ...info, recoverySalt: encode(salt), recoveryWrappedKey: seal(rKek, this.assertKey(), RECOVERY_AAD) };
      return { recoveryKey: formatRecoveryKey(recovery), envelope: this.currentEnvelope };
    } finally { recovery.fill(0); rKek.fill(0); }
  }

  lock() { this.dek?.fill(0); this.dek = null; }
}
