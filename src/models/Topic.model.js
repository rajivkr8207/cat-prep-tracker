import { Schema, models, model } from "mongoose";
import { blankToUndefined, isISODate } from "@/models/model-validators";

const topicSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    section: { type: String, enum: ["VARC", "DILR", "Quant"], required: true },
    status: {
      type: String,
      enum: ["Not started", "Learning", "Covered once", "Needs revision", "Revised"],
      default: "Not started",
    },
    priority: { type: String, enum: ["Low", "Medium", "High"], default: "Medium" },
    attempted: { type: Number, min: 0, validate: Number.isInteger, set: blankToUndefined },
    correct: { type: Number, min: 0, validate: Number.isInteger, set: blankToUndefined },
    accuracy: {
      type: Number,
      min: 0,
      max: 100,
      set: blankToUndefined,
    },
    lastPracticed: {
      type: String,
      default: "",
      validate: {
        validator: (value) => value === "" || isISODate(value),
        message: "Last practiced must be a valid YYYY-MM-DD date",
      },
    },
    nextReview: {
      type: String,
      default: "",
      validate: {
        validator: (value) => value === "" || isISODate(value),
        message: "Next review must be a valid YYYY-MM-DD date",
      },
    },
    notes: { type: String, default: "", maxlength: 5000 },
  },
  { timestamps: true },
);

topicSchema.pre("validate", function validateTopic() {
  if (
    this.attempted != null &&
    this.correct != null &&
    this.correct > this.attempted
  ) {
    this.invalidate("correct", "Correct answers cannot exceed questions attempted");
  }
});

topicSchema.index(
  { userId: 1, section: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);
topicSchema.index({ userId: 1, status: 1, nextReview: 1 });

export default models.Topic || model("Topic", topicSchema);
