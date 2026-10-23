import { connectDB } from "@/config/database";
import {
  generatePasswordResetToken,
  hashPasswordResetSecret,
  isValidPasswordResetEmail,
  normalizeEmail,
  PASSWORD_RESET_MAX_ATTEMPTS,
  PASSWORD_RESET_TOKEN_TTL_MS,
  passwordResetSecretMatches,
} from "@/lib/password-reset";
import { handleAuthError, readJsonBody } from "@/lib/auth";
import UserModel from "@/models/user.model";

const INVALID_CODE_RESPONSE = {
  error: "The code is invalid or expired. Request a new code and try again.",
};

export async function POST(request) {
  const body = await readJsonBody(request);
  if (
    !isValidPasswordResetEmail(body?.email) ||
    typeof body?.otp !== "string" ||
    !/^\d{6}$/.test(body.otp)
  ) {
    return Response.json(INVALID_CODE_RESPONSE, { status: 400 });
  }

  try {
    await connectDB();
    const user = await UserModel.findOne({
      email: normalizeEmail(body.email),
    }).select("+passwordResetOtpHash");

    if (!user || !user.passwordResetOtpHash) {
      return Response.json(INVALID_CODE_RESPONSE, { status: 400 });
    }

    const attemptUser = await UserModel.findOneAndUpdate(
      {
        _id: user._id,
        passwordResetOtpHash: user.passwordResetOtpHash,
        passwordResetOtpExpiresAt: { $gt: new Date() },
        passwordResetOtpAttempts: { $lt: PASSWORD_RESET_MAX_ATTEMPTS },
      },
      { $inc: { passwordResetOtpAttempts: 1 } },
      { returnDocument: "after" },
    ).select("+passwordResetOtpHash");

    if (!attemptUser) {
      return Response.json(INVALID_CODE_RESPONSE, { status: 400 });
    }

    if (!passwordResetSecretMatches(body.otp, attemptUser.passwordResetOtpHash)) {
      if (attemptUser.passwordResetOtpAttempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
        await UserModel.updateOne(
          {
            _id: attemptUser._id,
            passwordResetOtpHash: attemptUser.passwordResetOtpHash,
            passwordResetOtpAttempts: { $gte: PASSWORD_RESET_MAX_ATTEMPTS },
          },
          {
            $set: {
              passwordResetOtpHash: null,
              passwordResetOtpExpiresAt: null,
            },
          },
        );
      }
      return Response.json(INVALID_CODE_RESPONSE, { status: 400 });
    }

    const resetToken = generatePasswordResetToken();
    const resetTokenHash = hashPasswordResetSecret(resetToken);
    const verification = await UserModel.updateOne(
      {
        _id: attemptUser._id,
        passwordResetOtpHash: attemptUser.passwordResetOtpHash,
        passwordResetOtpAttempts: attemptUser.passwordResetOtpAttempts,
        passwordResetOtpExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          passwordResetOtpHash: null,
          passwordResetOtpExpiresAt: null,
          passwordResetTokenHash: resetTokenHash,
          passwordResetTokenExpiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
        },
      },
    );

    if (verification.modifiedCount !== 1) {
      return Response.json(INVALID_CODE_RESPONSE, { status: 400 });
    }

    return Response.json({
      message: "Code verified",
      resetToken,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
