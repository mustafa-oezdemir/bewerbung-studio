import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import * as nodeFs from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";
import { AppError } from "../src/shared/app-error";
import {
  imageReference,
  interviewFenceLine as fenceLine,
  localInterviewImagePattern,
  remoteInterviewImages,
  wholeLineImageLink as wholeLineLink,
} from "../src/shared/interviewMarkdown";
import { decodeForManagedRead, encodeForManagedWrite, lstat, mkdir, rm } from "./security/secure-fs";
export { remoteInterviewImages };

/**
 * Images of the interview notes: an image address in the text (`![…](https://…)` or a line that is only a link to
 * an image) is downloaded once into `<interview folder>/Bilder/` and the text then points to the local file
 * (`![…](Bilder/… "Quelle: https://…")`). Viewing a note never contacts the image host. Only https addresses with a
 * host name, at most `maxBytes` per image, and only real PNG, JPEG, GIF or WebP files (checked by their bytes, never
 * by the server's word; no SVG) are saved. A failed download leaves the link as it was.
 */

export const interviewImageLimits = {
  maxBytes: 5 * 1024 * 1024,
  /** An encrypted image is slightly larger on disk. */
  maxStoredBytes: 6 * 1024 * 1024,
  maxImages: 30,
  timeoutMs: 15_000,
  maxRedirects: 5,
} as const;

export const interviewImageFolder = "Bilder";

export type ImageFetcher = (url: string) => Promise<Uint8Array>;

const imageTypes = [
  { extension: "png", mime: "image/png", matches: (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { extension: "jpg", mime: "image/jpeg", matches: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { extension: "gif", mime: "image/gif", matches: (b: Uint8Array) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  {
    extension: "webp",
    mime: "image/webp",
    matches: (b: Uint8Array) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
] as const;

export const detectImageType = (bytes: Uint8Array) => imageTypes.find((type) => bytes.length >= 12 && type.matches(bytes)) ?? null;

/** https with a real host name: no credentials, no IP address, no localhost (nothing in the user's own network). */
const isAllowedImageUrl = (url: URL) => {
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return url.protocol === "https:" && !url.username && !url.password && !isIP(host) &&
    host.includes(".") && host !== "localhost" && !host.endsWith(".localhost") && !host.endsWith(".local") &&
    (!url.port || url.port === "443");
};

/** Downloads one image with `fetch`: every redirect is checked again, the body is cut off above `maxBytes`. */
export const fetchInterviewImage: ImageFetcher = async (address) => {
  let url = new URL(address);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), interviewImageLimits.timeoutMs);
  try {
    for (let redirects = 0; ; redirects += 1) {
      if (!isAllowedImageUrl(url)) throw new Error("image address not allowed");
      const response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "image/png,image/jpeg,image/gif,image/webp" },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects >= interviewImageLimits.maxRedirects) throw new Error("too many redirects");
        url = new URL(location, url);
        continue;
      }
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      if (Number(response.headers.get("content-length") ?? 0) > interviewImageLimits.maxBytes) throw new Error("image too large");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > interviewImageLimits.maxBytes) {
          await reader.cancel();
          throw new Error("image too large");
        }
        chunks.push(value);
      }
      return Buffer.concat(chunks);
    }
  } finally {
    clearTimeout(timer);
  }
};

const fileStem = (alt: string) => alt.normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "")
  .slice(0, 40).replace(/-+$/g, "") || "Bild";

const nodeCode = (error: unknown) =>
  error && typeof error === "object" && "code" in error ? String(error.code) : "";

/** The `Bilder` folder of a checked interview folder: a real directory, created when missing. */
const imageFolder = async (folder: string) => {
  const directory = path.join(folder, interviewImageFolder);
  await mkdir(directory).catch((error: unknown) => {
    if (nodeCode(error) !== "EEXIST") throw error;
  });
  const info = await lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new AppError("VALIDATION_FAILED", "Der Bilderordner ist eine Verknüpfung und wird nicht verwendet.", { expected: true });
  }
  return directory;
};

/** Writes a new image file completely, then links it into place; an existing file of that name is kept. */
const writeImage = async (directory: string, fileName: string, bytes: Uint8Array) => {
  const target = path.join(directory, fileName);
  const temporary = path.join(directory, `.${randomUUID()}.tmp`);
  await nodeFs.writeFile(temporary, encodeForManagedWrite(target, Buffer.from(bytes)), { flag: "wx" });
  try {
    try {
      await nodeFs.link(temporary, target);
    } catch (error) {
      if (nodeCode(error) === "EEXIST") return;
      if (!["EPERM", "ENOTSUP", "ENOSYS", "EXDEV", "EINVAL"].includes(nodeCode(error))) throw error;
      await nodeFs.copyFile(temporary, target, constants.COPYFILE_EXCL).catch((copyError: unknown) => {
        if (nodeCode(copyError) !== "EEXIST") throw copyError;
      });
    }
  } finally {
    await rm(temporary, { force: true });
  }
};

export type LocalizedImages = { text: string; saved: number; failed: string[] };

/**
 * Downloads the image addresses of `text` into `<folder>/Bilder/` and returns the text pointing to the local files.
 * Addresses that fail (not reachable, not an image, too large, not allowed) stay as they were and are named in
 * `failed` (by their description or host).
 */
export const localizeInterviewImages = async (
  folder: string,
  text: string,
  fetcher: ImageFetcher = fetchInterviewImage,
): Promise<LocalizedImages> => {
  const references = remoteInterviewImages(text).slice(0, interviewImageLimits.maxImages);
  if (!references.length) return { text, saved: 0, failed: [] };
  const directory = await imageFolder(folder);
  const localFiles = new Map<string, string>();
  const failed: string[] = [];
  for (const reference of references) {
    try {
      const bytes = await fetcher(reference.url);
      const type = detectImageType(bytes);
      if (!type || bytes.length > interviewImageLimits.maxBytes) throw new Error("not an image");
      const hash = createHash("sha256").update(reference.url).digest("hex").slice(0, 10);
      const fileName = `${fileStem(reference.alt)}_${hash}.${type.extension}`;
      await writeImage(directory, fileName, bytes);
      localFiles.set(reference.url, `${interviewImageFolder}/${fileName}`);
    } catch {
      failed.push(reference.alt.trim() || new URL(reference.url).hostname);
    }
  }
  const local = (url: string, alt: string) => {
    const file = localFiles.get(url);
    return file ? `![${alt}](${file} "Quelle: ${url}")` : null;
  };
  let fence: string | null = null;
  const lines = text.split("\n").map((line) => {
    const marker = fenceLine.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      return line;
    }
    if (marker) {
      fence = marker;
      return line;
    }
    const link = wholeLineLink.exec(line);
    const replaced = link ? local(link[3], link[2]) : null;
    if (link && replaced) return `${link[1]}${replaced}`;
    return line.replace(imageReference, (match, alt: string, url: string) => local(url, alt) ?? match);
  });
  return { text: lines.join("\n"), saved: localFiles.size, failed };
};

/** A downloaded image as a `data:` URL for the panel (the page may show `data:` images, never remote ones). */
export const readInterviewImage = async (folder: string, source: string) => {
  const notFound = () => new AppError("RESOURCE_NOT_FOUND", "Das Bild wurde nicht gefunden.", { expected: true });
  if (!localInterviewImagePattern.test(source)) throw notFound();
  const filePath = path.join(folder, interviewImageFolder, source.slice(interviewImageFolder.length + 1));
  const directory = await lstat(path.dirname(filePath)).catch(() => null);
  const info = await lstat(filePath).catch(() => null);
  if (!directory || directory.isSymbolicLink() || !directory.isDirectory() || !info || info.isSymbolicLink() || !info.isFile() ||
      info.size > interviewImageLimits.maxStoredBytes) throw notFound();
  let bytes: Buffer;
  try {
    bytes = decodeForManagedRead(filePath, await nodeFs.readFile(filePath));
  } catch {
    throw notFound();
  }
  const type = detectImageType(bytes);
  if (!type) throw notFound();
  return `data:${type.mime};base64,${bytes.toString("base64")}`;
};
