"use client";

import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import IconButton from "@/components/ui/icon-button";
import { SECTIONS, STATUSES } from "@/lib/preparation-ui";
import { TASK_STATUSES } from "@/constants/TASK";

export default function StudyPlan({
  activeDate,
  today,
  dayTasks,
  visibleTasks,
  loading,
  search,
  onSearchChange,
  sectionFilter,
  onSectionFilterChange,
  statusFilter,
  onStatusFilterChange,
  sortNewestFirst,
  onToggleSort,
  onChangeDate,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onToggleTaskStatus,
}) {
  return (
    <section className="panel daily-panel" id="daily-plan">
      <div className="daily-heading">
        <div>
          <span className="eyebrow">ONE THING AT A TIME</span>
          <h2>Today’s study plan <span className="task-count">{dayTasks.length}</span></h2>
        </div>
        <div className="day-controls">
          <button aria-label="Previous day" className="day-arrow" onClick={() => onChangeDate(-1)} type="button">
            <ArrowLeft size={17} />
          </button>
          <span>
            {activeDate === today
              ? "Today"
              : activeDate
                ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${activeDate}T12:00:00`))
                : "—"}
          </span>
          <button aria-label="Next day" className="day-arrow" onClick={() => onChangeDate(1)} type="button">
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
      <div className="task-toolbar">
        <label className="search-field">
          <Search size={17} />
          <span className="sr-only">Search tasks</span>
          <input onChange={(event) => onSearchChange(event.target.value)} placeholder="Find a task…" value={search} />
        </label>
        <div aria-label="Filter by section" className="filter-group">
          {["All", ...SECTIONS].map((section) => (
            <button
              aria-pressed={sectionFilter === section}
              className={sectionFilter === section ? "filter-chip filter-active" : "filter-chip"}
              key={section}
              onClick={() => onSectionFilterChange(section)}
              type="button"
            >
              {section}
            </button>
          ))}
        </div>
        <label className="status-filter">
          <span className="sr-only">Filter by status</span>
          <select onChange={(event) => onStatusFilterChange(event.target.value)} value={statusFilter}>
            <option>All</option>
            {STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <button
          aria-label={`Sort by time ${sortNewestFirst ? "ascending" : "descending"}`}
          className="sort-button"
          onClick={onToggleSort}
          type="button"
        >
          <ArrowDownWideNarrow size={17} /> <span>Sort</span>
        </button>
      </div>

      {loading ? (
        <div className="empty-state"><span className="loading-dots" /><p>Loading your study plan…</p></div>
      ) : visibleTasks.length ? (
        <div className="task-list">
          {visibleTasks.map((task) => (
            <article className={`task-row${task.status === TASK_STATUSES.DONE ? " task-done" : ""}`} key={task._id}>
              <button
                aria-label={task.status === TASK_STATUSES.DONE ? `Mark ${task.title} as pending` : `Mark ${task.title} as done`}
                aria-pressed={task.status === TASK_STATUSES.DONE}
                className={`task-check${task.status === TASK_STATUSES.DONE ? " checked" : ""}`}
                onClick={() => onToggleTaskStatus(task)}
                type="button"
              >
                {task.status === TASK_STATUSES.DONE ? <Check size={15} /> : null}
              </button>
              <div className="task-main">
                <div className="task-title-line">
                  <h3>{task.title}</h3>
                  <span className={`priority priority-${task.priority.toLowerCase().replace(" ", "-")}`}>{task.priority}</span>
                </div>
                <div className="task-meta">
                  <span className={`section-tag section-${task.section.toLowerCase()}`}>{task.section}</span>
                  <span><Clock3 size={14} /> {task.startTime} – {task.endTime}</span>
                  <span>{task.actual}/{task.planned} Qs</span>
                </div>
              </div>
              <span className={`status-tag status-${task.status.toLowerCase().replace(" ", "-")}`}>{task.status}</span>
              <div className="task-actions">
                <IconButton label={`Edit ${task.title}`} onClick={() => onEditTask(task)}>
                  <Pencil size={16} />
                </IconButton>
                <IconButton className="delete-action" label={`Delete ${task.title}`} onClick={() => onDeleteTask(task)}>
                  <Trash2 size={16} />
                </IconButton>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon"><BookOpen size={22} /></span>
          <h3>{dayTasks.length ? "No tasks match those filters." : "A fresh page. Make it yours."}</h3>
          <p>{dayTasks.length ? "Try another section or search term." : "Add a study session and give your prep some structure."}</p>
          {!dayTasks.length ? (
            <button className="button button-secondary" onClick={onAddTask} type="button">
              <Plus size={17} /> Add your first task
            </button>
          ) : null}
        </div>
      )}
      <div className="daily-footer">
        <span><span className="footer-dot" /> YOUR PLAN, YOUR PACE.</span>
        <span>{visibleTasks.length} {visibleTasks.length === 1 ? "SESSION" : "SESSIONS"} SHOWN</span>
      </div>
    </section>
  );
}
