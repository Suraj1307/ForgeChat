import mammoth from "mammoth";
import { createAppError } from "./appError.js";

const ALLOWED_KINDS = new Set(["text", "image", "pdf", "docx"]);
const DATA_URL_IMAGE_PATTERN = /^data:image\/(?:png|jpeg|jpg|webp);base64,[a-z0-9+/=]+$/i;
const BASE64_PATTERN = /^[a-z0-9+/=]+$/i;

const TEXT_LIMIT = 120000;
const PDF_LIMIT = 1500000;
const DOCX_LIMIT = 1000000;
const IMAGE_LIMIT = 1500000;

const sanitizeFileName = (value) => {
  const trimmed = String(value || "attachment").trim();
  return trimmed.slice(0, 180) || "attachment";
};

const sanitizeMimeType = (value, fallback) => {
  const trimmed = String(value || fallback).trim();
  return trimmed.slice(0, 120) || fallback;
};

const sanitizeSize = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const enforceLimit = (size, maxSize, message) => {
  if (size > maxSize) {
    throw createAppError(400, message, "ATTACHMENT_TOO_LARGE");
  }
};

const ensureBase64 = (value, fieldName) => {
  const normalized = String(value || "").trim();

  if (normalized && !BASE64_PATTERN.test(normalized)) {
    throw createAppError(400, `Invalid ${fieldName}.`, "INVALID_ATTACHMENT");
  }

  return normalized;
};

const buildStoredAttachment = (attachment) => ({
  kind: attachment.kind,
  name: attachment.name,
  mimeType: attachment.mimeType,
  textContent: attachment.textContent || "",
  size: attachment.size,
});

const normalizeTextAttachment = (attachment) => {
  const size = sanitizeSize(attachment.size);
  enforceLimit(size, TEXT_LIMIT, "Keep text or code attachments under 120 KB.");

  return {
    processingAttachment: {
      kind: "text",
      name: sanitizeFileName(attachment.name),
      mimeType: sanitizeMimeType(attachment.mimeType, "text/plain"),
      textContent: String(attachment.textContent || "").slice(0, TEXT_LIMIT),
      fileData: "",
      previewUrl: "",
      size,
    },
  };
};

const normalizePdfAttachment = (attachment) => {
  const size = sanitizeSize(attachment.size);
  enforceLimit(size, PDF_LIMIT, "Keep PDF files under 1.5 MB.");

  return {
    processingAttachment: {
      kind: "pdf",
      name: sanitizeFileName(attachment.name),
      mimeType: sanitizeMimeType(attachment.mimeType, "application/pdf"),
      textContent: attachment.textContent || `PDF attachment uploaded: ${sanitizeFileName(attachment.name)}`,
      fileData: ensureBase64(attachment.fileData, "PDF data"),
      previewUrl: "",
      size,
    },
  };
};

const normalizeDocxAttachment = async (attachment) => {
  const size = sanitizeSize(attachment.size);
  enforceLimit(size, DOCX_LIMIT, "Keep DOCX files under 1 MB.");

  let textContent = "";
  const fileData = ensureBase64(attachment.fileData, "DOCX data");

  if (fileData) {
    const buffer = Buffer.from(fileData, "base64");
    const extracted = await mammoth.extractRawText({ buffer });
    textContent = extracted.value?.trim() || "";
  }

  return {
    processingAttachment: {
      kind: "docx",
      name: sanitizeFileName(attachment.name),
      mimeType: sanitizeMimeType(
        attachment.mimeType,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ),
      textContent: textContent || `DOCX attachment uploaded: ${sanitizeFileName(attachment.name)}`,
      fileData,
      previewUrl: "",
      size,
    },
  };
};

const normalizeImageAttachment = (attachment) => {
  const size = sanitizeSize(attachment.size);
  enforceLimit(size, IMAGE_LIMIT, "Keep image files under 1.5 MB.");
  const previewUrl = String(attachment.previewUrl || "").trim();

  if (!previewUrl || !DATA_URL_IMAGE_PATTERN.test(previewUrl)) {
    throw createAppError(400, "Upload a PNG, JPG, JPEG, or WEBP image under 1.5 MB.", "INVALID_ATTACHMENT");
  }

  return {
    processingAttachment: {
      kind: "image",
      name: sanitizeFileName(attachment.name),
      mimeType: sanitizeMimeType(attachment.mimeType, "image/jpeg"),
      textContent: `Image attachment uploaded: ${sanitizeFileName(attachment.name)}`,
      fileData: "",
      previewUrl,
      size,
    },
  };
};

const normalizeIncomingAttachment = async (attachment) => {
  if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) {
    return null;
  }

  const kind = String(attachment.kind || "text").trim().toLowerCase();

  if (!ALLOWED_KINDS.has(kind)) {
    throw createAppError(400, "Unsupported attachment type.", "INVALID_ATTACHMENT");
  }

  let normalized = null;

  if (kind === "text") normalized = normalizeTextAttachment(attachment);
  if (kind === "pdf") normalized = normalizePdfAttachment(attachment);
  if (kind === "docx") normalized = await normalizeDocxAttachment(attachment);
  if (kind === "image") normalized = normalizeImageAttachment(attachment);

  return {
    processingAttachment: normalized.processingAttachment,
    storedAttachment: buildStoredAttachment(normalized.processingAttachment),
  };
};

export {
  DOCX_LIMIT,
  IMAGE_LIMIT,
  PDF_LIMIT,
  TEXT_LIMIT,
  buildStoredAttachment,
  normalizeIncomingAttachment,
};
