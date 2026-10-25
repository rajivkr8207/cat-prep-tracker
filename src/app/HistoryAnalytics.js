"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/api-client";
import {
  localDateString,
  shiftISODate,
  formatDate,
  haDate,
  haWithin,
  haTaskQuestionStats,
  haPracticeSessions,
  testScore,
  effectiveTestType,
} from "@/lib/dashboard-analytics";

export default function HistoryAnalytics({ onOpenDate }) {
  const [tasks, setTasks] = useState([]);
  const [reflections, setReflections] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [mocks, setMocks] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [syllabus, setSyllabus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const todayStr = useMemo(() => localDateString(), []);

  // Filter States
  const [from, setFrom] = useState(() => shiftISODate(localDateString(), -29));
  const [to, setTo] = useState(() => localDateString());
  const [isAllTime, setIsAllTime] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadAllHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        tasksRes,
        reflectionsRes,
        sessionsRes,
        mocksRes,
        revisionsRes,
        syllabusRes,
      ] = await Promise.all([
        requestJson("/api/preparation/tasks?limit=500"),
        requestJson("/api/preparation/reflections"),
        requestJson("/api/preparation/topic-sessions?limit=500"),
        requestJson("/api/preparation/mock-tests"),
        requestJson("/api/preparation/revisions"),
        requestJson("/api/preparation/syllabus"),
      ]);

      setTasks(tasksRes.tasks || []);
      setReflections(reflectionsRes.reflections || []);
      setSessions(sessionsRes.sessions || []);
      setMocks(mocksRes.mockTests || []);
      setRevisions(revisionsRes.revisions || []);
      setSyllabus(syllabusRes.progress || []);
    } catch (err) {
      setError(err.message || "Failed to load history & analytics data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllHistory();
  }, [loadAllHistory]);

  // Date Filter Presets
  function setLast7Days() {
    setIsAllTime(false);
    setFrom(shiftISODate(todayStr, -6));
    setTo(todayStr);
  }

  function setLast30Days() {
    setIsAllTime(false);
    setFrom(shiftISODate(todayStr, -29));
    setTo(todayStr);
  }

  function setAllTimeRange() {
    setIsAllTime(true);
    setFrom("");
    setTo(todayStr);
  }

  function resetFilters() {
    setIsAllTime(false);
    setFrom(shiftISODate(todayStr, -29));
    setTo(todayStr);
    setSearchQuery("");
  }

  // Active Filter Predicate
  const dateMatches = useCallback(
    (d) => {
      if (isAllTime) {
        return !to || haWithin(d, "", to);
      }
      return haWithin(d, from, to);
    },
    [from, isAllTime, to],
  );

  // Period Filtered Datasets
  const periodTasks = useMemo(() => tasks.filter((t) => dateMatches(t.date)), [dateMatches, tasks]);
  const periodSessions = useMemo(() => sessions.filter((s) => dateMatches(s.date)), [dateMatches, sessions]);
  const periodMocks = useMemo(() => mocks.filter((m) => dateMatches(m.date)), [dateMatches, mocks]);
  const periodRevisions = useMemo(
    () => revisions.filter((r) => r.completed === true && dateMatches(r.completedOn)),
    [dateMatches, revisions],
  );

  const reflectionsMap = useMemo(() => {
    const map = {};
    for (const r of reflections) {
      if (r.date) map[r.date] = r;
    }
    return map;
  }, [reflections]);

  const refEntries = useMemo(
    () => Object.entries(reflectionsMap).filter(([d]) => dateMatches(d)),
    [dateMatches, reflectionsMap],
  );

  // 1. KPI: Total Focused Hours
  const totalHours = useMemo(
    () => refEntries.reduce((sum, [, r]) => sum + Math.max(0, Number(r.hours) || 0), 0),
    [refEntries],
  );
  const daysWithHours = useMemo(
    () => refEntries.filter(([, r]) => Number(r.hours) > 0).length,
    [refEntries],
  );

  // 2. KPI: Active Study Days
  const activityDays = useMemo(() => {
    const days = new Set();
    periodTasks.forEach((t) => {
      if (t.status === "Done" && t.date) days.add(haDate(t.date));
    });
    refEntries.forEach(([d, r]) => {
      if (Number(r.hours) > 0) days.add(haDate(d));
    });
    periodSessions.forEach((s) => {
      if (s.date) days.add(haDate(s.date));
    });
    periodMocks.forEach((m) => {
      if (m.date) days.add(haDate(m.date));
    });
    periodRevisions.forEach((r) => {
      if (r.completedOn) days.add(haDate(r.completedOn));
    });
    return days;
  }, [periodMocks, periodRevisions, periodSessions, periodTasks, refEntries]);

  // 3. KPI: Tasks Completed
  const taskDone = useMemo(
    () => periodTasks.filter((t) => t.status === "Done").length,
    [periodTasks],
  );
  const taskCompletionRate = periodTasks.length
    ? Math.round((taskDone / periodTasks.length) * 100)
    : null;

  // 4. KPI: Questions Attempted & Accuracy
  const taskAttempt = useMemo(() => haTaskQuestionStats(periodTasks), [periodTasks]);
  const independentSessions = useMemo(
    () => haPracticeSessions(periodSessions, periodTasks),
    [periodSessions, periodTasks],
  );
  const sessionAttempt = useMemo(() => {
    return independentSessions.reduce(
      (a, s) => {
        const att = Math.max(0, Number(s.attempted) || 0);
        const cor = Math.max(0, Number(s.correct) || 0);
        a.attempted += att;
        a.correct += Math.min(cor, att);
        return a;
      },
      { attempted: 0, correct: 0 },
    );
  }, [independentSessions]);

  const qAttempt = taskAttempt.attempted + sessionAttempt.attempted;
  const qCorrect = taskAttempt.correct + sessionAttempt.correct;
  const qAccuracy = qAttempt > 0 ? Math.round((qCorrect / qAttempt) * 100) : null;

  // 5. KPI: Mocks
  const fullMocks = useMemo(
    () =>
      periodMocks
        .filter((m) => effectiveTestType(m) === "full")
        .sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    [periodMocks],
  );

  const sectionalsBySec = useCallback(
    (sec) =>
      periodMocks
        .filter((m) => effectiveTestType(m) === "sectional" && (m.testSection || "VARC") === sec)
        .sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    [periodMocks],
  );

  // Daily Consistency Chart (last 14 days of the selected period or bounded by from/to)
  const consistencyChartData = useMemo(() => {
    const chartEndRaw = to && to < todayStr ? to : todayStr;
    const defaultStart = shiftISODate(chartEndRaw, -13);
    const chartStartRaw = from && from > defaultStart ? from : defaultStart;

    const days = [];
    let cur = chartStartRaw;
    while (cur <= chartEndRaw && days.length <= 31) {
      days.push(cur);
      cur = shiftISODate(cur, 1);
    }

    const items = days.map((d) => ({
      date: d,
      hours: Math.max(0, Number(reflectionsMap[d]?.hours) || 0),
    }));
    const maxVal = Math.max(1, ...items.map((x) => x.hours));
    const hasHours = items.some((x) => x.hours > 0);
    return { items, maxVal, hasHours };
  }, [from, reflectionsMap, to, todayStr]);

  // Section-wise Practice Table
  const sectionPracticeRows = useMemo(() => {
    return ["VARC", "DILR", "Quant"].map((sec) => {
      const st = periodTasks.filter((t) => t.section === sec);
      const ss = independentSessions.filter((s) => s.section === sec);
      const a = haTaskQuestionStats(st);
      const extra = ss.reduce(
        (v, s) => ({
          attempted: v.attempted + Math.max(0, Number(s.attempted) || 0),
          correct: v.correct + Math.min(Math.max(0, Number(s.correct) || 0), Math.max(0, Number(s.attempted) || 0)),
        }),
        { attempted: 0, correct: 0 },
      );
      const attempted = a.attempted + extra.attempted;
      const correct = a.correct + extra.correct;
      const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : null;
      return { sec, attempted, correct, accuracy };
    });
  }, [independentSessions, periodTasks]);

  // Mock Performance Insight
  const mockInsightText = useMemo(() => {
    if (fullMocks.length < 2) {
      return "Log at least two full mocks with overall scores to compare change. Sectional scores are never mixed into the full-mock chart.";
    }
    const scored = fullMocks.filter((m) => testScore(m, null) !== null);
    if (scored.length < 2) {
      return "Full mocks are kept separate from sectionals; enter at least two overall scores to compare a trend.";
    }
    const first = scored[0];
    const last = scored[scored.length - 1];
    return `Full mocks only: score ${testScore(first, null)} on ${formatDate(first.date)} → ${testScore(last, null)} on ${formatDate(last.date)}. Review the errors and test conditions before judging the trend.`;
  }, [fullMocks]);

  // Topics to Revisit (Syllabus covered 14+ days ago + due/overdue revisions)
  const revisitList = useMemo(() => {
    const overdueTopics = [];
    for (const item of syllabus) {
      const last = haDate(item.lastCoveredDate);
      if (!last || item.status === "Not started") continue;
      const [y, m, d] = last.split("-").map(Number);
      const lastDate = new Date(Date.UTC(y, m - 1, d, 12));
      const [cy, cm, cd] = todayStr.split("-").map(Number);
      const currentDate = new Date(Date.UTC(cy, cm - 1, cd, 12));
      const age = Math.floor((currentDate - lastDate) / 86400000);
      if (age >= 14) {
        overdueTopics.push({
          name: item.topicName,
          date: last,
          age,
          status: item.status || "Covered once",
          section: item.subject,
          type: "syllabus",
        });
      }
    }

    const dueRevisions = revisions
      .filter((r) => r.completed !== true && r.date && r.date <= todayStr)
      .map((r) => {
        const d = haDate(r.date);
        const [y, m, day] = d.split("-").map(Number);
        const [cy, cm, cday] = todayStr.split("-").map(Number);
        const rDate = new Date(Date.UTC(y, m - 1, day, 12));
        const cDate = new Date(Date.UTC(cy, cm - 1, cday, 12));
        const age = Math.max(0, Math.floor((cDate - rDate) / 86400000));
        return {
          name: r.title || "Untitled revision",
          date: d,
          age,
          status: r.date < todayStr ? "Revision overdue" : "Due today",
          section: r.section,
          type: "revision",
        };
      });

    return [...dueRevisions, ...overdueTopics]
      .sort((a, b) => (b.age || 0) - (a.age || 0))
      .slice(0, 10);
  }, [revisions, syllabus, todayStr]);

  // What Your Data Says: Simple, factual insights
  const insights = useMemo(() => {
    const list = [];
    if (!periodTasks.length) {
      list.push(
        tasks.length
          ? "No daily tasks fall within this selected date range. Widen the range to compare task completion."
          : "No daily tasks recorded yet. Once you log tasks and mark their real status, task-completion trends will appear.",
      );
    } else {
      list.push(
        `Task completion in this date range is ${Math.round((taskDone / periodTasks.length) * 100)}% (${taskDone}/${periodTasks.length}). This measures plan execution, not learning quality.`,
      );
    }

    if (qAttempt) {
      list.push(
        `Recorded question accuracy is ${Math.round((qCorrect / qAttempt) * 100)}% across ${qAttempt} attempts. Use it with error analysis; accuracy alone does not show question difficulty.`,
      );
    } else {
      list.push(
        "Question accuracy is unavailable for this date range because no attempted/correct counts have been recorded.",
      );
    }

    if (totalHours === 0) {
      list.push(
        "No focused hours are logged in daily reflections for this range. This means “not recorded”, not necessarily “did not study”.",
      );
    }

    const scoredFull = fullMocks.filter((m) => testScore(m, null) !== null);
    if (scoredFull.length < 2) {
      list.push(
        "Mock improvement cannot be judged from fewer than two full mocks with overall scores. Sectionals remain separate.",
      );
    } else {
      const first = scoredFull[0];
      const last = scoredFull[scoredFull.length - 1];
      list.push(
        `Full-mock score changed from ${testScore(first, null)} to ${testScore(last, null)} across the recorded range. Compare mistake patterns and test conditions too.`,
      );
    }

    const latestBySection = ["VARC", "DILR", "Quant"]
      .map((sec) => ({
        sec,
        last: periodSessions
          .filter((s) => s.section === sec)
          .map((s) => haDate(s.date))
          .filter(Boolean)
          .sort()
          .pop(),
      }))
      .filter((x) => x.last);

    if (latestBySection.length) {
      list.push(
        "Most recent Topic Dashboard practice recorded: " +
          latestBySection.map((x) => `${x.sec} ${formatDate(x.last)}`).join(" · ") +
          ".",
      );
    }

    return list;
  }, [fullMocks, periodSessions, periodTasks, qAttempt, qCorrect, taskDone, tasks.length, totalHours]);

  // Day-by-Day Activity Table Rows
  const dayRows = useMemo(() => {
    const allDates = new Set();
    tasks.forEach((t) => {
      if (dateMatches(t.date)) allDates.add(haDate(t.date));
    });
    Object.keys(reflectionsMap).forEach((d) => {
      if (dateMatches(d)) allDates.add(haDate(d));
    });
    sessions.forEach((s) => {
      if (dateMatches(s.date)) allDates.add(haDate(s.date));
    });
    mocks.forEach((m) => {
      if (dateMatches(m.date)) allDates.add(haDate(m.date));
    });
    revisions.forEach((r) => {
      if (r.completed === true && dateMatches(r.completedOn)) allDates.add(haDate(r.completedOn));
    });

    const query = searchQuery.trim().toLowerCase();

    let rows = [...allDates]
      .filter(Boolean)
      .sort()
      .reverse()
      .map((d) => {
        const dt = tasks.filter((t) => haDate(t.date) === d);
        const ds = sessions.filter((s) => haDate(s.date) === d);
        const dm = mocks.filter((m) => haDate(m.date) === d);
        const dr = revisions.filter((r) => r.completed === true && haDate(r.completedOn) === d);
        const reflection = reflectionsMap[d] || {};
        const hour = Number(reflection.hours) || 0;
        const done = dt.filter((t) => t.status === "Done").length;

        const qs = haTaskQuestionStats(dt);
        const extra = haPracticeSessions(ds, dt).reduce(
          (a, s) => ({
            attempted: a.attempted + Math.max(0, Number(s.attempted) || 0),
            correct: a.correct + Math.min(Math.max(0, Number(s.correct) || 0), Math.max(0, Number(s.attempted) || 0)),
          }),
          { attempted: 0, correct: 0 },
        );
        const attempted = qs.attempted + extra.attempted;

        const detailText = [
          ...dt.map((t) => `${t.section || "Task"}: ${t.title || "Untitled"} (${t.status || "Not started"})`),
          ...ds.map((s) => `Practice: ${s.topic || "Untitled"} · ${s.section || ""} · ${Number(s.attempted) || 0} attempted`),
          ...dm.map((m) => {
            const typ = effectiveTestType(m);
            const sc = testScore(m, typ === "full" ? null : m.testSection);
            return `${typ === "full" ? "Full mock" : "Sectional " + (m.testSection || "")}: ${m.name || "Mock"}${sc !== null ? ` · score ${sc}` : ""}`;
          }),
          ...dr.map((r) => `Revision completed: ${r.title || "Untitled revision"}`),
        ];

        if (reflection.win) detailText.push(`Win: ${reflection.win}`);
        if (reflection.weak) detailText.push(`Needs work: ${reflection.weak}`);
        if (reflection.actual) detailText.push(`Actual study: ${reflection.actual}`);

        const hay = [d, formatDate(d), ...detailText].join(" ").toLowerCase();
        return {
          date: d,
          hour,
          tasks: dt,
          done,
          attempted,
          sessions: ds,
          mocks: dm,
          revisions: dr,
          detailText,
          hay,
        };
      });

    if (query) {
      rows = rows.filter((r) => r.hay.includes(query));
    }

    return rows;
  }, [dateMatches, mocks, reflectionsMap, revisions, searchQuery, sessions, tasks]);

  // Render mock mini bar charts
  function renderMockBars(items, fillClass) {
    if (!items.length) {
      return <div className="empty">No scores recorded yet.</div>;
    }
    const vals = items.map((m) => ({
      label: formatDate(m.date),
      value: Number(testScore(m, effectiveTestType(m) === "full" ? null : m.testSection)) || 0,
      name: m.name || "",
    }));
    const maxVal = Math.max(1, ...vals.map((x) => x.value));
    return (
      <div className="ha-bars">
        {vals.map((x, i) => (
          <div className="ha-bar-row" key={`${x.label}_${i}`}>
            <span className="ha-bar-label" title={x.name || x.label}>{x.label}</span>
            <div className="ha-bar-track">
              <div
                className={`ha-bar-fill ${fillClass}`}
                style={{ width: `${Math.max(0, Math.min(100, (x.value / maxVal) * 100))}%` }}
              />
            </div>
            <span className="ha-bar-value">{x.value}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section id="view-history" className="panel history-analytics">
      {/* Hero Header */}
      <div className="ha-hero">
        <div>
          <p className="ha-kicker">YOUR CAT 2027 JOURNEY</p>
          <h2>History &amp; Analytics</h2>
          <p className="muted">
            A truthful view of your study habits, practice, revisions and mock performance—based only on data you have recorded.
          </p>
        </div>
        <button type="button" className="secondary" onClick={resetFilters}>
          Reset date filters
        </button>
      </div>

      {error ? <div className="diary-notice diary-small" style={{ marginBottom: "14px", color: "#991b1b" }}>{error}</div> : null}

      {/* Filter Bar */}
      <div className="ha-filterbar">
        <label>
          From date
          <input
            type="date"
            lang="en-GB"
            value={from}
            onChange={(e) => {
              setIsAllTime(false);
              setFrom(e.target.value);
            }}
          />
        </label>
        <label>
          To date
          <input
            type="date"
            lang="en-GB"
            value={to}
            onChange={(e) => {
              setIsAllTime(false);
              setTo(e.target.value);
            }}
          />
        </label>
        <label className="ha-search-label">
          Search history
          <input
            type="search"
            placeholder="Topic, task, mock, note…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
      </div>

      {/* Preset Buttons */}
      <div className="formactions ha-range-presets" aria-label="Quick history date ranges" style={{ display: "flex", gap: "8px", margin: "10px 0" }}>
        <button type="button" className={`tab ${!isAllTime && from === shiftISODate(todayStr, -6) ? "active" : ""}`} onClick={setLast7Days}>
          Last 7 days
        </button>
        <button type="button" className={`tab ${!isAllTime && from === shiftISODate(todayStr, -29) ? "active" : ""}`} onClick={setLast30Days}>
          Last 30 days
        </button>
        <button type="button" className={`tab ${isAllTime ? "active" : ""}`} onClick={setAllTimeRange}>
          All-Time
        </button>
      </div>

      <p className="ha-hint">
        Choose All-Time to include every recorded date. You can still set a custom date range above. Dates use DD/MM/YYYY.
      </p>

      {/* KPI Grid */}
      <div className="ha-kpi-grid">
        <article className="ha-kpi ha-kpi-purple">
          <span>Focused hours logged</span>
          <strong id="haHours">{totalHours.toFixed(1)}</strong>
          <small id="haHoursNote">{daysWithHours} days with hours logged</small>
        </article>

        <article className="ha-kpi ha-kpi-blue">
          <span>Active study days</span>
          <strong id="haDays">{activityDays.size}</strong>
          <small id="haDaysNote">{from && to ? `${formatDate(from)} — ${formatDate(to)}` : "All recorded dates"}</small>
        </article>

        <article className="ha-kpi ha-kpi-green">
          <span>Tasks completed</span>
          <strong id="haCompletion">{taskCompletionRate !== null ? `${taskCompletionRate}%` : "—"}</strong>
          <small id="haCompletionNote">{taskDone} of {periodTasks.length} tasks marked done</small>
        </article>

        <article className="ha-kpi ha-kpi-pink">
          <span>Questions attempted</span>
          <strong id="haQuestions">{qAttempt}</strong>
          <small id="haAccuracyNote">
            {qAttempt ? `${qAccuracy}% recorded accuracy · ${qCorrect} correct` : "No question attempts logged"}
          </small>
        </article>

        <article className="ha-kpi ha-kpi-orange">
          <span>Practice sessions</span>
          <strong id="haSessions">{periodSessions.length}</strong>
          <small id="haSessionNote">{independentSessions.length} additional, non-duplicate sessions</small>
        </article>

        <article className="ha-kpi ha-kpi-indigo">
          <span>Mocks logged</span>
          <strong id="haMocks">{periodMocks.length}</strong>
          <small id="haMocksNote">
            {fullMocks.length} full · {sectionalsBySec("VARC").length + sectionalsBySec("DILR").length + sectionalsBySec("Quant").length} sectional
          </small>
        </article>
      </div>

      {/* Two Column: Consistency & Section Practice */}
      <div className="ha-two-col">
        {/* Study Consistency Chart */}
        <section className="ha-card">
          <div className="ha-card-heading">
            <div>
              <h3>Study consistency</h3>
              <p className="muted">Recorded focused hours per day</p>
            </div>
            <span className="ha-mini-badge">Daily</span>
          </div>

          <div className="ha-bars">
            {consistencyChartData.hasHours ? (
              consistencyChartData.items.map((x) => (
                <div className="ha-bar-row" key={x.date}>
                  <span className="ha-bar-label" title={x.date}>{formatDate(x.date)}</span>
                  <div className="ha-bar-track">
                    <div
                      className="ha-bar-fill ha-hours-fill"
                      style={{
                        width: `${Math.max(0, Math.min(100, (x.hours / consistencyChartData.maxVal) * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="ha-bar-value">{x.hours.toFixed(1)}h</span>
                </div>
              ))
            ) : (
              <div className="empty">No recorded focused hours for this date range yet.</div>
            )}
          </div>

          <p className="ha-footnote">
            {activityDays.size} active days in the selected range (completed tasks, practice, mocks, completed revisions, or positive logged hours); {daysWithHours} days have focused hours explicitly recorded.
          </p>
        </section>

        {/* Section-wise Practice Table */}
        <section className="ha-card">
          <div className="ha-card-heading">
            <div>
              <h3>Section-wise practice</h3>
              <p className="muted">From task logs plus non-duplicate Topic Dashboard sessions</p>
            </div>
          </div>

          <table className="ha-practice-table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Attempted</th>
                <th>Correct</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {sectionPracticeRows.map((r) => (
                <tr key={r.sec}>
                  <td><strong>{r.sec}</strong></td>
                  <td>{r.attempted}</td>
                  <td>{r.correct}</td>
                  <td>
                    {r.accuracy !== null ? `${r.accuracy}%` : "—"}
                    {r.attempted > 0 ? (
                      <div className="ha-accuracy-track">
                        <span style={{ width: `${Math.min(100, r.accuracy || 0)}%` }} />
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ha-footnote">Task-linked Topic Dashboard sessions are not counted twice. Unrecorded results are excluded.</p>
        </section>
      </div>

      {/* Mock Performance 4-Grid */}
      <section className="ha-card">
        <div className="ha-card-heading">
          <div>
            <h3>Mock performance</h3>
            <p className="muted">Full-length mocks are shown separately from sectionals. Only entered scores are plotted.</p>
          </div>
        </div>

        <div className="ha-mock-grid">
          <div>
            <h4>Full-length mocks</h4>
            {renderMockBars(fullMocks.slice(-8), "ha-full-fill")}
          </div>
          <div>
            <h4>Sectional mocks · VARC</h4>
            {renderMockBars(sectionalsBySec("VARC").slice(-8), "ha-varc-fill")}
          </div>
          <div>
            <h4>Sectional mocks · DILR</h4>
            {renderMockBars(sectionalsBySec("DILR").slice(-8), "ha-dilr-fill")}
          </div>
          <div>
            <h4>Sectional mocks · Quant</h4>
            {renderMockBars(sectionalsBySec("Quant").slice(-8), "ha-quant-fill")}
          </div>
        </div>

        <p className="ha-footnote">{mockInsightText}</p>
      </section>

      {/* Two-Column: Topics to Revisit & What Data Says */}
      <div className="ha-two-col">
        <section className="ha-card">
          <div className="ha-card-heading">
            <div>
              <h3>Topics to revisit</h3>
              <p className="muted">Syllabus topics last covered 14+ days ago, plus items marked for revision.</p>
            </div>
          </div>

          <div className="ha-revisit-list">
            {revisitList.length ? (
              revisitList.map((x, i) => (
                <div className="ha-revisit-item" key={`${x.name}_${i}`}>
                  <div>
                    <strong>{x.name}</strong>
                    <small>
                      {x.section || x.status || "Syllabus"} · {x.type === "revision" ? "Revision date" : "Last covered"}: {formatDate(x.date)}
                      {x.status && x.type === "syllabus" ? ` · ${x.status}` : ""}
                    </small>
                  </div>
                  <span className={`ha-due ${x.age < 14 ? "ha-due-soon" : ""}`}>
                    {x.age === 0 ? "Today" : `${x.age}d ago`}
                  </span>
                </div>
              ))
            ) : (
              <div className="empty">
                Nothing overdue is recorded. Keep your syllabus last-covered dates and revision queue updated to see reminders here.
              </div>
            )}
          </div>
        </section>

        <section className="ha-card">
          <div className="ha-card-heading">
            <div>
              <h3>What your data says</h3>
              <p className="muted">Simple observations, not guesses.</p>
            </div>
          </div>

          <div className="ha-insights">
            {insights.map((text, i) => (
              <div className="ha-insight-item" key={i}>
                {text}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Day-by-Day Activity Table */}
      <section className="ha-card ha-history-card">
        <div className="ha-card-heading">
          <div>
            <h3>Day-by-day history</h3>
            <p className="muted">
              Includes days with tasks, reflections, practice sessions or mock tests—even if you did not add a daily task.
            </p>
          </div>
          <span className="ha-mini-badge" id="haRowsCount">
            {dayRows.length} {dayRows.length === 1 ? "day" : "days"}
          </span>
        </div>

        <div className="tablewrap">
          <table className="ha-history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Focused hours</th>
                <th>Tasks done</th>
                <th>Questions attempted</th>
                <th>Practice sessions</th>
                <th>Mocks</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {dayRows.length ? (
                dayRows.map((r) => (
                  <tr key={r.date}>
                    <td><strong>{formatDate(r.date)}</strong></td>
                    <td>{r.hour > 0 ? `${r.hour.toFixed(1)} h` : "—"}</td>
                    <td>{r.tasks.length ? `${r.done}/${r.tasks.length}` : "—"}</td>
                    <td>{r.attempted || (r.attempted === 0 && r.sessions.length) ? r.attempted : "—"}</td>
                    <td>{r.sessions.length || "—"}</td>
                    <td>{r.mocks.length || "—"}</td>
                    <td className="ha-day-details">
                      <details>
                        <summary className="ha-detail-summary">
                          View {r.detailText.length || 0} details
                        </summary>
                        <ul className="ha-detail-list">
                          {r.detailText.length ? (
                            r.detailText.map((item, idx) => <li key={idx}>{item}</li>)
                          ) : (
                            <li>No item-level details recorded.</li>
                          )}
                        </ul>
                        {onOpenDate ? (
                          <button
                            type="button"
                            className="secondary"
                            style={{ marginTop: "6px", fontSize: "12px", padding: "4px 8px" }}
                            onClick={() => onOpenDate(r.date)}
                          >
                            Open this day
                          </button>
                        ) : null}
                      </details>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="ha-empty-cell">
                    No recorded activity matches these dates or search. Try widening the date range or clearing search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
