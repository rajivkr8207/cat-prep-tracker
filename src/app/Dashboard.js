"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/api-client";
import {
  localDateString,
  shiftISODate,
  formatDate,
  haTaskQuestionStats,
  haPracticeSessions,
  calculateStreak,
  getTodayThought,
  getAdviceOptions,
  testScore,
  effectiveTestType,
} from "@/lib/dashboard-analytics";

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [reflections, setReflections] = useState([]);
  const [topics, setTopics] = useState([]);
  const [mocks, setMocks] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adviceIndex, setAdviceIndex] = useState(0);

  const todayStr = useMemo(() => localDateString(), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        tasksRes,
        reflectionsRes,
        topicsRes,
        mocksRes,
        sessionsRes,
        revisionsRes,
      ] = await Promise.all([
        requestJson("/api/preparation/tasks?limit=500"),
        requestJson("/api/preparation/reflections"),
        requestJson("/api/preparation/topics"),
        requestJson("/api/preparation/mock-tests"),
        requestJson("/api/preparation/topic-sessions?limit=500"),
        requestJson("/api/preparation/revisions"),
      ]);

      setTasks(tasksRes.tasks || []);
      setReflections(reflectionsRes.reflections || []);
      setTopics(topicsRes.topics || []);
      setMocks(mocksRes.mockTests || []);
      setSessions(sessionsRes.sessions || []);
      setRevisions(revisionsRes.revisions || []);
    } catch (err) {
      setError(err.message || "Could not load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reflections map by date
  const reflectionsMap = useMemo(() => {
    const map = {};
    for (const r of reflections) {
      if (r.date) map[r.date] = r;
    }
    return map;
  }, [reflections]);

  // Overall Task Completion
  const totalTasks = tasks.length;
  const completedTasks = useMemo(
    () => tasks.filter((t) => t.status === "Done").length,
    [tasks],
  );
  const overallCompletion = totalTasks
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  // Last 7 Days Activity
  const start7 = useMemo(() => shiftISODate(todayStr, -6), [todayStr]);
  const recent7Tasks = useMemo(
    () => tasks.filter((t) => t.date >= start7 && t.date <= todayStr),
    [start7, tasks, todayStr],
  );
  const recent7Completed = useMemo(
    () => recent7Tasks.filter((t) => t.status === "Done").length,
    [recent7Tasks],
  );
  const weekCompletionRate = recent7Tasks.length
    ? Math.round((recent7Completed / recent7Tasks.length) * 100)
    : null;

  // Focused Study Hours
  const totalHours = useMemo(
    () =>
      reflections.reduce(
        (sum, r) => sum + Math.max(0, Number(r.hours) || 0),
        0,
      ),
    [reflections],
  );

  const weekHours = useMemo(() => {
    return Object.entries(reflectionsMap)
      .filter(([d]) => d >= start7 && d <= todayStr)
      .reduce((sum, [, r]) => sum + Math.max(0, Number(r.hours) || 0), 0);
  }, [reflectionsMap, start7, todayStr]);

  // Study Streak
  const activityDays = useMemo(() => {
    const days = new Set();
    tasks.forEach((t) => {
      if (t.status === "Done" && t.date) days.add(t.date);
    });
    reflections.forEach((r) => {
      if (Number(r.hours) > 0 && r.date) days.add(r.date);
    });
    sessions.forEach((s) => {
      if (s.date) days.add(s.date);
    });
    mocks.forEach((m) => {
      if (m.date) days.add(m.date);
    });
    revisions.forEach((r) => {
      if (r.completed && r.completedOn) days.add(r.completedOn);
    });
    return days;
  }, [mocks, reflections, revisions, sessions, tasks]);

  const streak = useMemo(
    () => calculateStreak(activityDays, todayStr),
    [activityDays, todayStr],
  );

  // Question Attempts & Accuracy
  const questionStats = useMemo(() => {
    const taskStats = haTaskQuestionStats(tasks);
    const independentSessions = haPracticeSessions(sessions, tasks);
    const sessionStats = independentSessions.reduce(
      (acc, s) => {
        const attempted = Math.max(0, Number(s.attempted) || 0);
        const correct = Math.max(0, Number(s.correct) || 0);
        acc.attempted += attempted;
        acc.correct += Math.min(correct, attempted);
        return acc;
      },
      { attempted: 0, correct: 0 },
    );

    const attempted = taskStats.attempted + sessionStats.attempted;
    const correct = taskStats.correct + sessionStats.correct;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : null;
    return { attempted, correct, accuracy };
  }, [sessions, tasks]);

  // Topic Mastery
  const totalTopics = topics.length;
  const masteredTopics = useMemo(
    () => topics.filter((t) => t.status === "Mastered").length,
    [topics],
  );
  const masteryPercentage = totalTopics
    ? Math.round((masteredTopics / totalTopics) * 100)
    : 0;

  // Mock Test Trends
  const fullMocks = useMemo(() => {
    return mocks
      .filter((m) => effectiveTestType(m) === "full" && testScore(m, null) !== null)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }, [mocks]);

  const mockTrend = useMemo(() => {
    if (fullMocks.length < 2) return null;
    const prev = Number(testScore(fullMocks[fullMocks.length - 2], null));
    const last = Number(testScore(fullMocks[fullMocks.length - 1], null));
    const delta = last - prev;
    return {
      delta,
      prev,
      last,
      direction: delta > 0 ? "trend-up" : delta < 0 ? "trend-down" : "",
    };
  }, [fullMocks]);


  // Daily thought & advice
  const todayThought = useMemo(() => getTodayThought(todayStr), [todayStr]);
  const adviceList = useMemo(
    () =>
      getAdviceOptions({
        revisions,
        tasks,
        attempted: questionStats.attempted,
        correct: questionStats.correct,
        topics,
        currentDate: todayStr,
        todayStr,
      }),
    [questionStats.attempted, questionStats.correct, revisions, tasks, todayStr, topics],
  );

  const currentAdvice = adviceList[adviceIndex % adviceList.length];


  return (
    <div className="dashboard-view" style={{ display: "grid", gap: "16px" }}>
      {/* Top Banner Stats */}
      <section className="diary-stats" aria-label="Quick statistics">
        <div className="diary-stat">
          <small>Total tasks</small>
          <strong>{totalTasks}</strong>
        </div>
        <div className="diary-stat">
          <small>Completed tasks</small>
          <strong>{completedTasks}</strong>
        </div>
        <div className="diary-stat">
          <small>Overall completion</small>
          <strong>{overallCompletion}%</strong>
        </div>
        <div className="diary-stat">
          <small>Focused hours</small>
          <strong>{totalHours.toFixed(1)}</strong>
        </div>
      </section>

      {/* Performance Dashboard Card */}
      <section className="diary-panel" id="performanceDashboard">
        <div className="diary-topbar">
          <div>
            <h2>🎯 Your performance dashboard</h2>
            <span className="diary-muted diary-small">Calculated from your saved work</span>
          </div>
          <button type="button" onClick={loadData} disabled={loading}>
            {loading ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>

        {notice ? <div className="diary-notice diary-small" style={{ marginBottom: "10px", color: "#166534" }}>{notice}</div> : null}
        {error ? <div className="diary-notice diary-small" style={{ marginBottom: "10px", color: "#991b1b" }}>{error}</div> : null}

        <div className="performance-grid">
          <div className="perf-card streak">
            <small>🔥 Current study streak</small>
            <strong id="streakCount">{streak} {streak === 1 ? "day" : "days"}</strong>
            <div className="sub" id="streakNote">
              {streak ? "Keep it going with one meaningful study action." : "No current streak. Start with one completed task or log focused time today."}
            </div>
          </div>

          <div className="perf-card">
            <small>Tasks completed (last 7 days)</small>
            <strong id="weekCompletion">{weekCompletionRate !== null ? `${weekCompletionRate}%` : "—"}</strong>
            <div className="sub" id="weekCompletionNote">
              {recent7Tasks.length ? `${recent7Completed} of ${recent7Tasks.length} tasks marked done` : "Add tasks to establish a baseline."}
            </div>
          </div>

          <div className="perf-card">
            <small>Question accuracy</small>
            <strong id="overallAccuracy">{questionStats.accuracy !== null ? `${questionStats.accuracy}%` : "—"}</strong>
            <div className="sub" id="accuracyNote">
              {questionStats.attempted ? `${questionStats.correct} correct out of ${questionStats.attempted} questions` : "Enter attempts and correct answers on tasks."}
            </div>
          </div>

          <div className="perf-card">
            <small>Focused hours (last 7 days)</small>
            <strong id="weekHours">{weekHours.toFixed(1)}</strong>
            <div className="sub">Use actual focused time, not library attendance.</div>
          </div>

          <div className="perf-card">
            <small>Topic mastery</small>
            <strong id="masteryProgress">{masteryPercentage}%</strong>
            <div className="sub" id="masteryNote">
              {totalTopics ? `${masteredTopics} of ${totalTopics} topics marked mastered` : "Add topics in Topic mastery."}
            </div>
          </div>

          <div className="perf-card">
            <small>Mock trend</small>
            <strong id="mockTrend" className={mockTrend?.direction || ""}>
              {mockTrend ? `${mockTrend.delta > 0 ? "+" : ""}${mockTrend.delta.toFixed(1)}` : "—"}
            </strong>
            <div className="sub" id="mockTrendNote">
              {mockTrend ? `Latest ${mockTrend.last} vs previous ${mockTrend.prev} points` : "Enter at least two mock scores to compare."}
            </div>
          </div>
        </div>

        {/* Daily Motivation Thought Card */}
        <div className="motivation-card" style={{ marginTop: "14px" }}>
          <div className="diary-small" style={{ fontWeight: 750, color: "#a33c83", marginBottom: "6px" }}>
            💡 TODAY&apos;S THOUGHT · <span id="motivationDate">{formatDate(todayThought.date)}</span>
          </div>
          <div className="quote" id="dailyMotivation">&ldquo;{todayThought.quote}&rdquo;</div>
          <p id="motivationAction" className="diary-small" style={{ marginBottom: 0, color: "#5d5478" }}>
            {todayThought.action}
          </p>
        </div>

        {/* Next Best Step Advice */}
        <div style={{ marginTop: "14px" }}>
          <div className="diary-topbar">
            <h3 style={{ fontSize: "16px", margin: 0 }}>Your next best step</h3>
            <button
              type="button"
              id="dashboardAdviceBtn"
              onClick={() => setAdviceIndex((i) => i + 1)}
            >
              Refresh advice
            </button>
          </div>
          <div id="dashboardAdvice" className="diary-notice diary-small" style={{ marginTop: "8px" }}>
            {currentAdvice}
          </div>
        </div>
      </section>
    </div>
  );
}
