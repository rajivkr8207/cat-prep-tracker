"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/api-client";

const TOPIC_SECTIONS = ["VARC", "DILR", "Quant"];
const TOPIC_STATUSES = ["Not started", "Learning", "Covered once", "Needs revision", "Revised"];
const TOPIC_PRIORITIES = ["High", "Medium", "Low"];
const MISTAKE_OPTIONS = [
  "",
  "Concept not clear",
  "Calculation error",
  "Misread question",
  "Time pressure",
  "Guessing / poor elimination",
  "Forgot method",
  "Careless error",
  "Other",
];

function localDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(raw) {
  if (!raw) return "—";
  const parts = String(raw).split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return raw;
}

export default function TopicDashboard() {
  // Topics state
  const [topics, setTopics] = useState([]);
  const [editingTopicId, setEditingTopicId] = useState("");
  const [topicForm, setTopicForm] = useState({
    name: "",
    section: "Quant",
    status: "Not started",
    priority: "Medium",
    attempted: "",
    correct: "",
    accuracy: "",
    lastPracticed: "",
    nextReview: "",
    notes: "",
  });

  // Topic filters
  const [topicSearch, setTopicSearch] = useState("");
  const [topicFilterSection, setTopicFilterSection] = useState("All");
  const [topicFilterStatus, setTopicFilterStatus] = useState("All");
  const [topicSort, setTopicSort] = useState("priority");

  // Sessions state
  const [sessions, setSessions] = useState([]);
  const [editingSessionId, setEditingSessionId] = useState("");
  const [sessionForm, setSessionForm] = useState({
    topic: "",
    section: "VARC",
    date: localDateString(),
    total: "20",
    attempted: "15",
    correct: "10",
    incorrect: "5",
    unattempted: "5",
    minutes: "25",
    mistake: "",
    revisionDate: "",
    notes: "",
  });

  // Session filters
  const [tdSearch, setTdSearch] = useState("");
  const [tdSectionFilter, setTdSectionFilter] = useState("All");
  const [tdPeriod, setTdPeriod] = useState("all");
  const [tdSort, setTdSort] = useState("weak");

  // General UI states
  const [loading, setLoading] = useState(true);
  const [savingTopic, setSavingTopic] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [coachUpdated, setCoachUpdated] = useState("Insights update when practice data changes.");

  // Fetch topics and sessions
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [topicsRes, sessionsRes] = await Promise.all([
        requestJson("/api/preparation/topics"),
        requestJson("/api/preparation/topic-sessions?limit=1000"),
      ]);
      setTopics(topicsRes.topics || []);
      setSessions(sessionsRes.sessions || []);
    } catch (err) {
      setError(err.message || "Failed to load topic data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  // Topic form count sync
  function updateTopicField(e) {
    const { name, value } = e.target;
    setTopicForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "attempted" || name === "correct") {
        const a = Number(name === "attempted" ? value : next.attempted);
        const c = Number(name === "correct" ? value : next.correct);
        if (next.attempted !== "" && next.correct !== "" && !isNaN(a) && !isNaN(c) && a > 0 && c >= 0 && c <= a) {
          next.accuracy = ((c / a) * 100).toFixed(1);
        }
      }
      return next;
    });
  }

  // Save Topic (Create or Edit)
  async function handleTopicSubmit(e) {
    e.preventDefault();
    setSavingTopic(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        name: topicForm.name.trim(),
        section: topicForm.section,
        status: topicForm.status,
        priority: topicForm.priority,
        attempted: topicForm.attempted !== "" ? Number(topicForm.attempted) : undefined,
        correct: topicForm.correct !== "" ? Number(topicForm.correct) : undefined,
        accuracy: topicForm.accuracy !== "" ? Number(topicForm.accuracy) : undefined,
        lastPracticed: topicForm.lastPracticed || "",
        nextReview: topicForm.nextReview || "",
        notes: topicForm.notes.trim(),
      };

      if (editingTopicId) {
        const res = await requestJson(`/api/preparation/topics/${editingTopicId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setTopics((prev) => prev.map((t) => (t._id === editingTopicId ? res.topic : t)));
        setNotice(`Topic &quot;${res.topic.name}&quot; updated.`);
      } else {
        const res = await requestJson("/api/preparation/topics", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setTopics((prev) => [res.topic, ...prev]);
        setNotice(`Topic &quot;${res.topic.name}&quot; added.`);
      }
      resetTopicForm();
      window.setTimeout(() => setNotice(""), 3500);
    } catch (err) {
      setError(err.message || "Failed to save topic.");
    } finally {
      setSavingTopic(false);
    }
  }

  function resetTopicForm() {
    setEditingTopicId("");
    setTopicForm({
      name: "",
      section: "Quant",
      status: "Not started",
      priority: "Medium",
      attempted: "",
      correct: "",
      accuracy: "",
      lastPracticed: "",
      nextReview: "",
      notes: "",
    });
  }

  function startEditTopic(t) {
    setEditingTopicId(t._id);
    setTopicForm({
      name: t.name || "",
      section: t.section || "Quant",
      status: t.status || "Not started",
      priority: t.priority || "Medium",
      attempted: t.attempted != null ? String(t.attempted) : "",
      correct: t.correct != null ? String(t.correct) : "",
      accuracy: t.accuracy != null ? String(t.accuracy) : "",
      lastPracticed: t.lastPracticed || "",
      nextReview: t.nextReview || "",
      notes: t.notes || "",
    });
  }

  async function deleteTopic(id, name) {
    if (!window.confirm(`Remove topic &quot;${name}&quot;?`)) return;
    try {
      await requestJson(`/api/preparation/topics/${id}`, { method: "DELETE" });
      setTopics((prev) => prev.filter((t) => t._id !== id));
      if (editingTopicId === id) resetTopicForm();
      setNotice(`Topic removed.`);
      window.setTimeout(() => setNotice(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to delete topic.");
    }
  }

  // Bulk add starter topics
  async function addStarterTopics() {
    try {
      setLoading(true);
      const res = await requestJson("/api/preparation/topics/starter", { method: "POST" });
      setTopics(res.topics || []);
      setNotice(
        res.added > 0
          ? `Added ${res.added} starter topics. Existing topics were kept.`
          : "Your starter topic list is already added. No duplicates created.",
      );
      window.setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      setError(err.message || "Could not add starter topics.");
    } finally {
      setLoading(false);
    }
  }

  // Session form count sync
  function updateSessionField(e) {
    const { name, value } = e.target;
    setSessionForm((prev) => {
      const next = { ...prev, [name]: value };
      const tot = Number(name === "total" ? value : next.total);
      const att = Number(name === "attempted" ? value : next.attempted);
      const cor = Number(name === "correct" ? value : next.correct);
      if (!isNaN(tot) && !isNaN(att) && !isNaN(cor) && tot >= 1 && att >= 0 && att <= tot && cor >= 0 && cor <= att) {
        next.incorrect = String(att - cor);
        next.unattempted = String(tot - att);
      }
      return next;
    });
  }

  // Save Session (Create or Edit)
  async function handleSessionSubmit(e) {
    e.preventDefault();
    setSavingSession(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        topic: sessionForm.topic.trim(),
        section: sessionForm.section,
        date: sessionForm.date,
        total: Number(sessionForm.total),
        attempted: Number(sessionForm.attempted),
        correct: Number(sessionForm.correct),
        minutes: sessionForm.minutes !== "" ? Number(sessionForm.minutes) : undefined,
        mistake: sessionForm.mistake || "",
        revisionDate: sessionForm.revisionDate || "",
        notes: sessionForm.notes.trim(),
      };

      if (editingSessionId) {
        const res = await requestJson(`/api/preparation/topic-sessions/${editingSessionId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setSessions((prev) => prev.map((s) => (s._id === editingSessionId ? res.session : s)));
        setNotice(`Practice session updated.`);
      } else {
        const res = await requestJson("/api/preparation/topic-sessions", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSessions((prev) => [res.session, ...prev]);
        setNotice(`Practice session logged.`);
      }
      resetSessionForm();
      loadData(); // reload to get synced topic dates
      window.setTimeout(() => setNotice(""), 3500);
    } catch (err) {
      setError(err.message || "Failed to save practice session.");
    } finally {
      setSavingSession(false);
    }
  }

  function resetSessionForm() {
    setEditingSessionId("");
    setSessionForm({
      topic: "",
      section: "VARC",
      date: localDateString(),
      total: "20",
      attempted: "15",
      correct: "10",
      incorrect: "5",
      unattempted: "5",
      minutes: "25",
      mistake: "",
      revisionDate: "",
      notes: "",
    });
  }

  function startEditSession(s) {
    setEditingSessionId(s._id);
    setSessionForm({
      topic: s.topic || "",
      section: s.section || "VARC",
      date: s.date || localDateString(),
      total: String(s.total || 0),
      attempted: String(s.attempted || 0),
      correct: String(s.correct || 0),
      incorrect: String(s.incorrect ?? Math.max(0, (s.attempted || 0) - (s.correct || 0))),
      unattempted: String(s.unattempted ?? Math.max(0, (s.total || 0) - (s.attempted || 0))),
      minutes: s.minutes != null ? String(s.minutes) : "",
      mistake: s.mistake || "",
      revisionDate: s.revisionDate || "",
      notes: s.notes || "",
    });
  }

  async function deleteSession(id) {
    if (!window.confirm("Delete this practice session?")) return;
    try {
      await requestJson(`/api/preparation/topic-sessions/${id}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s._id !== id));
      if (editingSessionId === id) resetSessionForm();
      setNotice("Practice session deleted.");
      window.setTimeout(() => setNotice(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to delete practice session.");
    }
  }

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    const q = tdSearch.trim().toLowerCase();
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    if (tdPeriod === "30") cutoff.setDate(cutoff.getDate() - 29);
    else if (tdPeriod === "7") cutoff.setDate(cutoff.getDate() - 6);

    return sessions.filter((s) => {
      const secMatch = tdSectionFilter === "All" || s.section === tdSectionFilter;
      const textMatch = !q || `${s.topic} ${s.mistake || ""} ${s.notes || ""} ${s.section}`.toLowerCase().includes(q);
      const dateMatch =
        tdPeriod === "all" ||
        (s.date && new Date(s.date + "T12:00:00") >= cutoff);
      return secMatch && textMatch && dateMatch;
    });
  }, [sessions, tdPeriod, tdSearch, tdSectionFilter]);

  // Aggregated topic stats from sessions
  const aggregatedTopics = useMemo(() => {
    const map = new Map();
    for (const s of filteredSessions) {
      const key = `${s.section}|||${String(s.topic || "").trim().toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, {
          section: s.section,
          topic: s.topic,
          sessions: [],
          attempted: 0,
          correct: 0,
        });
      }
      const item = map.get(key);
      item.sessions.push(s);
      item.attempted += Number(s.attempted) || 0;
      item.correct += Number(s.correct) || 0;
    }

    const list = [...map.values()].map((x) => {
      x.sessions.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      x.accuracy = x.attempted > 0 ? (x.correct / x.attempted) * 100 : null;

      const recent = x.sessions.slice(-2);
      const earlier = x.sessions.slice(0, Math.max(0, x.sessions.length - 2));

      const ra = recent.reduce((sum, s) => sum + (Number(s.attempted) || 0), 0);
      const rc = recent.reduce((sum, s) => sum + (Number(s.correct) || 0), 0);
      const ea = earlier.reduce((sum, s) => sum + (Number(s.attempted) || 0), 0);
      const ec = earlier.reduce((sum, s) => sum + (Number(s.correct) || 0), 0);

      x.recentAccuracy = ra > 0 ? (rc / ra) * 100 : null;
      x.earlierAccuracy = ea > 0 ? (ec / ea) * 100 : null;
      x.delta =
        x.recentAccuracy != null && x.earlierAccuracy != null
          ? x.recentAccuracy - x.earlierAccuracy
          : null;
      x.last = x.sessions[x.sessions.length - 1] || null;
      x.weak =
        x.sessions.length >= 2 &&
        x.attempted >= 10 &&
        ((x.recentAccuracy != null && x.recentAccuracy < 60) || (x.delta != null && x.delta <= -15));
      return x;
    });

    list.sort((a, b) => {
      if (tdSort === "accuracy") return (a.accuracy ?? 101) - (b.accuracy ?? 101);
      if (tdSort === "recent") return (b.last?.date || "").localeCompare(a.last?.date || "");
      if (tdSort === "name") return a.topic.localeCompare(b.topic);
      // weak first
      return Number(b.weak) - Number(a.weak) || (a.recentAccuracy ?? 101) - (b.recentAccuracy ?? 101);
    });

    return list;
  }, [filteredSessions, tdSort]);

  // Overall session metrics
  const totalAttemptedQuestions = useMemo(
    () => filteredSessions.reduce((sum, s) => sum + (Number(s.attempted) || 0), 0),
    [filteredSessions],
  );
  const totalCorrectQuestions = useMemo(
    () => filteredSessions.reduce((sum, s) => sum + (Number(s.correct) || 0), 0),
    [filteredSessions],
  );
  const overallAccuracy = useMemo(
    () =>
      totalAttemptedQuestions > 0
        ? ((totalCorrectQuestions / totalAttemptedQuestions) * 100).toFixed(1) + "%"
        : "—",
    [totalAttemptedQuestions, totalCorrectQuestions],
  );
  const weakCount = useMemo(
    () => aggregatedTopics.filter((x) => x.weak).length,
    [aggregatedTopics],
  );

  // Topic Revision Reminders
  const revisionAlerts = useMemo(() => {
    const todayStr = localDateString();
    const latestByTopic = new Map();
    for (const s of sessions) {
      if (!s.revisionDate || !s.topic) continue;
      const key = `${s.section}|||${s.topic.trim().toLowerCase()}`;
      const existing = latestByTopic.get(key);
      if (!existing || s.revisionDate < existing.due) {
        latestByTopic.set(key, { topic: s.topic, section: s.section, due: s.revisionDate });
      }
    }
    return [...latestByTopic.values()]
      .map((item) => {
        const diff = Math.round(
          (new Date(item.due + "T12:00:00") - new Date(todayStr + "T12:00:00")) / 86400000,
        );
        return {
          ...item,
          diff,
          status: diff < 0 ? "overdue" : diff === 0 ? "today" : "upcoming",
        };
      })
      .filter((item) => item.diff <= 7)
      .sort((a, b) => a.diff - b.diff || a.topic.localeCompare(b.topic));
  }, [sessions]);

  // Weakness to Action Recommendations
  const actionItems = useMemo(() => {
    const qualified = aggregatedTopics.filter(
      (x) =>
        x.weak ||
        (x.sessions.length >= 2 && x.attempted >= 10 && (x.recentAccuracy ?? x.accuracy) < 70) ||
        (x.attempted >= 5 && (x.recentAccuracy ?? x.accuracy) < 60),
    );
    const picks = (qualified.length ? qualified : aggregatedTopics.filter((x) => x.sessions.length < 2 || x.attempted < 10)).slice(0, 4);

    return picks.map((x, i) => {
      const recent = x.recentAccuracy ?? x.accuracy;
      const difficulty = String(x.last?.mistake || "");
      let steps = [];
      if (/Concept not clear|Forgot method/i.test(difficulty)) {
        steps = [
          "Spend 10 minutes revisiting the exact concept or method.",
          "Solve 5 worked examples, then 8–10 questions without notes.",
          "Log a fresh set and check whether accuracy improves.",
        ];
      } else if (/Calculation error|Careless error/i.test(difficulty)) {
        steps = [
          "Do 8–10 questions slowly and write each intermediate step.",
          "After each answer, check signs, units and arithmetic before moving on.",
          "Repeat a short timed set only after the careful set is accurate.",
        ];
      } else if (/Misread question/i.test(difficulty)) {
        steps = [
          "Underline the question requirement and key constraints before solving.",
          "Practise 8 questions; paraphrase what each question asks before answering.",
          "Review any wrong answer caused by missing a word or condition.",
        ];
      } else if (/Time pressure/i.test(difficulty)) {
        steps = [
          "Do 5 questions untimed to confirm the method is understood.",
          "Try 8–10 similar questions with a realistic but forgiving time limit.",
          "Track accuracy and time together; do not trade all accuracy for speed.",
        ];
      } else if (/Guessing|elimination/i.test(difficulty)) {
        steps = [
          "For each question, state why each rejected option is wrong.",
          "Attempt a small set only when you can justify the chosen answer.",
          "Review whether skipping would have been better than a low-confidence guess.",
        ];
      } else {
        steps = [
          "Practise 10–15 focused questions at a manageable level.",
          "Review every incorrect or skipped question and identify the concept or step that blocked you.",
          "Log another session on this topic to compare accuracy and time.",
        ];
      }
      if (recent != null && recent < 50) {
        steps[0] = "Relearn the core method with 2–3 worked examples before independent practice.";
      }
      const reason = x.weak
        ? `Flagged by dashboard rule: ${recent == null ? "limited accuracy data" : recent.toFixed(1) + "% recent accuracy"}; ${x.sessions.length} sessions and ${x.attempted} attempted questions.`
        : x.sessions.length < 2 || x.attempted < 10
          ? `Early signal only: ${recent == null ? "accuracy unavailable" : recent.toFixed(1) + "% accuracy"} across ${x.sessions.length} session(s). Collect more practice before treating this as a confirmed weakness.`
          : `Accuracy is ${recent == null ? "not available" : recent.toFixed(1) + "%"}; below the 70% checkpoint.`;
      const label = x.weak
        ? "Priority action"
        : x.sessions.length < 2 || x.attempted < 10
          ? "Early signal"
          : "Practise next";

      return { ...x, steps, reason, label, isPriority: i === 0 };
    });
  }, [aggregatedTopics]);

  // Autocomplete suggestions
  const topicSuggestions = useMemo(() => {
    const set = new Set();
    topics.forEach((t) => set.add(t.name));
    sessions.forEach((s) => set.add(s.topic));
    return [...set].sort();
  }, [sessions, topics]);

  // Topic Mastery list filtered
  const filteredTopics = useMemo(() => {
    const q = topicSearch.trim().toLowerCase();
    const todayStr = localDateString();
    return topics
      .filter((t) => {
        const secMatch = topicFilterSection === "All" || t.section === topicFilterSection;
        const statMatch = topicFilterStatus === "All" || t.status === topicFilterStatus;
        const textMatch = !q || `${t.name} ${t.notes || ""} ${t.section}`.toLowerCase().includes(q);
        return secMatch && statMatch && textMatch;
      })
      .sort((a, b) => {
        if (topicSort === "section") return (a.section || "").localeCompare(b.section || "") || a.name.localeCompare(b.name);
        if (topicSort === "accuracy-low") return (a.accuracy ?? 101) - (b.accuracy ?? 101);
        if (topicSort === "review") return (a.nextReview || "9999-99-99").localeCompare(b.nextReview || "9999-99-99");
        if (topicSort === "name") return a.name.localeCompare(b.name);
        // priority first
        const pRank = (p) => (p === "High" ? 0 : p === "Medium" ? 1 : 2);
        return pRank(a.priority) - pRank(b.priority) || (a.nextReview && a.nextReview < todayStr ? -1 : 1);
      });
  }, [topicFilterSection, topicFilterStatus, topicSearch, topicSort, topics]);

  const masteredTopicsCount = useMemo(
    () => topics.filter((t) => t.status === "Revised").length,
    [topics],
  );
  const needsAttentionTopicsCount = useMemo(() => {
    const todayStr = localDateString();
    return topics.filter(
      (t) => t.status === "Needs revision" || (t.nextReview && t.nextReview < todayStr),
    ).length;
  }, [topics]);
  const avgTopicAccuracy = useMemo(() => {
    const accs = topics.map((t) => t.accuracy).filter((a) => a != null);
    if (!accs.length) return "—";
    return (accs.reduce((sum, v) => sum + v, 0) / accs.length).toFixed(1) + "%";
  }, [topics]);

  return (
    <section id="view-topicdash" className="panel diary-panel">
      {/* Top Header */}
      <div className="topbar">
        <div>
          <h2>📈 Topic dashboard</h2>
          <p className="diary-muted diary-small">
            See how your topic practice is going using only the results you log here.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="topic-stats-grid">
        <div className="topic-stat topic-stat-purple">
          <small>Practice sessions</small>
          <strong id="tdSessions">{filteredSessions.length}</strong>
          <span>Logged by you</span>
        </div>
        <div className="topic-stat topic-stat-green">
          <small>Questions attempted</small>
          <strong id="tdAttempted">{totalAttemptedQuestions}</strong>
          <span>Across logged sessions</span>
        </div>
        <div className="topic-stat topic-stat-blue">
          <small>Overall accuracy</small>
          <strong id="tdAccuracy">{overallAccuracy}</strong>
          <span>Correct ÷ attempted</span>
        </div>
        <div className="topic-stat topic-stat-pink">
          <small>Topics needing attention</small>
          <strong id="tdWeak">{weakCount}</strong>
          <span>Based on enough recent data</span>
        </div>
      </div>

      <div className="notice topic-guidance">
        <b>How the dashboard works:</b> log practice sessions below. A topic is flagged for attention
        only after at least 2 logged sessions and 10 attempted questions, when recent accuracy is below
        60% or has fallen by at least 15 percentage points compared with earlier practice.
      </div>

      {/* Revision Alerts */}
      <section id="tdRevisionAlerts" className="td-revision-alerts" aria-live="polite">
        <div className="td-alerts-head">
          <div>
            <h3>🔔 Topic revision reminders</h3>
            <p>Based on the next-revision dates you entered in your practice sessions.</p>
          </div>
          <span id="tdRevisionAlertCount" className="td-alert-count">
            {revisionAlerts.filter((x) => x.diff <= 0).length} due
          </span>
        </div>
        <div id="tdRevisionAlertList" className="td-alert-list">
          {revisionAlerts.length === 0 ? (
            <div className="td-empty">
              No revision dates due in the next 7 days. Add a next-revision date when logging practice.
            </div>
          ) : (
            revisionAlerts.map((alert, idx) => (
              <article key={idx} className={`td-alert-item td-alert-${alert.status}`}>
                <div className="td-alert-main">
                  <div className="td-alert-title">
                    {alert.topic} <span className="diary-pill">{alert.section}</span>
                  </div>
                  <div className="td-alert-meta">
                    {alert.status === "overdue"
                      ? `${Math.abs(alert.diff)} day${Math.abs(alert.diff) === 1 ? "" : "s"} overdue`
                      : alert.status === "today"
                        ? "Scheduled for today"
                        : "Upcoming revision"}{" "}
                    · Date {formatDate(alert.due)}
                  </div>
                </div>
                <span className="td-alert-status">
                  {alert.status === "overdue"
                    ? "Overdue"
                    : alert.status === "today"
                      ? "Due today"
                      : `In ${alert.diff} day${alert.diff === 1 ? "" : "s"}`}
                </span>
              </article>
            ))
          )}
        </div>
      </section>

      {/* Log a Practice Session Form */}
      <details className="topic-add-panel" open>
        <summary>
          {editingSessionId ? "✏️ Edit practice session" : "＋ Log a topic practice session"}
        </summary>
        <form id="tdForm" onSubmit={handleSessionSubmit}>
          <div className="diary-formgrid formgrid">
            <div>
              <label htmlFor="tdTopic">Topic *</label>
              <input
                id="tdTopic"
                name="topic"
                required
                maxLength={200}
                placeholder="e.g. RC inference, Percentages, Arrangements"
                list="tdTopicSuggestions"
                value={sessionForm.topic}
                onChange={updateSessionField}
              />
              <datalist id="tdTopicSuggestions">
                {topicSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="tdSection">Section *</label>
              <select
                id="tdSection"
                name="section"
                required
                value={sessionForm.section}
                onChange={updateSessionField}
              >
                {TOPIC_SECTIONS.map((sec) => (
                  <option key={sec}>{sec}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tdDate">Practice date *</label>
              <input
                id="tdDate"
                name="date"
                type="date"
                lang="en-GB"
                required
                className="td-date-picker"
                value={sessionForm.date}
                onChange={updateSessionField}
              />
            </div>
            <div>
              <label htmlFor="tdTotalInput">Total questions in set *</label>
              <input
                id="tdTotalInput"
                name="total"
                type="number"
                min="1"
                step="1"
                required
                value={sessionForm.total}
                onChange={updateSessionField}
              />
            </div>
            <div>
              <label htmlFor="tdAttemptedInput">Questions attempted *</label>
              <input
                id="tdAttemptedInput"
                name="attempted"
                type="number"
                min="0"
                step="1"
                required
                value={sessionForm.attempted}
                onChange={updateSessionField}
              />
            </div>
            <div>
              <label htmlFor="tdCorrectInput">Correct answers *</label>
              <input
                id="tdCorrectInput"
                name="correct"
                type="number"
                min="0"
                step="1"
                required
                value={sessionForm.correct}
                onChange={updateSessionField}
              />
            </div>
            <div>
              <label htmlFor="tdIncorrectInput">Incorrect answers</label>
              <input
                id="tdIncorrectInput"
                name="incorrect"
                type="number"
                readOnly
                value={sessionForm.incorrect}
              />
            </div>
            <div>
              <label htmlFor="tdUnattemptedInput">Unattempted</label>
              <input
                id="tdUnattemptedInput"
                name="unattempted"
                type="number"
                readOnly
                value={sessionForm.unattempted}
              />
            </div>
            <div>
              <label htmlFor="tdMinutes">Time taken (minutes)</label>
              <input
                id="tdMinutes"
                name="minutes"
                type="number"
                min="0"
                step="1"
                value={sessionForm.minutes}
                onChange={updateSessionField}
              />
            </div>
            <div>
              <label htmlFor="tdMistake">Main difficulty</label>
              <select
                id="tdMistake"
                name="mistake"
                value={sessionForm.mistake}
                onChange={updateSessionField}
              >
                {MISTAKE_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m || "Choose if useful"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tdRevision">Next revision (optional)</label>
              <input
                id="tdRevision"
                name="revisionDate"
                type="date"
                lang="en-GB"
                className="td-date-picker"
                value={sessionForm.revisionDate}
                onChange={updateSessionField}
              />
            </div>
            <div className="wide diary-wide">
              <label htmlFor="tdNotes">Notes (optional)</label>
              <textarea
                id="tdNotes"
                name="notes"
                placeholder="What went wrong? What should you repeat next time?"
                value={sessionForm.notes}
                onChange={updateSessionField}
              />
            </div>
          </div>
          <div className="formactions diary-formactions">
            <button
              className="primary diary-primary"
              type="submit"
              disabled={savingSession || loading}
            >
              {savingSession
                ? "Saving…"
                : editingSessionId
                  ? "Save changes"
                  : "＋ Save practice session"}
            </button>
            <button
              type="button"
              id="tdReset"
              onClick={resetSessionForm}
              disabled={savingSession || loading}
            >
              {editingSessionId ? "Cancel edit" : "Clear form"}
            </button>
          </div>
        </form>
      </details>

      {/* Session Filters */}
      <div className="topic-filters">
        <input
          id="tdSearch"
          type="search"
          placeholder="Search topic or difficulty…"
          aria-label="Search topic sessions"
          value={tdSearch}
          onChange={(e) => setTdSearch(e.target.value)}
        />
        <select
          id="tdSectionFilter"
          aria-label="Filter topic dashboard"
          value={tdSectionFilter}
          onChange={(e) => setTdSectionFilter(e.target.value)}
        >
          <option value="All">All sections</option>
          {TOPIC_SECTIONS.map((sec) => (
            <option key={sec}>{sec}</option>
          ))}
        </select>
        <select
          id="tdPeriod"
          aria-label="Time range"
          value={tdPeriod}
          onChange={(e) => setTdPeriod(e.target.value)}
        >
          <option value="all">All logged time</option>
          <option value="30">Last 30 days</option>
          <option value="7">Last 7 days</option>
        </select>
        <select
          id="tdSort"
          aria-label="Sort topic results"
          value={tdSort}
          onChange={(e) => setTdSort(e.target.value)}
        >
          <option value="weak">Needs attention first</option>
          <option value="accuracy">Lowest accuracy</option>
          <option value="recent">Most recent practice</option>
          <option value="name">Topic name</option>
        </select>
      </div>

      {/* Grid: Topic Performance + AI CAT Coach */}
      <div className="grid2">
        <div className="card">
          <h3>Topic performance</h3>
          <p className="diary-muted diary-small">
            Accuracy and trend are calculated from logged sessions. Trends need at least two
            sessions.
          </p>
          <div id="tdTopicSummary" className="tasklist">
            {aggregatedTopics.length === 0 ? (
              <div className="td-empty">
                No practice data yet.
                <br />
                Log a session above to start building your dashboard.
              </div>
            ) : (
              aggregatedTopics.map((item, idx) => (
                <article
                  key={idx}
                  className={`td-summary-card td-${item.section === "Quant" ? "quant" : item.section === "DILR" ? "dilr" : "varc"}`}
                >
                  <div className="td-card-head">
                    <div className="td-topic-name">{item.topic}</div>
                    <div className="td-badges">
                      <span
                        className={`diary-pill tag-${item.section === "Quant" ? "quant" : item.section === "DILR" ? "dilr" : "varc"}`}
                      >
                        {item.section}
                      </span>
                      {item.weak ? (
                        <span className="diary-pill topic-status-weak">Needs attention</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="td-metrics">
                    <span className="td-metric">{item.sessions.length} session(s)</span>
                    <span className="td-metric">
                      {item.sessions.reduce(
                        (sum, s) => sum + (Number(s.total) || Number(s.attempted) || 0),
                        0,
                      )}{" "}
                      total
                    </span>
                    <span className="td-metric">{item.attempted} attempted</span>
                    <span className="td-metric">{item.correct} correct</span>
                    <span className="td-metric">
                      {item.sessions.reduce(
                        (sum, s) =>
                          sum +
                          Number(
                            s.incorrect ?? Math.max(0, (s.attempted || 0) - (s.correct || 0)),
                          ),
                        0,
                      )}{" "}
                      incorrect
                    </span>
                    <span className="td-metric">
                      {item.sessions.reduce(
                        (sum, s) =>
                          sum +
                          Number(
                            s.unattempted ??
                              Math.max(
                                0,
                                (s.total || s.attempted || 0) - (s.attempted || 0),
                              ),
                          ),
                        0,
                      )}{" "}
                      unattempted
                    </span>
                    <span className="td-metric">
                      Recent{" "}
                      {item.recentAccuracy == null ? "—" : item.recentAccuracy.toFixed(1) + "%"}
                    </span>
                  </div>
                  <div className="td-accuracy-row">
                    <div className="topic-progress" style={{ flex: 1 }}>
                      <span
                        style={{
                          width: `${item.accuracy != null ? Math.max(0, Math.min(100, item.accuracy)) : 0}%`,
                        }}
                      />
                    </div>
                    <span className="td-accuracy-value">
                      {item.accuracy == null ? "—" : item.accuracy.toFixed(1) + "%"}
                    </span>
                  </div>
                  <div className="td-footnote">
                    {item.delta == null
                      ? "Trend available after more practice sessions"
                      : `Trend: ${item.delta > 0 ? "+" : ""}${item.delta.toFixed(1)} percentage points vs earlier practice`}{" "}
                    ·{" "}
                    {item.last
                      ? `Last practice ${formatDate(item.last.date)}`
                      : "No practice logged"}
                    {item.last?.mistake ? ` · Difficulty: ${item.last.mistake}` : ""}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        {/* AI CAT Coach */}
        <div className="card td-coach-card">
          <div className="td-coach-header">
            <div>
              <div className="td-coach-kicker">PERSONALISED PRACTICE INSIGHTS</div>
              <h3>✨ AI CAT Coach</h3>
              <p className="diary-muted diary-small">
                Uses your logged practice data to suggest what to work on next. Insights are
                generated locally from your records.
              </p>
            </div>
            <div className="td-coach-refresh-tools">
              <button
                type="button"
                id="tdCoachRefresh"
                onClick={() => {
                  loadData();
                  setCoachUpdated(
                    `Updated just now · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
                  );
                }}
              >
                ↻ Refresh insights
              </button>
              <span id="tdCoachUpdated" className="td-coach-updated is-success">
                {coachUpdated}
              </span>
            </div>
          </div>

          <div id="tdCoachSummary" className="td-coach-summary">
            <div className="td-coach-stat">
              <small>Logged practice sessions</small>
              <strong>{filteredSessions.length}</strong>
              <span>Across all recorded dates</span>
            </div>
            <div className="td-coach-stat">
              <small>Overall accuracy</small>
              <strong>{overallAccuracy}</strong>
              <span>
                {totalCorrectQuestions} correct from {totalAttemptedQuestions} attempted
              </span>
            </div>
            <div className="td-coach-stat">
              <small>Topics to investigate</small>
              <strong>{weakCount}</strong>
              <span>Requires 2+ sessions and 10+ attempts</span>
            </div>
          </div>

          <div className="td-coach-columns">
            <section className="td-coach-panel">
              <h4>
                <span>🎯</span> Your next best action
              </h4>
              <div id="tdCoachNext" className="td-coach-body">
                {filteredSessions.length === 0 ? (
                  <>
                    <p>
                      <b>Start with one logged practice session.</b>
                    </p>
                    <p>
                      After you record topic, questions attempted, correct answers and time, this
                      coach can begin finding patterns.
                    </p>
                  </>
                ) : weakCount > 0 ? (
                  <>
                    <p>
                      <span className="td-coach-tag">TOP PRIORITY</span>
                    </p>
                    <p>
                      <b>
                        {aggregatedTopics.find((x) => x.weak)?.topic} (
                        {aggregatedTopics.find((x) => x.weak)?.section})
                      </b>{" "}
                      is currently the clearest area to work on. Recent accuracy is{" "}
                      <b>
                        {aggregatedTopics.find((x) => x.weak)?.recentAccuracy?.toFixed(1) || "—"}%
                      </b>
                      .
                    </p>
                    <ul>
                      <li>Do 10–15 focused questions on this topic.</li>
                      <li>Review every wrong answer and label the cause.</li>
                      <li>Log another session to check whether accuracy improves.</li>
                    </ul>
                  </>
                ) : (
                  <>
                    <p>
                      <b>No confirmed weak topic yet.</b>
                    </p>
                    <p>
                      Keep logging practice. For now, maintain a balanced mix of VARC, DILR and
                      Quant practice.
                    </p>
                  </>
                )}
              </div>
            </section>

            <section className="td-coach-panel td-coach-plan-panel">
              <h4>
                <span>🗓️</span> Suggested 7-day practice plan
              </h4>
              <div id="tdCoachPlan" className="td-coach-body">
                <div className="td-coach-plan">
                  <div className="td-coach-day">Day 1</div>
                  <div>Log a focused set in your weakest or least-practised topic.</div>
                </div>
                <div className="td-coach-plan">
                  <div className="td-coach-day">Day 2</div>
                  <div>Review incorrect answers; note whether errors were conceptual or careless.</div>
                </div>
                <div className="td-coach-plan">
                  <div className="td-coach-day">Day 3</div>
                  <div>Practice 15 questions in a second section with strict time tracking.</div>
                </div>
                <div className="td-coach-plan">
                  <div className="td-coach-day">Day 4</div>
                  <div>Mixed sectional practice; focus on question selection.</div>
                </div>
                <div className="td-coach-plan">
                  <div className="td-coach-day">Day 5</div>
                  <div>Revisit topic revision reminders and clear overdue items.</div>
                </div>
                <div className="td-coach-plan">
                  <div className="td-coach-day">Day 6</div>
                  <div>Review difficult questions and test recall without notes.</div>
                </div>
                <div className="td-coach-plan">
                  <div className="td-coach-day">Day 7</div>
                  <div>Log results, review week-over-week trends, and plan next week.</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Weakness-to-Action System */}
      <section className="card td-action-system" aria-labelledby="tdActionHeading">
        <div className="td-action-heading">
          <div>
            <p className="td-action-kicker">TURN RESULTS INTO A PLAN</p>
            <h3 id="tdActionHeading">🎯 Weakness-to-Action System</h3>
            <p className="diary-muted diary-small">
              Uses your logged accuracy, trend and main difficulty to suggest a specific next step.
            </p>
          </div>
          <span id="tdActionCount" className="td-action-count">
            {actionItems.length} area{actionItems.length === 1 ? "" : "s"} identified
          </span>
        </div>
        <div id="tdActionList" className="td-action-list">
          {actionItems.length === 0 ? (
            <div className="td-empty">
              Log practice sessions to get targeted actions here. Recommendations appear as your
              data grows.
            </div>
          ) : (
            actionItems.map((act, i) => (
              <article
                key={i}
                className={`td-action-item ${act.isPriority ? "is-priority" : ""}`}
              >
                <div className="td-action-top">
                  <div className="td-action-topic">
                    {act.topic}{" "}
                    <span
                      className={`diary-pill tag-${act.section === "Quant" ? "quant" : act.section === "DILR" ? "dilr" : "varc"}`}
                    >
                      {act.section}
                    </span>
                  </div>
                  <span className={`diary-pill ${act.weak ? "topic-status-weak" : ""}`}>
                    {act.label}
                  </span>
                </div>
                <div className="td-action-reason">{act.reason}</div>
                <ol className="td-action-steps">
                  {act.steps.map((st, sidx) => (
                    <li key={sidx}>{st}</li>
                  ))}
                </ol>
                <div className="td-action-foot">
                  {act.last?.mistake
                    ? `Based on difficulty logged: ${act.last.mistake}`
                    : "No specific difficulty logged; using general practice plan."}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {/* Practice History */}
      <div className="card">
        <h3>Practice history</h3>
        <div id="tdHistory" className="tasklist">
          {filteredSessions.length === 0 ? (
            <div className="td-empty">No practice sessions match these filters.</div>
          ) : (
            filteredSessions.map((s) => {
              const acc = s.attempted > 0 ? ((s.correct / s.attempted) * 100).toFixed(1) + "%" : "—";
              return (
                <article key={s._id} className="td-session-card">
                  <div className="td-session-main">
                    <div className="td-session-top">
                      <div className="td-topic-name">
                        {s.topic}{" "}
                        <span
                          className={`diary-pill tag-${s.section === "Quant" ? "quant" : s.section === "DILR" ? "dilr" : "varc"}`}
                        >
                          {s.section}
                        </span>
                      </div>
                      <span className="td-session-date">{formatDate(s.date)}</span>
                    </div>
                    <div className="td-metrics">
                      <span className="td-metric">{s.total} total</span>
                      <span className="td-metric">{s.attempted} attempted</span>
                      <span className="td-metric">{s.correct} correct</span>
                      <span className="td-metric">
                        {s.incorrect ?? Math.max(0, s.attempted - s.correct)} incorrect
                      </span>
                      <span className="td-metric">
                        {s.unattempted ?? Math.max(0, s.total - s.attempted)} unattempted
                      </span>
                      <span className="td-metric">{acc} accuracy</span>
                      <span className="td-metric">
                        {s.minutes ? `${s.minutes} min` : "Time not logged"}
                      </span>
                      {s.revisionDate ? (
                        <span className="td-metric">
                          Next revision: {formatDate(s.revisionDate)}
                        </span>
                      ) : null}
                    </div>
                    {s.mistake ? (
                      <div className="td-footnote">Main difficulty: {s.mistake}</div>
                    ) : null}
                    {s.notes ? <div className="td-footnote">{s.notes}</div> : null}
                  </div>
                  <div className="taskbuttons diary-task-buttons">
                    <button
                      type="button"
                      onClick={() => startEditSession(s)}
                      disabled={savingSession}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="danger diary-danger"
                      onClick={() => deleteSession(s._id)}
                      disabled={savingSession}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>

      {/* TOPIC MASTERY DASHBOARD SECTION */}
      <hr style={{ margin: "32px 0 24px", borderColor: "var(--line, #e2e8f0)" }} />
      <div className="topbar">
        <div>
          <h2>🧠 Topic mastery & syllabus tracking</h2>
          <span className="diary-muted diary-small">
            Mastery is based on evidence, not lectures watched.
          </span>
        </div>
        <div className="controls">
          <button type="button" id="addStarterTopics" onClick={addStarterTopics} disabled={loading}>
            ＋ Add CAT starter topics
          </button>
        </div>
      </div>

      {/* Topic Mastery Stats Grid */}
      <div className="topic-stats-grid">
        <div className="topic-stat topic-stat-purple">
          <small>Topics tracked</small>
          <strong id="topicTotal">{topics.length}</strong>
          <span>All sections</span>
        </div>
        <div className="topic-stat topic-stat-green">
          <small>Revised / Mastered</small>
          <strong id="topicMastered">{masteredTopicsCount}</strong>
          <span>Proven independently</span>
        </div>
        <div className="topic-stat topic-stat-pink">
          <small>Needs attention</small>
          <strong id="topicNeedsWork">{needsAttentionTopicsCount}</strong>
          <span>Weak or overdue</span>
        </div>
        <div className="topic-stat topic-stat-blue">
          <small>Average accuracy</small>
          <strong id="topicAvgAccuracy">{avgTopicAccuracy}</strong>
          <span>From logged practice</span>
        </div>
      </div>

      {/* Add / Edit Topic Form */}
      <details className="topic-add-panel" open>
        <summary>
          {editingTopicId ? "✏️ Edit selected topic" : "＋ Add or update a topic"}
        </summary>
        <form id="topicForm" onSubmit={handleTopicSubmit}>
          <div className="formgrid diary-formgrid">
            <div>
              <label htmlFor="topicName">Topic / skill *</label>
              <input
                id="topicName"
                name="name"
                required
                maxLength={200}
                placeholder="e.g., Percentages, RC inference, Arrangements"
                value={topicForm.name}
                onChange={updateTopicField}
              />
            </div>
            <div>
              <label htmlFor="topicSection">Section</label>
              <select
                id="topicSection"
                name="section"
                value={topicForm.section}
                onChange={updateTopicField}
              >
                {TOPIC_SECTIONS.map((sec) => (
                  <option key={sec}>{sec}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="topicStatus">Mastery status</label>
              <select
                id="topicStatus"
                name="status"
                value={topicForm.status}
                onChange={updateTopicField}
              >
                {TOPIC_STATUSES.map((st) => (
                  <option key={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="topicPriority">Priority</label>
              <select
                id="topicPriority"
                name="priority"
                value={topicForm.priority}
                onChange={updateTopicField}
              >
                {TOPIC_PRIORITIES.map((pr) => (
                  <option key={pr}>{pr}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="topicAttempted">Practice questions attempted</label>
              <input
                id="topicAttempted"
                name="attempted"
                type="number"
                min="0"
                step="1"
                placeholder="e.g., 40"
                value={topicForm.attempted}
                onChange={updateTopicField}
              />
            </div>
            <div>
              <label htmlFor="topicCorrect">Questions correct</label>
              <input
                id="topicCorrect"
                name="correct"
                type="number"
                min="0"
                step="1"
                placeholder="e.g., 28"
                value={topicForm.correct}
                onChange={updateTopicField}
              />
            </div>
            <div>
              <label htmlFor="topicAccuracy">Accuracy %</label>
              <input
                id="topicAccuracy"
                name="accuracy"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="Auto-calculated if counts entered"
                value={topicForm.accuracy}
                onChange={updateTopicField}
              />
            </div>
            <div>
              <label htmlFor="topicLastPracticed">Last practised</label>
              <input
                id="topicLastPracticed"
                name="lastPracticed"
                type="date"
                lang="en-GB"
                value={topicForm.lastPracticed}
                onChange={updateTopicField}
              />
            </div>
            <div>
              <label htmlFor="topicNextReview">Next revision</label>
              <input
                id="topicNextReview"
                name="nextReview"
                type="date"
                lang="en-GB"
                value={topicForm.nextReview}
                onChange={updateTopicField}
              />
            </div>
            <div className="wide diary-wide">
              <label htmlFor="topicNotes">Evidence / what remains difficult</label>
              <textarea
                id="topicNotes"
                name="notes"
                placeholder="What errors repeat? Can you solve without hints? What needs revision?"
                value={topicForm.notes}
                onChange={updateTopicField}
              />
            </div>
          </div>
          <div className="formactions diary-formactions">
            <button
              className="primary diary-primary"
              type="submit"
              id="topicSave"
              disabled={savingTopic || loading}
            >
              {savingTopic
                ? "Saving…"
                : editingTopicId
                  ? "Save changes"
                  : "＋ Add topic"}
            </button>
            {editingTopicId ? (
              <button
                type="button"
                id="topicCancel"
                onClick={resetTopicForm}
                disabled={savingTopic}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </details>

      {/* Topic Filters */}
      <div className="topic-filters">
        <input
          id="topicSearch"
          placeholder="Search topics…"
          aria-label="Search topics"
          value={topicSearch}
          onChange={(e) => setTopicSearch(e.target.value)}
        />
        <select
          id="topicFilterSection"
          aria-label="Filter by section"
          value={topicFilterSection}
          onChange={(e) => setTopicFilterSection(e.target.value)}
        >
          <option value="All">All sections</option>
          {TOPIC_SECTIONS.map((sec) => (
            <option key={sec}>{sec}</option>
          ))}
        </select>
        <select
          id="topicFilterStatus"
          aria-label="Filter by mastery status"
          value={topicFilterStatus}
          onChange={(e) => setTopicFilterStatus(e.target.value)}
        >
          <option value="All">All statuses</option>
          {TOPIC_STATUSES.map((st) => (
            <option key={st}>{st}</option>
          ))}
        </select>
        <select
          id="topicSort"
          aria-label="Sort topics"
          value={topicSort}
          onChange={(e) => setTopicSort(e.target.value)}
        >
          <option value="priority">Priority first</option>
          <option value="section">Section</option>
          <option value="accuracy-low">Lowest accuracy</option>
          <option value="review">Next revision date</option>
          <option value="name">Topic name</option>
        </select>
      </div>

      {/* Topic Card List */}
      <div id="topicList" className="tasklist">
        {filteredTopics.length === 0 ? (
          <div className="empty diary-empty">
            {topics.length === 0
              ? "No topics yet. Start with one topic you have studied, or click &quot;＋ Add CAT starter topics&quot;."
              : "No topics match these filters. Change the search or filter."}
          </div>
        ) : (
          filteredTopics.map((t) => {
            const todayStr = localDateString();
            const isOverdue = t.nextReview && t.nextReview < todayStr && t.status !== "Revised";
            const tone =
              t.section === "VARC"
                ? "tone-varc"
                : t.section === "DILR"
                  ? "tone-dilr"
                  : "tone-quant";
            const statusClass =
              t.status === "Revised"
                ? "topic-status-mastered"
                : t.status === "Needs revision" || isOverdue
                  ? "topic-status-weak"
                  : "topic-status-learning";

            return (
              <article key={t._id} className={`task topic-card ${tone}`}>
                <div className="topic-colorbar" />
                <div>
                  <div className="topic-title-row">
                    <span className="tasktitle">{t.name}</span>
                    <span
                      className={`diary-pill tag-${t.section === "Quant" ? "quant" : t.section === "DILR" ? "dilr" : "varc"}`}
                    >
                      {t.section}
                    </span>
                    <span className={`diary-pill ${statusClass}`}>{t.status}</span>
                    <span className={`diary-pill ${t.priority === "High" ? "diary-pill-high" : ""}`}>
                      {t.priority} priority
                    </span>
                    {isOverdue ? (
                      <span className="diary-pill topic-status-weak">REVISION OVERDUE</span>
                    ) : null}
                  </div>
                  <div className="meta diary-meta">
                    <span className="diary-pill">
                      Questions attempted: {t.attempted != null ? t.attempted : "—"}
                    </span>
                    <span className="diary-pill">
                      Correct: {t.correct != null ? t.correct : "—"}
                    </span>
                    <span className="diary-pill">
                      Accuracy: {t.accuracy != null ? `${t.accuracy}%` : "—"}
                    </span>
                    <span className="diary-pill">
                      Last practised: {t.lastPracticed ? formatDate(t.lastPracticed) : "—"}
                    </span>
                  </div>
                  {t.accuracy != null ? (
                    <div className="topic-progress" title={`Accuracy ${t.accuracy}%`}>
                      <span
                        style={{ width: `${Math.max(0, Math.min(100, t.accuracy))}%` }}
                      />
                    </div>
                  ) : null}
                  <div className={`topic-next ${isOverdue ? "overdue" : ""}`}>
                    {isOverdue ? "⚠️ " : ""}
                    {t.nextReview
                      ? `Next revision: ${formatDate(t.nextReview)}`
                      : "No revision date set"}
                  </div>
                  {t.notes ? <div className="topic-evidence">{t.notes}</div> : null}
                </div>
                <div className="taskbuttons diary-task-buttons">
                  <button type="button" onClick={() => startEditTopic(t)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="danger diary-danger"
                    onClick={() => deleteTopic(t._id, t.name)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Notices & Errors */}
      {notice ? (
        <p className="diary-feedback" role="status" style={{ marginTop: "16px" }}>
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="diary-feedback diary-feedback-error" role="alert" style={{ marginTop: "16px" }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
