"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/api-client";

const DEFAULT_WEEKLY_REVIEW = {
  goals: "",
  varc: "",
  quant: "",
  dilr: "",
  revision: "",
  improved: "",
  mistakes: "",
  avoided: "",
  next: "",
  advice: "",
};

function localDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function weekStart(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12));
  const dayOfWeek = (d.getUTCDay() + 6) % 7; // Monday is 0
  d.setUTCDate(d.getUTCDate() - dayOfWeek);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function shiftISODate(dateStr, days) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatMinutes(n) {
  return n >= 60
    ? `${Math.floor(n / 60)}h ${n % 60 ? `${n % 60}m` : ""}`.trim()
    : `${n} min`;
}

export default function WeeklyReview() {
  const [selectedDate, setSelectedDate] = useState(() => localDateString());
  const [review, setReview] = useState(DEFAULT_WEEKLY_REVIEW);
  const [reviewId, setReviewId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const start = useMemo(() => weekStart(selectedDate), [selectedDate]);
  const end = useMemo(() => shiftISODate(start, 6), [start]);
  const previousStart = useMemo(() => shiftISODate(start, -7), [start]);
  const previousEnd = useMemo(() => shiftISODate(start, -1), [start]);

  const loadWeekData = useCallback(async (startMonday, endSunday, prevMonday) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const [reviewRes, tasksRes] = await Promise.all([
        requestJson(
          `/api/preparation/weekly-reviews?weekStart=${encodeURIComponent(startMonday)}`,
        ),
        requestJson(
          `/api/preparation/tasks?from=${encodeURIComponent(prevMonday)}&to=${encodeURIComponent(endSunday)}&limit=500`,
        ),
      ]);

      if (reviewRes.review) {
        setReviewId(reviewRes.review._id);
        setReview({
          goals: reviewRes.review.goals || "",
          varc: reviewRes.review.varc || "",
          quant: reviewRes.review.quant || "",
          dilr: reviewRes.review.dilr || "",
          revision: reviewRes.review.revision || "",
          improved: reviewRes.review.improved || "",
          mistakes: reviewRes.review.mistakes || "",
          avoided: reviewRes.review.avoided || "",
          next: reviewRes.review.next || "",
          advice: reviewRes.review.advice || "",
        });
      } else {
        setReviewId("");
        setReview(DEFAULT_WEEKLY_REVIEW);
      }
      setTasks(tasksRes.tasks || []);
      setDirty(false);
    } catch (loadErr) {
      setError(loadErr.message || "Could not load weekly review. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadWeekData(start, end, previousStart);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [end, loadWeekData, previousStart, start]);

  // Current week tasks & metrics
  const weekTasks = useMemo(
    () => tasks.filter((t) => t.date && t.date >= start && t.date <= end),
    [end, start, tasks],
  );
  const done = useMemo(
    () => weekTasks.filter((t) => t.status === "Done").length,
    [weekTasks],
  );
  const rate = useMemo(
    () => (weekTasks.length ? Math.round((done / weekTasks.length) * 100) : 0),
    [done, weekTasks.length],
  );
  const actualMins = useMemo(
    () =>
      weekTasks.reduce(
        (sum, t) => sum + (Number(t.actual) > 0 ? Number(t.actual) : 0),
        0,
      ),
    [weekTasks],
  );
  const completedPlanned = useMemo(
    () =>
      weekTasks.reduce(
        (sum, t) =>
          sum +
          (t.status === "Done" && !(Number(t.actual) > 0)
            ? Math.max(0, Number(t.planned) || 0)
            : 0),
        0,
      ),
    [weekTasks],
  );
  const totalMinutes = actualMins + completedPlanned;

  // Previous week tasks & metrics
  const prevTasks = useMemo(
    () =>
      tasks.filter(
        (t) => t.date && t.date >= previousStart && t.date <= previousEnd,
      ),
    [previousEnd, previousStart, tasks],
  );
  const prevDone = useMemo(
    () => prevTasks.filter((t) => t.status === "Done").length,
    [prevTasks],
  );
  const prevRate = useMemo(
    () => (prevTasks.length ? Math.round((prevDone / prevTasks.length) * 100) : 0),
    [prevDone, prevTasks.length],
  );
  const prevActual = useMemo(
    () =>
      prevTasks.reduce(
        (sum, t) => sum + (Number(t.actual) > 0 ? Number(t.actual) : 0),
        0,
      ),
    [prevTasks],
  );
  const prevCompletedPlanned = useMemo(
    () =>
      prevTasks.reduce(
        (sum, t) =>
          sum +
          (t.status === "Done" && !(Number(t.actual) > 0)
            ? Math.max(0, Number(t.planned) || 0)
            : 0),
        0,
      ),
    [prevTasks],
  );
  const prevMinutes = prevActual + prevCompletedPlanned;
  const rateDiff = rate - prevRate;
  const timeDiff = totalMinutes - prevMinutes;

  function updateField(event) {
    const { name, value } = event.target;
    setReview((current) => ({ ...current, [name]: value }));
    setDirty(true);
  }

  function handleNavigate(offset) {
    if (dirty && !window.confirm("You have unsaved changes in this weekly review. Leave this week and discard those edits?")) {
      return;
    }
    const target = shiftISODate(start, offset * 7);
    setSelectedDate(target);
  }

  function handleDateInput(e) {
    const val = e.target.value;
    if (val) {
      if (dirty && !window.confirm("You have unsaved changes in this weekly review. Leave this week and discard those edits?")) {
        return;
      }
      setSelectedDate(val);
    }
  }

  async function saveWeeklyReview(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        weekStart: start,
        weekEnd: end,
        ...review,
      };

      const result = await requestJson("/api/preparation/weekly-reviews", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (result.review) {
        setReviewId(result.review._id);
        setDirty(false);
        setNotice(`Saved ✓ Week starting ${formatDate(start)}`);
        window.setTimeout(() => setNotice(""), 4000);
      }
    } catch (saveErr) {
      setError(saveErr.message || "Could not save weekly review. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteWeeklyReview() {
    if (!window.confirm(`Delete weekly review for week ${formatDate(start)} – ${formatDate(end)}?`)) {
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (reviewId) {
        await requestJson(`/api/preparation/weekly-reviews/${reviewId}`, {
          method: "DELETE",
        });
      } else {
        await requestJson(
          `/api/preparation/weekly-reviews?weekStart=${encodeURIComponent(start)}`,
          { method: "DELETE" },
        );
      }
      setReview(DEFAULT_WEEKLY_REVIEW);
      setReviewId("");
      setDirty(false);
      setNotice("Weekly review deleted.");
      window.setTimeout(() => setNotice(""), 3500);
    } catch (delErr) {
      setError(delErr.message || "Could not delete weekly review.");
    } finally {
      setSaving(false);
    }
  }

  const hasContent = Object.values(review).some((v) => String(v || "").trim() !== "");
  let statusText = "No review saved for this week yet";
  if (dirty) {
    statusText = "Unsaved changes";
  } else if (notice) {
    statusText = notice;
  } else if (reviewId || hasContent) {
    statusText = "Saved review exists for this week";
  }

  return (
    <section id="view-week" className="panel diary-panel">
      <h2>Weekly review</h2>

      {/* Week Navigation */}
      <div className="week-navigation" role="group" aria-label="Weekly review navigation">
        <button
          type="button"
          id="prevWeek"
          className="week-nav-btn week-prev-btn"
          onClick={() => handleNavigate(-1)}
        >
          ← Previous week
        </button>

        <div className="week-date-control">
          <label htmlFor="weekDate">Choose a date in the week</label>
          <div className="week-date-entry">
            <input
              id="weekDate"
              type="date"
              aria-label="Choose date"
              value={selectedDate}
              onChange={handleDateInput}
            />
          </div>
          <div className="date-format-hint">Any date selects its Monday–Sunday week</div>
        </div>

        <button
          type="button"
          id="nextWeek"
          className="week-nav-btn week-next-btn"
          onClick={() => handleNavigate(1)}
        >
          Next week →
        </button>

        <button
          type="button"
          id="thisWeekBtn"
          className="primary diary-primary week-this-btn"
          onClick={() => {
            if (dirty && !window.confirm("You have unsaved changes in this weekly review. Leave this week and discard those edits?")) {
              return;
            }
            setSelectedDate(localDateString());
          }}
        >
          This week
        </button>
      </div>

      {/* Week Range Strip */}
      <div className="week-range-strip">
        <strong id="weekRangeLabel">
          Week: {formatDate(start)} – {formatDate(end)}
        </strong>
        <span id="weekRecordStatus" className="diary-muted diary-small" role="status">
          {statusText}
        </span>
      </div>

      {/* Automatic Weekly Summary */}
      <section
        id="weekAutoSummary"
        className="week-auto-summary"
        aria-live="polite"
        aria-label="Automatic weekly summary"
      >
        <div className="week-summary-heading">
          <h3>📊 Your week at a glance</h3>
          <p>Calculated from tasks saved in your Daily Diary for this Monday–Sunday week.</p>
        </div>

        <div className="week-summary-metrics">
          <article className="week-summary-metric">
            <span>Tasks planned</span>
            <strong id="weekTasksTotal">{weekTasks.length}</strong>
            <small id="weekTasksDateNote">{formatDate(start)} – {formatDate(end)}</small>
          </article>

          <article className="week-summary-metric">
            <span>Tasks completed</span>
            <strong id="weekTasksDone">{done}</strong>
            <small id="weekTasksDoneNote">{Math.max(0, weekTasks.length - done)} not marked Done</small>
          </article>

          <article className="week-summary-metric">
            <span>Completion rate</span>
            <strong id="weekCompletionRate">{rate}%</strong>
            <div className="week-summary-progress">
              <span id="weekCompletionBar" style={{ width: `${rate}%` }}></span>
            </div>
          </article>

          <article className="week-summary-metric">
            <span>Recorded study time</span>
            <strong id="weekStudyTime">{formatMinutes(totalMinutes)}</strong>
            <small id="weekStudyTimeNote">
              {actualMins ? `${formatMinutes(actualMins)} actual time entered` : ""}
              {actualMins && completedPlanned ? " + " : ""}
              {completedPlanned ? `${formatMinutes(completedPlanned)} planned time for completed tasks` : ""}
              {!actualMins && !completedPlanned ? "No actual time or completed-task estimate yet" : ""}
            </small>
          </article>
        </div>

        {/* Week Comparison */}
        <div className="week-comparison" id="weekComparison">
          <div className="week-summary-heading">
            <h3>↗ Week-over-week comparison</h3>
            <p>Compare this selected week with the previous Monday–Sunday week.</p>
          </div>

          <div className="week-comparison-grid">
            <article className="week-comparison-item">
              <span>This week vs last week · Completion</span>
              <strong id="weekCompletionChange">
                {prevTasks.length ? `${rateDiff > 0 ? `+${rateDiff}` : rateDiff} percentage points` : "—"}
              </strong>
              <small id="weekCompletionComparisonNote">
                {prevTasks.length
                  ? `${rate}% this week vs ${prevRate}% last week (${prevDone}/${prevTasks.length} completed last week)`
                  : "No tasks were recorded last week, so there is no baseline yet."}
              </small>
            </article>

            <article className="week-comparison-item">
              <span>This week vs last week · Study time</span>
              <strong id="weekTimeChange">
                {prevTasks.length
                  ? `${timeDiff > 0 ? "+" : ""}${formatMinutes(Math.abs(timeDiff))}${timeDiff < 0 ? " less" : timeDiff > 0 ? " more" : " no change"}`
                  : "—"}
              </strong>
              <small id="weekTimeComparisonNote">
                {prevTasks.length
                  ? `${formatMinutes(totalMinutes)} this week vs ${formatMinutes(prevMinutes)} last week`
                  : "No tasks were recorded last week, so there is no baseline yet."}
              </small>
            </article>
          </div>
        </div>

        <p className="week-summary-footnote" id="weekSummaryFootnote">
          {weekTasks.length
            ? `Based on ${weekTasks.length} saved task${weekTasks.length === 1 ? "" : "s"} this week. Study time adds entered actual minutes; for completed tasks without actual time, it uses planned minutes. Incomplete tasks without actual time are not counted as study time.`
            : "No tasks recorded for this week yet. Add tasks in Daily Diary to populate this summary."}
        </p>
      </section>

      {/* Review Fields Form */}
      <form onSubmit={saveWeeklyReview}>
        <div className="reviewgrid">
          <div>
            <label htmlFor="wGoals">Week&apos;s main goals</label>
            <textarea
              id="wGoals"
              name="goals"
              value={review.goals}
              onChange={updateField}
            />
          </div>
          <div>
            <label htmlFor="wVarc">VARC progress / evidence</label>
            <textarea
              id="wVarc"
              name="varc"
              value={review.varc}
              onChange={updateField}
            />
          </div>
          <div>
            <label htmlFor="wQuant">Quant progress / evidence</label>
            <textarea
              id="wQuant"
              name="quant"
              value={review.quant}
              onChange={updateField}
            />
          </div>
          <div>
            <label htmlFor="wDilr">DILR progress / evidence</label>
            <textarea
              id="wDilr"
              name="dilr"
              value={review.dilr}
              onChange={updateField}
            />
          </div>
          <div>
            <label htmlFor="wRevision">Revision / mocks completed</label>
            <textarea
              id="wRevision"
              name="revision"
              value={review.revision}
              onChange={updateField}
            />
          </div>
          <div>
            <label htmlFor="wImproved">What improved?</label>
            <textarea
              id="wImproved"
              name="improved"
              value={review.improved}
              onChange={updateField}
            />
          </div>
          <div>
            <label htmlFor="wMistakes">Repeated mistakes / weak areas</label>
            <textarea
              id="wMistakes"
              name="mistakes"
              value={review.mistakes}
              onChange={updateField}
            />
          </div>
          <div>
            <label htmlFor="wAvoided">What did I avoid?</label>
            <textarea
              id="wAvoided"
              name="avoided"
              value={review.avoided}
              onChange={updateField}
            />
          </div>
          <div>
            <label htmlFor="wNext">Next week&apos;s top 3 priorities</label>
            <textarea
              id="wNext"
              name="next"
              value={review.next}
              onChange={updateField}
            />
          </div>
          <div>
            <label htmlFor="wAdvice">ChatGPT advice / decisions</label>
            <textarea
              id="wAdvice"
              name="advice"
              value={review.advice}
              onChange={updateField}
            />
          </div>
        </div>

        <div className="formactions diary-formactions">
          <button
            className="primary diary-primary"
            type="submit"
            id="saveWeek"
            disabled={saving || loading}
          >
            {saving ? "Saving…" : "Save weekly review"}
          </button>
          {reviewId ? (
            <button
              type="button"
              className="diary-danger"
              disabled={saving || loading}
              onClick={deleteWeeklyReview}
            >
              Delete weekly review
            </button>
          ) : null}
          {notice ? (
            <span
              className="diary-small diary-muted"
              style={{ alignSelf: "center", color: "#216b3a", fontWeight: 600 }}
              role="status"
            >
              {notice}
            </span>
          ) : null}
        </div>
        {error ? (
          <p className="diary-feedback diary-feedback-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
