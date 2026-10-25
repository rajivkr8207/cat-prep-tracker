"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/api-client";

// ── helpers ────────────────────────────────────────────────────────────────

function localDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function shiftISO(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function mondayOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dow);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function completionColor(pct) {
  if (pct >= 80) return "#22c55e";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── component ──────────────────────────────────────────────────────────────

export default function StudyPlan({ onOpenDate }) {
  const today = useMemo(() => localDateString(), []);
  const [weekStart, setWeekStart] = useState(() => mondayOf(localDateString()));
  const [reflections, setReflections] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");

  const weekEnd = useMemo(() => shiftISO(weekStart, 6), [weekStart]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftISO(weekStart, i)), [weekStart]);

  const loadData = useCallback(async (start, end) => {
    setLoading(true);
    setError("");
    try {
      const [refRes, taskRes] = await Promise.all([
        requestJson(`/api/preparation/reflections?from=${start}&to=${end}`),
        requestJson(`/api/preparation/tasks?from=${start}&to=${end}&limit=500`),
      ]);
      setReflections(refRes.reflections || []);
      setTasks(taskRes.tasks || []);
    } catch (err) {
      setError(err.message || "Could not load study plan data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(weekStart, weekEnd);
  }, [loadData, weekStart, weekEnd]);

  const refByDate = useMemo(() => {
    const m = {};
    for (const r of reflections) m[r.date] = r;
    return m;
  }, [reflections]);

  const tasksByDate = useMemo(() => {
    const m = {};
    for (const t of tasks) {
      if (!m[t.date]) m[t.date] = [];
      m[t.date].push(t);
    }
    return m;
  }, [tasks]);

  const weekSummary = useMemo(() => {
    let totalHours = 0, totalTasks = 0, doneTasks = 0;
    for (const d of weekDates) {
      const ref = refByDate[d];
      if (ref && ref.hours != null) totalHours += Number(ref.hours) || 0;
      const dayTasks = tasksByDate[d] || [];
      totalTasks += dayTasks.length;
      doneTasks += dayTasks.filter(t => t.status === "Done").length;
    }
    return { totalHours, totalTasks, doneTasks };
  }, [weekDates, refByDate, tasksByDate]);

  function startEdit(date) {
    const ref = refByDate[date] || {};
    setEditing({ date, plan: ref.plan || "", actual: ref.actual || "", hours: ref.hours != null ? String(ref.hours) : "" });
    setSaveError("");
    setSaveNotice("");
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    const hoursNum = editing.hours === "" ? null : Number(editing.hours);
    if (hoursNum !== null && (isNaN(hoursNum) || hoursNum < 0 || Math.abs(Math.round(hoursNum * 4) - hoursNum * 4) > 1e-9)) {
      setSaveError("Hours must use quarter-hour increments (0.25, 0.5, 1.75 …).");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await requestJson("/api/preparation/reflections", {
        method: "POST",
        body: JSON.stringify({ date: editing.date, plan: editing.plan, actual: editing.actual, hours: hoursNum }),
      });
      setSaveNotice("Saved ✓");
      setTimeout(() => setSaveNotice(""), 3000);
      setEditing(null);
      await loadData(weekStart, weekEnd);
    } catch (err) {
      setSaveError(err.message || "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const prevWeek = () => setWeekStart(w => shiftISO(w, -7));
  const nextWeek = () => setWeekStart(w => shiftISO(w, 7));
  const goToday = () => setWeekStart(mondayOf(today));

  return (
    <section className="diary-panel" aria-label="Weekly study plan">
      <div className="diary-topbar" style={{ flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2 style={{ margin: 0 }}>{"📅 Weekly Study Plan"}</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, opacity: 0.7 }}>
            {"Plan vs. actual \u2014 "}{fmtDate(weekStart)}{" to "}{fmtDate(weekEnd)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="diary-day-nav-btn" onClick={prevWeek}>{"← Prev week"}</button>
          <button type="button" className="diary-primary" onClick={goToday}>This week</button>
          <button type="button" className="diary-day-nav-btn" onClick={nextWeek}>{"Next week →"}</button>
        </div>
      </div>

      <div className="diary-stats" style={{ marginBottom: 16 }}>
        <div className="diary-stat">
          <small>Focused hours</small>
          <strong>{weekSummary.totalHours % 1 === 0 ? weekSummary.totalHours : weekSummary.totalHours.toFixed(2)}</strong>
        </div>
        <div className="diary-stat">
          <small>Tasks completed</small>
          <strong>{weekSummary.doneTasks} / {weekSummary.totalTasks}</strong>
        </div>
        <div className="diary-stat">
          <small>Completion rate</small>
          <strong style={{ color: completionColor(weekSummary.totalTasks ? (weekSummary.doneTasks / weekSummary.totalTasks) * 100 : 0) }}>
            {weekSummary.totalTasks ? Math.round((weekSummary.doneTasks / weekSummary.totalTasks) * 100) : 0}%
          </strong>
        </div>
        <div className="diary-stat">
          <small>Days studied</small>
          <strong>{weekDates.filter(d => (refByDate[d] && refByDate[d].hours > 0)).length} / 7</strong>
        </div>
      </div>

      {saveNotice && <p className="diary-notice" role="status" style={{ marginBottom: 10 }}>{saveNotice}</p>}
      {loading && <p className="diary-muted" style={{ padding: "20px 0" }}>Loading…</p>}
      {error && <p className="diary-error" role="alert">{error}</p>}

      {!loading && (
        <div className="sp-grid">
          {weekDates.map((date, i) => {
            const ref = refByDate[date] || {};
            const dayTasks = tasksByDate[date] || [];
            const done = dayTasks.filter(t => t.status === "Done").length;
            const partlyDone = dayTasks.filter(t => t.status === "Partly done").length;
            const pct = dayTasks.length ? Math.round((done / dayTasks.length) * 100) : null;
            const isToday = date === today;
            const isFuture = date > today;
            const isEditingThis = editing && editing.date === date;

            return (
              <article key={date} className={"sp-card" + (isToday ? " sp-card--today" : "") + (isFuture ? " sp-card--future" : "")}>
                <div className="sp-card-head">
                  <div>
                    <span className="sp-day-name">{DAYS[i]}</span>
                    <span className="sp-day-date">{fmtDate(date)}</span>
                    {isToday && <span className="sp-today-badge">Today</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {onOpenDate && (
                      <button type="button" className="sp-link-btn" title="Open in Daily Diary" onClick={() => onOpenDate(date)}>
                        Open diary
                      </button>
                    )}
                    <button type="button" className="sp-link-btn" onClick={() => isEditingThis ? setEditing(null) : startEdit(date)}>
                      {isEditingThis ? "Cancel" : (ref.plan || ref.actual) ? "Edit" : "+ Log"}
                    </button>
                  </div>
                </div>

                {dayTasks.length > 0 && (
                  <div style={{ margin: "8px 0 4px" }}>
                    <div className="sp-progress-track">
                      <div className="sp-progress-fill" style={{ width: pct + "%", background: completionColor(pct) }} />
                    </div>
                    <p className="diary-muted sp-task-line">
                      {done}/{dayTasks.length} tasks done{partlyDone > 0 ? ", " + partlyDone + " partly" : ""} · {pct}%
                    </p>
                  </div>
                )}
                {!dayTasks.length && !isFuture && (
                  <p className="diary-muted sp-task-line" style={{ fontStyle: "italic" }}>No tasks added</p>
                )}

                {ref.hours != null && (
                  <span className="sp-hours-pill">{"⏱ "}{ref.hours}{"h focused"}</span>
                )}

                {isEditingThis ? (
                  <form onSubmit={saveEdit} style={{ marginTop: 10 }}>
                    {saveError && <p className="diary-error" style={{ marginBottom: 6 }}>{saveError}</p>}
                    <div className="sp-form-group">
                      <label htmlFor={"sp-plan-" + date}>{"📋 Plan for the day"}</label>
                      <textarea id={"sp-plan-" + date} rows={3} placeholder="What do you plan to study today?" value={editing.plan} onChange={ev => setEditing(ed => ({ ...ed, plan: ev.target.value }))} />
                    </div>
                    <div className="sp-form-group">
                      <label htmlFor={"sp-actual-" + date}>{"✅ What actually happened"}</label>
                      <textarea id={"sp-actual-" + date} rows={3} placeholder="What did you actually study or accomplish?" value={editing.actual} onChange={ev => setEditing(ed => ({ ...ed, actual: ev.target.value }))} />
                    </div>
                    <div className="sp-form-group">
                      <label htmlFor={"sp-hours-" + date}>{"⏱ Focused hours (0.25 increments)"}</label>
                      <input id={"sp-hours-" + date} type="number" min={0} step={0.25} placeholder="e.g. 3.5" value={editing.hours} onChange={ev => setEditing(ed => ({ ...ed, hours: ev.target.value }))} style={{ width: 110 }} />
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button type="submit" className="diary-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                      <button type="button" className="diary-secondary" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div className="sp-read">
                    {ref.plan ? (
                      <div className="sp-field">
                        <span className="sp-field-label">{"📋 Plan"}</span>
                        <p className="sp-field-text">{ref.plan}</p>
                      </div>
                    ) : (
                      <p className="diary-muted sp-task-line" style={{ fontStyle: "italic" }}>
                        {isFuture ? "Future day — click + Log to plan ahead" : "No plan written"}
                      </p>
                    )}
                    {ref.actual && (
                      <div className="sp-field sp-field--actual">
                        <span className="sp-field-label">{"✅ Actual"}</span>
                        <p className="sp-field-text">{ref.actual}</p>
                      </div>
                    )}
                    {!ref.actual && ref.plan && !isFuture && (
                      <p className="diary-muted sp-task-line" style={{ fontStyle: "italic" }}>Actual not recorded yet</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {!loading && (
        <p className="diary-notice diary-small" style={{ marginTop: 16 }}>
          {"💡 Write your plan each morning and log what actually happened each night. Hours are shared with the Daily Diary reflection panel."}
        </p>
      )}
    </section>
  );
}
