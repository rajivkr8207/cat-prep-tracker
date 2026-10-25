import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import { isValidTaskDate } from "@/lib/task-api";
import {
  topicApiError,
  validateTopicSessionPayload,
} from "@/lib/topic-api";
import Topic from "@/models/Topic.model";
import TopicSession from "@/models/TopicSession.model";

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const search = new URL(request.url).searchParams;
    const topic = search.get("topic");
    const section = search.get("section");
    const from = search.get("from");
    const to = search.get("to");
    const limit = Math.min(1000, Math.max(1, Number(search.get("limit")) || 500));

    const filter = { userId: user._id };
    if (section && section !== "All") {
      filter.section = section;
    }
    if (topic && topic.trim()) {
      filter.topic = { $regex: topic.trim(), $options: "i" };
    }
    if (from || to) {
      filter.date = {};
      if (from && isValidTaskDate(from)) filter.date.$gte = from;
      if (to && isValidTaskDate(to)) filter.date.$lte = to;
    }

    await connectDB();
    const sessions = await TopicSession.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return Response.json({ sessions });
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

    const validation = validateTopicSessionPayload(body);
    if (validation.error) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    await connectDB();
    const session = new TopicSession({
      ...validation.payload,
      userId: user._id,
    });
    await session.save();

    // Optionally sync lastPracticed and nextReview with Topic if matching topic exists
    try {
      const topic = await Topic.findOne({
        userId: user._id,
        section: session.section,
        name: { $regex: new RegExp(`^${escapeRegex(session.topic)}$`, "i") },
      });
      if (topic) {
        let changed = false;
        if (!topic.lastPracticed || session.date >= topic.lastPracticed) {
          topic.lastPracticed = session.date;
          changed = true;
        }
        if (session.revisionDate) {
          topic.nextReview = session.revisionDate;
          changed = true;
        }
        if (changed) {
          await topic.save();
        }
      }
    } catch (syncErr) {
      console.warn("Topic sync after session warning:", syncErr);
    }

    return Response.json({ session }, { status: 201 });
  } catch (error) {
    return topicApiError(error);
  }
}
