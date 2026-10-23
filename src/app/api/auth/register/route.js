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
  if (!body) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
  const { fullName, username, email, password } = body;

  if (
    !body ||
    typeof body.fullName !== "string" ||
    typeof body.username !== "string" ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return Response.json(
      { error: "fullName, username, email, and password are required" },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const user = new UserModel({
      fullName: body.fullName,
      username: body.username,
      email: body.email,
      password: body.password,
      ...(typeof body.mobile === "string" && body.mobile.trim()
        ? { mobile: body.mobile }
        : {}),
    });
    const tokens = createSessionTokens(user);
    setRefreshTokenHash(user, tokens.refreshToken);
    await user.save();

    const response = NextResponse.json(
      { message: "Registration successful", user: publicUser(user) },
      { status: 201 },
    );
    setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
    return response;
  } catch (error) {
    return handleAuthError(error);
  }
}
