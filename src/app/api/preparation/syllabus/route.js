import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  syllabusApiError,
  validateSyllabusPayload,
} from "@/lib/syllabus-api";
import SyllabusProgress from "@/models/SyllabusProgress.model";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const search = new URL(request.url).searchParams;
    const subject = search.get("subject");
    const group = search.get("group");
    const status = search.get("status");

    const filter = { userId: user._id };
    if (subject && subject !== "All") {
      filter.subject = subject;
    }
    if (group && group.trim()) {
      filter.group = group.trim();
    }
    if (status && status !== "All") {
      filter.status = status;
    }

    await connectDB();
    const progress = await SyllabusProgress.find(filter)
      .sort({ subject: 1, group: 1, topicName: 1 })
      .lean();

    return Response.json({ progress });
  } catch (error) {
    return syllabusApiError(error);
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

    const validation = validateSyllabusPayload(body);
    if (validation.error) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    await connectDB();
    const item = await SyllabusProgress.findOneAndUpdate(
      {
        userId: user._id,
        subject: validation.payload.subject,
        group: validation.payload.group,
        topicName: validation.payload.topicName,
      },
      { ...validation.payload, userId: user._id },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    return Response.json({ item, progress: item }, { status: 200 });
  } catch (error) {
    return syllabusApiError(error);
  }
}

export async function DELETE(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const search = new URL(request.url).searchParams;
    let subject = search.get("subject");
    let group = search.get("group");
    let topicName = search.get("topicName");

    if (!subject || !group || !topicName) {
      try {
        const body = await request.json();
        subject = subject || body?.subject;
        group = group || body?.group;
        topicName = topicName || body?.topicName;
      } catch {
        // no json body provided
      }
    }

    if (!subject || !group || !topicName) {
      return Response.json(
        { error: "subject, group, and topicName are required" },
        { status: 400 },
      );
    }

    await connectDB();
    const deleted = await SyllabusProgress.findOneAndDelete({
      userId: user._id,
      subject,
      group,
      topicName,
    });

    if (!deleted) {
      return Response.json({ error: "Syllabus progress record not found" }, { status: 404 });
    }

    return Response.json({ deleted: true, message: "Syllabus progress reset" });
  } catch (error) {
    return syllabusApiError(error);
  }
}
