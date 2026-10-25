// Dashboard and History/Analytics calculations & utilities

export const THOUGHTS = [
  ["You do not need a perfect day; you need a day that moves you forward.", "Action: finish one important task before switching."],
  ["Your score changes when your habits change. Make today's work measurable.", "Action: record accuracy and analyse one mistake."],
  ["Confusion is useful when you investigate it instead of avoiding it.", "Action: redo one question you got wrong without looking at the solution."],
  ["Consistency beats occasional marathon sessions.", "Action: complete a realistic priority even if the day feels imperfect."],
  ["Reading faster is not progress if understanding disappears.", "Action: after an RC, summarise its central argument in one sentence."],
  ["A mistake repeated is a signal to change the method, not just try harder.", "Action: write why the mistake happened and how you will catch it next time."],
  ["Independent solving is the skill. Watching a solution is only the first step.", "Action: close the solution and attempt the question again."],
  ["You can only improve what you honestly measure.", "Action: enter today's actual time and results, not estimates."],
  ["A small planned revision today can save a big relearning session later.", "Action: clear one due item from your revision queue."],
  ["You are building a process, not proving your worth with one test.", "Action: review the test for decisions you can improve."],
  ["Focus is not never getting distracted; it is returning to the task sooner.", "Action: try one distraction-free 25-minute block."],
  ["Don't add more work just to feel productive. Do the work that fixes your weakest link.", "Action: choose the task with the clearest learning benefit."],
  ["Start where you are, then make the next step specific.", "Action: write down the single result you want from this study block."],
  ["Accuracy first, speed second; speed grows from reliable methods.", "Action: solve five questions carefully and note any repeated error."],
  ["A focused hour is worth more than a distracted afternoon.", "Action: put your phone away for one timed study block."],
  ["Do not measure a session only by how long you sat there.", "Action: record what you understood and what you can now solve alone."],
  ["Every wrong answer can become a rule that protects you next time.", "Action: write one short lesson from today's mistakes."],
  ["You build confidence by keeping small promises to your schedule.", "Action: complete the first task you planned for today."],
  ["A difficult passage rewards structure, not panic.", "Action: identify the author's main claim and the role of each paragraph."],
  ["Practice is strongest when you review the gap between your attempt and the answer.", "Action: redo one missed question without hints."],
  ["Your weakest topic deserves a clear plan, not avoidance.", "Action: spend one focused block on a specific weak subtopic."],
  ["Progress is often quiet: fewer repeated mistakes, clearer reasoning, better choices.", "Action: compare today's work with your last attempt."],
  ["A mock test is information, not a verdict.", "Action: choose one pattern from your last mock to fix."],
  ["Make revision active: retrieve the idea before checking your notes.", "Action: recall one formula or concept from memory, then verify it."],
  ["A good plan leaves room for analysis, not just completion.", "Action: review why one answer was right and the alternatives were wrong."],
  ["You don't need to feel motivated to begin; beginning can create momentum.", "Action: start a 20-minute timer and do the next small task."],
  ["Careful reading is active work: question, connect, and summarise.", "Action: summarise today's RC in one sentence without looking back."],
  ["Do fewer things with full attention rather than many things half-heartedly.", "Action: choose your top priority and finish it before switching."],
  ["A formula becomes useful when you know when and why to apply it.", "Action: solve one question and explain why that method fits."],
  ["Today's honest baseline is more useful than an impressive guess.", "Action: log your actual attempts, accuracy, and time."],
  ["When a method fails, inspect the step where your reasoning changed.", "Action: trace one incorrect solution line by line."],
  ["Consistency means returning after a bad session, not avoiding bad sessions.", "Action: restart with one manageable question."],
  ["Build speed by recognising patterns, not by skipping understanding.", "Action: identify the key pattern before calculating."],
  ["A clear error log turns practice into a feedback loop.", "Action: label one error as concept, calculation, reading, or strategy."],
  ["Protect your attention as carefully as you plan your timetable.", "Action: remove one distraction before the next session."],
];

export function localDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function shiftISODate(dateStr, days) {
  if (!dateStr || typeof dateStr !== "string") return "";
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const [y, m, d] = parts;
  const date = new Date(Date.UTC(y, m - 1, d + days, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function formatDate(value) {
  if (!value) return "—";
  const parts = String(value).split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return String(value);
}

export function haDate(raw) {
  if (!raw) return "";
  const str = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(str);
  if (match) return match[1];
  return "";
}

export function haWithin(date, from, to) {
  const d = haDate(date);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export function effectiveTestType(m) {
  if (!m) return "full";
  if (m.type === "sectional" || m.type === "full") return m.type;
  const filled = ["VARC", "DILR", "Quant"].filter(
    (sec) => m[sec.toLowerCase()] !== "" && m[sec.toLowerCase()] != null,
  );
  return (m.score === "" || m.score == null) && filled.length === 1
    ? "sectional"
    : "full";
}

export function testSectionData(m, sec) {
  if (!m) return null;
  if (m.sections && m.sections[sec]) {
    const raw = m.sections[sec];
    const n = (x) => (x === "" || x == null ? null : Number(x));
    const total = n(raw.total);
    const attempted = n(raw.attempted);
    const correct = n(raw.correct);
    const wrongNeg = n(raw.wrongNeg);
    const wrongNoNeg = n(raw.wrongNoNeg);
    const has = [total, attempted, correct, wrongNeg, wrongNoNeg].some((x) => x !== null);
    if (!has) return null;
    const att = attempted ?? ((correct ?? 0) + (wrongNeg ?? 0) + (wrongNoNeg ?? 0));
    const cor = correct ?? 0;
    const wn = wrongNeg ?? 0;
    const wnn = wrongNoNeg ?? 0;
    const incorrect = wn + wnn;
    const unattempted = total === null ? null : Math.max(0, total - att);
    return {
      total,
      attempted: att,
      correct: cor,
      wrongNeg: wn,
      wrongNoNeg: wnn,
      incorrect,
      unattempted,
      accuracy: att > 0 ? (cor / att) * 100 : null,
      score: 3 * cor - wn,
    };
  }
  const old = m[sec.toLowerCase()];
  if (old !== "" && old != null) {
    return {
      total: null,
      attempted: Number(m.attempts) || null,
      correct: null,
      wrongNeg: null,
      wrongNoNeg: null,
      incorrect: null,
      unattempted: null,
      accuracy: null,
      score: Number(old),
    };
  }
  return null;
}

export function testScore(m, section) {
  if (!m) return null;
  if (section) {
    const st = testSectionData(m, section);
    if (st && st.score !== null) return st.score;
    const v = m[section.toLowerCase()];
    return v === "" || v == null ? null : Number(v);
  }
  if (m.sections) {
    const sts = ["VARC", "DILR", "Quant"]
      .map((sec) => testSectionData(m, sec))
      .filter(Boolean);
    if (sts.length === 3 && sts.every((st) => st.score !== null)) {
      return sts.reduce((sum, st) => sum + st.score, 0);
    }
  }
  return m.score === "" || m.score == null ? null : Number(m.score);
}

export function calcTestSummary(m) {
  if (!m) return null;
  const typ = effectiveTestType(m);
  const secs = typ === "full" ? ["VARC", "DILR", "Quant"] : [m.testSection || "VARC"];
  const stats = secs.map((sec) => testSectionData(m, sec)).filter(Boolean);
  if (!stats.length) return null;
  const sum = (key) =>
    stats.some((st) => st[key] === null || st[key] === undefined)
      ? null
      : stats.reduce((n, st) => n + (Number(st[key]) || 0), 0);
  const attempted = sum("attempted");
  const correct = sum("correct");
  const incorrect = sum("incorrect");
  const unattempted = sum("unattempted");
  const total = sum("total");
  const score = testScore(m, null);
  return {
    total,
    attempted,
    correct,
    incorrect,
    unattempted,
    accuracy: attempted && correct !== null ? (correct / attempted) * 100 : null,
    score,
  };
}

export function haTaskQuestionStats(tasks = []) {
  return tasks.reduce(
    (acc, t) => {
      const attempted = Math.max(0, Number(t.attempted) || 0);
      const correct = Math.max(0, Number(t.correct) || 0);
      acc.attempted += attempted;
      acc.correct += Math.min(correct, attempted);
      return acc;
    },
    { attempted: 0, correct: 0 },
  );
}

export function haPracticeSessions(sessions = [], tasks = []) {
  const taskIds = new Set(
    tasks.map((t) => String(t._id || t.id)).filter(Boolean),
  );
  return sessions.filter(
    (s) => !s.relatedTaskId || !taskIds.has(String(s.relatedTaskId)),
  );
}

export function calculateStreak(activityDays, todayStr = localDateString()) {
  const set = activityDays instanceof Set ? activityDays : new Set(activityDays || []);
  let streak = 0;
  let cursor = todayStr;
  if (!set.has(cursor)) {
    cursor = shiftISODate(cursor, -1);
  }
  while (set.has(cursor) && streak <= 500) {
    streak++;
    cursor = shiftISODate(cursor, -1);
  }
  return streak;
}

export function getTodayThought(todayStr = localDateString()) {
  const parts = todayStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return {
      date: todayStr,
      quote: THOUGHTS[0][0],
      action: THOUGHTS[0][1],
    };
  }
  const dayDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const yearStart = new Date(Date.UTC(parts[0], 0, 1));
  const dayOfYear = Math.floor((dayDate - yearStart) / 86400000);
  const idx = Math.abs(dayOfYear) % THOUGHTS.length;
  return {
    date: todayStr,
    quote: THOUGHTS[idx][0],
    action: THOUGHTS[idx][1],
  };
}

export function getAdviceOptions({
  revisions = [],
  tasks = [],
  attempted = 0,
  correct = 0,
  topics = [],
  currentDate = localDateString(),
  todayStr = localDateString(),
}) {
  const now = todayStr;
  const due = revisions.filter(
    (r) => r.date && r.date <= now && r.result !== "Correct independently",
  ).length;
  const overdue = tasks.filter(
    (t) =>
      t.date < now &&
      ["Not started", "In progress", "Partly done", "Not done", "Rescheduled"].includes(t.status),
  ).length;
  const todays = tasks.filter((t) => t.date === currentDate);
  const todaysDone = todays.filter((t) => t.status === "Done").length;
  const todaysNotDone = todays.filter(
    (t) => t.status === "Not done" || t.status === "Skipped",
  ).length;

  const start7 = shiftISODate(now, -6);
  const recent = tasks.filter((t) => t.date >= start7 && t.date <= now);
  const completed = recent.filter((t) => t.status === "Done").length;

  const adviceOptions = [];
  if (due) {
    adviceOptions.push(
      `🔁 PRIORITY: ${due} revision item(s) are due/overdue. Clear 1–2 items and solve them independently before adding extra work.`,
    );
  }
  if (attempted && correct / attempted < 0.6) {
    adviceOptions.push(
      `🎯 ACCURACY: Recorded accuracy is ${Math.round((correct / attempted) * 100)}% (${correct}/${attempted}). Review each error and redo missed questions before chasing speed.`,
    );
  }
  if (topics.some((t) => t.status === "Weak")) {
    const weak = topics
      .filter((t) => t.status === "Weak")
      .slice(0, 3)
      .map((t) => t.name)
      .filter(Boolean);
    adviceOptions.push(
      `🎯 WEAK TOPICS: Focus on ${weak.join(", ") || "a topic marked weak"}. Do one practice block, then solve questions without help.`,
    );
  }
  if (overdue) {
    adviceOptions.push(
      `📌 BACKLOG: ${overdue} unfinished task(s) are from earlier dates. Pick only the highest-value one to reschedule; do not copy the whole backlog forward.`,
    );
  }
  if (todays.length && todaysDone === 0 && todaysNotDone > 0) {
    adviceOptions.push(
      `🔄 RESET: ${todaysNotDone} task(s) for ${formatDate(currentDate)} were marked not done. Identify the main blocker and make the first task of your next session smaller.`,
    );
  }
  if (recent.length && completed / recent.length < 0.5) {
    adviceOptions.push(
      `⚖️ PLAN SIZE: ${Math.round((completed / recent.length) * 100)}% of tasks in the last 7 days are marked done. Plan less and protect time for practice and error analysis.`,
    );
  }
  if (todays.length && todaysDone === todays.length) {
    adviceOptions.push(
      `✅ EXECUTION: All ${todays.length} task(s) for ${formatDate(currentDate)} are marked done. Verify that accuracy and mistake review were also recorded; completion alone does not prove mastery.`,
    );
  }
  if (!tasks.length) {
    adviceOptions.push(
      "📝 FIRST STEP: Add 2–4 specific tasks for today or tomorrow, each with a clear quantity and time estimate.",
    );
  }
  if (!attempted) {
    adviceOptions.push(
      "📈 MEASURE PROGRESS: Tasks are logged, but question attempts are missing. Enter attempted and correct counts so the tracker can judge accuracy.",
    );
  }
  adviceOptions.push(
    "💡 PRACTICE: Choose one task and define the finish line before starting—for example, one RC plus a one-sentence summary, or one DILR set with full analysis.",
  );
  adviceOptions.push(
    "🔍 ERROR REVIEW: Spend 10 minutes reviewing one mistake. Write whether it came from concept, interpretation, calculation, or time pressure, then retry without the solution.",
  );
  adviceOptions.push(
    "⏱️ FOCUS: Run one 25-minute distraction-free study block. Record only the time you actually focused, not the time spent sitting at the desk.",
  );

  return adviceOptions;
}

export function recommendationText({
  tasks = [],
  revisions = [],
  topics = [],
  currentDate = localDateString(),
  todayStr = localDateString(),
}) {
  const lines = [];
  const overdue = revisions.filter(
    (r) => r.date && r.date <= todayStr && r.result !== "Correct independently",
  );
  const weak = topics.filter(
    (t) =>
      t.status === "Weak" || t.status === "Learning" || t.status === "Practising",
  );
  const open = tasks.filter(
    (t) =>
      t.date < todayStr &&
      ["Not started", "In progress", "Partly done", "Not done", "Rescheduled"].includes(t.status),
  );

  if (overdue.length) {
    lines.push(
      `🔁 REVISION FIRST: ${overdue.length} due/overdue items. Pick the highest-value 1–3 and redo them independently.`,
    );
  }
  if (open.length) {
    lines.push(
      `📌 BACKLOG: ${open.length} unfinished task(s) from earlier dates. Reschedule only the important ones; drop low-value extras instead of endlessly carrying everything forward.`,
    );
  }
  if (weak.length) {
    lines.push(
      `🎯 TOPIC PRACTICE: Review these skills: ${weak
        .slice(0, 4)
        .map((t) => `${t.name} (${t.section}, ${t.status})`)
        .join("; ")}. Choose one priority based on upcoming coaching and recent errors.`,
    );
  }

  const t = tasks.filter((x) => x.date === currentDate);
  if (!t.length) {
    lines.push(
      "📝 PLAN: Add your intended tasks for the selected date. Include VARC, Quant, DILR and revision as appropriate to your current stage.",
    );
  } else {
    const sections = new Set(t.map((x) => x.section));
    for (const sec of ["VARC", "Quant", "DILR"]) {
      if (!sections.has(sec)) {
        lines.push(
          `⚖️ BALANCE: No ${sec} task is planned for this date. Decide whether it needs a small practice block or whether another priority justifies leaving it out.`,
        );
      }
    }
    if (t.length > 7) {
      lines.push(
        `🧩 LOAD CHECK: ${t.length} tasks planned. Check whether the time estimates fit your real day; fewer well-reviewed tasks may be better.`,
      );
    }
    if (t.filter((x) => x.priority === "Must do").length > 4) {
      lines.push(
        "⚠️ PRIORITIES: You have more than four “Must do” tasks. Reduce the list to the few that matter most.",
      );
    }
  }

  if (!lines.length) {
    lines.push(
      "✅ No obvious flags from the saved data. Share your plan and recent results with ChatGPT for a deeper review.",
    );
  }

  return lines;
}

export function generateChatGPTReport({
  tasks = [],
  revisions = [],
  topics = [],
  mocks = [],
  currentDate = localDateString(),
  todayStr = localDateString(),
}) {
  const dayTasks = tasks.filter((t) => t.date === currentDate);
  const tasksSection = dayTasks.length
    ? dayTasks
        .map(
          (t, i) =>
            `${i + 1}. ${t.section}: ${t.title} (${t.planned || 0} min, ${t.priority}, ${t.status})`,
        )
        .join("\n")
    : "No tasks entered";

  const topicsSection = topics.length
    ? topics
        .map(
          (t) =>
            `${t.section}: ${t.name} — ${t.status}, accuracy ${
              t.accuracy !== "" && t.accuracy != null && Number.isFinite(Number(t.accuracy))
                ? Number(t.accuracy) + "%"
                : "not entered"
            }`,
        )
        .join("\n")
    : "No topics logged";

  const dueRevisions = revisions.filter(
    (r) => r.date && r.date <= todayStr && r.result !== "Correct independently",
  );
  const revisionsSection = dueRevisions.length
    ? dueRevisions
        .map(
          (r) =>
            `${formatDate(r.date)}: ${r.section} — ${r.title} (${r.result || "Pending"})`,
        )
        .join("\n")
    : "None recorded";

  const sortedMocks = [...mocks]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 10)
    .reverse();
  const mocksSection = sortedMocks.length
    ? sortedMocks
        .map((m) => {
          const z = calcTestSummary(m);
          const typ = effectiveTestType(m);
          const scoreVal = testScore(m, typ === "full" ? null : m.testSection);
          return `${formatDate(m.date)} ${m.name} [${typ === "full" ? "FULL" : "SECTIONAL " + (m.testSection || "")}]: score ${
            scoreVal ?? "—"
          }, attempted ${z?.attempted ?? m.attempts ?? "—"}, unattempted ${
            z?.unattempted ?? "—"
          }, correct ${z?.correct ?? "—"}, incorrect ${
            z?.incorrect ?? "—"
          }, accuracy ${
            z?.accuracy == null ? "—" : z.accuracy.toFixed(1) + "%"
          }; issues: ${m.loss || "—"}; next actions: ${m.action || "—"}`;
        })
        .join("\n")
    : "None logged";

  const flags = recommendationText({
    tasks,
    revisions,
    topics,
    currentDate,
    todayStr,
  }).join("\n");

  return [
    `CAT 2027 adviser review — ${formatDate(currentDate)}`,
    "TODAY'S PLAN:",
    tasksSection,
    "",
    "TOPIC MASTERY:",
    topicsSection,
    "",
    "REVISION DUE:",
    revisionsSection,
    "",
    "RECENT MOCKS:",
    mocksSection,
    "",
    "LOCAL FLAGS:",
    flags,
    "",
    "Please honestly assess if the workload is sufficient for my current CAT preparation level. Suggest additions/removals, prioritize revision, and identify the next best actions without overloading my day.",
  ].join("\n");
}
