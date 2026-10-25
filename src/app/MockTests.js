"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/api-client";

const SECTIONS = ["VARC", "DILR", "Quant"];

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

const EMPTY_SECTION_FORM = {
  total: "",
  attempted: "",
  correct: "",
  wrongNeg: "",
  wrongNoNeg: "",
};

function calcSection(secForm) {
  const n = (x) => (x === "" || x == null ? null : Number(x));
  const total = n(secForm?.total);
  const attempted = n(secForm?.attempted);
  const correct = n(secForm?.correct);
  const wrongNeg = n(secForm?.wrongNeg);
  const wrongNoNeg = n(secForm?.wrongNoNeg);

  const hasAny = [total, attempted, correct, wrongNeg, wrongNoNeg].some((x) => x !== null);
  if (!hasAny) return null;

  const cor = correct ?? 0;
  const wn = wrongNeg ?? 0;
  const wnn = wrongNoNeg ?? 0;
  const att = attempted ?? (cor + wn + wnn);
  const incorrect = wn + wnn;
  const unattempted = total === null ? null : Math.max(0, total - att);
  const accuracy = att > 0 ? (cor / att) * 100 : null;
  const score = 3 * cor - wn;

  return {
    total,
    attempted: att,
    correct: cor,
    wrongNeg: wn,
    wrongNoNeg: wnn,
    incorrect,
    unattempted,
    accuracy,
    score,
  };
}

export default function MockTests() {
  const [mocks, setMocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Form State
  const [editingId, setEditingId] = useState("");
  const [mode, setMode] = useState("full"); // "full" or "sectional"
  const [testSection, setTestSection] = useState("VARC");
  const [testName, setTestName] = useState("");
  const [testDate, setTestDate] = useState(() => localDateString());
  const [percentile, setPercentile] = useState("");
  const [loss, setLoss] = useState("");
  const [action, setAction] = useState("");

  // Section inputs
  const [sectionInputs, setSectionInputs] = useState({
    VARC: { ...EMPTY_SECTION_FORM, total: "24" },
    DILR: { ...EMPTY_SECTION_FORM, total: "20" },
    Quant: { ...EMPTY_SECTION_FORM, total: "22" },
  });

  // Load Mock Tests from API
  const loadMocks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await requestJson("/api/preparation/mock-tests");
      if (res?.mockTests) {
        setMocks(res.mockTests);
      }
    } catch (err) {
      setError(err.message || "Could not load mock tests. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMocks();
  }, [loadMocks]);

  // Section field changes
  function updateSectionField(sec, field, value) {
    setSectionInputs((prev) => ({
      ...prev,
      [sec]: {
        ...prev[sec],
        [field]: value,
      },
    }));
  }

  // Calculated Section Summaries
  const calculatedSummaries = useMemo(() => {
    const res = {};
    for (const sec of SECTIONS) {
      res[sec] = calcSection(sectionInputs[sec]);
    }
    return res;
  }, [sectionInputs]);

  // Calculated Overall Score and Total Attempts for Form
  const formOverall = useMemo(() => {
    const activeSections = mode === "full" ? SECTIONS : [testSection];
    let totalScore = 0;
    let totalAttempts = 0;
    let hasAnyData = false;

    for (const sec of activeSections) {
      const st = calculatedSummaries[sec];
      if (st) {
        hasAnyData = true;
        totalScore += st.score;
        totalAttempts += st.attempted;
      }
    }

    return {
      score: hasAnyData ? totalScore : "",
      attempts: hasAnyData ? totalAttempts : "",
    };
  }, [mode, testSection, calculatedSummaries]);

  // Reset form
  function resetForm() {
    setEditingId("");
    setMode("full");
    setTestSection("VARC");
    setTestName("");
    setTestDate(localDateString());
    setPercentile("");
    setLoss("");
    setAction("");
    setSectionInputs({
      VARC: { ...EMPTY_SECTION_FORM, total: "24" },
      DILR: { ...EMPTY_SECTION_FORM, total: "20" },
      Quant: { ...EMPTY_SECTION_FORM, total: "22" },
    });
    setError("");
  }

  // Edit mock
  function startEdit(mock) {
    setEditingId(mock._id);
    const mType = mock.type || "full";
    setMode(mType);
    setTestSection(mock.testSection || "VARC");
    setTestName(mock.name || "");
    setTestDate(mock.date || localDateString());
    setPercentile(mock.percentile != null ? String(mock.percentile) : "");
    setLoss(mock.loss || "");
    setAction(mock.action || "");

    const newSecInputs = {
      VARC: { ...EMPTY_SECTION_FORM, total: "24" },
      DILR: { ...EMPTY_SECTION_FORM, total: "20" },
      Quant: { ...EMPTY_SECTION_FORM, total: "22" },
    };

    for (const sec of SECTIONS) {
      const raw = mock.sections?.[sec];
      if (raw) {
        newSecInputs[sec] = {
          total: raw.total != null ? String(raw.total) : "",
          attempted: raw.attempted != null ? String(raw.attempted) : "",
          correct: raw.correct != null ? String(raw.correct) : "",
          wrongNeg: raw.wrongNeg != null ? String(raw.wrongNeg) : "",
          wrongNoNeg: raw.wrongNoNeg != null ? String(raw.wrongNoNeg) : "",
        };
      }
    }
    setSectionInputs(newSecInputs);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Form submit
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!testName.trim()) {
      setError("Please enter a test name.");
      return;
    }
    if (!testDate) {
      setError("Please enter a valid test date.");
      return;
    }

    if (percentile !== "") {
      const p = Number(percentile);
      if (isNaN(p) || p < 0 || p > 100) {
        setError("Percentile must be between 0 and 100.");
        return;
      }
    }

    const activeSections = mode === "full" ? SECTIONS : [testSection];

    // Client-side validation per active section
    for (const sec of activeSections) {
      const inp = sectionInputs[sec];
      const countFields = [
        ["total", "total questions"],
        ["attempted", "attempted questions"],
        ["correct", "correct answers"],
        ["wrongNeg", "negative-marked incorrect answers"],
        ["wrongNoNeg", "non-negative-marked incorrect answers"],
      ];

      for (const [key, label] of countFields) {
        if (inp[key] === "") {
          setError(`${sec}: enter ${label}. Enter 0 if none.`);
          return;
        }
        const val = Number(inp[key]);
        if (!Number.isInteger(val) || val < 0) {
          setError(`${sec}: ${label} must be a non-negative whole number.`);
          return;
        }
      }

      const tot = Number(inp.total);
      const att = Number(inp.attempted);
      const cor = Number(inp.correct);
      const wn = Number(inp.wrongNeg);
      const wnn = Number(inp.wrongNoNeg);

      if (tot > 0 && att > tot) {
        setError(`${sec}: attempted questions (${att}) cannot exceed total questions (${tot}).`);
        return;
      }

      if (cor + wn + wnn !== att) {
        setError(
          `${sec}: attempted (${att}) must equal correct (${cor}) + negative-marked (${wn}) + non-negative-marked (${wnn}).`,
        );
        return;
      }
    }

    // Build payload
    const sectionsPayload = {};
    for (const sec of activeSections) {
      sectionsPayload[sec] = {
        total: Number(sectionInputs[sec].total),
        attempted: Number(sectionInputs[sec].attempted),
        correct: Number(sectionInputs[sec].correct),
        wrongNeg: Number(sectionInputs[sec].wrongNeg),
        wrongNoNeg: Number(sectionInputs[sec].wrongNoNeg),
      };
    }

    const payload = {
      name: testName.trim(),
      date: testDate,
      type: mode,
      testSection: mode === "sectional" ? testSection : "",
      percentile: percentile !== "" ? Number(percentile) : null,
      loss: loss.trim(),
      action: action.trim(),
      sections: sectionsPayload,
    };

    setSaving(true);
    try {
      if (editingId) {
        const res = await requestJson(`/api/preparation/mock-tests/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMocks((prev) =>
          prev.map((m) => (m._id === editingId ? res.mockTest : m)),
        );
        setNotice("Mock test updated successfully.");
      } else {
        const res = await requestJson("/api/preparation/mock-tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMocks((prev) => [res.mockTest, ...prev]);
        setNotice("Mock test saved successfully.");
      }

      resetForm();
      window.setTimeout(() => setNotice(""), 3500);
    } catch (err) {
      setError(err.message || "Failed to save mock test.");
    } finally {
      setSaving(false);
    }
  }

  // Delete mock test
  async function deleteMock(id) {
    if (!window.confirm("Are you sure you want to remove this test?")) return;
    setSaving(true);
    setError("");
    setNotice("");

    const previous = [...mocks];
    setMocks((prev) => prev.filter((m) => m._id !== id));

    try {
      await requestJson(`/api/preparation/mock-tests/${id}`, {
        method: "DELETE",
      });
      setNotice("Mock test removed.");
      window.setTimeout(() => setNotice(""), 3500);
    } catch (err) {
      setMocks(previous);
      setError(err.message || "Failed to delete mock test.");
    } finally {
      setSaving(false);
    }
  }

  // Filtered & sorted lists
  const sortedMocks = useMemo(() => {
    return [...mocks].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [mocks]);

  const fullMocks = useMemo(() => {
    return sortedMocks.filter((m) => m.type === "full");
  }, [sortedMocks]);

  const sectionalVARC = useMemo(() => {
    return sortedMocks.filter((m) => m.type === "sectional" && m.testSection === "VARC");
  }, [sortedMocks]);

  const sectionalDILR = useMemo(() => {
    return sortedMocks.filter((m) => m.type === "sectional" && m.testSection === "DILR");
  }, [sortedMocks]);

  const sectionalQuant = useMemo(() => {
    return sortedMocks.filter((m) => m.type === "sectional" && m.testSection === "Quant");
  }, [sortedMocks]);

  // Overall Statistics for Top Row
  const topStats = useMemo(() => {
    const totalCount = mocks.length;
    const fullCount = fullMocks.length;
    const fullScores = fullMocks.map((m) => m.score).filter((s) => s != null);
    const avgFullScore = fullScores.length
      ? (fullScores.reduce((a, b) => a + b, 0) / fullScores.length).toFixed(1)
      : "—";

    let maxFullScore = "—";
    if (fullScores.length) {
      maxFullScore = Math.max(...fullScores);
    }

    const percentiles = fullMocks.map((m) => m.percentile).filter((p) => p != null);
    const maxPercentile = percentiles.length
      ? `${Math.max(...percentiles).toFixed(1)}%ile`
      : "—";

    // Overall Accuracy across all mocks
    let allAttempts = 0;
    let allCorrect = 0;
    for (const m of mocks) {
      if (m.sections) {
        for (const sec of SECTIONS) {
          const s = m.sections[sec];
          if (s) {
            allAttempts += s.attempted || 0;
            allCorrect += s.correct || 0;
          }
        }
      }
    }
    const overallAcc = allAttempts > 0
      ? `${((allCorrect / allAttempts) * 100).toFixed(1)}%`
      : "—";

    return {
      totalCount,
      fullCount,
      avgFullScore,
      maxFullScore,
      maxPercentile,
      overallAcc,
    };
  }, [mocks, fullMocks]);

  // Helper for rendering a mock card
  function renderMockCard(m) {
    const isFull = m.type === "full";
    const tone = isFull
      ? "mock-full"
      : m.testSection === "VARC"
        ? "mock-varc"
        : m.testSection === "DILR"
          ? "mock-dilr"
          : "mock-quant";

    const secs = isFull ? SECTIONS : [m.testSection || "VARC"];

    // Aggregated stats from sections if available
    let totalQuestions = 0;
    let totalAttempted = 0;
    let totalUnattempted = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let hasSectionDetails = false;

    for (const sec of secs) {
      const s = m.sections?.[sec];
      if (s) {
        hasSectionDetails = true;
        totalQuestions += s.total || 0;
        totalAttempted += s.attempted || 0;
        totalCorrect += s.correct || 0;
        const wn = s.wrongNeg || 0;
        const wnn = s.wrongNoNeg || 0;
        totalIncorrect += wn + wnn;
        totalUnattempted += Math.max(0, (s.total || 0) - (s.attempted || 0));
      }
    }

    const accuracy = totalAttempted > 0
      ? `${((totalCorrect / totalAttempted) * 100).toFixed(1)}%`
      : null;

    return (
      <article
        key={m._id}
        id={`mock-card-${m._id}`}
        className={`task mock-saved-card ${tone}`}
      >
        <div className="badge-status">
          {m.score != null ? `${m.score} pts` : "—"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tasktitle">
            <strong>{m.name}</strong>{" "}
            <span className="muted small">· {formatDate(m.date)}</span>
          </div>

          <div className="meta" style={{ marginTop: "6px" }}>
            <span className="pill">
              {isFull ? "Full-length mock" : `Sectional · ${m.testSection}`}
            </span>
            {hasSectionDetails && totalQuestions > 0 ? (
              <span className="pill">Total Q {totalQuestions}</span>
            ) : null}
            <span className="pill">
              Attempted {hasSectionDetails ? totalAttempted : m.attempts ?? "—"}
            </span>
            {hasSectionDetails ? (
              <span className="pill">Unattempted {totalUnattempted}</span>
            ) : null}
            {hasSectionDetails ? (
              <span className="pill">Correct {totalCorrect}</span>
            ) : null}
            {hasSectionDetails ? (
              <span className="pill">Incorrect {totalIncorrect}</span>
            ) : null}
            {accuracy ? (
              <span className="pill">Accuracy {accuracy}</span>
            ) : null}
            {m.percentile != null ? (
              <span className="pill">Percentile {m.percentile}%ile</span>
            ) : null}
          </div>

          {/* Detailed Section Lines */}
          <div className="meta" style={{ marginTop: "6px" }}>
            {secs.map((sec) => {
              const s = m.sections?.[sec];
              if (!s) {
                const secScore = m[sec.toLowerCase()];
                return (
                  <span key={sec} className="pill">
                    {sec}: {secScore != null ? `${secScore} pts` : "details not entered"}
                  </span>
                );
              }
              const secAtt = s.attempted || 0;
              const secCor = s.correct || 0;
              const secInc = (s.wrongNeg || 0) + (s.wrongNoNeg || 0);
              const secUnatt = Math.max(0, (s.total || 0) - secAtt);
              const secAcc = secAtt > 0 ? `${((secCor / secAtt) * 100).toFixed(1)}%` : "—";
              const secScore = 3 * secCor - (s.wrongNeg || 0);

              return (
                <span key={sec} className="pill">
                  {sec}: attempted {secAtt} · unattempted {secUnatt} · correct {secCor} · incorrect {secInc} · accuracy {secAcc} · score {secScore}
                </span>
              );
            })}
          </div>

          {m.loss ? (
            <div className="tasknotes" style={{ marginTop: "7px" }}>
              <b>What went wrong:</b> {m.loss}
            </div>
          ) : null}
          {m.action ? (
            <div className="tasknotes" style={{ marginTop: "4px" }}>
              <b>Next action:</b> {m.action}
            </div>
          ) : null}
        </div>

        <div className="taskbuttons">
          <button type="button" onClick={() => startEdit(m)} disabled={saving}>
            Edit
          </button>
          <button
            type="button"
            className="danger diary-danger"
            onClick={() => deleteMock(m._id)}
            disabled={saving}
          >
            Remove
          </button>
        </div>
      </article>
    );
  }

  // Render score trend chart bars
  function renderBarChart(items, fillClass) {
    if (!items.length) {
      return <div className="empty">No scores recorded yet.</div>;
    }

    // Chronological order for chart
    const chronItems = [...items].reverse().slice(-8);
    const vals = chronItems.map((m) => ({
      label: formatDate(m.date),
      value: Number(m.score) || 0,
      name: m.name || "",
    }));

    const max = Math.max(1, ...vals.map((x) => x.value));

    return (
      <div className="ha-bars">
        {vals.map((x, i) => (
          <div key={i} className="ha-bar-row">
            <span className="ha-bar-label" title={`${x.name} · ${x.label}`}>
              {x.label}
            </span>
            <div className="ha-bar-track">
              <div
                className={`ha-bar-fill ${fillClass}`}
                style={{
                  width: `${Math.max(0, Math.min(100, (x.value / max) * 100))}%`,
                }}
              />
            </div>
            <span className="ha-bar-value">{x.value} pts</span>
          </div>
        ))}
      </div>
    );
  }

  // Trend insight text
  const fullMockTrendInsight = useMemo(() => {
    if (fullMocks.length >= 2) {
      const chron = [...fullMocks].reverse();
      const first = chron[0];
      const last = chron[chron.length - 1];
      if (first && last && first._id !== last._id) {
        return `Full mocks only: score ${first.score ?? "—"} on ${formatDate(first.date)} → score ${last.score ?? "—"} on ${formatDate(last.date)}. Review the errors and test conditions before judging the trend.`;
      }
    }
    return "Log at least two full mocks with overall scores to compare change. Sectional scores are never mixed into the full-mock chart.";
  }, [fullMocks]);

  return (
    <section id="view-mocks" className="panel diary-panel">
      {/* Top Header */}
      <div className="topbar diary-topbar">
        <div>
          <h2>📊 Mock analysis</h2>
          <p className="diary-muted diary-small">
            Choose one test type first. Full-length mocks and sectional tests are stored and compared separately.
          </p>
        </div>
        <button
          type="button"
          onClick={loadMocks}
          disabled={loading}
          style={{ fontSize: "13px", padding: "6px 12px" }}
        >
          ↻ Refresh Mocks
        </button>
      </div>

      {/* Top Stats Cards */}
      <div className="topic-stats-grid" style={{ margin: "14px 0" }}>
        <div className="topic-stat topic-stat-purple">
          <small>Total Mocks Logged</small>
          <strong>{topStats.totalCount}</strong>
          <span>Full &amp; sectional tests</span>
        </div>
        <div className="topic-stat topic-stat-green">
          <small>Full Mocks Count</small>
          <strong>{topStats.fullCount}</strong>
          <span>Avg score: {topStats.avgFullScore}</span>
        </div>
        <div className="topic-stat topic-stat-pink">
          <small>Overall Accuracy</small>
          <strong>{topStats.overallAcc}</strong>
          <span>Across all logged attempts</span>
        </div>
        <div className="topic-stat topic-stat-blue">
          <small>Best Full Score</small>
          <strong>{topStats.maxFullScore}</strong>
          <span>Top percentile: {topStats.maxPercentile}</span>
        </div>
      </div>

      {/* Mode Picker (Full-length vs Sectional) */}
      <div className="mock-mode-picker" role="group" aria-label="Choose test type">
        <button
          type="button"
          className={`mock-mode-choice${mode === "full" ? " active" : ""}`}
          data-mock-mode="full"
          onClick={() => setMode("full")}
        >
          Full-length test
          <span>Enter VARC, DILR and Quant results</span>
        </button>
        <button
          type="button"
          className={`mock-mode-choice${mode === "sectional" ? " active" : ""}`}
          data-mock-mode="sectional"
          onClick={() => setMode("sectional")}
        >
          Sectional test
          <span>Choose one section: VARC, DILR or Quant</span>
        </button>
      </div>

      {/* Form */}
      <form id="mockForm" onSubmit={handleSubmit}>
        <div className="mock-common-grid">
          <div>
            <label htmlFor="mockName">Test name *</label>
            <input
              id="mockName"
              required
              maxLength={200}
              placeholder="AIMCAT 01 / VARC practice test"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="mockDate">Date (DD/MM/YYYY) *</label>
            <div>
              <input
                id="mockDate"
                type="date"
                lang="en-GB"
                required
                aria-label="Test date (DD/MM/YYYY)"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
              />
              <div className="date-format-hint">Enter DD/MM/YYYY</div>
            </div>
          </div>
          <div>
            <label htmlFor="mockPercentile">Percentile (if available)</label>
            <input
              id="mockPercentile"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="0–100"
              value={percentile}
              onChange={(e) => setPercentile(e.target.value)}
            />
          </div>
        </div>

        {/* Section Picker for Sectional Mocks */}
        {mode === "sectional" ? (
          <div id="mockSectionPickerWrap" style={{ margin: "14px 0" }}>
            <h3 className="mock-section-heading">Choose the sectional test</h3>
            <div className="mock-section-picker" role="group" aria-label="Choose section">
              {SECTIONS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`mock-section-choice${testSection === sec ? " active" : ""}`}
                  data-mock-section={sec}
                  onClick={() => setTestSection(sec)}
                >
                  {sec}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Section Question Input Panels */}
        <div className="stats-section" style={{ marginTop: "16px" }}>
          <h3 id="mockEntryHeading">
            {mode === "full"
              ? "Enter results for all three sections"
              : `Enter results for ${testSection} only`}
          </h3>
          <div className="notice" style={{ margin: "8px 0 14px" }}>
            Enter total questions, attempted, correct, and both types of incorrect answers. Unattempted,
            accuracy and score calculate automatically. Scoring: <b>+3 correct</b>, <b>−1 negative-marked incorrect</b>,{" "}
            <b>0 unattempted or non-negative-marked incorrect</b>.
          </div>

          {SECTIONS.map((sec) => {
            const isVisible = mode === "full" || testSection === sec;
            if (!isVisible) return null;

            const inp = sectionInputs[sec];
            const st = calculatedSummaries[sec];
            const pId = sec === "VARC" ? "v" : sec === "DILR" ? "d" : "q";

            return (
              <div
                key={sec}
                id={`mockPanel-${sec}`}
                className="mock-analysis-panel mock-analysis-panel-section"
              >
                <h3>{sec}</h3>
                <div className="formgrid">
                  <div>
                    <label htmlFor={`${pId}Total`}>Total questions</label>
                    <input
                      id={`${pId}Total`}
                      type="number"
                      min="0"
                      step="1"
                      placeholder={sec === "VARC" ? "24" : sec === "DILR" ? "20" : "22"}
                      value={inp.total}
                      onChange={(e) => updateSectionField(sec, "total", e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${pId}Attempted`}>Attempted</label>
                    <input
                      id={`${pId}Attempted`}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={inp.attempted}
                      onChange={(e) => updateSectionField(sec, "attempted", e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${pId}Correct`}>Correct</label>
                    <input
                      id={`${pId}Correct`}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={inp.correct}
                      onChange={(e) => updateSectionField(sec, "correct", e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${pId}WrongNeg`}>Incorrect (−1 marking)</label>
                    <input
                      id={`${pId}WrongNeg`}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={inp.wrongNeg}
                      onChange={(e) => updateSectionField(sec, "wrongNeg", e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${pId}WrongNoNeg`}>Incorrect (no negative mark)</label>
                    <input
                      id={`${pId}WrongNoNeg`}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={inp.wrongNoNeg}
                      onChange={(e) => updateSectionField(sec, "wrongNoNeg", e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Summary</label>
                    <div className="pill" id={`${pId}Summary`}>
                      {st
                        ? `Unattempted ${st.unattempted ?? "—"} · Accuracy ${st.accuracy == null ? "—" : st.accuracy.toFixed(1) + "%"} · Score ${st.score}`
                        : "Unattempted — · Accuracy — · Score —"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Calculated score and attempts row */}
        <div
          className="mock-common-grid"
          style={{ margin: "14px 0 10px", gridTemplateColumns: "1fr 1fr" }}
        >
          <div>
            <label htmlFor="mockScore">Calculated score</label>
            <input
              id="mockScore"
              type="number"
              step="any"
              readOnly
              placeholder="Calculated automatically"
              value={formOverall.score}
            />
          </div>
          <div>
            <label htmlFor="mockAttempts">Attempted (total)</label>
            <input
              id="mockAttempts"
              type="number"
              min="0"
              readOnly
              placeholder="Calculated automatically"
              value={formOverall.attempts}
            />
          </div>
        </div>

        {/* What went wrong & Next action textareas */}
        <div style={{ marginTop: "12px" }}>
          <label htmlFor="mockLoss">What went wrong / marks lost (optional)</label>
          <textarea
            id="mockLoss"
            maxLength={5000}
            placeholder="Concept gaps, misreading, poor question selection, time pressure, calculation errors"
            value={loss}
            onChange={(e) => setLoss(e.target.value)}
          />
        </div>
        <div style={{ marginTop: "12px" }}>
          <label htmlFor="mockAction">What will I change before the next test? (optional)</label>
          <textarea
            id="mockAction"
            maxLength={5000}
            placeholder="Specific actions to take before your next test"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
        </div>

        {/* Form Actions */}
        <div className="formactions diary-formactions" style={{ marginTop: "14px" }}>
          <button className="primary diary-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Save test"}
          </button>
          {editingId ? (
            <button type="button" onClick={resetForm} disabled={saving}>
              Cancel edit
            </button>
          ) : null}
          <button type="button" onClick={resetForm} disabled={saving}>
            Clear form
          </button>
        </div>
      </form>

      {/* Messages */}
      {error ? (
        <p className="diary-feedback diary-feedback-error" role="alert" style={{ marginTop: "12px" }}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="diary-feedback" role="status" style={{ marginTop: "12px" }}>
          {notice}
        </p>
      ) : null}

      {/* SCORE TRENDS & CHARTS */}
      <section className="stats-section" style={{ marginTop: "24px" }}>
        <h3>📈 Score trends over time</h3>
        <p className="diary-muted diary-small">
          Visual bar charts comparing your latest performance chronologically. Full-length mocks are kept separate from sectional tests.
        </p>

        <div className="ha-mock-grid" style={{ marginTop: "14px" }}>
          {/* Full Mock Chart */}
          <div className="card" style={{ padding: "14px", borderRadius: "12px", border: "1px solid var(--line)" }}>
            <h4>Full-length Mocks trend</h4>
            <div id="haFullMocks">{renderBarChart(fullMocks, "ha-full-fill")}</div>
            <p className="ha-footnote" id="haMockInsight">
              {fullMockTrendInsight}
            </p>
          </div>

          {/* VARC Sectionals Chart */}
          <div className="card" style={{ padding: "14px", borderRadius: "12px", border: "1px solid var(--line)" }}>
            <h4>VARC sectionals trend</h4>
            <div id="haVarcMocks">{renderBarChart(sectionalVARC, "ha-varc-fill")}</div>
          </div>

          {/* DILR Sectionals Chart */}
          <div className="card" style={{ padding: "14px", borderRadius: "12px", border: "1px solid var(--line)" }}>
            <h4>DILR sectionals trend</h4>
            <div id="haDilrMocks">{renderBarChart(sectionalDILR, "ha-dilr-fill")}</div>
          </div>

          {/* Quant Sectionals Chart */}
          <div className="card" style={{ padding: "14px", borderRadius: "12px", border: "1px solid var(--line)" }}>
            <h4>Quant sectionals trend</h4>
            <div id="haQuantMocks">{renderBarChart(sectionalQuant, "ha-quant-fill")}</div>
          </div>
        </div>
      </section>

      {/* SAVED FULL-LENGTH TESTS */}
      <div className="stats-section" style={{ marginTop: "24px" }}>
        <h3>Saved full-length tests</h3>
        <p className="diary-muted diary-small">Full mocks are compared only with other full mocks.</p>
        <div id="fullMockList" className="tasklist" style={{ marginTop: "10px" }}>
          {fullMocks.length > 0 ? (
            fullMocks.map(renderMockCard)
          ) : (
            <div className="empty">No full-length tests recorded yet.</div>
          )}
        </div>
      </div>

      {/* SAVED SECTIONAL TESTS */}
      <div className="stats-section" style={{ marginTop: "24px" }}>
        <h3>Saved sectional tests</h3>
        <p className="diary-muted diary-small">
          Each section has its own list and is compared only with the same section.
        </p>

        <h4 style={{ marginTop: "14px" }}>VARC sectionals</h4>
        <div id="sectionalVARCList" className="tasklist mock-sublist">
          {sectionalVARC.length > 0 ? (
            sectionalVARC.map(renderMockCard)
          ) : (
            <div className="empty">No VARC sectional tests recorded yet.</div>
          )}
        </div>

        <h4 style={{ marginTop: "14px" }}>DILR sectionals</h4>
        <div id="sectionalDILRList" className="tasklist mock-sublist">
          {sectionalDILR.length > 0 ? (
            sectionalDILR.map(renderMockCard)
          ) : (
            <div className="empty">No DILR sectional tests recorded yet.</div>
          )}
        </div>

        <h4 style={{ marginTop: "14px" }}>Quant sectionals</h4>
        <div id="sectionalQuantList" className="tasklist mock-sublist">
          {sectionalQuant.length > 0 ? (
            sectionalQuant.map(renderMockCard)
          ) : (
            <div className="empty">No Quant sectional tests recorded yet.</div>
          )}
        </div>
      </div>
    </section>
  );
}
