"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/api-client";
import {
  localDateString,
  shiftISODate,
  haTaskQuestionStats,
  haPracticeSessions,
  calculateStreak,
  testScore,
  effectiveTestType,
} from "@/lib/dashboard-analytics";

export default function MiniDashboardBar() {
  const [tasks, setTasks] = useState([]);
  const [reflections, setReflections] = useState([]);
  const [topics, setTopics] = useState([]);
  const [mocks, setMocks] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);

  const todayStr = useMemo(() => localDateString(), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, reflectionsRes, topicsRes, mocksRes, sessionsRes, revisionsRes] =
        await Promise.all([
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
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activityDays = useMemo(() => {
    const days = new Set();
    tasks.forEach((t) => { if (t.status === "Done" && t.date) days.add(t.date); });
    reflections.forEach((r) => { if (Number(r.hours) > 0 && r.date) days.add(r.date); });
    sessions.forEach((s) => { if (s.date) days.add(s.date); });
    mocks.forEach((m) => { if (m.date) days.add(m.date); });
    revisions.forEach((r) => { if (r.completed && r.completedOn) days.add(r.completedOn); });
    return days;
  }, [mocks, reflections, revisions, sessions, tasks]);

  const streak = useMemo(() => calculateStreak(activityDays, todayStr), [activityDays, todayStr]);

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

  const reflectionsMap = useMemo(() => {
    const map = {};
    for (const r of reflections) { if (r.date) map[r.date] = r; }
    return map;
  }, [reflections]);

  const weekHours = useMemo(() => {
    return Object.entries(reflectionsMap)
      .filter(([d]) => d >= start7 && d <= todayStr)
      .reduce((sum, [, r]) => sum + Math.max(0, Number(r.hours) || 0), 0);
  }, [reflectionsMap, start7, todayStr]);

  const totalTopics = topics.length;
  const masteredTopics = useMemo(() => topics.filter((t) => t.status === "Mastered").length, [topics]);
  const masteryPct = totalTopics ? Math.round((masteredTopics / totalTopics) * 100) : null;

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
    return { delta, last };
  }, [fullMocks]);

  const items = [
    {
      icon: "🔥",
      label: "Streak",
      value: loading ? "…" : `${streak}d`,
      color: streak > 0 ? "#e85c1a" : "var(--diary-muted)",
      title: `${streak} day${streak !== 1 ? "s" : ""} current streak`,
    },
    {
      icon: "✅",
      label: "Tasks 7d",
      value: loading ? "…" : weekCompletionRate !== null ? `${weekCompletionRate}%` : "—",
      color: weekCompletionRate !== null && weekCompletionRate >= 70 ? "#16a34a" : weekCompletionRate !== null ? "#d97706" : "var(--diary-muted)",
      title: `${recent7Completed} of ${recent7Tasks.length} tasks done in last 7 days`,
    },
    {
      icon: "🎯",
      label: "Accuracy",
      value: loading ? "…" : questionStats.accuracy !== null ? `${questionStats.accuracy}%` : "—",
      color: questionStats.accuracy !== null && questionStats.accuracy >= 70 ? "#16a34a" : questionStats.accuracy !== null ? "#d97706" : "var(--diary-muted)",
      title: `${questionStats.correct} correct out of ${questionStats.attempted} questions`,
    },
    {
      icon: "⏱️",
      label: "Hours 7d",
      value: loading ? "…" : `${weekHours.toFixed(1)}h`,
      color: weekHours >= 5 ? "#5b4bc4" : "var(--diary-muted)",
      title: `${weekHours.toFixed(1)} focused hours in last 7 days`,
    },
    {
      icon: "📚",
      label: "Mastery",
      value: loading ? "…" : masteryPct !== null ? `${masteryPct}%` : "—",
      color: masteryPct !== null && masteryPct >= 50 ? "#0284c7" : "var(--diary-muted)",
      title: `${masteredTopics} of ${totalTopics} topics mastered`,
    },
    {
      icon: mockTrend && mockTrend.delta > 0 ? "📈" : mockTrend && mockTrend.delta < 0 ? "📉" : "📊",
      label: "Mock",
      value: loading ? "…" : mockTrend ? `${mockTrend.delta > 0 ? "+" : ""}${mockTrend.delta.toFixed(1)}` : "—",
      color: mockTrend ? (mockTrend.delta > 0 ? "#16a34a" : "#dc2626") : "var(--diary-muted)",
      title: mockTrend ? `Last mock: ${mockTrend.last} pts` : "Need 2+ full mocks",
    },
  ];

  return (
    <div className="mini-dash-bar" role="region" aria-label="Live performance snapshot">
      <div className="mini-dash-inner">
        {items.map((item) => (
          <div key={item.label} className="mini-dash-item" title={item.title}>
            <span className="mini-dash-icon" aria-hidden="true">{item.icon}</span>
            <div className="mini-dash-text">
              <span className="mini-dash-label">{item.label}</span>
              <span className="mini-dash-value" style={{ color: item.color }}>
                {item.value}
              </span>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="mini-dash-refresh"
          onClick={loadData}
          disabled={loading}
          title="Refresh stats"
          aria-label="Refresh dashboard stats"
        >
          {loading ? "⟳" : "↻"}
        </button>
      </div>
    </div>
  );
}
