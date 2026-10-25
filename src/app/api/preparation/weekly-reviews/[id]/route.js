import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  parseWeeklyReviewId,
  validateWeeklyReviewPayload,
  weeklyReviewApiError,
} from "@/lib/weekly-review-api";
import WeeklyReview from "@/models/WeeklyReview.model";

async function getReviewId(context) {
  const { id } = await context.params;
  return id;
}

export async function GET(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getReviewId(context);
    if (!parseWeeklyReviewId(id)) {
      return Response.json({ error: "Invalid weekly review ID" }, { status: 400 });
    }

    await connectDB();
    const review = await WeeklyReview.findOne({
      _id: id,
      userId: user._id,
    }).lean();

    if (!review) {
      return Response.json({ error: "Weekly review not found" }, { status: 404 });
    }

    return Response.json({ review });
  } catch (error) {
    return weeklyReviewApiError(error);
  }
}

export async function PATCH(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getReviewId(context);
    if (!parseWeeklyReviewId(id)) {
      return Response.json({ error: "Invalid weekly review ID" }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "A valid JSON object is required" }, { status: 400 });
    }

    const validation = validateWeeklyReviewPayload(body, { partial: true });
    if (validation.error) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    await connectDB();
    const review = await WeeklyReview.findOne({
      _id: id,
      userId: user._id,
    });

    if (!review) {
      return Response.json({ error: "Weekly review not found" }, { status: 404 });
    }

    for (const [field, value] of Object.entries(validation.payload)) {
      review.set(field, value);
    }
    await review.save();

    return Response.json({ review });
  } catch (error) {
    return weeklyReviewApiError(error);
  }
}

export async function DELETE(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getReviewId(context);
    if (!parseWeeklyReviewId(id)) {
      return Response.json({ error: "Invalid weekly review ID" }, { status: 400 });
    }

    await connectDB();
    const deleted = await WeeklyReview.findOneAndDelete({
      _id: id,
      userId: user._id,
    });

    if (!deleted) {
      return Response.json({ error: "Weekly review not found" }, { status: 404 });
    }

    return Response.json({ message: "Weekly review deleted" });
  } catch (error) {
    return weeklyReviewApiError(error);
  }
}
