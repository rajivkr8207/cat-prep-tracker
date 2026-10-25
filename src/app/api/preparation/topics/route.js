import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  topicApiError,
  validateTopicPayload,
} from "@/lib/topic-api";
import Topic from "@/models/Topic.model";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const search = new URL(request.url).searchParams;
    const section = search.get("section");
    const status = search.get("status");
    const query = search.get("search");

    const filter = { userId: user._id };
    if (section && section !== "All") {
      filter.section = section;
    }
    if (status && status !== "All") {
      filter.status = status;
    }
    if (query && query.trim()) {
      filter.name = { $regex: query.trim(), $options: "i" };
    }

    await connectDB();
    const topics = await Topic.find(filter)
      .sort({ updatedAt: -1 })
      .lean();

    return Response.json({ topics });
  } catch (error) {
    return topicApiError(error);
  }
}

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "A valid JSON object is required" }, { status: 400 });
    }

    const validation = validateTopicPayload(body);
    if (validation.error) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    await connectDB();
    const topic = new Topic({
      ...validation.payload,
      userId: user._id,
    });
    await topic.save();

    return Response.json({ topic }, { status: 201 });
  } catch (error) {
    return topicApiError(error);
  }
}
