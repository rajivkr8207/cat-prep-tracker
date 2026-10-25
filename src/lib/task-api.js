import mongoose from "mongoose";

export const TASK_API_FIELDS = Object.freeze([
  "date",
  "title",
  "section",
  "priority",
  "startTime",
  "endTime",
  "planned",
  "status",
  "attempted",
  "correct",
  "actual",
  "notes",
]);

const TASK_SECTIONS = new Set([
  "VARC",
  "Quant",
  "DILR",
  "Revision",
  "Mock test",
  "Analysis",
  "Other",
]);
const TASK_PRIORITIES = new Set(["Must do", "Should do", "Bonus"]);
const TASK_STATUSES = new Set([
  "Not started",
  "In progress",
  "Done",
  "Partly done",
  "Not done",
  "Skipped",
  "Rescheduled",
]);
const NUMERIC_FIELDS = new Set(["planned", "attempted", "correct", "actual"]);
const TIME_PATTERN = /^(0?[1-9]|1[0-2]):[0-5]\d (AM|PM)$/;

export function isValidTaskDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function validateTaskPayload(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "A JSON object is required" };
  }

  const unsupported = Object.keys(body).filter(
    (field) => !TASK_API_FIELDS.includes(field),
  );
  if (unsupported.length) {
    return { error: `Unsupported field(s): ${unsupported.join(", ")}` };
  }
  if (!Object.keys(body).length) {
    return { error: "Provide at least one task field to save" };
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

    if (field === "title") {
      if (typeof value !== "string" || !value.trim() || value.trim().length > 300) {
        return { error: "title must be a non-empty string of at most 300 characters" };
      }
      payload.title = value.trim();
      continue;
    }

    if (field === "section") {
      if (typeof value !== "string" || !TASK_SECTIONS.has(value)) {
        return { error: "section is not a supported task section" };
      }
      payload.section = value;
      continue;
    }

    if (field === "priority") {
      if (typeof value !== "string" || !TASK_PRIORITIES.has(value)) {
        return { error: "priority must be Must do, Should do, or Bonus" };
      }
      payload.priority = value;
      continue;
    }

    if (field === "status") {
      if (typeof value !== "string" || !TASK_STATUSES.has(value)) {
        return { error: "status is not a supported task status" };
      }
      payload.status = value;
      continue;
    }

    if (field === "startTime" || field === "endTime") {
      if (typeof value !== "string" || (value !== "" && !TIME_PATTERN.test(value))) {
        return { error: `${field} must be blank or in HH:MM AM/PM format` };
      }
      payload[field] = value;
      continue;
    }

    if (NUMERIC_FIELDS.has(field)) {
      if (value === "" || value === null) {
        payload[field] = undefined;
      } else if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        !Number.isInteger(value)
      ) {
        return { error: `${field} must be a non-negative integer or blank` };
      } else {
        payload[field] = value;
      }
      continue;
    }

    if (field === "notes") {
      if (typeof value !== "string" || value.length > 5000) {
        return { error: "notes must be a string of at most 5000 characters" };
      }
      payload.notes = value.trim();
    }
  }

  if (!partial) {
    for (const field of ["date", "title", "section"]) {
      if (!Object.hasOwn(payload, field)) {
        return { error: `${field} is required` };
      }
    }
  }

  return { payload };
}

export function parseTaskId(id) {
  return (
    typeof id === "string" &&
    /^[a-f\d]{24}$/i.test(id) &&
    mongoose.Types.ObjectId.isValid(id)
  );
}

export function taskApiError(error) {
  if (error?.code === 11000) {
    return Response.json({ error: "A task with this identifier already exists" }, { status: 409 });
  }

  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return Response.json({ error: error.message }, { status: 400 });
  }

  console.error("Task API error:", error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
