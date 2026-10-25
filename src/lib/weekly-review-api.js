import mongoose from "mongoose";
import { isValidTaskDate } from "@/lib/task-api";

export const WEEKLY_REVIEW_FIELDS = Object.freeze([
  "weekStart",
  "weekEnd",
  "goals",
  "varc",
  "quant",
  "dilr",
  "revision",
  "improved",
  "mistakes",
  "avoided",
  "next",
  "advice",
]);

export function calculateWeekEnd(weekStart) {
  const [year, month, day] = weekStart.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  return `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`;
}

export function isMonday(dateStr) {
  if (!isValidTaskDate(dateStr)) return false;
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCDay() === 1;
}

export function validateWeeklyReviewPayload(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "A JSON object is required" };
  }

  const unsupported = Object.keys(body).filter(
    (field) => !WEEKLY_REVIEW_FIELDS.includes(field),
  );
  if (unsupported.length) {
    return { error: `Unsupported field(s): ${unsupported.join(", ")}` };
  }

  const payload = {};

  for (const [field, value] of Object.entries(body)) {
    if (field === "weekStart") {
      if (!isValidTaskDate(value)) {
        return { error: "weekStart must be a valid YYYY-MM-DD date" };
      }
      if (!isMonday(value)) {
        return { error: "Week must start on Monday" };
      }
      payload.weekStart = value;
      if (!body.weekEnd) {
        payload.weekEnd = calculateWeekEnd(value);
      }
      continue;
    }

    if (field === "weekEnd") {
      if (!isValidTaskDate(value)) {
        return { error: "weekEnd must be a valid YYYY-MM-DD date" };
      }
      payload.weekEnd = value;
      continue;
    }

    if (
      [
        "goals",
        "varc",
        "quant",
        "dilr",
        "revision",
        "improved",
        "mistakes",
        "avoided",
        "next",
        "advice",
      ].includes(field)
    ) {
      if (value != null && typeof value !== "string") {
        return { error: `${field} must be a string` };
      }
      const strVal = (value || "").trim();
      if (strVal.length > 5000) {
        return { error: `${field} must be at most 5000 characters` };
      }
      payload[field] = strVal;
    }
  }

  if (!partial) {
    if (!payload.weekStart) {
      return { error: "weekStart is required" };
    }
    if (!payload.weekEnd) {
      payload.weekEnd = calculateWeekEnd(payload.weekStart);
    }
  }

  if (payload.weekStart && payload.weekEnd) {
    const start = new Date(`${payload.weekStart}T00:00:00.000Z`);
    const end = new Date(`${payload.weekEnd}T00:00:00.000Z`);
    if (end.getTime() - start.getTime() !== 6 * 24 * 60 * 60 * 1000) {
      return { error: "Week must end six days after its Monday start" };
    }
  }

  return { payload };
}

export function parseWeeklyReviewId(id) {
  return (
    typeof id === "string" &&
    /^[a-f\d]{24}$/i.test(id) &&
    mongoose.Types.ObjectId.isValid(id)
  );
}

export function weeklyReviewApiError(error) {
  if (error?.code === 11000) {
    return Response.json(
      { error: "A weekly review for this week already exists" },
      { status: 409 },
    );
  }

  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return Response.json({ error: error.message }, { status: 400 });
  }

  console.error("Weekly review API error:", error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
