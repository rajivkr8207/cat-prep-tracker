import { clearAuthCookies, handleAuthError, revokeSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    await revokeSession(request);
    const response = NextResponse.json({ message: "Logout successful" });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    return handleAuthError(error);
  }
}
