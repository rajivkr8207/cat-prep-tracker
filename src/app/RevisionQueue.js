"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/api-client";

const SECTIONS = ["VARC", "Quant", "DILR"];
const RESULTS = [
  "Not attempted",
  "Wrong again",
  "Correct with hint",
  "Correct independently",
];

function localDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value) {
  if (!value || typeof value !== "string" || !value.includes("-")) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function addDaysToDate(baseDateStr, days) {
  const [y, m, d] = (baseDateStr || localDateString()).split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1, d + days));
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(target.getUTCDate()).padStart(2, "0")}`;
}

function getDaysDiff(targetDateStr, todayStr = localDateString()) {
  if (!targetDateStr) return 0;
  const target = new Date(targetDateStr + "T12:00:00");
  const today = new Date(todayStr + "T12:00:00");
  return Math.round((target - today) / 86400000);
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - target.getTime()) / 86400000);
  return diff < 0 ? null : diff;
}

const DEFAULT_FORM = {
  topic: "",
  section: "Quant",
  date: localDateString(),
  notes: "",
  result: "Not attempted",
  topicId: "",
};

export default function RevisionQueue() {
  const [revisions, setRevisions] = useState([]);
  const [topics, setTopics] = useState([]);
  const [syllabusList, setSyllabusList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Form State
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState("");

  // Filter State
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const todayStr = useMemo(() => localDateString(), []);

  // Load revisions, topics, and syllabus
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [revRes, topicRes, sylRes] = await Promise.allSettled([
        requestJson("/api/preparation/revisions"),
        requestJson("/api/preparation/topics"),
        requestJson("/api/preparation/syllabus"),
      ]);

      if (revRes.status === "fulfilled" && revRes.value?.revisions) {
        setRevisions(revRes.value.revisions);
      } else if (revRes.status === "rejected") {
        throw revRes.reason;
      }

      if (topicRes.status === "fulfilled" && topicRes.value?.topics) {
        setTopics(topicRes.value.topics);
      }

      if (sylRes.status === "fulfilled" && sylRes.value?.progress) {
        setSyllabusList(sylRes.value.progress);
      }
    } catch (err) {
      setError(err.message || "Failed to load revision queue data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Topic lookup maps for enrichment
  const topicMap = useMemo(() => {
    const map = new Map();
    for (const t of topics) {
      const key = `${t.section.toUpperCase()}:::${t.name.trim().toLowerCase()}`;
      map.set(key, t);
    }
    return map;
  }, [topics]);

  const syllabusMap = useMemo(() => {
    const map = new Map();
    for (const s of syllabusList) {
      const key = `${s.subject.toUpperCase()}:::${s.topicName.trim().toLowerCase()}`;
      map.set(key, s);
    }
    return map;
  }, [syllabusList]);

  // Topic Suggestions for Autocomplete / Quick Picker
  const topicSuggestions = useMemo(() => {
    const set = new Set();
    for (const t of topics) {
      if (t.name) set.add(t.name);
    }
    for (const s of syllabusList) {
      if (s.topicName) set.add(s.topicName);
    }
    return Array.from(set).sort();
  }, [topics, syllabusList]);

  // 14-Day Revision Alerts & Suggestions
  // Find topics in SyllabusProgress where daysSince >= 14 or status === 'Needs revision' in Topics
  const suggestedRevisions = useMemo(() => {
    const suggestions = [];
    const scheduledTopics = new Set(
      revisions
        .filter((r) => !r.completed)
        .map((r) => `${(r.section || r.subject).toUpperCase()}:::${(r.topic || r.title).trim().toLowerCase()}`),
    );

    // Check syllabus progress for 14-day overdue items
    for (const s of syllabusList) {
      if (!s.lastCoveredAt) continue;
      const days = daysSince(s.lastCoveredAt);
      if (days !== null && days >= 14) {
        const key = `${s.subject.toUpperCase()}:::${s.topicName.trim().toLowerCase()}`;
        if (!scheduledTopics.has(key)) {
          suggestions.push({
            topic: s.topicName,
            section: s.subject,
            reason: `Covered ${days} days ago (14-day alert)`,
            type: "14-day",
            lastCoveredAt: s.lastCoveredAt,
          });
        }
      }
    }

    // Check topics needing revision
    for (const t of topics) {
      if (t.status === "Needs revision") {
        const key = `${t.section.toUpperCase()}:::${t.name.trim().toLowerCase()}`;
        if (!scheduledTopics.has(key) && !suggestions.some((x) => `${x.section.toUpperCase()}:::${x.topic.trim().toLowerCase()}` === key)) {
          suggestions.push({
            topic: t.name,
            section: t.section,
            reason: `Marked 'Needs revision' in Topic Dashboard`,
            type: "needs-revision",
            topicId: t._id,
          });
        }
      }
    }

    return suggestions.slice(0, 8); // Top 8 suggestions
  }, [syllabusList, topics, revisions]);

  // Categorize Revisions into Due Today, Overdue, Upcoming, Completed
  const categorizedRevisions = useMemo(() => {
    const overdue = [];
    const dueToday = [];
    const upcoming = [];
    const completed = [];

    const q = searchQuery.trim().toLowerCase();

    for (const rev of revisions) {
      // Filtering
      const sec = (rev.section || rev.subject || "").toUpperCase();
      if (subjectFilter !== "All" && sec !== subjectFilter.toUpperCase()) {
        continue;
      }

      if (q) {
        const topicMatch = (rev.topic || rev.title || "").toLowerCase().includes(q);
        const notesMatch = (rev.notes || "").toLowerCase().includes(q);
        if (!topicMatch && !notesMatch) continue;
      }

      const diff = getDaysDiff(rev.date, todayStr);

      if (rev.completed) {
        if (statusFilter === "All" || statusFilter === "completed") {
          completed.push({ ...rev, diff });
        }
      } else {
        if (diff < 0) {
          if (
            statusFilter === "All" ||
            statusFilter === "pending" ||
            statusFilter === "overdue"
          ) {
            overdue.push({ ...rev, diff });
          }
        } else if (diff === 0) {
          if (
            statusFilter === "All" ||
            statusFilter === "pending" ||
            statusFilter === "today"
          ) {
            dueToday.push({ ...rev, diff });
          }
        } else {
          if (
            statusFilter === "All" ||
            statusFilter === "pending" ||
            statusFilter === "upcoming"
          ) {
            upcoming.push({ ...rev, diff });
          }
        }
      }
    }

    // Sort overdue by earliest due date first
    overdue.sort((a, b) => a.date.localeCompare(b.date));
    // Due today
    dueToday.sort((a, b) => (a.topic || a.title).localeCompare(b.topic || b.title));
    // Upcoming sorted by soonest date
    upcoming.sort((a, b) => a.date.localeCompare(b.date));
    // Completed sorted by completion date or updated date descending
    completed.sort((a, b) => (b.completedOn || b.date).localeCompare(a.completedOn || a.date));

    return { overdue, dueToday, upcoming, completed };
  }, [revisions, subjectFilter, statusFilter, searchQuery, todayStr]);

  // Summary counts
  const counts = useMemo(() => {
    let overdueCount = 0;
    let dueTodayCount = 0;
    let upcomingCount = 0;
    let completedCount = 0;

    for (const rev of revisions) {
      if (rev.completed) {
        completedCount++;
      } else {
        const diff = getDaysDiff(rev.date, todayStr);
        if (diff < 0) overdueCount++;
        else if (diff === 0) dueTodayCount++;
        else upcomingCount++;
      }
    }

    return { overdueCount, dueTodayCount, upcomingCount, completedCount };
  }, [revisions, todayStr]);

  // Form field changes
  function updateFormField(e) {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };

      // If user typed/picked a topic, auto-link topicId and section if matched
      if (name === "topic") {
        const trimmed = value.trim().toLowerCase();
        const found = topics.find((t) => t.name.trim().toLowerCase() === trimmed);
        if (found) {
          next.section = found.section;
          next.topicId = found._id;
        }
      }
      return next;
    });
  }

  // Quick date presets
  function setDatePreset(days) {
    setForm((prev) => ({
      ...prev,
      date: addDaysToDate(todayStr, days),
    }));
  }

  // Reset Form
  function resetForm() {
    setForm({
      topic: "",
      section: "Quant",
      date: localDateString(),
      notes: "",
      result: "Not attempted",
      topicId: "",
    });
    setEditingId("");
    setError("");
  }

  // Submit Create or Edit Form
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.topic.trim()) {
      setError("Please enter a topic name.");
      return;
    }
    if (!form.date) {
      setError("Please specify a scheduled revision date.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    const payload = {
      topic: form.topic.trim(),
      title: form.topic.trim(),
      section: form.section,
      subject: form.section,
      date: form.date,
      notes: form.notes.trim(),
      result: form.result,
      topicId: form.topicId || null,
    };

    try {
      if (editingId) {
        // PATCH
        const res = await requestJson(`/api/preparation/revisions/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        // Immediate state update
        setRevisions((prev) =>
          prev.map((r) => (r._id === editingId ? res.revision : r)),
        );
        setNotice("Revision entry updated successfully.");
      } else {
        // POST
        const res = await requestJson("/api/preparation/revisions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        // Immediate state update
        setRevisions((prev) => [res.revision, ...prev]);
        setNotice("Revision added to queue.");
      }

      resetForm();
      window.setTimeout(() => setNotice(""), 3500);
    } catch (err) {
      setError(err.message || "Failed to save revision entry.");
    } finally {
      setSaving(false);
    }
  }

  // Edit item
  function startEdit(rev) {
    setEditingId(rev._id);
    setForm({
      topic: rev.topic || rev.title || "",
      section: rev.section || rev.subject || "Quant",
      date: rev.date || localDateString(),
      notes: rev.notes || "",
      result: rev.result || "Not attempted",
      topicId: rev.topicId?._id || rev.topicId || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Mark revision as completed or pending
  async function toggleComplete(rev, newCompletedStatus) {
    setSaving(true);
    setError("");
    setNotice("");

    // Optimistic UI update
    const previous = [...revisions];
    setRevisions((prev) =>
      prev.map((r) =>
        r._id === rev._id
          ? {
              ...r,
              completed: newCompletedStatus,
              status: newCompletedStatus ? "completed" : "pending",
              completedOn: newCompletedStatus ? todayStr : "",
            }
          : r,
      ),
    );

    try {
      const res = await requestJson(`/api/preparation/revisions/${rev._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completed: newCompletedStatus,
          status: newCompletedStatus ? "completed" : "pending",
          completedOn: newCompletedStatus ? todayStr : "",
        }),
      });

      setRevisions((prev) =>
        prev.map((r) => (r._id === rev._id ? res.revision : r)),
      );
      setNotice(
        newCompletedStatus
          ? "Revision marked as completed! ✓"
          : "Revision returned to pending queue.",
      );
      window.setTimeout(() => setNotice(""), 3500);
    } catch (err) {
      // Rollback
      setRevisions(previous);
      setError(err.message || "Failed to update completion status.");
    } finally {
      setSaving(false);
    }
  }

  // Delete revision
  async function deleteRevision(id) {
    if (!window.confirm("Are you sure you want to remove this revision?")) return;
    setSaving(true);
    setError("");
    setNotice("");

    // Optimistic remove
    const previous = [...revisions];
    setRevisions((prev) => prev.filter((r) => r._id !== id));

    try {
      await requestJson(`/api/preparation/revisions/${id}`, {
        method: "DELETE",
      });
      setNotice("Revision removed from queue.");
      window.setTimeout(() => setNotice(""), 3500);
    } catch (err) {
      // Rollback
      setRevisions(previous);
      setError(err.message || "Failed to delete revision.");
    } finally {
      setSaving(false);
    }
  }

  // Quick schedule a suggested revision
  function scheduleSuggestion(sug) {
    setForm({
      topic: sug.topic,
      section: sug.section,
      date: todayStr,
      notes: `Revision scheduled via ${sug.reason}`,
      result: "Not attempted",
      topicId: sug.topicId || "",
    });
    setEditingId("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Quick Reschedule (+X days)
  async function quickReschedule(rev, days) {
    const newDate = addDaysToDate(todayStr, days);
    setSaving(true);
    try {
      const res = await requestJson(`/api/preparation/revisions/${rev._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate }),
      });
      setRevisions((prev) =>
        prev.map((r) => (r._id === rev._id ? res.revision : r)),
      );
      setNotice(`Rescheduled for ${formatDate(newDate)}.`);
      window.setTimeout(() => setNotice(""), 3500);
    } catch (err) {
      setError(err.message || "Failed to reschedule revision.");
    } finally {
      setSaving(false);
    }
  }

  // Render a revision card
  function renderRevisionCard(rev, badgeType) {
    const sec = rev.section || rev.subject || "Quant";
    const topicName = rev.topic || rev.title || "Untitled topic";

    // Enrich with Topic & Syllabus data
    const lookupKey = `${sec.toUpperCase()}:::${topicName.trim().toLowerCase()}`;
    const topicData = topicMap.get(lookupKey);
    const syllabusData = syllabusMap.get(lookupKey);

    const sylDays = syllabusData?.lastCoveredAt
      ? daysSince(syllabusData.lastCoveredAt)
      : null;
    const is14DayOverdue = sylDays !== null && sylDays >= 14;

    return (
      <article
        key={rev._id}
        id={`revision-${rev._id}`}
        className={`rq-card rq-card-${badgeType} ${rev.completed ? "rq-card-done" : ""}`}
      >
        <div className="rq-card-header">
          <div className="rq-card-title-row">
            <input
              type="checkbox"
              id={`rev-check-${rev._id}`}
              aria-label={`Mark ${topicName} as ${rev.completed ? "pending" : "completed"}`}
              checked={Boolean(rev.completed)}
              disabled={saving}
              onChange={(e) => toggleComplete(rev, e.target.checked)}
              className="rq-checkbox"
            />
            <div className="rq-title-block">
              <span className="rq-topic-name">{topicName}</span>
              <div className="rq-badges">
                <span className={`diary-pill tag-${sec.toLowerCase()}`}>
                  {sec}
                </span>

                {/* Status / Due Pill */}
                {rev.completed ? (
                  <span className="diary-pill diary-pill-done">✓ Completed</span>
                ) : badgeType === "overdue" ? (
                  <span className="diary-pill rq-pill-overdue">
                    ⚠️ {Math.abs(rev.diff)} day{Math.abs(rev.diff) === 1 ? "" : "s"} overdue
                  </span>
                ) : badgeType === "today" ? (
                  <span className="diary-pill rq-pill-today">
                    🔔 Due today
                  </span>
                ) : (
                  <span className="diary-pill rq-pill-upcoming">
                    📅 In {rev.diff} day{rev.diff === 1 ? "" : "s"}
                  </span>
                )}

                {/* Topic Master Status from Topic Dashboard */}
                {topicData?.status ? (
                  <span
                    className={`diary-pill ${
                      topicData.status === "Revised"
                        ? "topic-status-mastered"
                        : topicData.status === "Needs revision"
                          ? "topic-status-weak"
                          : "topic-status-learning"
                    }`}
                  >
                    Mastery: {topicData.status}
                  </span>
                ) : null}

                {/* Accuracy from Topic Dashboard */}
                {topicData?.accuracy != null ? (
                  <span className="diary-pill">
                    🎯 {topicData.accuracy.toFixed(1)}% acc ({topicData.correct || 0}/{topicData.attempted || 0})
                  </span>
                ) : null}

                {/* Syllabus Group */}
                {syllabusData?.group ? (
                  <span className="diary-pill">
                    📚 {syllabusData.group}
                  </span>
                ) : null}

                {/* 14-day alert indicator */}
                {is14DayOverdue ? (
                  <span className="diary-pill rq-pill-alert" title={`Last covered ${sylDays} days ago`}>
                    ⚡ 14-day alert ({sylDays}d)
                  </span>
                ) : null}

                {/* Revision Count from Syllabus */}
                {syllabusData?.revisionCount != null && syllabusData.revisionCount > 0 ? (
                  <span className="diary-pill">
                    🔁 Revised {syllabusData.revisionCount}x
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rq-date-block">
            <span className="rq-scheduled-date">
              Scheduled: <strong>{formatDate(rev.date)}</strong>
            </span>
            {rev.completed && rev.completedOn ? (
              <span className="rq-completed-date">
                Finished on: <strong>{formatDate(rev.completedOn)}</strong>
              </span>
            ) : null}
          </div>
        </div>

        {/* Notes & Result */}
        {(rev.notes || rev.result) && (
          <div className="rq-card-body">
            {rev.notes ? (
              <p className="rq-notes">
                <strong>Notes:</strong> {rev.notes}
              </p>
            ) : null}
            {rev.result && rev.result !== "Not attempted" ? (
              <div className="rq-result-tag">
                <span>Result:</span> <strong>{rev.result}</strong>
              </div>
            ) : null}
          </div>
        )}

        {/* Action Buttons */}
        <div className="rq-card-actions diary-task-buttons">
          <button
            type="button"
            className={rev.completed ? "rq-btn-pending" : "diary-mark-done"}
            disabled={saving}
            onClick={() => toggleComplete(rev, !rev.completed)}
          >
            {rev.completed ? "↩ Mark pending" : "✓ Done"}
          </button>
          {!rev.completed ? (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => quickReschedule(rev, 3)}
                title="Reschedule +3 days"
              >
                +3d
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => quickReschedule(rev, 7)}
                title="Reschedule +7 days"
              >
                +7d
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => quickReschedule(rev, 14)}
                title="Reschedule +14 days (Spaced rep)"
              >
                +14d
              </button>
            </>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => startEdit(rev)}
          >
            Edit
          </button>
          <button
            type="button"
            className="diary-danger"
            disabled={saving}
            onClick={() => deleteRevision(rev._id)}
          >
            Remove
          </button>
        </div>
      </article>
    );
  }

  return (
    <div id="view-revision-queue" className="panel diary-panel rq-container">
      {/* Top Header */}
      <div className="topbar diary-topbar">
        <div>
          <h2>🔁 Revision Queue</h2>
          <p className="diary-muted diary-small">
            Spaced repetition, 14-day revision alerts, and mastery tracking across VARC, DILR, and Quant.
          </p>
        </div>
        <div className="rq-header-actions">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="rq-refresh-btn"
          >
            ↻ Refresh Queue
          </button>
        </div>
      </div>

      {/* Summary Stats Row */}
      <section className="diary-stats rq-stats-row" aria-label="Revision queue statistics">
        <div className="diary-stat rq-stat-overdue">
          <small>Overdue</small>
          <strong id="rqOverdueCount">{counts.overdueCount}</strong>
          <span>Needs quick review</span>
        </div>
        <div className="diary-stat rq-stat-today">
          <small>Due Today</small>
          <strong id="rqTodayCount">{counts.dueTodayCount}</strong>
          <span>Ready for practice</span>
        </div>
        <div className="diary-stat rq-stat-upcoming">
          <small>Upcoming</small>
          <strong id="rqUpcomingCount">{counts.upcomingCount}</strong>
          <span>Scheduled ahead</span>
        </div>
        <div className="diary-stat rq-stat-completed">
          <small>Completed</small>
          <strong id="rqCompletedCount">{counts.completedCount}</strong>
          <span>Mastered revisions</span>
        </div>
      </section>

      {/* 14-Day Revision Alerts & Suggestions Panel */}
      {suggestedRevisions.length > 0 ? (
        <section className="rq-suggestions-panel" aria-label="Suggested revisions">
          <div className="rq-suggestions-header">
            <div>
              <h3>⚡ 14-Day Revision Alerts & Recommended Topics</h3>
              <p>Topics at least 14 days old or flagged &apos;Needs revision&apos; that are not yet in your queue.</p>
            </div>
            <span className="rq-suggestions-badge">
              {suggestedRevisions.length} suggested
            </span>
          </div>
          <div className="rq-suggestions-list">
            {suggestedRevisions.map((sug, i) => (
              <div key={i} className="rq-suggestion-chip">
                <div className="rq-sug-info">
                  <span className="rq-sug-title">{sug.topic}</span>
                  <span className={`diary-pill tag-${sug.section.toLowerCase()}`}>
                    {sug.section}
                  </span>
                  <small className="rq-sug-reason">{sug.reason}</small>
                </div>
                <button
                  type="button"
                  className="rq-sug-action"
                  onClick={() => scheduleSuggestion(sug)}
                  disabled={saving}
                >
                  ＋ Add to queue
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Add / Edit Revision Form */}
      <details className="topic-add-panel rq-form-panel" open>
        <summary id="rqFormHeading">
          {editingId ? "✏️ Edit Revision Entry" : "＋ Schedule a Revision"}
        </summary>
        <form id="revisionForm" onSubmit={handleSubmit} className="rq-form">
          <div className="formgrid diary-formgrid">
            {/* Topic Input with Autocomplete Datalist */}
            <div>
              <label htmlFor="rqTopicInput">Topic / Skill *</label>
              <input
                id="rqTopicInput"
                name="topic"
                required
                maxLength={300}
                placeholder="e.g. Percentages, Arrangements, RC Inference"
                list="rqTopicSuggestions"
                value={form.topic}
                onChange={updateFormField}
              />
              <datalist id="rqTopicSuggestions">
                {topicSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            {/* Subject / Section */}
            <div>
              <label htmlFor="rqSectionSelect">Subject *</label>
              <select
                id="rqSectionSelect"
                name="section"
                required
                value={form.section}
                onChange={updateFormField}
              >
                {SECTIONS.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            {/* Scheduled Revision Date + Quick Presets */}
            <div>
              <label htmlFor="rqDateInput">Scheduled Revision Date *</label>
              <div className="rq-date-input-wrap">
                <input
                  id="rqDateInput"
                  name="date"
                  type="date"
                  lang="en-GB"
                  required
                  value={form.date}
                  onChange={updateFormField}
                />
              </div>
              <div className="rq-presets" role="group" aria-label="Quick date presets">
                <button type="button" onClick={() => setDatePreset(0)}>
                  Today
                </button>
                <button type="button" onClick={() => setDatePreset(1)}>
                  Tomorrow
                </button>
                <button type="button" onClick={() => setDatePreset(3)}>
                  +3d
                </button>
                <button type="button" onClick={() => setDatePreset(7)}>
                  +7d
                </button>
                <button type="button" onClick={() => setDatePreset(14)}>
                  +14d
                </button>
              </div>
            </div>

            {/* Optional Result */}
            <div>
              <label htmlFor="rqResultSelect">Outcome / Result</label>
              <select
                id="rqResultSelect"
                name="result"
                value={form.result}
                onChange={updateFormField}
              >
                {RESULTS.map((res) => (
                  <option key={res} value={res}>
                    {res}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div className="wide diary-wide">
              <label htmlFor="rqNotesInput">Revision Notes / Pitfalls / Formulas</label>
              <textarea
                id="rqNotesInput"
                name="notes"
                maxLength={5000}
                placeholder="What formulas to review? What traps did you fall for earlier? What specific problem types need practice?"
                value={form.notes}
                onChange={updateFormField}
              />
            </div>
          </div>

          <div className="formactions diary-formactions rq-form-actions">
            <button
              className="primary diary-primary"
              type="submit"
              disabled={saving}
              id="rqSubmitButton"
            >
              {saving
                ? "Saving…"
                : editingId
                  ? "Save changes"
                  : "＋ Add to revision queue"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel edit
              </button>
            ) : null}
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
            >
              Clear form
            </button>
          </div>
        </form>
      </details>

      {/* Feedback Messages */}
      {error ? (
        <p className="diary-feedback diary-feedback-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="diary-feedback" role="status">
          {notice}
        </p>
      ) : null}

      {/* Filter and Search Controls */}
      <div className="rq-controls-bar">
        <div className="rq-search-wrap">
          <input
            id="rqSearchInput"
            type="search"
            aria-label="Search revisions by topic or notes"
            placeholder="Search topic or notes…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="rq-filters">
          <select
            id="rqSubjectFilter"
            aria-label="Filter revisions by subject"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
          >
            <option value="All">All subjects</option>
            {SECTIONS.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
          <select
            id="rqStatusFilter"
            aria-label="Filter revisions by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All statuses</option>
            <option value="pending">Pending only</option>
            <option value="overdue">Overdue only</option>
            <option value="today">Due today only</option>
            <option value="upcoming">Upcoming only</option>
            <option value="completed">Completed only</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="diary-empty" role="status">
          Loading revision queue…
        </div>
      ) : null}

      {/* 1. OVERDUE REVISIONS SECTION */}
      {categorizedRevisions.overdue.length > 0 ? (
        <section id="rqSectionOverdue" className="rq-section rq-section-overdue" aria-labelledby="rqOverdueHeading">
          <div className="rq-section-head">
            <h3 id="rqOverdueHeading">
              <span className="rq-section-icon">⚠️</span> Overdue Revisions
            </h3>
            <span className="rq-section-count rq-badge-overdue">
              {categorizedRevisions.overdue.length} overdue
            </span>
          </div>
          <div className="rq-card-list">
            {categorizedRevisions.overdue.map((rev) =>
              renderRevisionCard(rev, "overdue"),
            )}
          </div>
        </section>
      ) : null}

      {/* 2. DUE TODAY REVISIONS SECTION */}
      {categorizedRevisions.dueToday.length > 0 ? (
        <section id="rqSectionToday" className="rq-section rq-section-today" aria-labelledby="rqTodayHeading">
          <div className="rq-section-head">
            <h3 id="rqTodayHeading">
              <span className="rq-section-icon">🔔</span> Due Today
            </h3>
            <span className="rq-section-count rq-badge-today">
              {categorizedRevisions.dueToday.length} today
            </span>
          </div>
          <div className="rq-card-list">
            {categorizedRevisions.dueToday.map((rev) =>
              renderRevisionCard(rev, "today"),
            )}
          </div>
        </section>
      ) : null}

      {/* 3. UPCOMING REVISIONS SECTION */}
      {categorizedRevisions.upcoming.length > 0 ? (
        <section id="rqSectionUpcoming" className="rq-section rq-section-upcoming" aria-labelledby="rqUpcomingHeading">
          <div className="rq-section-head">
            <h3 id="rqUpcomingHeading">
              <span className="rq-section-icon">📅</span> Upcoming Revisions
            </h3>
            <span className="rq-section-count rq-badge-upcoming">
              {categorizedRevisions.upcoming.length} upcoming
            </span>
          </div>
          <div className="rq-card-list">
            {categorizedRevisions.upcoming.map((rev) =>
              renderRevisionCard(rev, "upcoming"),
            )}
          </div>
        </section>
      ) : null}

      {/* 4. COMPLETED REVISIONS SECTION */}
      {categorizedRevisions.completed.length > 0 ? (
        <details className="rq-section rq-section-completed" open={statusFilter === "completed"}>
          <summary className="rq-section-head rq-summary-head">
            <h3 style={{ display: "inline-flex", alignItems: "center", gap: "6px", margin: 0 }}>
              <span className="rq-section-icon">✓</span> Completed Revisions
            </h3>
            <span className="rq-section-count rq-badge-completed">
              {categorizedRevisions.completed.length} completed
            </span>
          </summary>
          <div className="rq-card-list" style={{ marginTop: "12px" }}>
            {categorizedRevisions.completed.map((rev) =>
              renderRevisionCard(rev, "completed"),
            )}
          </div>
        </details>
      ) : null}

      {/* Empty State when no revisions match */}
      {!loading &&
      categorizedRevisions.overdue.length === 0 &&
      categorizedRevisions.dueToday.length === 0 &&
      categorizedRevisions.upcoming.length === 0 &&
      categorizedRevisions.completed.length === 0 ? (
        <div className="diary-empty" id="rqEmptyState">
          No revisions found matching your current filter.
          <br />
          Schedule a revision above or pick from suggested 14-day revision alerts.
        </div>
      ) : null}
    </div>
  );
}
