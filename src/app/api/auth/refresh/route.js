import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  handleAuthError,
  publicUser,
  rotateRefreshToken,
  setAuthCookies,
} from "@/lib/auth";

export async function POST(request) {
  try {
    const session = await rotateRefreshToken(request);
    if (!session) {
      const response = NextResponse.json(
        { error: "Refresh token is invalid or expired. Please sign in again." },
        { status: 401 },
      );
      clearAuthCookies(response);
      return response;
    }

    const response = NextResponse.json({
      message: "Tokens refreshed",
      user: publicUser(session.user),
    });
    setAuthCookies(response, session.accessToken, session.refreshToken);
    return response;
  } catch (error) {
    return handleAuthError(error);
  }
}
