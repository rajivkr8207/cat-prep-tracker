import mongoose, { Schema } from "mongoose";
import {
  PREPARATION_PRIORITIES,
  PREPARATION_PRIORITY_VALUES,
  PREPARATION_SECTION_VALUES,
  PREPARATION_STATUSES,
  PREPARATION_STATUS_VALUES,
} from "@/constants/PREPARATIONS";

const preparationTrackerSchema = new Schema(
  {
    user:{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },

    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
    },

    startTime: {
      type: String,
      required: true,
      match: [
        /^(0?[1-9]|1[0-2]):[0-5]\d (AM|PM)$/,
        "Start time must be in HH:MM AM/PM format",
      ],
    },

    endTime: {
      type: String,
      required: true,
      match: [
        /^(0?[1-9]|1[0-2]):[0-5]\d (AM|PM)$/,
        "End time must be in HH:MM AM/PM format",
      ],
    },
    actual: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    attempted: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    correct: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },

    planned: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    priority: {
      type: String,
      enum: PREPARATION_PRIORITY_VALUES,
      required: true,
      default: PREPARATION_PRIORITIES.MEDIUM,
    },

    section: {
      type: String,
      enum: PREPARATION_SECTION_VALUES,
      required: true,
    },

    status: {
      type: String,
      enum: PREPARATION_STATUS_VALUES,
      required: true,
      default: PREPARATION_STATUSES.PENDING,
    },
  },
  {
    timestamps: true,
  },
);

preparationTrackerSchema.index({ date: 1, section: 1 });
preparationTrackerSchema.index({ status: 1, date: 1 });

const PreparationTracker =
  mongoose.models.PreparationTracker ||
  mongoose.model("PreparationTracker", preparationTrackerSchema);

export default PreparationTracker;
