import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  parseObjectId,
  topicApiError,
  validateTopicPayload,
} from "@/lib/topic-api";
import Topic from "@/models/Topic.model";

async function getTopicId(context) {
  const { id } = await context.params;
  return id;
}

export async function GET(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getTopicId(context);
    if (!parseObjectId(id)) {
      return Response.json({ error: "Invalid topic ID" }, { status: 400 });
    }

    await connectDB();
    const topic = await Topic.findOne({
      _id: id,
      userId: user._id,
    }).lean();

    if (!topic) {
      return Response.json({ error: "Topic not found" }, { status: 404 });
    }

    return Response.json({ topic });
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

    const id = await getTopicId(context);
    if (!parseObjectId(id)) {
      return Response.json({ error: "Invalid topic ID" }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "A valid JSON object is required" }, { status: 400 });
    }

    const validation = validateTopicPayload(body, { partial: true });
    if (validation.error) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    await connectDB();
    const topic = await Topic.findOne({
      _id: id,
      userId: user._id,
    });

    if (!topic) {
      return Response.json({ error: "Topic not found" }, { status: 404 });
    }

    for (const [field, value] of Object.entries(validation.payload)) {
      topic.set(field, value);
    }
    await topic.save();

    return Response.json({ topic });
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

    const id = await getTopicId(context);
    if (!parseObjectId(id)) {
      return Response.json({ error: "Invalid topic ID" }, { status: 400 });
    }

    await connectDB();
    const deleted = await Topic.findOneAndDelete({
      _id: id,
      userId: user._id,
    });

    if (!deleted) {
      return Response.json({ error: "Topic not found" }, { status: 404 });
    }

    return Response.json({ message: "Topic deleted" });
  } catch (error) {
    return topicApiError(error);
  }
}
