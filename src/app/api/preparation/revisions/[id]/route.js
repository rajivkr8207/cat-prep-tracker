import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  parseObjectId,
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

async function getRevisionId(context) {
  const { id } = await context.params;
  return id;
}

export async function GET(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getRevisionId(context);
    if (!parseObjectId(id)) {
      return Response.json({ error: "Invalid revision ID" }, { status: 400 });
    }

    await connectDB();
    const revision = await Revision.findOne({
      _id: id,
      userId: user._id,
    })
      .populate("topicId")
      .lean();

    if (!revision) {
      return Response.json({ error: "Revision not found" }, { status: 404 });
    }

    return Response.json({ revision });
  } catch (error) {
    return revisionApiError(error);
  }
}

export async function PATCH(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getRevisionId(context);
    if (!parseObjectId(id)) {
      return Response.json({ error: "Invalid revision ID" }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "A valid JSON object is required" }, { status: 400 });
    }

    const validation = validateRevisionPayload(body, { partial: true });
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

    const revision = await Revision.findOne({
      _id: id,
      userId: user._id,
    });

    if (!revision) {
      return Response.json({ error: "Revision not found" }, { status: 404 });
    }

    // Handle status / completed changes
    if (
      validation.payload.completed === true ||
      validation.payload.status === "completed"
    ) {
      if (!validation.payload.completedOn && !revision.completedOn) {
        validation.payload.completedOn = localDateString();
      }
    } else if (
      validation.payload.completed === false ||
      validation.payload.status === "pending"
    ) {
      validation.payload.completedOn = "";
    }

    for (const [field, value] of Object.entries(validation.payload)) {
      revision.set(field, value);
    }
    await revision.save();

    if (revision.topicId) {
      await revision.populate("topicId");
    }

    return Response.json({ revision });
  } catch (error) {
    return revisionApiError(error);
  }
}

export async function DELETE(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getRevisionId(context);
    if (!parseObjectId(id)) {
      return Response.json({ error: "Invalid revision ID" }, { status: 400 });
    }

    await connectDB();
    const deleted = await Revision.findOneAndDelete({
      _id: id,
      userId: user._id,
    });

    if (!deleted) {
      return Response.json({ error: "Revision not found" }, { status: 404 });
    }

    return Response.json({ message: "Revision deleted" });
  } catch (error) {
    return revisionApiError(error);
  }
}
