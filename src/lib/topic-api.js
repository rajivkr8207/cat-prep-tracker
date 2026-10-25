import mongoose from "mongoose";
import { isValidTaskDate } from "@/lib/task-api";

export const TOPIC_SECTIONS = Object.freeze(["VARC", "DILR", "Quant"]);
export const TOPIC_STATUSES = Object.freeze([
  "Not started",
  "Learning",
  "Covered once",
  "Needs revision",
  "Revised",
]);
export const TOPIC_PRIORITIES = Object.freeze(["Low", "Medium", "High"]);

export const TOPIC_SESSION_MISTAKES = Object.freeze([
  "",
  "Concept not clear",
  "Calculation error",
  "Misread question",
  "Time pressure",
  "Guessing / poor elimination",
  "Forgot method",
  "Careless error",
  "Other",
]);

export const CAT_STARTER_TOPICS = Object.freeze([
  { section: "Quant", name: "Fractions and decimals", priority: "High" },
  { section: "Quant", name: "Percentages", priority: "High" },
  { section: "Quant", name: "Ratio and proportion", priority: "High" },
  { section: "Quant", name: "Averages", priority: "High" },
  { section: "Quant", name: "Profit, loss and discount", priority: "High" },
  { section: "Quant", name: "Simple and compound interest", priority: "Medium" },
  { section: "Quant", name: "Time and work", priority: "High" },
  { section: "Quant", name: "Time, speed and distance", priority: "High" },
  { section: "Quant", name: "Number system", priority: "Medium" },
  { section: "Quant", name: "Exponents and roots", priority: "Medium" },
  { section: "Quant", name: "Linear equations", priority: "High" },
  { section: "Quant", name: "Algebraic expressions and factorisation", priority: "Medium" },
  { section: "Quant", name: "Geometry and mensuration", priority: "Medium" },
  { section: "VARC", name: "RC: main idea and central argument", priority: "High" },
  { section: "VARC", name: "RC: inference questions", priority: "High" },
  { section: "VARC", name: "RC: tone and author attitude", priority: "Medium" },
  { section: "VARC", name: "RC: paragraph structure and purpose", priority: "Medium" },
  { section: "VARC", name: "Para summary", priority: "High" },
  { section: "VARC", name: "Parajumbles", priority: "High" },
  { section: "VARC", name: "Odd sentence out", priority: "Medium" },
  { section: "VARC", name: "Para completion", priority: "Medium" },
  { section: "DILR", name: "Linear and circular arrangements", priority: "High" },
  { section: "DILR", name: "Distribution and selection", priority: "High" },
  { section: "DILR", name: "Tables and data interpretation", priority: "High" },
  { section: "DILR", name: "Charts and graphs", priority: "Medium" },
  { section: "DILR", name: "Games and tournaments", priority: "Medium" },
  { section: "DILR", name: "Routes, networks and scheduling", priority: "Medium" },
]);

export function parseObjectId(id) {
  return (
    typeof id === "string" &&
    /^[a-f\d]{24}$/i.test(id) &&
    mongoose.Types.ObjectId.isValid(id)
  );
}

export function validateTopicPayload(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "A JSON object is required" };
  }

  const allowedFields = [
    "name",
    "section",
    "status",
    "priority",
    "attempted",
    "correct",
    "accuracy",
    "lastPracticed",
    "nextReview",
    "notes",
  ];

  const unsupported = Object.keys(body).filter((k) => !allowedFields.includes(k));
  if (unsupported.length) {
    return { error: `Unsupported field(s): ${unsupported.join(", ")}` };
  }

  const payload = {};

  if (!partial || body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return { error: "Topic name is required and cannot be empty" };
    }
    if (body.name.trim().length > 200) {
      return { error: "Topic name cannot exceed 200 characters" };
    }
    payload.name = body.name.trim();
  }

  if (!partial || body.section !== undefined) {
    if (!TOPIC_SECTIONS.includes(body.section)) {
      return { error: `Section must be one of: ${TOPIC_SECTIONS.join(", ")}` };
    }
    payload.section = body.section;
  }

  if (body.status !== undefined) {
    if (!TOPIC_STATUSES.includes(body.status)) {
      return { error: `Status must be one of: ${TOPIC_STATUSES.join(", ")}` };
    }
    payload.status = body.status;
  }

  if (body.priority !== undefined) {
    if (!TOPIC_PRIORITIES.includes(body.priority)) {
      return { error: `Priority must be one of: ${TOPIC_PRIORITIES.join(", ")}` };
    }
    payload.priority = body.priority;
  }

  if (body.attempted !== undefined) {
    if (body.attempted === "" || body.attempted === null) {
      payload.attempted = undefined;
    } else {
      const a = Number(body.attempted);
      if (!Number.isInteger(a) || a < 0) {
        return { error: "Attempted questions must be a non-negative integer" };
      }
      payload.attempted = a;
    }
  }

  if (body.correct !== undefined) {
    if (body.correct === "" || body.correct === null) {
      payload.correct = undefined;
    } else {
      const c = Number(body.correct);
      if (!Number.isInteger(c) || c < 0) {
        return { error: "Correct answers must be a non-negative integer" };
      }
      payload.correct = c;
    }
  }

  if (payload.attempted !== undefined && payload.correct !== undefined) {
    if (payload.correct > payload.attempted) {
      return { error: "Correct answers cannot exceed attempted questions" };
    }
    if (payload.attempted > 0) {
      payload.accuracy = Number(((payload.correct / payload.attempted) * 100).toFixed(1));
    } else {
      payload.accuracy = 0;
    }
  } else if (body.accuracy !== undefined) {
    if (body.accuracy === "" || body.accuracy === null) {
      payload.accuracy = undefined;
    } else {
      const acc = Number(body.accuracy);
      if (isNaN(acc) || acc < 0 || acc > 100) {
        return { error: "Accuracy must be a number between 0 and 100" };
      }
      payload.accuracy = acc;
    }
  }

  if (body.lastPracticed !== undefined) {
    if (body.lastPracticed && !isValidTaskDate(body.lastPracticed)) {
      return { error: "lastPracticed must be a valid YYYY-MM-DD date" };
    }
    payload.lastPracticed = body.lastPracticed || "";
  }

  if (body.nextReview !== undefined) {
    if (body.nextReview && !isValidTaskDate(body.nextReview)) {
      return { error: "nextReview must be a valid YYYY-MM-DD date" };
    }
    payload.nextReview = body.nextReview || "";
  }

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

export function validateTopicSessionPayload(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "A JSON object is required" };
  }

  const allowedFields = [
    "topic",
    "section",
    "date",
    "total",
    "attempted",
    "correct",
    "incorrect",
    "unattempted",
    "minutes",
    "mistake",
    "revisionDate",
    "notes",
    "relatedTaskId",
  ];

  const unsupported = Object.keys(body).filter((k) => !allowedFields.includes(k));
  if (unsupported.length) {
    return { error: `Unsupported field(s): ${unsupported.join(", ")}` };
  }

  const payload = {};

  if (!partial || body.topic !== undefined) {
    if (typeof body.topic !== "string" || !body.topic.trim()) {
      return { error: "Topic name is required" };
    }
    if (body.topic.trim().length > 200) {
      return { error: "Topic name cannot exceed 200 characters" };
    }
    payload.topic = body.topic.trim();
  }

  if (!partial || body.section !== undefined) {
    if (!TOPIC_SECTIONS.includes(body.section)) {
      return { error: `Section must be one of: ${TOPIC_SECTIONS.join(", ")}` };
    }
    payload.section = body.section;
  }

  if (!partial || body.date !== undefined) {
    if (!isValidTaskDate(body.date)) {
      return { error: "date must be a valid YYYY-MM-DD date" };
    }
    payload.date = body.date;
  }

  if (!partial || body.total !== undefined) {
    const total = Number(body.total);
    if (!Number.isInteger(total) || total < 1) {
      return { error: "total questions must be an integer >= 1" };
    }
    payload.total = total;
  }

  if (!partial || body.attempted !== undefined) {
    const attempted = Number(body.attempted);
    if (!Number.isInteger(attempted) || attempted < 0) {
      return { error: "attempted questions must be an integer >= 0" };
    }
    payload.attempted = attempted;
  }

  if (!partial || body.correct !== undefined) {
    const correct = Number(body.correct);
    if (!Number.isInteger(correct) || correct < 0) {
      return { error: "correct answers must be an integer >= 0" };
    }
    payload.correct = correct;
  }

  if (payload.total !== undefined && payload.attempted !== undefined) {
    if (payload.attempted > payload.total) {
      return { error: "attempted questions cannot exceed total questions" };
    }
    payload.unattempted = payload.total - payload.attempted;
  }

  if (payload.attempted !== undefined && payload.correct !== undefined) {
    if (payload.correct > payload.attempted) {
      return { error: "correct answers cannot exceed attempted questions" };
    }
    payload.incorrect = payload.attempted - payload.correct;
  }

  if (body.minutes !== undefined) {
    if (body.minutes === "" || body.minutes === null) {
      payload.minutes = undefined;
    } else {
      const m = Number(body.minutes);
      if (isNaN(m) || m < 0) {
        return { error: "minutes must be a non-negative number" };
      }
      payload.minutes = m;
    }
  }

  if (body.mistake !== undefined) {
    if (!TOPIC_SESSION_MISTAKES.includes(body.mistake)) {
      return { error: `mistake must be one of: ${TOPIC_SESSION_MISTAKES.filter(Boolean).join(", ")}` };
    }
    payload.mistake = body.mistake || "";
  }

  if (body.revisionDate !== undefined) {
    if (body.revisionDate && !isValidTaskDate(body.revisionDate)) {
      return { error: "revisionDate must be a valid YYYY-MM-DD date" };
    }
    payload.revisionDate = body.revisionDate || "";
  }

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

  if (body.relatedTaskId !== undefined) {
    if (body.relatedTaskId && !parseObjectId(body.relatedTaskId)) {
      return { error: "relatedTaskId must be a valid MongoDB ObjectId" };
    }
    payload.relatedTaskId = body.relatedTaskId || null;
  }

  return { payload };
}

export function topicApiError(error) {
  if (error?.code === 11000) {
    return Response.json(
      { error: "A topic with this name already exists in this section" },
      { status: 409 },
    );
  }

  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return Response.json({ error: error.message }, { status: 400 });
  }

  console.error("Topic API error:", error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
