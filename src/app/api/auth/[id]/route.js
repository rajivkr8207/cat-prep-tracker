import {
  getAuthenticatedUser,
  handleAuthError,
  publicUser,
  readJsonBody,
} from "@/lib/auth";

export async function GET(request, { params }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

    const { id } = await params;
    if (id !== user._id.toString()) {
      return Response.json({ error: "You can only view your own profile" }, { status: 403 });
    }

    return Response.json({ user: publicUser(user) });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

    const { id } = await params;
    if (id !== user._id.toString()) {
      return Response.json({ error: "You can only edit your own profile" }, { status: 403 });
    }

    const body = await readJsonBody(request);
    if (!body) return Response.json({ error: "A JSON object is required" }, { status: 400 });

    const fields = ["fullName", "username", "email", "mobile"];
    const updates = fields.filter((field) => Object.hasOwn(body, field));
    if (updates.length === 0) {
      return Response.json({ error: "Provide at least one profile field to update" }, { status: 400 });
    }

    for (const field of updates) {
      const value = body[field];
      if (field === "mobile" && (value === null || value === "")) {
        user.set(field, undefined);
      } else if (typeof value === "string") {
        user.set(field, value);
      } else {
        return Response.json({ error: `${field} must be a string` }, { status: 400 });
      }
    }
    await user.save();

    return Response.json({ message: "Profile updated", user: publicUser(user) });
  } catch (error) {
    return handleAuthError(error);
  }
}
