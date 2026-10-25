"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/api-client";
import {
  CAT_FULL_SYLLABUS,
  COVERED_STATUSES,
  SYLLABUS_SECTIONS,
  SYLLABUS_STATUSES,
} from "@/lib/syllabus-api";

function localDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function daysSince(rawDate) {
  if (!rawDate) return null;
  const a = new Date(rawDate + "T12:00:00Z");
  const b = new Date(localDateString() + "T12:00:00Z");
  if (isNaN(a.getTime()) || a > b) return null;
  return Math.floor((b - a) / 86400000);
}

export default function SyllabusTracker() {
  const [progressMap, setProgressMap] = useState({});
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadProgress = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await requestJson("/api/preparation/syllabus");
      const map = {};
      (res.progress || []).forEach((item) => {
        const key = `${item.subject}|${item.group}|${item.topicName}`;
        map[key] = {
          status: item.status || "Not started",
          lastCoveredAt: item.lastCoveredAt || "",
          revisionCount: item.revisionCount || 0,
          notes: item.notes || "",
        };
      });
      setProgressMap(map);
    } catch (err) {
      setError(err.message || "Failed to load syllabus progress.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadProgress, 0);
    return () => window.clearTimeout(timer);
  }, [loadProgress]);

  // Update a single topic status or date
  async function updateTopic(subject, group, topicName, statusUpdate, dateUpdate) {
    const key = `${subject}|${group}|${topicName}`;
    const current = progressMap[key] || {
      status: "Not started",
      lastCoveredAt: "",
      revisionCount: 0,
      notes: "",
    };

    let newStatus = statusUpdate !== undefined ? statusUpdate : current.status;
    let newDate = dateUpdate !== undefined ? dateUpdate : current.lastCoveredAt;

    // Original auto-date logic from CAT2027.html:
    // If status changed to Covered once or Revised, auto set date to today
    if (
      statusUpdate !== undefined &&
      ["Covered once", "Revised"].includes(statusUpdate) &&
      current.status !== statusUpdate
    ) {
      newDate = localDateString();
    }

    // If date set and status was Not started, set to Covered once
    if (dateUpdate !== undefined && dateUpdate && (newStatus === "Not started" || !newStatus)) {
      newStatus = "Covered once";
    }

    // Optimistic UI update
    setProgressMap((prev) => ({
      ...prev,
      [key]: {
        ...current,
        status: newStatus,
        lastCoveredAt: newDate,
      },
    }));

    try {
      await requestJson("/api/preparation/syllabus", {
        method: "POST",
        body: JSON.stringify({
          subject,
          group,
          topicName,
          status: newStatus,
          lastCoveredAt: newDate,
        }),
      });
    } catch (err) {
      setError(err.message || "Failed to save syllabus update.");
      // Rollback on failure
      setProgressMap((prev) => ({ ...prev, [key]: current }));
    }
  }

  function resetFilters() {
    setSearch("");
    setSectionFilter("All");
    setStatusFilter("All");
  }

  // Filter and metrics calculation
  const { filteredGroups, totalInView, coveredInView, progressInView, subjectBreakdowns } =
    useMemo(() => {
      const q = search.trim().toLowerCase();
      let total = 0;
      let covered = 0;
      let progress = 0;

      const subjectStats = {
        VARC: { total: 0, covered: 0 },
        DILR: { total: 0, covered: 0 },
        Quant: { total: 0, covered: 0 },
      };

      const groups = CAT_FULL_SYLLABUS.map((grp) => {
        const topics = grp.topics
          .map((name) => {
            const key = `${grp.section}|${grp.group}|${name}`;
            const item = progressMap[key] || { status: "Not started", lastCoveredAt: "" };
            const isCovered = COVERED_STATUSES.includes(item.status);
            const isLearning = item.status === "Learning";

            // Track global subject stats
            if (subjectStats[grp.section]) {
              subjectStats[grp.section].total++;
              if (isCovered) subjectStats[grp.section].covered++;
            }

            const matchSection = sectionFilter === "All" || sectionFilter === grp.section;
            const matchStatus = statusFilter === "All" || item.status === statusFilter;
            const matchSearch =
              !q || `${grp.section} ${grp.group} ${name}`.toLowerCase().includes(q);

            const visible = matchSection && matchStatus && matchSearch;
            if (visible) {
              total++;
              if (isCovered) covered++;
              if (isLearning) progress++;
            }

            return {
              name,
              key,
              status: item.status,
              lastCoveredAt: item.lastCoveredAt,
              visible,
            };
          })
          .filter((t) => t.visible);

        const totalGroup = grp.topics.length;
        const coveredGroup = grp.topics.filter((name) => {
          const key = `${grp.section}|${grp.group}|${name}`;
          const item = progressMap[key];
          return item && COVERED_STATUSES.includes(item.status);
        }).length;

        return {
          ...grp,
          filteredTopics: topics,
          totalGroup,
          coveredGroup,
        };
      }).filter((grp) => grp.filteredTopics.length > 0);

      return {
        filteredGroups: groups,
        totalInView: total,
        coveredInView: covered,
        progressInView: progress,
        subjectBreakdowns: subjectStats,
      };
    }, [progressMap, search, sectionFilter, statusFilter]);

  const coveragePercent = totalInView > 0 ? Math.round((coveredInView / totalInView) * 100) : 0;

  return (
    <section id="view-syllabus" className="panel diary-panel">
      {/* Top Header */}
      <div className="topbar">
        <div>
          <h2>📚 Full CAT syllabus tracker</h2>
          <p className="diary-muted diary-small">
            Chapter-wise CAT preparation checklist. Quant is organised into Arithmetic, Algebra,
            Number System, Geometry (including Mensuration) and Modern Maths.
          </p>
        </div>
        <button id="syllabusResetFilters" type="button" onClick={resetFilters}>
          Reset filters
        </button>
      </div>

      <div className="notice small diary-notice" style={{ margin: "14px 0" }}>
        This is a comprehensive standard-preparation syllabus, not an official topic-by-topic list
        published by CAT authorities. The exam pattern and question mix can change. Use this page to
        track syllabus exposure and revision. Topics at least 14 days old are highlighted for
        revision.
      </div>

      {/* Summary Stats Grid */}
      <div className="syllabus-summary">
        <div className="syllabus-stat">
          <small>Topics in view</small>
          <strong id="syllabusVisibleCount">{totalInView}</strong>
        </div>
        <div className="syllabus-stat">
          <small>Covered / revised</small>
          <strong id="syllabusMasteredCount">{coveredInView}</strong>
        </div>
        <div className="syllabus-stat">
          <small>In progress</small>
          <strong id="syllabusProgressCount">{progressInView}</strong>
        </div>
        <div className="syllabus-stat">
          <small>Coverage</small>
          <strong id="syllabusCoverage">{coveragePercent}%</strong>
        </div>
      </div>

      {/* Subject-wise Quick Overview Bar */}
      <div className="topic-stats-grid" style={{ marginBottom: "16px" }}>
        {SYLLABUS_SECTIONS.map((sec) => {
          const stats = subjectBreakdowns[sec] || { total: 0, covered: 0 };
          const pct = stats.total > 0 ? Math.round((stats.covered / stats.total) * 100) : 0;
          const toneClass =
            sec === "VARC"
              ? "topic-stat-pink"
              : sec === "DILR"
                ? "topic-stat-green"
                : "topic-stat-blue";
          return (
            <div
              key={sec}
              className={`topic-stat ${toneClass}`}
              style={{ cursor: "pointer" }}
              onClick={() => setSectionFilter(sec)}
              title={`Filter to ${sec}`}
            >
              <small>{sec} Syllabus</small>
              <strong>
                {stats.covered} / {stats.total}
              </strong>
              <span>{pct}% complete</span>
              <div className="syllabus-progress-track" style={{ marginTop: "6px" }}>
                <span style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Search and Filters */}
      <div className="syllabus-controls">
        <input
          id="syllabusSearch"
          type="search"
          placeholder="Search a chapter, e.g. percentages, logarithms, triangles"
          aria-label="Search syllabus topics"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          id="syllabusSectionFilter"
          aria-label="Filter syllabus section"
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
        >
          <option value="All">All sections</option>
          {SYLLABUS_SECTIONS.map((sec) => (
            <option key={sec} value={sec}>
              {sec}
            </option>
          ))}
        </select>
        <select
          id="syllabusStatusFilter"
          aria-label="Filter syllabus status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All statuses</option>
          {SYLLABUS_STATUSES.map((st) => (
            <option key={st}>{st}</option>
          ))}
        </select>
      </div>

      {/* Syllabus Group Sections */}
      <div id="fullSyllabusList">
        {loading && totalInView === 0 ? (
          <div className="empty diary-empty">Loading syllabus progress…</div>
        ) : filteredGroups.length === 0 ? (
          <div className="empty diary-empty">
            No topics match these filters. Try another search or status.
          </div>
        ) : (
          filteredGroups.map((grp) => {
            const tone =
              grp.section === "VARC"
                ? "varc"
                : grp.section === "DILR"
                  ? "dilr"
                  : "quant";
            return (
              <div key={`${grp.section}-${grp.group}`} className="syllabus-section">
                <div className={`syllabus-section-head ${tone}`}>
                  <span>
                    {grp.section} · {grp.group}
                  </span>
                  <span className="syllabus-section-progress">
                    {grp.coveredGroup}/{grp.totalGroup} covered
                  </span>
                </div>

                {grp.filteredTopics.map((t) => {
                  const days = daysSince(t.lastCoveredAt);
                  const isOverdue = days !== null && days >= 14;

                  let daysText = "Not covered yet";
                  if (t.lastCoveredAt) {
                    if (days === null) {
                      daysText = "Date is in the future";
                    } else if (days === 0) {
                      daysText = "Covered today";
                    } else {
                      daysText = `${days} day${days === 1 ? "" : "s"} ago${isOverdue ? " · due for revision" : ""}`;
                    }
                  }

                  return (
                    <div key={t.key} className="syllabus-topic-row">
                      <div>
                        <div className="syllabus-topic-name">{t.name}</div>
                        <div className="syllabus-topic-group">{grp.group}</div>
                      </div>

                      <select
                        aria-label={`Coverage status for ${t.name}`}
                        value={t.status}
                        onChange={(e) =>
                          updateTopic(grp.section, grp.group, t.name, e.target.value, undefined)
                        }
                      >
                        {SYLLABUS_STATUSES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>

                      <label className={`syllabus-last-covered ${isOverdue ? "overdue" : ""}`}>
                        <span>Last covered · DD/MM/YYYY</span>
                        <input
                          type="date"
                          lang="en-GB"
                          value={t.lastCoveredAt || ""}
                          aria-label={`Last covered date for ${t.name}`}
                          onChange={(e) =>
                            updateTopic(
                              grp.section,
                              grp.group,
                              t.name,
                              undefined,
                              e.target.value,
                            )
                          }
                        />
                        <span className="days-label">{daysText}</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      <p className="syllabus-footnote">
        Tip: use this checklist for coverage only: Not started → Learning → Covered once → Needs
        revision / Revised. Use <b>Topic Dashboard</b> separately to track accuracy, attempts,
        revision dates and independent solving. Last-covered dates are saved in MongoDB. Topics at
        least 14 days old are highlighted for revision.
      </p>

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
