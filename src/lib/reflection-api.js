import mongoose from "mongoose";
import { isValidTaskDate } from "@/lib/task-api";

export const REFLECTION_FIELDS = Object.freeze([
  "date",
  "plan",
  "actual",
  "hours",
  "focus",
  "win",
  "weak",
  "tomorrow",
]);

const VALID_FOCUS_VALUES = new Set(["", "1", "2", "3", "4", "5"]);

export function isQuarterHour(value) {
  if (value == null) return true;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return false;
  return Math.abs(Math.round(value * 4) - value * 4) < 1e-9;
}

export function validateReflectionPayload(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "A JSON object is required" };
  }

  const unsupported = Object.keys(body).filter(
    (field) => !REFLECTION_FIELDS.includes(field),
  );
  if (unsupported.length) {
    return { error: `Unsupported field(s): ${unsupported.join(", ")}` };
  }

  const payload = {};

  for (const [field, value] of Object.entries(body)) {
    if (field === "date") {
      if (!isValidTaskDate(value)) {
        return { error: "date must be a valid YYYY-MM-DD date" };
      }
      payload.date = value;
      continue;
    }

    if (field === "hours") {
      if (value === "" || value === null || value === undefined) {
        payload.hours = null;
      } else {
        const num = Number(value);
        if (isNaN(num) || num < 0 || !isQuarterHour(num)) {
          return { error: "Focused hours must use quarter-hour increments" };
        }
        payload.hours = num;
      }
      continue;
    }

    if (field === "focus") {
      const focusStr = value == null ? "" : String(value).trim();
      if (!VALID_FOCUS_VALUES.has(focusStr)) {
        return { error: "Focus must be between 1 and 5" };
      }
      payload.focus = focusStr;
      continue;
    }

    if (["plan", "actual", "win", "weak", "tomorrow"].includes(field)) {
      if (value != null && typeof value !== "string") {
        return { error: `${field} must be a string` };
      }
      const strVal = (value || "").trim();
      if (strVal.length > 5000) {
        return { error: `${field} must be at most 5000 characters` };
      }
      payload[field] = strVal;
      continue;
    }
  }

  if (!partial && !payload.date) {
    return { error: "date is required" };
  }

  return { payload };
}

export function parseReflectionId(id) {
  return (
    typeof id === "string" &&
    /^[a-f\d]{24}$/i.test(id) &&
    mongoose.Types.ObjectId.isValid(id)
  );
}

export function reflectionApiError(error) {
  if (error?.code === 11000) {
    return Response.json(
      { error: "A reflection for this date already exists" },
      { status: 409 },
    );
  }

  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return Response.json({ error: error.message }, { status: 400 });
  }

  console.error("Reflection API error:", error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
