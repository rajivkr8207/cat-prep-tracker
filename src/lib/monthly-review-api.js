import mongoose from "mongoose";

export const MONTHLY_REVIEW_TEXT_FIELDS = Object.freeze([
  "goal",
  "topics",
  "evidence",
  "varc",
  "quant",
  "dilr",
  "revision",
  "mocks",
  "notWork",
  "next",
]);

export const MONTHLY_REVIEW_ALLOWED_FIELDS = Object.freeze([
  "year",
  "month",
  "monthKey",
  ...MONTHLY_REVIEW_TEXT_FIELDS,
]);

export function parseMonthKey(key) {
  if (typeof key !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) {
    return null;
  }
  const [yearStr, monthStr] = key.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (year < 2000 || isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month, monthKey: `${year}-${String(month).padStart(2, "0")}` };
}

export function validateMonthlyReviewPayload(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "A JSON object is required" };
  }

  const unsupported = Object.keys(body).filter(
    (field) => !MONTHLY_REVIEW_ALLOWED_FIELDS.includes(field),
  );
  if (unsupported.length) {
    return { error: `Unsupported field(s): ${unsupported.join(", ")}` };
  }

  const payload = {};

  if (body.monthKey) {
    const parsed = parseMonthKey(body.monthKey);
    if (!parsed) {
      return { error: "monthKey must be a valid YYYY-MM string (e.g. 2026-10)" };
    }
    payload.year = parsed.year;
    payload.month = parsed.month;
  }

  if (body.year !== undefined) {
    const y = Number(body.year);
    if (!Number.isInteger(y) || y < 2000) {
      return { error: "year must be an integer greater than or equal to 2000" };
    }
    payload.year = y;
  }

  if (body.month !== undefined) {
    const m = Number(body.month);
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      return { error: "month must be an integer between 1 and 12" };
    }
    payload.month = m;
  }

  for (const field of MONTHLY_REVIEW_TEXT_FIELDS) {
    if (body[field] !== undefined) {
      if (body[field] != null && typeof body[field] !== "string") {
        return { error: `${field} must be a string` };
      }
      const strVal = (body[field] || "").trim();
      if (strVal.length > 5000) {
        return { error: `${field} must be at most 5000 characters` };
      }
      payload[field] = strVal;
    }
  }

  if (!partial) {
    if (payload.year === undefined || payload.month === undefined) {
      return { error: "Both year and month (or monthKey) are required" };
    }
  }

  return { payload };
}

export function parseMonthlyReviewId(id) {
  return (
    typeof id === "string" &&
    /^[a-f\d]{24}$/i.test(id) &&
    mongoose.Types.ObjectId.isValid(id)
  );
}

export function monthlyReviewApiError(error) {
  if (error?.code === 11000) {
    return Response.json(
      { error: "A monthly review for this month already exists" },
      { status: 409 },
    );
  }

  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return Response.json({ error: error.message }, { status: 400 });
  }

  console.error("Monthly review API error:", error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
