import { Schema, models, model } from "mongoose";
import { blankToUndefined, isISODate } from "@/models/model-validators";

const taskSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: String,
      required: true,
      validate: { validator: isISODate, message: "Date must be a valid YYYY-MM-DD date" },
    },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    section: {
      type: String,
      required: true,
      enum: ["VARC", "Quant", "DILR", "Revision", "Mock test", "Analysis", "Other"],
    },
    priority: {
      type: String,
      required: true,
      enum: ["Must do", "Should do", "Bonus"],
      default: "Must do",
    },
    startTime: {
      type: String,
      default: "",
      validate: {
        validator(value) {
          return value === "" || /^(0?[1-9]|1[0-2]):[0-5]\d (AM|PM)$/.test(value);
        },
        message: "Start time must be in HH:MM AM/PM format",
      },
    },
    endTime: {
      type: String,
      default: "",
      validate: {
        validator(value) {
          return value === "" || /^(0?[1-9]|1[0-2]):[0-5]\d (AM|PM)$/.test(value);
        },
        message: "End time must be in HH:MM AM/PM format",
      },
    },
    planned: { type: Number, min: 0, validate: Number.isInteger, set: blankToUndefined },
    status: {
      type: String,
      required: true,
      enum: [
        "Not started",
        "In progress",
        "Done",
        "Partly done",
        "Not done",
        "Skipped",
        "Rescheduled",
      ],
      default: "Not started",
    },
    attempted: { type: Number, min: 0, validate: Number.isInteger, set: blankToUndefined },
    correct: { type: Number, min: 0, validate: Number.isInteger, set: blankToUndefined },
    actual: { type: Number, min: 0, validate: Number.isInteger, set: blankToUndefined },
    notes: { type: String, trim: true, default: "", maxlength: 5000 },
  },
  { timestamps: true },
);

taskSchema.pre("validate", function validateTask() {
  if (this.startTime && this.endTime) {
    const toMinutes = (value) => {
      const [, hourText, minuteText, meridiem] =
        /^(0?[1-9]|1[0-2]):([0-5]\d) (AM|PM)$/.exec(value) || [];
      if (!hourText) return null;
      let hour = Number(hourText) % 12;
      if (meridiem === "PM") hour += 12;
      return hour * 60 + Number(minuteText);
    };
    const start = toMinutes(this.startTime);
    const end = toMinutes(this.endTime);
    if (start !== null && end !== null && end <= start) {
      this.invalidate("endTime", "End time must be later than start time");
    }
  }

  if (
    this.attempted != null &&
    this.correct != null &&
    this.correct > this.attempted
  ) {
    this.invalidate("correct", "Correct answers cannot exceed questions attempted");
  }
});

taskSchema.index({ userId: 1, date: 1, startTime: 1, endTime: 1 });
taskSchema.index({ userId: 1, status: 1, date: 1 });

const TaskTracker =
  models.TaskTracker || model("TaskTracker", taskSchema);

export default TaskTracker;
