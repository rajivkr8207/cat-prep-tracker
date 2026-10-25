import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  parseReflectionId,
  reflectionApiError,
  validateReflectionPayload,
} from "@/lib/reflection-api";
import DailyReflection from "@/models/DailyReflection.model";

async function getReflectionId(context) {
  const { id } = await context.params;
  return id;
}

export async function GET(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getReflectionId(context);
    if (!parseReflectionId(id)) {
      return Response.json({ error: "Invalid reflection ID" }, { status: 400 });
    }

    await connectDB();
    const reflection = await DailyReflection.findOne({
      _id: id,
      userId: user._id,
    }).lean();

    if (!reflection) {
      return Response.json({ error: "Daily reflection not found" }, { status: 404 });
    }

    return Response.json({ reflection });
  } catch (error) {
    return reflectionApiError(error);
  }
}

export async function PATCH(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getReflectionId(context);
    if (!parseReflectionId(id)) {
      return Response.json({ error: "Invalid reflection ID" }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "A valid JSON object is required" }, { status: 400 });
    }

    const validation = validateReflectionPayload(body, { partial: true });
    if (validation.error) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    await connectDB();
    const reflection = await DailyReflection.findOne({
      _id: id,
      userId: user._id,
    });

    if (!reflection) {
      return Response.json({ error: "Daily reflection not found" }, { status: 404 });
    }

    for (const [field, value] of Object.entries(validation.payload)) {
      reflection.set(field, value);
    }
    await reflection.save();

    return Response.json({ reflection });
  } catch (error) {
    return reflectionApiError(error);
  }
}

export async function DELETE(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getReflectionId(context);
    if (!parseReflectionId(id)) {
      return Response.json({ error: "Invalid reflection ID" }, { status: 400 });
    }

    await connectDB();
    const deleted = await DailyReflection.findOneAndDelete({
      _id: id,
      userId: user._id,
    });

    if (!deleted) {
      return Response.json({ error: "Daily reflection not found" }, { status: 404 });
    }

    return Response.json({ message: "Daily reflection deleted" });
  } catch (error) {
    return reflectionApiError(error);
  }
}
