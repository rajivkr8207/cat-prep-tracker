import mongoose from "mongoose";
import { isValidTaskDate } from "@/lib/task-api";

export const REVISION_SECTIONS = Object.freeze(["VARC", "DILR", "Quant"]);
export const REVISION_SUBJECTS = REVISION_SECTIONS;

export const REVISION_STATUSES = Object.freeze(["pending", "completed"]);

export const REVISION_RESULTS = Object.freeze([
  "Not attempted",
  "Wrong again",
  "Correct with hint",
  "Correct independently",
]);

export function parseObjectId(id) {
  return (
    typeof id === "string" &&
    /^[a-f\d]{24}$/i.test(id) &&
    mongoose.Types.ObjectId.isValid(id)
  );
}

export function validateRevisionPayload(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "A JSON object is required" };
  }

  const allowedFields = [
    "topic",
    "title",
    "topicId",
    "section",
    "subject",
    "date",
    "scheduledDate",
    "result",
    "notes",
    "status",
    "completed",
    "completedOn",
  ];

  const unsupported = Object.keys(body).filter((k) => !allowedFields.includes(k));
  if (unsupported.length) {
    return { error: `Unsupported field(s): ${unsupported.join(", ")}` };
  }

  const payload = {};

  // Topic / Title
  const rawTopic = body.topic !== undefined ? body.topic : body.title;
  if (!partial || rawTopic !== undefined) {
    if (typeof rawTopic !== "string" || !rawTopic.trim()) {
      return { error: "Topic is required and cannot be empty" };
    }
    const trimmed = rawTopic.trim();
    if (trimmed.length > 300) {
      return { error: "Topic cannot exceed 300 characters" };
    }
    payload.topic = trimmed;
    payload.title = trimmed;
  }

  // Section / Subject
  const rawSection = body.section !== undefined ? body.section : body.subject;
  if (!partial || rawSection !== undefined) {
    if (!REVISION_SECTIONS.includes(rawSection)) {
      return {
        error: `Subject/section must be one of: ${REVISION_SECTIONS.join(", ")}`,
      };
    }
    payload.section = rawSection;
    payload.subject = rawSection;
  }

  // TopicId
  if (body.topicId !== undefined) {
    if (body.topicId === null || body.topicId === "") {
      payload.topicId = null;
    } else {
      if (!parseObjectId(body.topicId)) {
        return { error: "Invalid topic ID" };
      }
      payload.topicId = body.topicId;
    }
  }

  // Scheduled date / date
  const rawDate = body.date !== undefined ? body.date : body.scheduledDate;
  if (!partial || rawDate !== undefined) {
    if (!rawDate || !isValidTaskDate(rawDate)) {
      return { error: "Scheduled revision date must be a valid YYYY-MM-DD date" };
    }
    payload.date = rawDate;
  }

  // Status & Completed
  let isCompleted;
  if (body.status !== undefined) {
    const s = String(body.status).toLowerCase();
    if (!REVISION_STATUSES.includes(s)) {
      return { error: `Status must be one of: ${REVISION_STATUSES.join(", ")}` };
    }
    payload.status = s;
    isCompleted = s === "completed";
    payload.completed = isCompleted;
  } else if (body.completed !== undefined) {
    isCompleted = Boolean(body.completed);
    payload.completed = isCompleted;
    payload.status = isCompleted ? "completed" : "pending";
  }

  // CompletedOn
  if (body.completedOn !== undefined) {
    if (body.completedOn) {
      if (!isValidTaskDate(body.completedOn)) {
        return { error: "completedOn must be a valid YYYY-MM-DD date" };
      }
      payload.completedOn = body.completedOn;
    } else {
      payload.completedOn = "";
    }
  }

  // Result
  if (body.result !== undefined) {
    if (body.result && !REVISION_RESULTS.includes(body.result)) {
      return {
        error: `Result must be one of: ${REVISION_RESULTS.join(", ")}`,
      };
    }
    payload.result = body.result || "Not attempted";
  }

  // Notes
  if (body.notes !== undefined) {
    if (body.notes != null && typeof body.notes !== "string") {
      return { error: "notes must be a string" };
    }
    const n = (body.notes || "").trim();
    if (n.length > 5000) {
      return { error: "notes must be at most 5000 characters" };
    }
    payload.notes = n;
  }

  return { payload };
}

export function revisionApiError(error) {
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return Response.json({ error: error.message }, { status: 400 });
  }

  console.error("Revision API error:", error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
