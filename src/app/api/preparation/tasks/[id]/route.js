import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  parseTaskId,
  taskApiError,
  validateTaskPayload,
} from "@/lib/task-api";
import TaskTracker from "@/models/task.model";

async function getTaskId(context) {
  const { id } = await context.params;
  return id;
}

export async function GET(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getTaskId(context);
    if (!parseTaskId(id)) {
      return Response.json({ error: "Invalid task ID" }, { status: 400 });
    }

    await connectDB();
    const task = await TaskTracker.findOne({ _id: id, userId: user._id }).lean();
    if (!task) {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }

    return Response.json({ task });
  } catch (error) {
    return taskApiError(error);
  }
}

export async function PATCH(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getTaskId(context);
    if (!parseTaskId(id)) {
      return Response.json({ error: "Invalid task ID" }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "A valid JSON object is required" }, { status: 400 });
    }
    const validation = validateTaskPayload(body, { partial: true });
    if (validation.error) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    await connectDB();
    const task = await TaskTracker.findOne({ _id: id, userId: user._id });
    if (!task) {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }

    for (const [field, value] of Object.entries(validation.payload)) {
      task.set(field, value);
    }
    await task.save();

    return Response.json({ task });
  } catch (error) {
    return taskApiError(error);
  }
}

export async function DELETE(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getTaskId(context);
    if (!parseTaskId(id)) {
      return Response.json({ error: "Invalid task ID" }, { status: 400 });
    }

    await connectDB();
    const task = await TaskTracker.findOneAndDelete({
      _id: id,
      userId: user._id,
    });
    if (!task) {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }

    return Response.json({ message: "Task deleted" });
  } catch (error) {
    return taskApiError(error);
  }
}
