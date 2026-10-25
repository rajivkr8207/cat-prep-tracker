import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import { isValidTaskDate } from "@/lib/task-api";
import {
  isMonday,
  validateWeeklyReviewPayload,
  weeklyReviewApiError,
} from "@/lib/weekly-review-api";
import WeeklyReview from "@/models/WeeklyReview.model";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const search = new URL(request.url).searchParams;
    const weekStart = search.get("weekStart");
    const from = search.get("from");
    const to = search.get("to");

    if (weekStart !== null && (!isValidTaskDate(weekStart) || !isMonday(weekStart))) {
      return Response.json(
        { error: "weekStart must be a valid Monday YYYY-MM-DD date" },
        { status: 400 },
      );
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

    if (weekStart) {
      const review = await WeeklyReview.findOne({
        userId: user._id,
        weekStart,
      }).lean();
      return Response.json({ review: review || null });
    }

    if (from || to) {
      const filter = {
        userId: user._id,
        weekStart: {
          ...(from ? { $gte: from } : {}),
          ...(to ? { $lte: to } : {}),
        },
      };
      const reviews = await WeeklyReview.find(filter)
        .sort({ weekStart: 1 })
        .lean();
      return Response.json({ reviews });
    }

    const reviews = await WeeklyReview.find({ userId: user._id })
      .sort({ weekStart: -1 })
      .lean();
    return Response.json({ reviews });
  } catch (error) {
    return weeklyReviewApiError(error);
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

    const validation = validateWeeklyReviewPayload(body);
    if (validation.error) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    await connectDB();
    const review = await WeeklyReview.findOneAndUpdate(
      { userId: user._id, weekStart: validation.payload.weekStart },
      { ...validation.payload, userId: user._id },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    return Response.json({ review }, { status: 200 });
  } catch (error) {
    return weeklyReviewApiError(error);
  }
}

export async function DELETE(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const search = new URL(request.url).searchParams;
    const weekStart = search.get("weekStart");
    if (!weekStart || !isValidTaskDate(weekStart)) {
      return Response.json(
        { error: "A valid weekStart (YYYY-MM-DD) query parameter is required" },
        { status: 400 },
      );
    }

    await connectDB();
    const deleted = await WeeklyReview.findOneAndDelete({
      userId: user._id,
      weekStart,
    });

    if (!deleted) {
      return Response.json({ error: "Weekly review not found" }, { status: 404 });
    }

    return Response.json({ message: "Weekly review deleted" });
  } catch (error) {
    return weeklyReviewApiError(error);
  }
}
