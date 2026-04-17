import mammoth from "mammoth";

const ALLOWED_KINDS = new Set(["text", "image", "pdf", "docx"]);

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
    throw new Error(message);
  }
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
      fileData: String(attachment.fileData || ""),
      previewUrl: "",
      size,
    },
  };
};

const normalizeDocxAttachment = async (attachment) => {
  const size = sanitizeSize(attachment.size);
  enforceLimit(size, DOCX_LIMIT, "Keep DOCX files under 1 MB.");

  let textContent = "";
  const fileData = String(attachment.fileData || "");

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

  return {
    processingAttachment: {
      kind: "image",
      name: sanitizeFileName(attachment.name),
      mimeType: sanitizeMimeType(attachment.mimeType, "image/jpeg"),
      textContent: `Image attachment uploaded: ${sanitizeFileName(attachment.name)}`,
      fileData: "",
      previewUrl: String(attachment.previewUrl || ""),
      size,
    },
  };
};

const normalizeIncomingAttachment = async (attachment) => {
  if (!attachment || typeof attachment !== "object") {
    return null;
  }

  const kind = String(attachment.kind || "text").trim().toLowerCase();
  if (!ALLOWED_KINDS.has(kind)) {
    throw new Error("Unsupported attachment type.");
  }

  let normalized;

  if (kind === "text") normalized = normalizeTextAttachment(attachment);
  if (kind === "pdf") normalized = normalizePdfAttachment(attachment);
  if (kind === "docx") normalized = await normalizeDocxAttachment(attachment);
  if (kind === "image") normalized = normalizeImageAttachment(attachment);

  const processingAttachment = normalized.processingAttachment;

  return {
    processingAttachment,
    storedAttachment: buildStoredAttachment(processingAttachment),
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
