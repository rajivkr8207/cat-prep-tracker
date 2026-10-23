import {
  getAuthenticatedUser,
  handleAuthError,
  publicUser,
} from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    return Response.json({ user: publicUser(user) });
  } catch (error) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") throw error;
    return handleAuthError(error);
  }
}
