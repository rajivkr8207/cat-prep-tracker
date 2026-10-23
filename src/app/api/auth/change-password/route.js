import {
  clearAuthCookies,
  getAuthenticatedUser,
  handleAuthError,
  readJsonBody,
} from "@/lib/auth";
import UserModel from "@/models/user.model";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

    const body = await readJsonBody(request);
    if (
      typeof body?.currentPassword !== "string" ||
      typeof body?.newPassword !== "string"
    ) {
      return Response.json(
        { error: "currentPassword and newPassword are required" },
        { status: 400 },
      );
    }
    const passwordUser = await UserModel.findById(user._id).select("+password");
    if (!passwordUser || !(await passwordUser.comparePassword(body.currentPassword))) {
      return Response.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    if (body.newPassword.length < 6) {
      return Response.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }
    if (body.currentPassword === body.newPassword) {
      return Response.json(
        { error: "New password must be different from the current password" },
        { status: 400 },
      );
    }

    passwordUser.password = body.newPassword;
    passwordUser.authVersion = (passwordUser.authVersion || 0) + 1;
    passwordUser.refreshTokenHash = null;
    await passwordUser.save();

    const response = NextResponse.json({
      message: "Password changed. Please sign in again.",
    });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    return handleAuthError(error);
  }
}
