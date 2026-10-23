import { connectDB } from "@/config/database";
import {
  clearPasswordResetData,
  isValidPasswordResetEmail,
  normalizeEmail,
  passwordResetSecretMatches,
} from "@/lib/password-reset";
import { handleAuthError, readJsonBody } from "@/lib/auth";
import UserModel from "@/models/user.model";

export async function POST(request) {
  const body = await readJsonBody(request);
  if (
    !isValidPasswordResetEmail(body?.email) ||
    typeof body?.resetToken !== "string" ||
    !/^[\da-f]{64}$/i.test(body.resetToken) ||
    typeof body?.newPassword !== "string" ||
    body.newPassword.length < 6
  ) {
    return Response.json(
      { error: "Provide a valid reset session and a password of at least 6 characters" },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const user = await UserModel.findOne({
      email: normalizeEmail(body.email),
    }).select("+passwordResetTokenHash");

    if (
      !user ||
      !user.passwordResetTokenHash ||
      !user.passwordResetTokenExpiresAt ||
      user.passwordResetTokenExpiresAt.getTime() <= Date.now() ||
      !passwordResetSecretMatches(body.resetToken, user.passwordResetTokenHash)
    ) {
      return Response.json(
        { error: "The password reset session is invalid or expired. Start again." },
        { status: 400 },
      );
    }

    const consumedResetToken = await UserModel.findOneAndUpdate(
      {
        _id: user._id,
        passwordResetTokenHash: user.passwordResetTokenHash,
        passwordResetTokenExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          passwordResetTokenHash: null,
          passwordResetTokenExpiresAt: null,
        },
      },
      { returnDocument: "after" },
    );

    if (!consumedResetToken) {
      return Response.json(
        { error: "The password reset session is invalid or expired. Start again." },
        { status: 400 },
      );
    }

    user.password = body.newPassword;
    user.authVersion = (user.authVersion || 0) + 1;
    user.refreshTokenHash = null;
    clearPasswordResetData(user);
    await user.save();

    return Response.json({ message: "Password reset successfully. Please sign in." });
  } catch (error) {
    return handleAuthError(error);
  }
}
