import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";

export const PASSWORD_RESET_OTP_TTL_MS = 10 * 60 * 1000;
export const PASSWORD_RESET_RESEND_DELAY_MS = 60 * 1000;
export const PASSWORD_RESET_MAX_ATTEMPTS = 5;
export const PASSWORD_RESET_TOKEN_TTL_MS = 10 * 60 * 1000;

export function isValidPasswordResetEmail(email) {
  return (
    typeof email === "string" &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  );
}

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export function hashPasswordResetSecret(secret) {
  return createHash("sha256").update(secret).digest("hex");
}

export function passwordResetSecretMatches(secret, storedHash) {
  if (!storedHash || !/^[\da-f]{64}$/i.test(storedHash)) return false;

  const actualHash = Buffer.from(hashPasswordResetSecret(secret), "hex");
  const expectedHash = Buffer.from(storedHash, "hex");
  return timingSafeEqual(actualHash, expectedHash);
}

export function generatePasswordResetOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function generatePasswordResetToken() {
  return randomBytes(32).toString("hex");
}

export function clearPasswordResetData(user) {
  user.passwordResetOtpHash = null;
  user.passwordResetOtpExpiresAt = null;
  user.passwordResetOtpSentAt = null;
  user.passwordResetOtpAttempts = 0;
  user.passwordResetTokenHash = null;
  user.passwordResetTokenExpiresAt = null;
}
