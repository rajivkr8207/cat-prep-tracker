import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  revisionApiError,
  validateRevisionPayload,
} from "@/lib/revision-api";
import Revision from "@/models/Revision.model";
import Topic from "@/models/Topic.model";

function localDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const searchParams = new URL(request.url).searchParams;
    const section = searchParams.get("section") || searchParams.get("subject");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const date = searchParams.get("date");

    const filter = { userId: user._id };

    if (section && section !== "All") {
      filter.section = section;
    }

    if (status && status !== "All") {
      const lower = status.toLowerCase();
      if (lower === "completed") {
        filter.completed = true;
      } else if (lower === "pending") {
        filter.completed = false;
      }
    }

    if (date) {
      filter.date = date;
    }

    if (search && search.trim()) {
      filter.$or = [
        { topic: { $regex: search.trim(), $options: "i" } },
        { title: { $regex: search.trim(), $options: "i" } },
        { notes: { $regex: search.trim(), $options: "i" } },
      ];
    }

    await connectDB();
    const revisions = await Revision.find(filter)
      .populate("topicId")
      .sort({ date: 1, createdAt: -1 })
      .lean();

    return Response.json({ revisions });
  } catch (error) {
    return revisionApiError(error);
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

    const validation = validateRevisionPayload(body);
    if (validation.error) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    await connectDB();

    if (validation.payload.topicId) {
      const topicDoc = await Topic.findOne({
        _id: validation.payload.topicId,
        userId: user._id,
      });
      if (!topicDoc) {
        return Response.json(
          { error: "Invalid topic ID or topic not found" },
          { status: 400 },
        );
      }
    }

    if (validation.payload.completed && !validation.payload.completedOn) {
      validation.payload.completedOn = localDateString();
    }

    const revision = new Revision({
      ...validation.payload,
      userId: user._id,
    });
    await revision.save();

    if (revision.topicId) {
      await revision.populate("topicId");
    }

    return Response.json({ revision }, { status: 201 });
  } catch (error) {
    return revisionApiError(error);
  }
}
