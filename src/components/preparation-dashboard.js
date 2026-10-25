"use client";

import {
  ArrowDownWideNarrow,
  ArrowRight,
  CheckCircle2,
  Plus,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import AuthScreen from "@/features/auth/components/auth-screen";
import ChangePasswordDialog from "@/features/auth/components/change-password-dialog";
import ProfileDialog from "@/features/auth/components/profile-dialog";
import TaskForm from "@/features/preparation/components/task-form";
import {
  DashboardHeader,
  DashboardSidebar,
} from "@/features/preparation/components/dashboard-navigation";
import {
  DashboardStatistics,
  ProgressInsights,
} from "@/features/preparation/components/dashboard-statistics";
import StudyPlan from "@/features/preparation/components/study-plan";
import Dialog from "@/components/ui/dialog";
import { requestJson } from "@/lib/api-client";
import { TASK_STATUSES } from "@/constants/TASK";
import { SECTIONS, dateString, timeToMinutes } from "@/lib/preparation-ui";

function subscribeToLocalDate() {
  return () => {};
}

function getLocalDate() {
  return dateString(new Date());
}

function getServerDate() {
  return "";
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(date);
}

function dailyLabel(date) {
  return new Intl.DateTimeFormat("en", { weekday: "short" }).format(date);
}

function getStreak(preparations, today) {
  const activeDays = new Set(
    preparations
      .filter(
        (task) =>
          task.actual > 0 || task.status === TASK_STATUSES.DONE,
      )
      .map((task) => task.date),
  );
  let cursor = new Date(`${today}T12:00:00`);
  if (!activeDays.has(dateString(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (activeDays.has(dateString(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function PreparationDashboard() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [preparations, setPreparations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortNewestFirst, setSortNewestFirst] = useState(false);
  const [taskDialog, setTaskDialog] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const loadPreparations = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const result = await requestJson("/api/preparation");
      setPreparations(result.preparations || []);
    } catch (loadError) {
      if (loadError.status === 401) {
        setUser(null);
      } else {
        setPageError(loadError.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    requestJson("/api/auth/me")
      .then(({ user: authenticatedUser }) => {
        if (active) {
          setUser(authenticatedUser);
          loadPreparations();
        }
      })
      .catch((error) => {
        if (active && error.status !== 401) setPageError(error.message);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadPreparations]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const today = useSyncExternalStore(subscribeToLocalDate, getLocalDate, getServerDate);
  const activeDate = selectedDate || today;
  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return preparations
      .filter((task) => task.date === activeDate)
      .filter((task) => sectionFilter === "All" || task.section === sectionFilter)
      .filter((task) => statusFilter === "All" || task.status === statusFilter)
      .filter((task) => !query || task.title.toLowerCase().includes(query) || (task.notes || "").toLowerCase().includes(query))
      .sort((first, second) => {
        const comparison = timeToMinutes(first.startTime) - timeToMinutes(second.startTime);
        return sortNewestFirst ? -comparison : comparison;
      });
  }, [activeDate, preparations, search, sectionFilter, sortNewestFirst, statusFilter]);

  const dayTasks = useMemo(
    () => preparations.filter((task) => task.date === activeDate),
    [activeDate, preparations],
  );
  const totals = useMemo(
    () => dayTasks.reduce(
      (sum, task) => ({
        planned: sum.planned + (Number(task.planned) || 0),
        attempted: sum.attempted + (Number(task.attempted) || 0),
        actual: sum.actual + (Number(task.actual) || 0),
        correct: sum.correct + (Number(task.correct) || 0),
      }),
      { planned: 0, attempted: 0, actual: 0, correct: 0 },
    ),
    [dayTasks],
  );
  const accuracy = totals.attempted ? Math.round((totals.correct / totals.attempted) * 100) : 0;
  const completion = totals.planned ? Math.min(100, Math.round((totals.actual / totals.planned) * 100)) : 0;
  const streak = useMemo(() => today ? getStreak(preparations, today) : 0, [preparations, today]);
  const chartDays = useMemo(() => {
    if (!activeDate) return [];
    const start = new Date(`${activeDate}T12:00:00`);
    start.setDate(start.getDate() - 6);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = dateString(date);
      const actual = preparations
        .filter((task) => task.date === key)
        .reduce((sum, task) => sum + (Number(task.actual) || 0), 0);
      return { date: key, label: dailyLabel(date), actual };
    });
  }, [activeDate, preparations]);
  const chartMax = Math.max(...chartDays.map((day) => day.actual), 1);

  function changeDate(offset) {
    if (!activeDate) return;
    const date = new Date(`${activeDate}T12:00:00`);
    date.setDate(date.getDate() + offset);
    setSelectedDate(dateString(date));
  }

  async function saveTask(payload) {
    setSaving(true);
    try {
      if (taskDialog?.task) {
        const result = await requestJson(`/api/preparation/${taskDialog.task._id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setPreparations((current) => current.map((task) => task._id === result.preparation._id ? result.preparation : task));
        setNotice("Your study task is updated.");
      } else {
        const result = await requestJson("/api/preparation", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setPreparations((current) => [...current, result.preparation]);
        setSelectedDate(payload.date);
        setNotice("Your study task is on the plan.");
      }
      setTaskDialog(null);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask(task) {
    if (!window.confirm(`Delete "${task.title}" from your study plan?`)) return;
    try {
      await requestJson(`/api/preparation/${task._id}`, { method: "DELETE" });
      setPreparations((current) => current.filter((item) => item._id !== task._id));
      setNotice("Task deleted from your plan.");
    } catch (error) {
      setPageError(error.message);
    }
  }

  async function toggleTaskStatus(task) {
    const status =
      task.status === TASK_STATUSES.DONE
        ? TASK_STATUSES.PENDING
        : TASK_STATUSES.DONE;
    try {
      const result = await requestJson(`/api/preparation/${task._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setPreparations((current) => current.map((item) => item._id === task._id ? result.preparation : item));
      setNotice(
        status === TASK_STATUSES.DONE
          ? "Session marked complete. Nice work."
          : "Session moved back to your plan.",
      );
    } catch (error) {
      setPageError(error.message);
    }
  }

  async function signOut() {
    try {
      await requestJson("/api/auth/logout", { method: "POST" });
      setUser(null);
      setPreparations([]);
      setNotice("");
    } catch (error) {
      setPageError(error.message);
    }
  }

  function finishPasswordChange() {
    setChangePasswordOpen(false);
    setUser(null);
    setPreparations([]);
    setPageError("");
    setNotice("");
  }

  if (authLoading) {
    return <main className="loading-screen" aria-label="Loading CAT Prep"><span className="brand-mark">C</span><span>Getting your desk ready…</span></main>;
  }
  if (!user) {
    return <AuthScreen initialError={pageError} onAuthenticated={(authenticatedUser) => { setUser(authenticatedUser); setPageError(""); loadPreparations(); }} />;
  }

  return (
    <div className="app-frame">
      <DashboardSidebar
        mobileNavOpen={mobileNavOpen}
        onCloseNavigation={() => setMobileNavOpen(false)}
        onChangePassword={() => { setChangePasswordOpen(true); setUserMenuOpen(false); }}
        onProfile={() => { setProfileOpen(true); setUserMenuOpen(false); }}
        onSignOut={signOut}
        onToggleUserMenu={() => setUserMenuOpen((current) => !current)}
        user={user}
        userMenuOpen={userMenuOpen}
      />

      <main className="main-area">
        <DashboardHeader
          onOpenNavigation={() => setMobileNavOpen(true)}
          onProfile={() => setProfileOpen(true)}
          user={user}
        />

        <div className="dashboard-content">
          <section className="welcome-row" id="overview">
            <div>
              <span className="eyebrow">{activeDate ? formatDate(new Date(`${activeDate}T12:00:00`)).toUpperCase() : "YOUR STUDY DAY"}</span>
              <h1>Make today <span>count.</span></h1>
              <p>You don’t need to do it all. Just the next thing.</p>
            </div>
            <div className="welcome-actions">
              <label className="date-picker"><span className="sr-only">Choose study date</span><input aria-label="Choose study date" onChange={(event) => setSelectedDate(event.target.value)} type="date" value={activeDate} /></label>
              <button className="button button-primary" onClick={() => setTaskDialog({ task: null })} type="button"><Plus size={18} /> Add a task</button>
            </div>
          </section>

          {pageError ? (
            <div className="notice notice-error" role="alert"><span>{pageError}</span><button onClick={() => { setPageError(""); if (user) loadPreparations(); }} type="button">Try again</button></div>
          ) : null}
          {notice ? <div className="notice notice-success" role="status"><CheckCircle2 size={18} /><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")} type="button"><X size={16} /></button></div> : null}

          <DashboardStatistics totals={totals} accuracy={accuracy} completion={completion} />
          <ProgressInsights
            activeDate={activeDate}
            chartDays={chartDays}
            chartMax={chartMax}
            streak={streak}
          />
          <StudyPlan
            activeDate={activeDate}
            dayTasks={dayTasks}
            loading={loading}
            onAddTask={() => setTaskDialog({ task: null })}
            onChangeDate={changeDate}
            onDeleteTask={deleteTask}
            onEditTask={(task) => setTaskDialog({ task })}
            onSearchChange={setSearch}
            onSectionFilterChange={setSectionFilter}
            onStatusFilterChange={setStatusFilter}
            onToggleSort={() => setSortNewestFirst((current) => !current)}
            onToggleTaskStatus={toggleTaskStatus}
            search={search}
            sectionFilter={sectionFilter}
            sortNewestFirst={sortNewestFirst}
            statusFilter={statusFilter}
            today={today}
            visibleTasks={visibleTasks}
          />
          <footer className="page-footer"><span>MADE FOR THE WORK BETWEEN THE MILESTONES.</span><span>CAT PREP TRACKER <span className="footer-separator">·</span> 2026</span></footer>
        </div>
      </main>

      {taskDialog ? (
        <Dialog onClose={() => setTaskDialog(null)} title={taskDialog.task ? "Edit your session" : "Plan a study session"} wide>
          <TaskForm busy={saving} onCancel={() => setTaskDialog(null)} onSave={saveTask} task={taskDialog.task} />
        </Dialog>
      ) : null}
      {profileOpen ? <ProfileDialog onClose={() => setProfileOpen(false)} onUpdated={setUser} user={user} /> : null}
      {changePasswordOpen ? (
        <ChangePasswordDialog
          onClose={() => setChangePasswordOpen(false)}
          onSessionEnded={finishPasswordChange}
        />
      ) : null}
    </div>
  );
}
