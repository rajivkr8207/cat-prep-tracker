export function isValidDateString(value) {
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

export const SYLLABUS_SECTIONS = Object.freeze(["VARC", "DILR", "Quant"]);

export const SYLLABUS_STATUSES = Object.freeze([
  "Not started",
  "Learning",
  "Covered once",
  "Needs revision",
  "Revised",
]);

export const COVERED_STATUSES = Object.freeze([
  "Covered once",
  "Needs revision",
  "Revised",
]);

export const CAT_FULL_SYLLABUS = Object.freeze([
  {
    section: "VARC",
    group: "Reading Comprehension",
    topics: [
      "Main Idea and Central Theme",
      "Author Purpose, Tone and Attitude",
      "Inference-Based Questions",
      "Assumptions and Implications",
      "Fact, Opinion and Evidence",
      "Passage Structure and Paragraph Function",
      "Strengthen and Weaken Arguments",
      "Application-Based Questions",
      "Vocabulary in Context",
      "Reading Comprehension Practice Sets",
    ],
  },
  {
    section: "VARC",
    group: "Verbal Ability",
    topics: [
      "Para Summary",
      "Parajumbles",
      "Odd Sentence Out",
      "Paragraph Completion",
      "Sentence Placement",
      "Paragraph Flow and Coherence",
      "Critical Reasoning",
      "Argument Structure and Logical Gaps",
      "Grammar and Sentence Correction Basics",
    ],
  },
  {
    section: "DILR",
    group: "Data Interpretation",
    topics: [
      "Tables",
      "Bar Graphs",
      "Line Graphs",
      "Pie Charts",
      "Mixed Graphs",
      "Caselets",
      "Missing-Data Sets",
      "Data Comparison",
      "Calculation-Based DI",
      "Percentages, Ratios and Averages in DI",
      "Data Sufficiency",
    ],
  },
  {
    section: "DILR",
    group: "Logical Reasoning",
    topics: [
      "Linear Arrangements",
      "Circular Arrangements",
      "Matrix Arrangements",
      "Ordering and Ranking",
      "Selection and Distribution",
      "Distribution with Constraints",
      "Selection with Conditions",
      "Scheduling and Calendars",
      "Games and Tournaments",
      "Venn Diagrams and Set-Based Reasoning",
      "Routes and Networks",
      "Binary Logic",
      "Truth and Lie Puzzles",
      "Matching and Assignment Puzzles",
      "Numerical and Sequence Puzzles",
      "Constraint-Based Logical Puzzles",
      "Family Trees and Blood Relations",
    ],
  },
  {
    section: "Quant",
    group: "Arithmetic",
    topics: [
      "Percentages",
      "Successive Percentage Changes",
      "Ratio and Proportion",
      "Direct and Inverse Proportion",
      "Averages",
      "Weighted Averages",
      "Mixtures and Alligation",
      "Profit, Loss and Discount",
      "Simple Interest",
      "Compound Interest",
      "Partnership",
      "Problems on Ages",
      "Time and Work",
      "Work Efficiency",
      "Pipes and Cisterns",
      "Time, Speed and Distance",
      "Relative Speed",
      "Trains",
      "Boats and Streams",
      "Races",
      "Circular Tracks",
      "Installments and Growth",
    ],
  },
  {
    section: "Quant",
    group: "Algebra",
    topics: [
      "Algebraic Expressions and Identities",
      "Linear Equations",
      "Simultaneous Equations",
      "Quadratic Equations",
      "Polynomials",
      "Factorisation",
      "Linear Inequalities",
      "Quadratic Inequalities",
      "Modulus and Absolute Value",
      "Exponents and Powers",
      "Surds",
      "Logarithms",
      "Functions",
      "Domain and Range",
      "Graphs of Functions",
      "Sequences and Series",
      "Arithmetic Progression (AP)",
      "Geometric Progression (GP)",
      "Maxima and Minima",
      "Special Equations",
    ],
  },
  {
    section: "Quant",
    group: "Number System",
    topics: [
      "Types and Properties of Numbers",
      "Divisibility",
      "Factors and Multiples",
      "Prime Numbers",
      "Prime Factorisation",
      "HCF and LCM",
      "Number of Factors",
      "Remainders and Remainder Patterns",
      "Cyclicity",
      "Unit Digit and Last Digit",
      "Last Two Digits",
      "Factorials",
      "Highest Power in Factorials",
      "Trailing Zeroes",
      "Odd and Even Numbers",
      "Rational and Irrational Numbers",
      "Terminating and Recurring Decimals",
      "Base Systems",
    ],
  },
  {
    section: "Quant",
    group: "Geometry",
    topics: [
      "Lines and Angles",
      "Triangles",
      "Congruence and Similarity",
      "Pythagoras Theorem and Special Triangles",
      "Triangle Centres",
      "Quadrilaterals",
      "Polygons and Angle Properties",
      "Circles and Circle Theorems",
      "Tangents and Chords",
      "Coordinate Geometry",
      "Distance and Midpoint",
      "Slope and Straight Lines",
      "Geometric Inequalities",
      "2D Mensuration",
      "Circle Sectors and Composite Areas",
      "3D Mensuration",
    ],
  },
  {
    section: "Quant",
    group: "Modern Maths",
    topics: [
      "Fundamental Principle of Counting",
      "Permutations",
      "Combinations",
      "Arrangements with Restrictions",
      "Circular Permutations",
      "Selection with Cases",
      "Complementary Counting",
      "Set Theory",
      "Venn Diagrams",
      "Set Operations and Inclusion-Exclusion",
      "Probability",
      "Complementary Probability",
      "Independent and Dependent Events",
      "Conditional Probability",
      "Binomial Theorem",
    ],
  },
]);

export function validateSyllabusPayload(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "A JSON object is required" };
  }

  const allowedFields = [
    "subject",
    "group",
    "topicName",
    "status",
    "lastCoveredAt",
    "revisionCount",
    "notes",
  ];

  const unsupported = Object.keys(body).filter((k) => !allowedFields.includes(k));
  if (unsupported.length) {
    return { error: `Unsupported field(s): ${unsupported.join(", ")}` };
  }

  const payload = {};

  if (!partial || body.subject !== undefined) {
    if (!SYLLABUS_SECTIONS.includes(body.subject)) {
      return { error: `Subject must be one of: ${SYLLABUS_SECTIONS.join(", ")}` };
    }
    payload.subject = body.subject;
  }

  if (!partial || body.group !== undefined) {
    if (typeof body.group !== "string" || !body.group.trim()) {
      return { error: "Group is required" };
    }
    payload.group = body.group.trim();
  }

  if (!partial || body.topicName !== undefined) {
    if (typeof body.topicName !== "string" || !body.topicName.trim()) {
      return { error: "Topic name is required" };
    }
    payload.topicName = body.topicName.trim();
  }

  if (body.status !== undefined) {
    if (!SYLLABUS_STATUSES.includes(body.status)) {
      return { error: `Status must be one of: ${SYLLABUS_STATUSES.join(", ")}` };
    }
    payload.status = body.status;
  }

  if (body.lastCoveredAt !== undefined) {
    if (body.lastCoveredAt && !isValidDateString(body.lastCoveredAt)) {
      return { error: "lastCoveredAt must be a valid YYYY-MM-DD date" };
    }
    payload.lastCoveredAt = body.lastCoveredAt || "";
  }

  if (body.revisionCount !== undefined) {
    const rc = Number(body.revisionCount);
    if (!Number.isInteger(rc) || rc < 0) {
      return { error: "revisionCount must be a non-negative integer" };
    }
    payload.revisionCount = rc;
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

export function syllabusApiError(error) {
  if (error?.code === 11000) {
    return Response.json(
      { error: "A progress record already exists for this syllabus topic" },
      { status: 409 },
    );
  }

  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return Response.json({ error: error.message }, { status: 400 });
  }

  console.error("Syllabus API error:", error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
