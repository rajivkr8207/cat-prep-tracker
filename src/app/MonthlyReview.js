"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requestJson } from "@/lib/api-client";

const DEFAULT_MONTHLY_REVIEW = {
  goal: "",
  topics: "",
  evidence: "",
  varc: "",
  quant: "",
  dilr: "",
  revision: "",
  mocks: "",
  notWork: "",
  next: "",
};

function localDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function monthFirstDay(monthKey) {
  return `${monthKey}-01`;
}

function monthLastDay(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDate).padStart(2, "0")}`;
}

function shiftMonth(monthKey, offset) {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + offset, 1, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
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

export default function MonthlyReview() {
  const [selectedMonthKey, setSelectedMonthKey] = useState(() =>
    localDateString().slice(0, 7),
  );
  const [review, setReview] = useState(DEFAULT_MONTHLY_REVIEW);
  const [reviewId, setReviewId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const datePickerRef = useRef(null);

  const start = useMemo(() => monthFirstDay(selectedMonthKey), [selectedMonthKey]);
  const end = useMemo(() => monthLastDay(selectedMonthKey), [selectedMonthKey]);
  const previousMonthKey = useMemo(
    () => shiftMonth(selectedMonthKey, -1),
    [selectedMonthKey],
  );
  const previousStart = useMemo(
    () => monthFirstDay(previousMonthKey),
    [previousMonthKey],
  );
  const previousEnd = useMemo(
    () => monthLastDay(previousMonthKey),
    [previousMonthKey],
  );

  const loadMonthData = useCallback(
    async (mKey, currentStart, currentEnd, prevStart) => {
      setLoading(true);
      setError("");
      setNotice("");
      try {
        const [reviewRes, tasksRes] = await Promise.all([
          requestJson(
            `/api/preparation/monthly-reviews?monthKey=${encodeURIComponent(mKey)}`,
          ),
          requestJson(
            `/api/preparation/tasks?from=${encodeURIComponent(prevStart)}&to=${encodeURIComponent(currentEnd)}&limit=1000`,
          ),
        ]);

        if (reviewRes.review) {
          setReviewId(reviewRes.review._id);
          setReview({
            goal: reviewRes.review.goal || "",
            topics: reviewRes.review.topics || "",
            evidence: reviewRes.review.evidence || "",
            varc: reviewRes.review.varc || "",
            quant: reviewRes.review.quant || "",
            dilr: reviewRes.review.dilr || "",
            revision: reviewRes.review.revision || "",
            mocks: reviewRes.review.mocks || "",
            notWork: reviewRes.review.notWork || "",
            next: reviewRes.review.next || "",
          });
        } else {
          setReviewId("");
          setReview(DEFAULT_MONTHLY_REVIEW);
        }
        setTasks(tasksRes.tasks || []);
        setDirty(false);
      } catch (loadErr) {
        setError(loadErr.message || "Could not load monthly review. Try again.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadMonthData(selectedMonthKey, start, end, previousStart);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [end, loadMonthData, previousStart, selectedMonthKey, start]);

  // Current month tasks & metrics
  const monthTasks = useMemo(
    () => tasks.filter((t) => t.date && t.date >= start && t.date <= end),
    [end, start, tasks],
  );
  const done = useMemo(
    () => monthTasks.filter((t) => t.status === "Done").length,
    [monthTasks],
  );
  const rate = useMemo(
    () => (monthTasks.length ? Math.round((done / monthTasks.length) * 100) : 0),
    [done, monthTasks.length],
  );
  const actualMins = useMemo(
    () =>
      monthTasks.reduce(
        (sum, t) => sum + (Number(t.actual) > 0 ? Number(t.actual) : 0),
        0,
      ),
    [monthTasks],
  );
  const completedPlanned = useMemo(
    () =>
      monthTasks.reduce(
        (sum, t) =>
          sum +
          (t.status === "Done" && !(Number(t.actual) > 0)
            ? Math.max(0, Number(t.planned) || 0)
            : 0),
        0,
      ),
    [monthTasks],
  );
  const totalMinutes = actualMins + completedPlanned;

  // Previous month tasks & metrics
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
    if (
      dirty &&
      !window.confirm(
        "You have unsaved changes in this monthly review. Leave this month and discard those edits?",
      )
    ) {
      return;
    }
    const target = shiftMonth(selectedMonthKey, offset);
    setSelectedMonthKey(target);
  }

  function handleDateInput(e) {
    const val = e.target.value;
    if (val) {
      const key = val.slice(0, 7);
      if (
        dirty &&
        !window.confirm(
          "You have unsaved changes in this monthly review. Leave this month and discard those edits?",
        )
      ) {
        return;
      }
      setSelectedMonthKey(key);
    }
  }

  async function saveMonthlyReview(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const [yearStr, monthStr] = selectedMonthKey.split("-");
      const payload = {
        year: Number(yearStr),
        month: Number(monthStr),
        ...review,
      };

      const result = await requestJson("/api/preparation/monthly-reviews", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (result.review) {
        setReviewId(result.review._id);
        setDirty(false);
        setNotice(`Saved ✓ Month: ${selectedMonthKey}`);
        window.setTimeout(() => setNotice(""), 4000);
      }
    } catch (saveErr) {
      setError(saveErr.message || "Could not save monthly review. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMonthlyReview() {
    if (
      !window.confirm(
        `Delete monthly review for month ${selectedMonthKey} (${formatDate(start)} – ${formatDate(end)})?`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (reviewId) {
        await requestJson(`/api/preparation/monthly-reviews/${reviewId}`, {
          method: "DELETE",
        });
      } else {
        await requestJson(
          `/api/preparation/monthly-reviews?monthKey=${encodeURIComponent(selectedMonthKey)}`,
          { method: "DELETE" },
        );
      }
      setReview(DEFAULT_MONTHLY_REVIEW);
      setReviewId("");
      setDirty(false);
      setNotice("Monthly review deleted.");
      window.setTimeout(() => setNotice(""), 3500);
    } catch (delErr) {
      setError(delErr.message || "Could not delete monthly review.");
    } finally {
      setSaving(false);
    }
  }

  const hasContent = Object.values(review).some((v) => String(v || "").trim() !== "");
  let statusText = "No review saved for this month yet";
  if (dirty) {
    statusText = "Unsaved changes";
  } else if (notice) {
    statusText = notice;
  } else if (reviewId || hasContent) {
    statusText = "Saved review exists for this month";
  }

  return (
    <section id="view-month" className="panel diary-panel">
      <div className="topbar monthly-heading">
        <h2>Monthly review</h2>
        <span className="diary-muted diary-small">One review per calendar month</span>
      </div>

      {/* Month Navigation */}
      <div
        className="controls month-navigation"
        role="group"
        aria-label="Monthly review navigation"
      >
        <button
          type="button"
          id="prevMonth"
          className="week-nav-btn week-prev-btn"
          onClick={() => handleNavigate(-1)}
        >
          ← Previous month
        </button>

        <div className="week-date-control month-date-control">
          <label htmlFor="monthDate">Selected month</label>
          <div className="week-date-input-row">
            <input
              id="monthDate"
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/YYYY"
              maxLength={10}
              autoComplete="off"
              aria-label="Choose a date in the month (DD/MM/YYYY)"
              value={formatDate(start)}
              readOnly
            />
            <button
              type="button"
              id="monthCalendarBtn"
              className="week-calendar-btn"
              aria-label="Open calendar"
              title="Choose from calendar"
              onClick={() => {
                try {
                  if (datePickerRef.current?.showPicker) {
                    datePickerRef.current.showPicker();
                  } else {
                    datePickerRef.current?.click();
                  }
                } catch {
                  datePickerRef.current?.click();
                }
              }}
            >
              📅
            </button>
            <input
              ref={datePickerRef}
              id="monthDatePicker"
              type="date"
              lang="en-GB"
              aria-label="Calendar date picker"
              className="week-date-picker-native"
              tabIndex={-1}
              value={start}
              onChange={handleDateInput}
            />
          </div>
          <div className="date-format-hint">
            Date format: DD/MM/YYYY · any date selects its month
          </div>
        </div>

        <button
          type="button"
          id="nextMonth"
          className="week-nav-btn week-next-btn"
          onClick={() => handleNavigate(1)}
        >
          Next month →
        </button>

        <button
          type="button"
          id="thisMonthBtn"
          className="primary diary-primary week-this-btn"
          onClick={() => {
            if (
              dirty &&
              !window.confirm(
                "You have unsaved changes in this monthly review. Leave this month and discard those edits?",
              )
            ) {
              return;
            }
            setSelectedMonthKey(localDateString().slice(0, 7));
          }}
        >
          This month
        </button>
      </div>

      {/* Month Range Strip */}
      <div className="week-range-strip">
        <strong id="monthRangeLabel">
          Month: {formatDate(start)} – {formatDate(end)}
        </strong>
        <span id="monthRecordStatus" className="diary-muted diary-small" role="status">
          {statusText}
        </span>
      </div>

      {/* Automatic Monthly Summary */}
      <section
        id="monthAutoSummary"
        className="month-auto-summary"
        aria-live="polite"
        aria-label="Automatic monthly summary"
      >
        <div className="month-summary-heading">
          <h3>📊 Monthly performance snapshot</h3>
          <p>
            Automatically calculated from your Daily Diary and mock records for the
            selected calendar month.
          </p>
        </div>

        <div className="month-summary-metrics">
          <article className="month-summary-metric">
            <span>Tasks planned</span>
            <strong id="monthTasksTotal">{monthTasks.length}</strong>
            <small id="monthTasksDateNote">
              {formatDate(start)} – {formatDate(end)}
            </small>
          </article>

          <article className="month-summary-metric">
            <span>Tasks completed</span>
            <strong id="monthTasksDone">{done}</strong>
            <small id="monthTasksDoneNote">
              {Math.max(0, monthTasks.length - done)} not marked Done
            </small>
          </article>

          <article className="month-summary-metric">
            <span>Completion rate</span>
            <strong id="monthCompletionRate">{rate}%</strong>
            <div className="month-summary-progress">
              <span id="monthCompletionBar" style={{ width: `${rate}%` }}></span>
            </div>
          </article>

          <article className="month-summary-metric">
            <span>Study time</span>
            <strong id="monthStudyTime">{formatMinutes(totalMinutes)}</strong>
            <small id="monthStudyTimeNote">
              {actualMins ? `${formatMinutes(actualMins)} actual` : ""}
              {actualMins && completedPlanned ? " + " : ""}
              {completedPlanned
                ? `${formatMinutes(completedPlanned)} planned for completed tasks`
                : ""}
              {!actualMins && !completedPlanned ? "No study-time data yet" : ""}
            </small>
          </article>

          <article className="month-summary-metric">
            <span>Mocks recorded</span>
            <strong id="monthMockCount">0</strong>
            <small>From your Mock tab</small>
          </article>
        </div>

        {/* Month-over-Month Comparison */}
        <div className="month-comparison" id="monthComparison" aria-live="polite">
          <div className="month-summary-heading">
            <h3>↗ Month-over-month comparison</h3>
            <p>Compare this month with the previous calendar month.</p>
          </div>

          <div className="month-comparison-grid">
            <article className="month-comparison-item">
              <span>Completion rate</span>
              <strong id="monthCompletionChange">
                {prevTasks.length
                  ? `${rateDiff > 0 ? `+${rateDiff}` : rateDiff} percentage points`
                  : "—"}
              </strong>
              <small id="monthCompletionComparisonNote">
                {prevTasks.length
                  ? `${rate}% this month vs ${prevRate}% last month`
                  : "No task records last month, so there is no baseline yet."}
              </small>
            </article>

            <article className="month-comparison-item">
              <span>Study time</span>
              <strong id="monthTimeChange">
                {prevTasks.length
                  ? `${timeDiff > 0 ? "+" : ""}${formatMinutes(Math.abs(timeDiff))}${timeDiff < 0 ? " less" : timeDiff > 0 ? " more" : " no change"}`
                  : "—"}
              </strong>
              <small id="monthTimeComparisonNote">
                {prevTasks.length
                  ? `${formatMinutes(totalMinutes)} this month vs ${formatMinutes(prevMinutes)} last month`
                  : "No task records last month, so there is no baseline yet."}
              </small>
            </article>

            <article className="month-comparison-item">
              <span>Mock activity</span>
              <strong id="monthMockChange">—</strong>
              <small id="monthMockComparisonNote">No mock records for either month yet.</small>
            </article>
          </div>
        </div>

        <p className="month-summary-footnote" id="monthSummaryFootnote">
          {monthTasks.length
            ? `Based on ${monthTasks.length} saved task${monthTasks.length === 1 ? "" : "s"} and 0 mock records in ${selectedMonthKey}. Incomplete tasks without actual time are excluded from study time.`
            : `No tasks or mocks recorded for ${selectedMonthKey} yet. Add entries in Daily Diary or the Mock tab to populate this snapshot.`}
        </p>
      </section>

      {/* Review Fields Form */}
      <form onSubmit={saveMonthlyReview}>
        <div className="reviewgrid">
          <div>
            <label htmlFor="mGoal">Main goal this month</label>
            <textarea
              id="mGoal"
              name="goal"
              value={review.goal}
              onChange={updateField}
            />
          </div>
          <div>
            <label htmlFor="mTopics">Topics / skills to finish</label>
            <textarea
              id="mTopics"
              name="topics"
              value={review.topics}
              onChange={updateField}
            />
          </div>
          <div>
            <label htmlFor="mEvidence">Evidence of progress</label>
            <textarea
              id="mEvidence"
              name="evidence"
              value={review.evidence}
              onChange={updateField}
            />
          </div>
          <div>
            <label htmlFor="mVarc">VARC assessment</label>
            <textarea
              id="mVarc"
              name="varc"
              value={review.varc}
              onChange={updateField}
            />
          </div>
          <div>
            <label htmlFor="mQuant">Quant assessment</label>
            <textarea
              id="mQuant"
              name="quant"
              value={review.quant}
              onChange={updateField}
            />
          </div>
          <div>
            <label htmlFor="mDilr">DILR assessment</label>
            <textarea
              id="mDilr"
              name="dilr"
              value={review.dilr}
              onChange={updateField}
            />
          </div>
          <div>
            <label htmlFor="mRevision">Revision / error log</label>
            <textarea
              id="mRevision"
              name="revision"
              value={review.revision}
              onChange={updateField}
            />
          </div>
          <div>
            <label htmlFor="mMocks">Mocks / sectionals + analysis</label>
            <textarea
              id="mMocks"
              name="mocks"
              value={review.mocks}
              onChange={updateField}
            />
          </div>
          <div>
            <label htmlFor="mNotWork">What didn&apos;t work?</label>
            <textarea
              id="mNotWork"
              name="notWork"
              value={review.notWork}
              onChange={updateField}
            />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label htmlFor="mNext">Next month&apos;s adjustment and advice</label>
            <textarea
              id="mNext"
              name="next"
              value={review.next}
              onChange={updateField}
            />
          </div>
        </div>

        <div className="formactions diary-formactions">
          <button
            className="primary diary-primary"
            type="submit"
            id="saveMonth"
            disabled={saving || loading}
          >
            {saving ? "Saving…" : "Save monthly review"}
          </button>
          {reviewId ? (
            <button
              type="button"
              className="diary-danger"
              disabled={saving || loading}
              onClick={deleteMonthlyReview}
            >
              Delete monthly review
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
