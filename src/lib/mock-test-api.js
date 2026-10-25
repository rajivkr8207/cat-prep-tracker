import mongoose from "mongoose";
import { isValidTaskDate } from "@/lib/task-api";

export const MOCK_TYPES = Object.freeze(["full", "sectional"]);
export const MOCK_SECTIONS = Object.freeze(["VARC", "DILR", "Quant"]);

export function parseObjectId(id) {
  return (
    typeof id === "string" &&
    /^[a-f\d]{24}$/i.test(id) &&
    mongoose.Types.ObjectId.isValid(id)
  );
}

export function calculateSectionStats(raw) {
  if (!raw || typeof raw !== "object") return null;

  const n = (x) => (x === "" || x == null ? null : Number(x));
  const total = n(raw.total);
  const attempted = n(raw.attempted);
  const correct = n(raw.correct);
  const wrongNeg = n(raw.wrongNeg);
  const wrongNoNeg = n(raw.wrongNoNeg);

  const hasAny = [total, attempted, correct, wrongNeg, wrongNoNeg].some((x) => x !== null);
  if (!hasAny) return null;

  const cor = correct ?? 0;
  const wn = wrongNeg ?? 0;
  const wnn = wrongNoNeg ?? 0;
  const att = attempted ?? (cor + wn + wnn);
  const incorrect = wn + wnn;
  const unattempted = total === null ? null : Math.max(0, total - att);
  const accuracy = att > 0 ? (cor / att) * 100 : null;
  const score = 3 * cor - wn;

  return {
    total,
    attempted: att,
    correct: cor,
    wrongNeg: wn,
    wrongNoNeg: wnn,
    incorrect,
    unattempted,
    accuracy,
    score,
  };
}

export function validateMockTestPayload(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "A JSON object is required" };
  }

  const allowedFields = [
    "name",
    "date",
    "type",
    "testSection",
    "percentile",
    "score",
    "attempts",
    "varc",
    "dilr",
    "quant",
    "loss",
    "action",
    "sections",
  ];

  const unsupported = Object.keys(body).filter((k) => !allowedFields.includes(k));
  if (unsupported.length) {
    return { error: `Unsupported field(s): ${unsupported.join(", ")}` };
  }

  const payload = {};

  // Name
  if (!partial || body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return { error: "Test name is required and cannot be empty" };
    }
    const trimmed = body.name.trim();
    if (trimmed.length > 200) {
      return { error: "Test name cannot exceed 200 characters" };
    }
    payload.name = trimmed;
  }

  // Date
  if (!partial || body.date !== undefined) {
    if (!body.date || !isValidTaskDate(body.date)) {
      return { error: "Test date must be a valid YYYY-MM-DD date" };
    }
    payload.date = body.date;
  }

  // Type
  if (!partial || body.type !== undefined) {
    if (!MOCK_TYPES.includes(body.type)) {
      return { error: `Test type must be one of: ${MOCK_TYPES.join(", ")}` };
    }
    payload.type = body.type;
  }

  const testType = payload.type || body.type;

  // TestSection
  if (!partial || body.testSection !== undefined || payload.type !== undefined) {
    const ts = body.testSection || "";
    if (testType === "sectional") {
      if (!MOCK_SECTIONS.includes(ts)) {
        return {
          error: `Sectional test section must be one of: ${MOCK_SECTIONS.join(", ")}`,
        };
      }
      payload.testSection = ts;
    } else {
      if (ts) {
        return { error: "Full mocks must not have a single test section" };
      }
      payload.testSection = "";
    }
  }

  // Percentile
  if (body.percentile !== undefined) {
    if (body.percentile === "" || body.percentile === null) {
      payload.percentile = undefined;
    } else {
      const p = Number(body.percentile);
      if (isNaN(p) || p < 0 || p > 100) {
        return { error: "Percentile must be a number between 0 and 100" };
      }
      payload.percentile = Number(p.toFixed(2));
    }
  }

  // Loss
  if (body.loss !== undefined) {
    if (body.loss != null && typeof body.loss !== "string") {
      return { error: "Loss analysis notes must be a string" };
    }
    const lossStr = (body.loss || "").trim();
    if (lossStr.length > 5000) {
      return { error: "Loss notes cannot exceed 5000 characters" };
    }
    payload.loss = lossStr;
  }

  // Action
  if (body.action !== undefined) {
    if (body.action != null && typeof body.action !== "string") {
      return { error: "Action plan notes must be a string" };
    }
    const actStr = (body.action || "").trim();
    if (actStr.length > 5000) {
      return { error: "Action plan cannot exceed 5000 characters" };
    }
    payload.action = actStr;
  }

  // Sections and Scoring Calculations
  if (body.sections !== undefined) {
    if (typeof body.sections !== "object" || body.sections === null || Array.isArray(body.sections)) {
      return { error: "Sections must be an object with section results" };
    }

    const payloadSections = {};
    const relevantSections =
      testType === "full" ? MOCK_SECTIONS : payload.testSection ? [payload.testSection] : [];

    for (const sec of MOCK_SECTIONS) {
      const secData = body.sections[sec];
      if (!secData) continue;

      const isRequired = relevantSections.includes(sec);

      const countFields = [
        ["total", "total questions"],
        ["attempted", "attempted"],
        ["correct", "correct"],
        ["wrongNeg", "negative-marked incorrect"],
        ["wrongNoNeg", "non-negative-marked incorrect"],
      ];

      const cleanSec = {};

      for (const [key, label] of countFields) {
        const val = secData[key];
        if (val === "" || val === null || val === undefined) {
          if (isRequired) {
            return { error: `${sec}: enter ${label}. Enter 0 if none.` };
          }
        } else {
          const num = Number(val);
          if (!Number.isInteger(num) || num < 0) {
            return { error: `${sec}: ${label} must be a non-negative whole number` };
          }
          cleanSec[key] = num;
        }
      }

      if (cleanSec.attempted !== undefined) {
        if (cleanSec.total !== undefined && cleanSec.attempted > cleanSec.total) {
          return { error: `${sec}: attempted questions cannot exceed total questions` };
        }

        const classified =
          (cleanSec.correct || 0) + (cleanSec.wrongNeg || 0) + (cleanSec.wrongNoNeg || 0);

        if (cleanSec.correct !== undefined && cleanSec.correct > cleanSec.attempted) {
          return { error: `${sec}: correct answers cannot exceed attempted questions` };
        }

        if (cleanSec.correct !== undefined && cleanSec.wrongNeg !== undefined && cleanSec.wrongNoNeg !== undefined) {
          if (classified !== cleanSec.attempted) {
            return {
              error: `${sec}: attempted (${cleanSec.attempted}) must equal correct (${cleanSec.correct}) + negative-marked (${cleanSec.wrongNeg}) + non-negative-marked (${cleanSec.wrongNoNeg})`,
            };
          }
        }
      }

      payloadSections[sec] = cleanSec;
    }

    payload.sections = payloadSections;

    // Calculate score, attempts, and section scores
    let calculatedTotalScore = 0;
    let calculatedTotalAttempts = 0;

    for (const sec of relevantSections) {
      const s = payloadSections[sec];
      if (s && s.correct !== undefined && s.wrongNeg !== undefined) {
        const secScore = 3 * s.correct - s.wrongNeg;
        payload[sec.toLowerCase()] = secScore;
        calculatedTotalScore += secScore;
        calculatedTotalAttempts += s.attempted || 0;
      }
    }

    if (relevantSections.length > 0) {
      payload.score = calculatedTotalScore;
      payload.attempts = calculatedTotalAttempts;
    }
  } else {
    // If sections were not passed, handle direct score/attempts if provided
    if (body.score !== undefined) {
      if (body.score === "" || body.score === null) {
        payload.score = undefined;
      } else {
        const s = Number(body.score);
        if (isNaN(s)) return { error: "Score must be a valid number" };
        payload.score = s;
      }
    }

    if (body.attempts !== undefined) {
      if (body.attempts === "" || body.attempts === null) {
        payload.attempts = undefined;
      } else {
        const a = Number(body.attempts);
        if (!Number.isInteger(a) || a < 0) return { error: "Attempts must be a non-negative integer" };
        payload.attempts = a;
      }
    }

    for (const sec of ["varc", "dilr", "quant"]) {
      if (body[sec] !== undefined) {
        if (body[sec] === "" || body[sec] === null) {
          payload[sec] = undefined;
        } else {
          const val = Number(body[sec]);
          if (isNaN(val)) return { error: `${sec.toUpperCase()} score must be a number` };
          payload[sec] = val;
        }
      }
    }
  }

  return { payload };
}

export function mockTestApiError(error) {
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return Response.json({ error: error.message }, { status: 400 });
  }

  console.error("MockTest API error:", error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
