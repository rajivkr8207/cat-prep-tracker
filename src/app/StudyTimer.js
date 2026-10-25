"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { requestJson } from "@/lib/api-client";
import { localDateString, formatDate } from "@/lib/dashboard-analytics";

const STORAGE_KEY = "cat_study_timer_state";

const two = (n) => String(n).padStart(2, "0");

export default function StudyTimer() {
  // Live Clock State
  const [liveTime, setLiveTime] = useState("--:--:--");
  const [liveDate, setLiveDate] = useState("Loading date…");

  // Countdown State
  const [targetDate, setTargetDate] = useState("2027-11-28");
  const [countdownText, setCountdownText] = useState("— days");
  const [countdownNote, setCountdownNote] = useState("");

  // Timer State
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready. Choose a task and start the timer.");
  const [savingSession, setSavingSession] = useState(false);
  const [sessionSavedNote, setSessionSavedNote] = useState("");

  const endAtRef = useRef(null);
  const intervalRef = useRef(null);
  const sessionIdRef = useRef(null);

  // 1. Live Clock effect
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      const h = now.getHours() % 12 || 12;
      const ampm = now.getHours() >= 12 ? "PM" : "AM";
      setLiveTime(`${two(h)}:${two(now.getMinutes())}:${two(now.getSeconds())} ${ampm}`);

      const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      setLiveDate(
        `${days[now.getDay()]} · ${two(now.getDate())}/${two(now.getMonth() + 1)}/${String(now.getFullYear()).slice(2)}`,
      );
    }

    updateClock();
    const clockTimer = setInterval(updateClock, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // 2. Countdown Calculation
  useEffect(() => {
    if (!targetDate) {
      setCountdownText("Set a date");
      setCountdownNote("Choose a target date to start the countdown.");
      return;
    }
    const parts = targetDate.split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) {
      setCountdownNote("Enter target date as DD/MM/YYYY.");
      return;
    }
    const targetUTC = Date.UTC(parts[0], parts[1] - 1, parts[2]);
    const current = new Date();
    const todayUTC = Date.UTC(current.getFullYear(), current.getMonth(), current.getDate());
    const diff = Math.round((targetUTC - todayUTC) / 86400000);

    if (diff > 1) {
      setCountdownText(`${diff} days left`);
    } else if (diff === 1) {
      setCountdownText("1 day left");
    } else if (diff === 0) {
      setCountdownText("CAT target date is today");
    } else {
      setCountdownText(`${Math.abs(diff)} days past target`);
    }

    const tentative = targetDate === "2027-11-28";
    setCountdownNote(
      (tentative ? "Tentative planning date only — replace this when official CAT 2027 date is announced. " : "") +
        `Target: ${formatDate(targetDate)}.`,
    );
  }, [targetDate]);

  // 3. Save completed study session to MongoDB DailyReflection
  const saveCompletedSession = useCallback(async (minutesDuration) => {
    if (!minutesDuration || minutesDuration <= 0) return;
    setSavingSession(true);
    try {
      const today = localDateString();
      // Fetch today's current reflection to avoid overwriting existing data
      let currentHours = 0;
      let currentActual = "";
      try {
        const res = await requestJson(`/api/preparation/reflections?date=${encodeURIComponent(today)}`);
        if (res?.reflection) {
          currentHours = Number(res.reflection.hours) || 0;
          currentActual = res.reflection.actual || "";
        }
      } catch {
        // new reflection
      }

      // Quarter-hour increment
      const addedHours = Math.round((minutesDuration / 60) * 4) / 4;
      const newHours = Number((currentHours + addedHours).toFixed(2));
      const logNote = `Timer session: ${minutesDuration} min focused study`;
      const newActual = currentActual ? `${currentActual}\n${logNote}`.trim() : logNote;

      await requestJson("/api/preparation/reflections", {
        method: "POST",
        body: JSON.stringify({
          date: today,
          hours: newHours,
          actual: newActual,
        }),
      });

      setSessionSavedNote(`✓ Logged ${minutesDuration} min (${addedHours}h) to today's Daily Reflection.`);
      window.setTimeout(() => setSessionSavedNote(""), 6000);
    } catch {
      // ignore or show message
    } finally {
      setSavingSession(false);
    }
  }, []);

  // 4. Timer Tick logic
  const handleTimerComplete = useCallback((completedMinutes) => {
    setIsRunning(false);
    setIsPaused(false);
    endAtRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setStatusMessage("Time is up! Take a short break, then record your focused time.");
    saveCompletedSession(completedMinutes);
  }, [saveCompletedSession]);

  // 5. Restore timer state from localStorage on mount
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        if (state && typeof state === "object") {
          const mins = Math.min(600, Math.max(1, Number(state.targetMinutes) || 25));
          setTimerMinutes(mins);
          sessionIdRef.current = state.sessionId;

          if (state.isRunning && state.endAt) {
            const now = Date.now();
            const left = Math.max(0, Math.ceil((state.endAt - now) / 1000));
            if (left > 0) {
              setRemainingSeconds(left);
              endAtRef.current = state.endAt;
              setIsRunning(true);
              setIsPaused(false);
              setStatusMessage("Timer running — focus on one task.");
            } else {
              setRemainingSeconds(0);
              handleTimerComplete(mins);
            }
          } else if (state.isPaused && state.remainingSeconds) {
            setRemainingSeconds(Math.max(0, state.remainingSeconds));
            setIsRunning(false);
            setIsPaused(true);
            setStatusMessage("Paused. Resume when ready.");
          }
        }
      }
    } catch {
      // ignore localStorage errors
    }
  }, [handleTimerComplete]);

  // 6. Running Timer Interval
  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      if (!endAtRef.current) return;
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemainingSeconds(left);

      if (left <= 0) {
        handleTimerComplete(timerMinutes);
      }
    }, 250);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, timerMinutes, handleTimerComplete]);

  // 7. Button Handlers
  function startTimer() {
    if (isRunning) return;
    const totalSecs = isPaused && remainingSeconds > 0
      ? remainingSeconds
      : Math.min(600, Math.max(1, timerMinutes)) * 60;

    const endAt = Date.now() + totalSecs * 1000;
    endAtRef.current = endAt;
    sessionIdRef.current = `timer_${Date.now()}`;

    setRemainingSeconds(totalSecs);
    setIsRunning(true);
    setIsPaused(false);
    setStatusMessage("Timer running — focus on one task.");

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          targetMinutes: timerMinutes,
          remainingSeconds: totalSecs,
          endAt,
          isRunning: true,
          isPaused: false,
          sessionId: sessionIdRef.current,
        }),
      );
    } catch {
      // ignore
    }
  }

  function pauseTimer() {
    if (!isRunning || !endAtRef.current) return;
    const currentLeft = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
    endAtRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setRemainingSeconds(currentLeft);
    setIsRunning(false);
    setIsPaused(true);
    setStatusMessage(currentLeft > 0 ? "Paused. Resume when ready." : "Timer finished.");

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          targetMinutes: timerMinutes,
          remainingSeconds: currentLeft,
          endAt: null,
          isRunning: false,
          isPaused: true,
          sessionId: sessionIdRef.current,
        }),
      );
    } catch {
      // ignore
    }
  }

  function resetTimer() {
    endAtRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const resetSecs = Math.max(1, Number(timerMinutes) || 25) * 60;
    setRemainingSeconds(resetSecs);
    setIsRunning(false);
    setIsPaused(false);
    setStatusMessage("Timer reset and ready.");

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  function handleMinutesChange(e) {
    if (isRunning) return;
    const val = Math.min(600, Math.max(1, Number(e.target.value) || 25));
    setTimerMinutes(val);
    setRemainingSeconds(val * 60);
    setIsPaused(false);
    setStatusMessage("Timer length updated.");
  }

  const safeSec = Math.max(0, Math.ceil(remainingSeconds));
  const displayMinutes = two(Math.floor(safeSec / 60));
  const displaySeconds = two(safeSec % 60);

  return (
    <section id="view-clock" className="diary-panel">
      <div className="diary-topbar">
        <div>
          <h2>⏱️ Clock, study timer & CAT countdown</h2>
          <p className="diary-muted diary-small">
            Use this page to keep track of time while studying and see how much time remains.
            The countdown date is editable because the official CAT 2027 date may not be announced yet.
          </p>
        </div>
      </div>

      <div className="clock-grid">
        {/* Card 1: Live Clock */}
        <div className="clock-card">
          <h3>🕒 Current time</h3>
          <div className="clock-digits" id="liveClock">{liveTime}</div>
          <div className="diary-muted diary-small" id="liveDate">{liveDate}</div>
          <div className="clock-note">Uses the time and time zone set on your device.</div>
        </div>

        {/* Card 2: CAT Countdown */}
        <div className="clock-card">
          <h3>📅 Days until CAT 2027</h3>
          <div className="countdown-number" id="catDaysLeft">{countdownText}</div>
          <label htmlFor="catTargetDate" style={{ marginTop: "10px" }}>
            Target exam date (edit when official date is known)
          </label>
          <input
            id="catTargetDate"
            type="date"
            lang="en-GB"
            aria-label="Target exam date (DD/MM/YYYY)"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
          <div className="diary-date-format-hint">Use the calendar · dates shown as DD/MM/YYYY</div>
          <div className="clock-note" id="catCountdownNote">{countdownNote}</div>
        </div>

        {/* Card 3: Study Timer */}
        <div className="clock-card">
          <h3>⏳ Study timer</h3>
          <div className="timer-display" id="studyTimerDisplay">
            {displayMinutes}:{displaySeconds}
          </div>
          <label htmlFor="timerMinutes">Timer length (minutes)</label>
          <input
            id="timerMinutes"
            type="number"
            min="1"
            max="600"
            disabled={isRunning}
            value={timerMinutes}
            onChange={handleMinutesChange}
          />
          <div className="diary-controls" style={{ marginTop: "10px" }}>
            <button
              type="button"
              className="diary-primary"
              id="timerStart"
              onClick={startTimer}
              disabled={isRunning}
            >
              {isPaused ? "▶ Resume" : "▶ Start"}
            </button>
            <button
              type="button"
              id="timerPause"
              onClick={pauseTimer}
              disabled={!isRunning}
            >
              ⏸ Pause
            </button>
            <button
              type="button"
              id="timerReset"
              onClick={resetTimer}
            >
              ↺ Reset
            </button>
          </div>
          <div className="clock-note" id="timerStatus" aria-live="polite">
            {statusMessage}
          </div>
          {savingSession ? (
            <div className="diary-notice diary-small" style={{ marginTop: "6px" }}>
              Saving study session…
            </div>
          ) : sessionSavedNote ? (
            <div className="diary-notice diary-small" style={{ marginTop: "6px", color: "#166534" }}>
              {sessionSavedNote}
            </div>
          ) : null}
        </div>
      </div>

      <div className="diary-notice diary-small" style={{ marginTop: "16px" }}>
        <strong>Timer tip:</strong> during a session, work on only one task. When the timer ends,
        focused study time is automatically saved to your Daily Reflection, or you can record details
        in the daily diary. The timer continues accurately even when switching tabs or refreshing.
      </div>
    </section>
  );
}
