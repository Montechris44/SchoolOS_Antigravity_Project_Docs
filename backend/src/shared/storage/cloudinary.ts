import crypto from "crypto";

import { env } from "../../config/env";
import { AppError, BadRequestError } from "../http/errors";

export interface UploadedFile {
  url: string;
  publicId: string;
  bytes: number;
  format?: string;
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const IMAGE_SIGNATURES: Array<{ mime: string; test: (b: Buffer) => boolean }> = [
  { mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: "image/webp",
    test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];
const isPdf = (b: Buffer) => b.subarray(0, 5).toString("ascii") === "%PDF-";

export type UploadKind = "image" | "document";

/**
 * Trusts the file's magic bytes, never the client-supplied mime type or extension, so an executable
 * renamed to .png is rejected. Documents are limited to PDF.
 */
export function assertFileAllowed(buffer: Buffer, kind: UploadKind): { mime: string; resourceType: "image" | "raw" } {
  if (buffer.length === 0) throw new BadRequestError("The uploaded file is empty.");
  if (buffer.length > MAX_UPLOAD_BYTES) throw new BadRequestError("File is too large (5 MB maximum).");

  const image = IMAGE_SIGNATURES.find((signature) => signature.test(buffer));
  if (image) return { mime: image.mime, resourceType: "image" };
  if (kind === "document" && isPdf(buffer)) return { mime: "application/pdf", resourceType: "raw" };

  throw new BadRequestError(
    kind === "image" ? "Only JPEG, PNG or WebP images are allowed." : "Only images and PDF files are allowed."
  );
}

export function isStorageConfigured(): boolean {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

export async function uploadToStorage(buffer: Buffer, folder: string, kind: UploadKind): Promise<UploadedFile> {
  if (!isStorageConfigured()) {
    throw new AppError("File storage is not configured on this server.", 503);
  }
  const { mime, resourceType } = assertFileAllowed(buffer, kind);

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign + env.CLOUDINARY_API_SECRET)
    .digest("hex");

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mime }));
  form.append("api_key", env.CLOUDINARY_API_KEY as string);
  form.append("timestamp", timestamp);
  form.append("folder", folder);
  form.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    throw new AppError("File upload failed. Please try again.", 502);
  }
  const body = (await response.json()) as { secure_url: string; public_id: string; bytes: number; format?: string };
  return { url: body.secure_url, publicId: body.public_id, bytes: body.bytes, format: body.format };
}

/** Uploads are namespaced per school so a public_id never collides across tenants. */
export function schoolFolder(schoolId: string, area: string): string {
  return `schoolos/${schoolId}/${area}`;
}
