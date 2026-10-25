import { Schema, models, model } from "mongoose";
import { blankToUndefined, isISODate } from "@/models/model-validators";

const syllabusProgressSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subject: { type: String, enum: ["VARC", "DILR", "Quant"], required: true },
    group: { type: String, required: true, trim: true, maxlength: 100 },
    topicName: { type: String, required: true, trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: ["Not started", "Learning", "Covered once", "Needs revision", "Revised"],
      default: "Not started",
    },
    lastCoveredAt: {
      type: String,
      default: "",
      validate: {
        validator: (value) => value === "" || isISODate(value),
        message: "Last covered date must be a valid YYYY-MM-DD date",
      },
    },
    revisionCount: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      default: 0,
      set: blankToUndefined,
    },
    notes: { type: String, default: "", maxlength: 5000 },
  },
  { timestamps: true },
);

syllabusProgressSchema.index(
  { userId: 1, subject: 1, group: 1, topicName: 1 },
  { unique: true },
);

export default models.SyllabusProgress ||
  model("SyllabusProgress", syllabusProgressSchema);
