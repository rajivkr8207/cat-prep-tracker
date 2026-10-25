import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import TaskTracker from "@/models/task.model";
import DailyReflection from "@/models/DailyReflection.model";
import WeeklyReview from "@/models/WeeklyReview.model";
import MonthlyReview from "@/models/MonthlyReview.model";
import Topic from "@/models/Topic.model";
import TopicSession from "@/models/TopicSession.model";
import SyllabusProgress from "@/models/SyllabusProgress.model";
import Revision from "@/models/Revision.model";
import MockTest from "@/models/MockTest.model";

function isISODate(str) {
  return typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    await connectDB();
    const userId = user._id;

    const [
      tasks,
      reflections,
      weeklyReviews,
      monthlyReviews,
      topics,
      topicSessions,
      syllabusProgress,
      revisions,
      mockTests,
    ] = await Promise.all([
      TaskTracker.find({ userId }).sort({ date: 1, _id: 1 }).lean(),
      DailyReflection.find({ userId }).sort({ date: 1 }).lean(),
      WeeklyReview.find({ userId }).sort({ weekStart: 1 }).lean(),
      MonthlyReview.find({ userId }).sort({ month: 1 }).lean(),
      Topic.find({ userId }).sort({ name: 1 }).lean(),
      TopicSession.find({ userId }).sort({ date: 1, _id: 1 }).lean(),
      SyllabusProgress.find({ userId }).sort({ subject: 1, group: 1, topicName: 1 }).lean(),
      Revision.find({ userId }).sort({ date: 1 }).lean(),
      MockTest.find({ userId }).sort({ date: 1, _id: 1 }).lean(),
    ]);

    // Strip internal _id and userId from exported data to keep it clean and portable
    const sanitize = (list) =>
      list.map((item) => {
        const { _id, userId: uid, __v, createdAt, updatedAt, ...rest } = item;
        return rest;
      });

    // Also support original CAT2027 reflection map format { "YYYY-MM-DD": { hours, plan, ... } }
    const reflectionsMap = {};
    for (const r of reflections) {
      if (r.date) {
        reflectionsMap[r.date] = {
          hours: r.hours,
          plan: r.plan,
          actual: r.actual,
          focus: r.focus,
          win: r.win,
          weak: r.weak,
          tomorrow: r.tomorrow,
        };
      }
    }

    const backupData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      tasks: sanitize(tasks),
      reflections: reflectionsMap,
      weeklyReviews: sanitize(weeklyReviews),
      monthlyReviews: sanitize(monthlyReviews),
      topics: sanitize(topics),
      topicSessions: sanitize(topicSessions),
      syllabusProgress: sanitize(syllabusProgress),
      revisions: sanitize(revisions),
      mocks: sanitize(mockTests),
      counts: {
        tasks: tasks.length,
        reflections: reflections.length,
        weeklyReviews: weeklyReviews.length,
        monthlyReviews: monthlyReviews.length,
        topics: topics.length,
        topicSessions: topicSessions.length,
        syllabusProgress: syllabusProgress.length,
        revisions: revisions.length,
        mocks: mockTests.length,
      },
    };

    return Response.json(backupData, {
      status: 200,
      headers: {
        "Content-Disposition": 'attachment; filename="CAT_2027_Diary_Backup.json"',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message || "Failed to generate backup" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON format" }, { status: 400 });
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return Response.json({ error: "Backup file must be a JSON object" }, { status: 400 });
    }

    await connectDB();
    const userId = user._id;
    const restored = {
      tasks: 0,
      reflections: 0,
      weeklyReviews: 0,
      monthlyReviews: 0,
      topics: 0,
      topicSessions: 0,
      syllabusProgress: 0,
      revisions: 0,
      mocks: 0,
    };

    // 1. Tasks
    if (Array.isArray(payload.tasks)) {
      for (const t of payload.tasks) {
        if (!t || typeof t !== "object" || !t.title || !isISODate(t.date)) continue;
        const taskDoc = {
          userId,
          title: String(t.title).trim().slice(0, 500),
          section: ["VARC", "Quant", "DILR", "Revision", "Mock test", "Analysis", "Other"].includes(t.section)
            ? t.section
            : "Other",
          priority: ["Must do", "Should do", "Bonus"].includes(t.priority) ? t.priority : "Must do",
          status: [
            "Not started",
            "In progress",
            "Done",
            "Partly done",
            "Not done",
            "Skipped",
            "Rescheduled",
          ].includes(t.status)
            ? t.status
            : "Not started",
          date: t.date,
          startTime: typeof t.startTime === "string" ? t.startTime : "",
          endTime: typeof t.endTime === "string" ? t.endTime : "",
          planned: Number.isFinite(Number(t.planned)) ? Math.max(0, Math.floor(Number(t.planned))) : undefined,
          actual: Number.isFinite(Number(t.actual)) ? Math.max(0, Math.floor(Number(t.actual))) : undefined,
          attempted: Number.isFinite(Number(t.attempted)) ? Math.max(0, Math.floor(Number(t.attempted))) : undefined,
          correct: Number.isFinite(Number(t.correct)) ? Math.max(0, Math.floor(Number(t.correct))) : undefined,
          notes: typeof t.notes === "string" ? t.notes.slice(0, 5000) : "",
        };
        await TaskTracker.create(taskDoc);
        restored.tasks++;
      }
    }

    // 2. Reflections (supports both Array of reflection objects or Map object { "YYYY-MM-DD": { ... } })
    if (payload.reflections) {
      let refList = [];
      if (Array.isArray(payload.reflections)) {
        refList = payload.reflections;
      } else if (typeof payload.reflections === "object") {
        for (const [date, val] of Object.entries(payload.reflections)) {
          if (val && typeof val === "object") {
            refList.push({ date, ...val });
          }
        }
      }

      for (const r of refList) {
        if (!r || typeof r !== "object" || !isISODate(r.date)) continue;
        let hours = null;
        if (r.hours !== "" && r.hours != null && Number.isFinite(Number(r.hours))) {
          const num = Math.max(0, Number(r.hours));
          hours = Math.round(num * 4) / 4; // Ensure quarter-hour increments
        }
        await DailyReflection.findOneAndUpdate(
          { userId, date: r.date },
          {
            userId,
            date: r.date,
            hours,
            plan: typeof r.plan === "string" ? r.plan.slice(0, 5000) : "",
            actual: typeof r.actual === "string" ? r.actual.slice(0, 5000) : "",
            focus: typeof r.focus === "string" ? r.focus.slice(0, 5000) : "",
            win: typeof r.win === "string" ? r.win.slice(0, 5000) : "",
            weak: typeof r.weak === "string" ? r.weak.slice(0, 5000) : "",
            tomorrow: typeof r.tomorrow === "string" ? r.tomorrow.slice(0, 5000) : "",
          },
          { upsert: true, new: true, runValidators: true },
        );
        restored.reflections++;
      }
    }

    // 3. Weekly Reviews
    if (Array.isArray(payload.weeklyReviews) || (payload.weeks && typeof payload.weeks === "object")) {
      const weeksList = Array.isArray(payload.weeklyReviews)
        ? payload.weeklyReviews
        : Object.entries(payload.weeks).map(([weekStart, val]) => ({ weekStart, ...val }));

      for (const w of weeksList) {
        if (!w || !isISODate(w.weekStart)) continue;
        await WeeklyReview.findOneAndUpdate(
          { userId, weekStart: w.weekStart },
          {
            userId,
            weekStart: w.weekStart,
            goals: typeof w.goals === "string" ? w.goals.slice(0, 5000) : "",
            varc: typeof w.varc === "string" ? w.varc.slice(0, 5000) : "",
            quant: typeof w.quant === "string" ? w.quant.slice(0, 5000) : "",
            dilr: typeof w.dilr === "string" ? w.dilr.slice(0, 5000) : "",
            revision: typeof w.revision === "string" ? w.revision.slice(0, 5000) : "",
            improved: typeof w.improved === "string" ? w.improved.slice(0, 5000) : "",
            mistakes: typeof w.mistakes === "string" ? w.mistakes.slice(0, 5000) : "",
            avoided: typeof w.avoided === "string" ? w.avoided.slice(0, 5000) : "",
            next: typeof w.next === "string" ? w.next.slice(0, 5000) : "",
            advice: typeof w.advice === "string" ? w.advice.slice(0, 5000) : "",
          },
          { upsert: true, new: true, runValidators: true },
        );
        restored.weeklyReviews++;
      }
    }

    // 4. Monthly Reviews
    if (Array.isArray(payload.monthlyReviews) || (payload.months && typeof payload.months === "object")) {
      const monthsList = Array.isArray(payload.monthlyReviews)
        ? payload.monthlyReviews
        : Object.entries(payload.months).map(([month, val]) => ({ month, ...val }));

      for (const m of monthsList) {
        if (!m || !m.month) continue;
        await MonthlyReview.findOneAndUpdate(
          { userId, month: m.month },
          {
            userId,
            month: m.month,
            quantSummary: typeof m.quantSummary === "string" ? m.quantSummary.slice(0, 5000) : "",
            varcSummary: typeof m.varcSummary === "string" ? m.varcSummary.slice(0, 5000) : "",
            dilrSummary: typeof m.dilrSummary === "string" ? m.dilrSummary.slice(0, 5000) : "",
            mockReview: typeof m.mockReview === "string" ? m.mockReview.slice(0, 5000) : "",
            hoursReview: typeof m.hoursReview === "string" ? m.hoursReview.slice(0, 5000) : "",
            nextMonthGoals: typeof m.nextMonthGoals === "string" ? m.nextMonthGoals.slice(0, 5000) : "",
          },
          { upsert: true, new: true, runValidators: true },
        );
        restored.monthlyReviews++;
      }
    }

    // 5. Topics
    if (Array.isArray(payload.topics)) {
      for (const t of payload.topics) {
        if (!t || typeof t !== "object" || !t.name) continue;
        const section = ["VARC", "DILR", "Quant"].includes(t.section) ? t.section : "Quant";
        const status = ["Not started", "Learning", "Covered once", "Needs revision", "Revised", "Weak", "Mastered"].includes(t.status)
          ? t.status
          : "Not started";
        await Topic.findOneAndUpdate(
          { userId, name: t.name.trim(), section },
          {
            userId,
            name: t.name.trim().slice(0, 200),
            section,
            status,
            priority: ["High", "Medium", "Low"].includes(t.priority) ? t.priority : "Medium",
            attempted: Number.isFinite(Number(t.attempted)) ? Math.max(0, Math.floor(Number(t.attempted))) : undefined,
            correct: Number.isFinite(Number(t.correct)) ? Math.max(0, Math.floor(Number(t.correct))) : undefined,
            accuracy: Number.isFinite(Number(t.accuracy)) ? Math.max(0, Math.min(100, Number(t.accuracy))) : undefined,
            lastPracticed: isISODate(t.lastPracticed) ? t.lastPracticed : "",
            nextReview: isISODate(t.nextReview) ? t.nextReview : "",
            notes: typeof t.notes === "string" ? t.notes.slice(0, 5000) : "",
          },
          { upsert: true, new: true, runValidators: true },
        );
        restored.topics++;
      }
    }

    // 6. Topic Sessions
    if (Array.isArray(payload.topicSessions)) {
      for (const s of payload.topicSessions) {
        if (!s || !s.topic || !isISODate(s.date)) continue;
        const total = Math.max(1, Number(s.total) || 1);
        const attempted = Math.max(0, Number(s.attempted) || 0);
        const correct = Math.max(0, Math.min(attempted, Number(s.correct) || 0));
        await TopicSession.create({
          userId,
          topic: String(s.topic).trim().slice(0, 200),
          section: ["VARC", "DILR", "Quant"].includes(s.section) ? s.section : "Quant",
          date: s.date,
          total,
          attempted,
          correct,
          incorrect: attempted - correct,
          unattempted: Math.max(0, total - attempted),
          minutes: Number.isFinite(Number(s.minutes)) ? Math.max(0, Number(s.minutes)) : undefined,
          mistake: typeof s.mistake === "string" ? s.mistake : "",
          notes: typeof s.notes === "string" ? s.notes.slice(0, 5000) : "",
        });
        restored.topicSessions++;
      }
    }

    // 7. Syllabus Progress
    if (Array.isArray(payload.syllabusProgress) || (payload.syllabusDates && typeof payload.syllabusDates === "object")) {
      const syllabusList = Array.isArray(payload.syllabusProgress)
        ? payload.syllabusProgress
        : [];

      for (const sp of syllabusList) {
        if (!sp || !sp.topicName || !sp.subject) continue;
        await SyllabusProgress.findOneAndUpdate(
          { userId, subject: sp.subject, group: sp.group || "", topicName: sp.topicName },
          {
            userId,
            subject: sp.subject,
            group: sp.group || "",
            topicName: sp.topicName,
            status: ["Not started", "Covered once", "Revised once", "Mastered"].includes(sp.status)
              ? sp.status
              : "Covered once",
            lastCoveredDate: isISODate(sp.lastCoveredDate) ? sp.lastCoveredDate : "",
          },
          { upsert: true, new: true, runValidators: true },
        );
        restored.syllabusProgress++;
      }
    }

    // 8. Revisions
    if (Array.isArray(payload.revisions)) {
      for (const r of payload.revisions) {
        if (!r || !r.title) continue;
        await Revision.create({
          userId,
          title: String(r.title).trim().slice(0, 200),
          section: ["VARC", "DILR", "Quant", "Revision"].includes(r.section) ? r.section : "Quant",
          topic: typeof r.topic === "string" ? r.topic.slice(0, 200) : "",
          date: isISODate(r.date) ? r.date : "",
          completed: Boolean(r.completed),
          completedOn: isISODate(r.completedOn) ? r.completedOn : "",
          result: typeof r.result === "string" ? r.result : "",
          notes: typeof r.notes === "string" ? r.notes.slice(0, 5000) : "",
        });
        restored.revisions++;
      }
    }

    // 9. Mock Tests
    const mocksList = Array.isArray(payload.mocks)
      ? payload.mocks
      : Array.isArray(payload.mockTests)
        ? payload.mockTests
        : [];

    for (const m of mocksList) {
      if (!m || !m.name || !isISODate(m.date)) continue;
      const type = m.type === "sectional" ? "sectional" : "full";
      await MockTest.create({
        userId,
        name: String(m.name).trim().slice(0, 200),
        date: m.date,
        type,
        testSection: type === "sectional" && ["VARC", "DILR", "Quant"].includes(m.testSection) ? m.testSection : "",
        score: Number.isFinite(Number(m.score)) ? Number(m.score) : undefined,
        percentile: Number.isFinite(Number(m.percentile)) ? Number(m.percentile) : undefined,
        attempts: Number.isFinite(Number(m.attempts)) ? Math.max(0, Math.floor(Number(m.attempts))) : undefined,
        varc: Number.isFinite(Number(m.varc)) ? Number(m.varc) : undefined,
        dilr: Number.isFinite(Number(m.dilr)) ? Number(m.dilr) : undefined,
        quant: Number.isFinite(Number(m.quant)) ? Number(m.quant) : undefined,
        sections: typeof m.sections === "object" && m.sections !== null ? m.sections : undefined,
        loss: typeof m.loss === "string" ? m.loss.slice(0, 5000) : "",
        action: typeof m.action === "string" ? m.action.slice(0, 5000) : "",
      });
      restored.mocks++;
    }

    return Response.json(
      {
        message: "Backup imported successfully",
        restored,
      },
      { status: 200 },
    );
  } catch (error) {
    return Response.json({ error: error.message || "Failed to restore backup" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    await connectDB();
    const userId = user._id;

    await Promise.all([
      TaskTracker.deleteMany({ userId }),
      DailyReflection.deleteMany({ userId }),
      WeeklyReview.deleteMany({ userId }),
      MonthlyReview.deleteMany({ userId }),
      Topic.deleteMany({ userId }),
      TopicSession.deleteMany({ userId }),
      SyllabusProgress.deleteMany({ userId }),
      Revision.deleteMany({ userId }),
      MockTest.deleteMany({ userId }),
    ]);

    return Response.json({ message: "All diary data deleted successfully" }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message || "Failed to clear diary data" }, { status: 500 });
  }
}
