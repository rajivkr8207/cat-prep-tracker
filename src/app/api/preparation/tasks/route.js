import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  isValidTaskDate,
  taskApiError,
  validateTaskPayload,
} from "@/lib/task-api";
import TaskTracker from "@/models/task.model";

const MAX_LIMIT = 500;

function parsePositiveInteger(value, fallback) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const search = new URL(request.url).searchParams;
    const date = search.get("date");
    const from = search.get("from");
    const to = search.get("to");
    const section = search.get("section");
    const status = search.get("status");
    const page = parsePositiveInteger(search.get("page"), 1);
    const requestedLimit = parsePositiveInteger(search.get("limit"), 100);

    if (date !== null && !isValidTaskDate(date)) {
      return Response.json({ error: "date must be a valid YYYY-MM-DD date" }, { status: 400 });
    }
    if (from !== null && !isValidTaskDate(from)) {
      return Response.json({ error: "from must be a valid YYYY-MM-DD date" }, { status: 400 });
    }
    if (to !== null && !isValidTaskDate(to)) {
      return Response.json({ error: "to must be a valid YYYY-MM-DD date" }, { status: 400 });
    }
    if (date !== null && (from !== null || to !== null)) {
      return Response.json({ error: "Use date or from/to, not both" }, { status: 400 });
    }
    if (from && to && from > to) {
      return Response.json({ error: "from must be on or before to" }, { status: 400 });
    }
    if (section !== null && !["VARC", "Quant", "DILR", "Revision", "Mock test", "Analysis", "Other"].includes(section)) {
      return Response.json({ error: "section is not a supported task section" }, { status: 400 });
    }
    if (status !== null && !["Not started", "In progress", "Done", "Partly done", "Not done", "Skipped", "Rescheduled"].includes(status)) {
      return Response.json({ error: "status is not a supported task status" }, { status: 400 });
    }
    if (
      page === null ||
      requestedLimit === null ||
      !Number.isSafeInteger((page - 1) * requestedLimit)
    ) {
      return Response.json({ error: "page and limit must be positive integers" }, { status: 400 });
    }

    const limit = Math.min(requestedLimit, MAX_LIMIT);
    const filter = { userId: user._id };
    if (date) filter.date = date;
    else if (from || to) {
      filter.date = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
      };
    }
    if (section) filter.section = section;
    if (status) filter.status = status;

    await connectDB();
    const [tasks, total] = await Promise.all([
      TaskTracker.find(filter)
        .sort({ date: -1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      TaskTracker.countDocuments(filter),
    ]);

    return Response.json({
      tasks,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return taskApiError(error);
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
    const validation = validateTaskPayload(body);
    if (validation.error) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    await connectDB();
    const task = await TaskTracker.create({
      ...validation.payload,
      userId: user._id,
    });

    return Response.json({ task }, { status: 201 });
  } catch (error) {
    return taskApiError(error);
  }
}
