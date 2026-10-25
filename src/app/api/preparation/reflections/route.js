import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import { isValidTaskDate } from "@/lib/task-api";
import {
  reflectionApiError,
  validateReflectionPayload,
} from "@/lib/reflection-api";
import DailyReflection from "@/models/DailyReflection.model";

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

    if (date !== null && !isValidTaskDate(date)) {
      return Response.json({ error: "date must be a valid YYYY-MM-DD date" }, { status: 400 });
    }
    if (from !== null && !isValidTaskDate(from)) {
      return Response.json({ error: "from must be a valid YYYY-MM-DD date" }, { status: 400 });
    }
    if (to !== null && !isValidTaskDate(to)) {
      return Response.json({ error: "to must be a valid YYYY-MM-DD date" }, { status: 400 });
    }
    if (from && to && from > to) {
      return Response.json({ error: "from must be on or before to" }, { status: 400 });
    }

    await connectDB();

    if (date) {
      const reflection = await DailyReflection.findOne({
        userId: user._id,
        date,
      }).lean();
      return Response.json({ reflection: reflection || null });
    }

    if (from || to) {
      const filter = {
        userId: user._id,
        date: {
          ...(from ? { $gte: from } : {}),
          ...(to ? { $lte: to } : {}),
        },
      };
      const reflections = await DailyReflection.find(filter)
        .sort({ date: 1 })
        .lean();
      return Response.json({ reflections });
    }

    // Default: fetch all reflections for this user
    const reflections = await DailyReflection.find({ userId: user._id })
      .sort({ date: -1 })
      .lean();
    return Response.json({ reflections });
  } catch (error) {
    return reflectionApiError(error);
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

    const validation = validateReflectionPayload(body);
    if (validation.error) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    await connectDB();
    const reflection = await DailyReflection.findOneAndUpdate(
      { userId: user._id, date: validation.payload.date },
      { ...validation.payload, userId: user._id },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    return Response.json({ reflection }, { status: 200 });
  } catch (error) {
    return reflectionApiError(error);
  }
}

export async function DELETE(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const search = new URL(request.url).searchParams;
    const date = search.get("date");
    if (!date || !isValidTaskDate(date)) {
      return Response.json({ error: "A valid date (YYYY-MM-DD) query parameter is required" }, { status: 400 });
    }

    await connectDB();
    const deleted = await DailyReflection.findOneAndDelete({
      userId: user._id,
      date,
    });

    if (!deleted) {
      return Response.json({ error: "Daily reflection not found" }, { status: 404 });
    }

    return Response.json({ message: "Daily reflection deleted" });
  } catch (error) {
    return reflectionApiError(error);
  }
}
