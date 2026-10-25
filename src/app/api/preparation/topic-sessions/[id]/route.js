import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  parseObjectId,
  topicApiError,
  validateTopicSessionPayload,
} from "@/lib/topic-api";
import TopicSession from "@/models/TopicSession.model";

async function getSessionId(context) {
  const { id } = await context.params;
  return id;
}

export async function GET(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getSessionId(context);
    if (!parseObjectId(id)) {
      return Response.json({ error: "Invalid topic session ID" }, { status: 400 });
    }

    await connectDB();
    const session = await TopicSession.findOne({
      _id: id,
      userId: user._id,
    }).lean();

    if (!session) {
      return Response.json({ error: "Topic session not found" }, { status: 404 });
    }

    return Response.json({ session });
  } catch (error) {
    return topicApiError(error);
  }
}

export async function PATCH(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getSessionId(context);
    if (!parseObjectId(id)) {
      return Response.json({ error: "Invalid topic session ID" }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "A valid JSON object is required" }, { status: 400 });
    }

    const validation = validateTopicSessionPayload(body, { partial: true });
    if (validation.error) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    await connectDB();
    const session = await TopicSession.findOne({
      _id: id,
      userId: user._id,
    });

    if (!session) {
      return Response.json({ error: "Topic session not found" }, { status: 404 });
    }

    for (const [field, value] of Object.entries(validation.payload)) {
      session.set(field, value);
    }
    await session.save();

    return Response.json({ session });
  } catch (error) {
    return topicApiError(error);
  }
}

export async function DELETE(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getSessionId(context);
    if (!parseObjectId(id)) {
      return Response.json({ error: "Invalid topic session ID" }, { status: 400 });
    }

    await connectDB();
    const deleted = await TopicSession.findOneAndDelete({
      _id: id,
      userId: user._id,
    });

    if (!deleted) {
      return Response.json({ error: "Topic session not found" }, { status: 404 });
    }

    return Response.json({ message: "Topic session deleted" });
  } catch (error) {
    return topicApiError(error);
  }
}
