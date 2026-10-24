import mongoose, { Schema } from "mongoose";

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
      enum: ["Must do", "Shoud do", "Bonus", "High", "Medium", "Low"],
      required: true,
      default: "Medium",
    },

    section: {
      type: String,
      enum: ["Quant", "VARC", "DILR",  "Revision", "Mock_test", "Other"],
      required: true,
    },

    status: {
      type: String,
      enum: ["Pending","Not_Started", "In Progress", "Done", "Not_Done", "Skipped", "Rescheduled"],
      required: true,
      default: "Pending",
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
