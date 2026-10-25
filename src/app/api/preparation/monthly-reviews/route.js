import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  parseMonthKey,
  validateMonthlyReviewPayload,
  monthlyReviewApiError,
} from "@/lib/monthly-review-api";
import MonthlyReview from "@/models/MonthlyReview.model";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const search = new URL(request.url).searchParams;
    const monthKey = search.get("monthKey");
    const rawYear = search.get("year");
    const rawMonth = search.get("month");

    let queryYear = null;
    let queryMonth = null;

    if (monthKey) {
      const parsed = parseMonthKey(monthKey);
      if (!parsed) {
        return Response.json(
          { error: "monthKey must be a valid YYYY-MM string" },
          { status: 400 },
        );
      }
      queryYear = parsed.year;
      queryMonth = parsed.month;
    } else if (rawYear !== null || rawMonth !== null) {
      if (rawYear === null || rawMonth === null) {
        return Response.json(
          { error: "Both year and month query parameters are required together" },
          { status: 400 },
        );
      }
      const y = Number(rawYear);
      const m = Number(rawMonth);
      if (!Number.isInteger(y) || y < 2000 || !Number.isInteger(m) || m < 1 || m > 12) {
        return Response.json(
          { error: "year must be >= 2000 and month must be between 1 and 12" },
          { status: 400 },
        );
      }
      queryYear = y;
      queryMonth = m;
    }

    await connectDB();

    if (queryYear !== null && queryMonth !== null) {
      const review = await MonthlyReview.findOne({
        userId: user._id,
        year: queryYear,
        month: queryMonth,
      }).lean();
      return Response.json({ review: review || null });
    }

    const reviews = await MonthlyReview.find({ userId: user._id })
      .sort({ year: -1, month: -1 })
      .lean();
    return Response.json({ reviews });
  } catch (error) {
    return monthlyReviewApiError(error);
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

    const validation = validateMonthlyReviewPayload(body);
    if (validation.error) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    await connectDB();
    const review = await MonthlyReview.findOneAndUpdate(
      {
        userId: user._id,
        year: validation.payload.year,
        month: validation.payload.month,
      },
      { ...validation.payload, userId: user._id },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    return Response.json({ review }, { status: 200 });
  } catch (error) {
    return monthlyReviewApiError(error);
  }
}

export async function DELETE(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const search = new URL(request.url).searchParams;
    const monthKey = search.get("monthKey");
    const rawYear = search.get("year");
    const rawMonth = search.get("month");

    let queryYear = null;
    let queryMonth = null;

    if (monthKey) {
      const parsed = parseMonthKey(monthKey);
      if (!parsed) {
        return Response.json(
          { error: "monthKey must be a valid YYYY-MM string" },
          { status: 400 },
        );
      }
      queryYear = parsed.year;
      queryMonth = parsed.month;
    } else if (rawYear && rawMonth) {
      const y = Number(rawYear);
      const m = Number(rawMonth);
      if (!Number.isInteger(y) || y < 2000 || !Number.isInteger(m) || m < 1 || m > 12) {
        return Response.json(
          { error: "year must be >= 2000 and month must be between 1 and 12" },
          { status: 400 },
        );
      }
      queryYear = y;
      queryMonth = m;
    } else {
      return Response.json(
        { error: "A valid monthKey or year and month query parameters are required" },
        { status: 400 },
      );
    }

    await connectDB();
    const deleted = await MonthlyReview.findOneAndDelete({
      userId: user._id,
      year: queryYear,
      month: queryMonth,
    });

    if (!deleted) {
      return Response.json({ error: "Monthly review not found" }, { status: 404 });
    }

    return Response.json({ message: "Monthly review deleted" });
  } catch (error) {
    return monthlyReviewApiError(error);
  }
}
