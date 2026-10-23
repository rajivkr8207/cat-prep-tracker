import { connectDB } from "@/config/database";
import {
  generatePasswordResetOtp,
  hashPasswordResetSecret,
  isValidPasswordResetEmail,
  normalizeEmail,
  PASSWORD_RESET_OTP_TTL_MS,
  PASSWORD_RESET_RESEND_DELAY_MS,
} from "@/lib/password-reset";
import { handleAuthError, readJsonBody } from "@/lib/auth";
import UserModel from "@/models/user.model";
import { sendPasswordResetOtp } from "@/services/email.service";

const GENERIC_RESPONSE = {
  message:
    "If an account exists for that email, check your inbox for a reset code. If it does not arrive, try again later.",
};

export async function POST(request) {
  const body = await readJsonBody(request);
  if (!isValidPasswordResetEmail(body?.email)) {
    return Response.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  try {
    await connectDB();
    const existingUser = await UserModel.findOne({
      email: normalizeEmail(body.email),
    });

    if (!existingUser || existingUser.isBlocked || !existingUser.isApproved) {
      return Response.json(GENERIC_RESPONSE);
    }

    const now = Date.now();
    const otp = generatePasswordResetOtp();
    const otpHash = hashPasswordResetSecret(otp);
    const user = await UserModel.findOneAndUpdate(
      {
        _id: existingUser._id,
        isBlocked: false,
        isApproved: true,
        $or: [
          { passwordResetOtpSentAt: null },
          {
            passwordResetOtpSentAt: {
              $lte: new Date(now - PASSWORD_RESET_RESEND_DELAY_MS),
            },
          },
        ],
      },
      {
        $set: {
          passwordResetOtpHash: otpHash,
          passwordResetOtpExpiresAt: new Date(now + PASSWORD_RESET_OTP_TTL_MS),
          passwordResetOtpSentAt: new Date(now),
          passwordResetOtpAttempts: 0,
          passwordResetTokenHash: null,
          passwordResetTokenExpiresAt: null,
        },
      },
      { returnDocument: "after" },
    );

    if (!user) {
      return Response.json(GENERIC_RESPONSE);
    }

    try {
      await sendPasswordResetOtp(user.email, otp);
    } catch (mailError) {
      try {
        await UserModel.updateOne(
          { _id: user._id, passwordResetOtpHash: otpHash },
          {
            $set: {
              passwordResetOtpHash: null,
              passwordResetOtpExpiresAt: null,
            },
          },
        );
      } catch (cleanupError) {
        console.error("Unable to invalidate an unsent password reset code:", cleanupError);
      }
      console.error("Password reset code email delivery failed:", mailError);
      return Response.json(
        { error: "Password reset email could not be sent. Please try again later." },
        { status: 503 },
      );
    }

    return Response.json(GENERIC_RESPONSE);
  } catch (error) {
    return handleAuthError(error);
  }
}
