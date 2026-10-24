"use client";

import { useForm } from "react-hook-form";
import { ArrowRight } from "lucide-react";
import {
  PREPARATION_PRIORITIES,
  PREPARATION_SECTIONS,
  PREPARATION_STATUSES,
} from "@/constants/PREPARATIONS";
import { dateString, PRIORITIES, SECTIONS, STATUSES, timeToDisplay, timeToInput } from "@/lib/preparation-ui";

function getDefaultValues(task) {
  if (!task) {
    return {
      title: "",
      date: dateString(new Date()),
      startTime: "09:00",
      endTime: "10:00",
      actual: 0,
      attempted: 0,
      correct: 0,
      notes: "",
      planned: 0,
      priority: PREPARATION_PRIORITIES.MEDIUM,
      section: PREPARATION_SECTIONS.QUANT,
      status: PREPARATION_STATUSES.PENDING,
    };
  }

  return {
    title: task.title || "",
    date: task.date || dateString(new Date()),
    startTime: timeToInput(task.startTime),
    endTime: timeToInput(task.endTime),
    actual: task.actual ?? 0,
    attempted: task.attempted ?? 0,
    correct: task.correct ?? 0,
    notes: task.notes || "",
    planned: task.planned ?? 0,
    priority: task.priority || PREPARATION_PRIORITIES.MEDIUM,
    section: task.section || PREPARATION_SECTIONS.QUANT,
    status: task.status || PREPARATION_STATUSES.PENDING,
  };
}

export default function TaskForm({ task, busy, onCancel, onSave }) {
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm({ defaultValues: getDefaultValues(task) });

  async function submit(values) {
    const payload = {
      ...values,
      startTime: timeToDisplay(values.startTime),
      endTime: timeToDisplay(values.endTime),
      actual: Number(values.actual),
      attempted: Number(values.attempted),
      correct: Number(values.correct),
      planned: Number(values.planned),
    };
    if (payload.correct > payload.attempted) {
      setError("correct", {
        type: "validate",
        message: "Correct answers can't be more than attempted questions.",
      });
      return;
    }
    try {
      await onSave(payload);
    } catch (error) {
      setError("root.server", { type: "server", message: error.message });
    }
  }

  return (
    <form className="task-form grid grid-cols-1 gap-3 md:grid-cols-2" noValidate onSubmit={handleSubmit(submit)}>
      <label className="field-full">
        Study task
        <input
          autoFocus
          className="border-border bg-surface text-ink"
          maxLength={200}
          placeholder="e.g. Arithmetic — percentages"
          {...register("title", {
            required: "Enter a study task.",
            minLength: { value: 2, message: "Use at least 2 characters." },
            maxLength: { value: 200, message: "Use 200 characters or fewer." },
          })}
        />
        {errors.title ? <span className="field-error">{errors.title.message}</span> : null}
      </label>
      <div className="field-grid">
        <label>
          Date
          <input className="border-border bg-surface text-ink" type="date" {...register("date", { required: "Choose a date." })} />
          {errors.date ? <span className="field-error">{errors.date.message}</span> : null}
        </label>
        <label>
          Section
          <select className="border-border bg-surface text-ink" {...register("section", { required: true })}>
            {SECTIONS.map((section) => <option key={section}>{section}</option>)}
          </select>
        </label>
        <label>
          Start time
          <input className="border-border bg-surface text-ink" type="time" {...register("startTime", { required: "Choose a start time." })} />
          {errors.startTime ? <span className="field-error">{errors.startTime.message}</span> : null}
        </label>
        <label>
          End time
          <input className="border-border bg-surface text-ink" type="time" {...register("endTime", { required: "Choose an end time." })} />
          {errors.endTime ? <span className="field-error">{errors.endTime.message}</span> : null}
        </label>
        <label>
          Priority
          <select className="border-border bg-surface text-ink" {...register("priority", { required: true })}>
            {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
          </select>
        </label>
        <label>
          Status
          <select className="border-border bg-surface text-ink" {...register("status", { required: true })}>
            {STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
      </div>
      <div className="field-grid field-grid-four">
        {[
          ["planned", "Planned"],
          ["attempted", "Attempted"],
          ["correct", "Correct"],
          ["actual", "Actual"],
        ].map(([name, label]) => (
          <label key={name}>
            {label}
            <input
              className="border-border bg-surface text-ink"
              min="0"
              type="number"
              {...register(name, {
                required: `${label} count is required.`,
                min: { value: 0, message: "Value cannot be negative." },
                valueAsNumber: true,
                ...(name === "correct"
                  ? {
                      validate: (value, values) => value <= values.attempted || "Correct answers can't be more than attempted questions.",
                    }
                  : {}),
              })}
            />
            {errors[name] ? <span className="field-error">{errors[name].message}</span> : null}
          </label>
        ))}
      </div>
      <label className="field-full">
        Notes <span className="optional-label">OPTIONAL</span>
        <textarea
          className="border-border bg-surface text-ink"
          maxLength={2000}
          placeholder="Anything to remember for next time?"
          rows={3}
          {...register("notes", { maxLength: { value: 2000, message: "Use 2000 characters or fewer." } })}
        />
        {errors.notes ? <span className="field-error">{errors.notes.message}</span> : null}
      </label>
      {errors.root?.server ? (
        <p className="form-error field-full" role="alert">{errors.root.server.message}</p>
      ) : null}
      <div className="dialog-actions field-full">
        <button className="button button-quiet" onClick={onCancel} type="button">Cancel</button>
        <button className="button button-primary" disabled={busy || isSubmitting} type="submit">
          {busy || isSubmitting ? "Saving…" : task ? "Save changes" : "Add to my plan"}
          <ArrowRight size={17} />
        </button>
      </div>
    </form>
  );
}
