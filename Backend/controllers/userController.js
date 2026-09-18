import { normalizeIncomingAttachment } from "../utils/attachments.js";
import { createAppError } from "../utils/appError.js";
import { normalizeEmail, normalizeName, normalizePassword, readOptionalString } from "../utils/requestValidation.js";
import { getCurrentUser, loginUser, logoutUser, registerUser } from "../services/authService.js";

const register = async (req, res) => {
  const payload = req.body || {};
  const avatarUrl = readOptionalString(payload.avatarUrl, 2_100_000);

  if (avatarUrl) {
    await normalizeIncomingAttachment({
      kind: "image",
      name: "avatar.webp",
      mimeType: "image/webp",
      previewUrl: avatarUrl,
      size: avatarUrl.length,
    }).catch(() => {
      throw createAppError(400, "Upload a PNG, JPG, JPEG, or WEBP image under 1.5 MB.", "INVALID_AVATAR");
    });
  }

  const result = await registerUser({
    name: normalizeName(payload.name),
    email: normalizeEmail(payload.email),
    password: normalizePassword(payload.password),
    avatarUrl,
  });

  res.status(201).json(result);
};

const login = async (req, res) => {
  const payload = req.body || {};
  const result = await loginUser({
    email: normalizeEmail(payload.email),
    password: normalizePassword(payload.password),
  });

  res.json(result);
};

const me = async (req, res) => {
  const user = await getCurrentUser(req.userId);
  res.json(user);
};

const logout = async (req, res) => {
  await logoutUser(req.userId);
  res.json({ success: true });
};

export { login, logout, me, register };
