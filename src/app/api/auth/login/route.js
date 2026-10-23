import { connectDB } from "@/config/database";
import { NextResponse } from "next/server";
import {
  createSessionTokens,
  handleAuthError,
  publicUser,
  readJsonBody,
  setAuthCookies,
  setRefreshTokenHash,
} from "@/lib/auth";
import UserModel from "@/models/user.model";

export async function POST(request) {
  const body = await readJsonBody(request);
  const identifier =
    typeof body?.identifier === "string"
      ? body.identifier.trim().toLowerCase()
      : typeof body?.email === "string"
        ? body.email.trim().toLowerCase()
        : typeof body?.username === "string"
          ? body.username.trim().toLowerCase()
          : "";

  if (!identifier || typeof body?.password !== "string" || !body.password) {
    return Response.json(
      { error: "An email or username and password are required" },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const user = await UserModel.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    }).select("+password");

    if (!user || !(await user.comparePassword(body.password))) {
      return Response.json({ error: "Invalid email/username or password" }, { status: 401 });
    }
    if (user.isBlocked || !user.isApproved) {
      return Response.json({ error: "This account cannot sign in" }, { status: 403 });
    }

    const tokens = createSessionTokens(user);
    setRefreshTokenHash(user, tokens.refreshToken);
    user.lastLoginAt = new Date();
    await user.save();

    const response = NextResponse.json({
      message: "Login successful",
      user: publicUser(user),
    });
    setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
    return response;
  } catch (error) {
    return handleAuthError(error);
  }
}
