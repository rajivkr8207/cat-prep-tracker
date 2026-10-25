import { Schema, models, model } from "mongoose";
import { blankToUndefined, isISODate } from "@/models/model-validators";

const topicSessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    topic: { type: String, required: true, trim: true, maxlength: 200 },
    section: { type: String, enum: ["VARC", "DILR", "Quant"], required: true },
    date: {
      type: String,
      required: true,
      validate: { validator: isISODate, message: "Date must be a valid YYYY-MM-DD date" },
    },
    total: { type: Number, min: 1, validate: Number.isInteger, required: true },
    attempted: { type: Number, min: 0, validate: Number.isInteger, required: true },
    correct: { type: Number, min: 0, validate: Number.isInteger, required: true },
    incorrect: { type: Number, min: 0, validate: Number.isInteger, required: true },
    unattempted: { type: Number, min: 0, validate: Number.isInteger, required: true },
    minutes: { type: Number, min: 0, set: blankToUndefined },
    mistake: {
      type: String,
      enum: [
        "",
        "Concept not clear",
        "Calculation error",
        "Misread question",
        "Time pressure",
        "Guessing / poor elimination",
        "Forgot method",
        "Careless error",
        "Other",
      ],
      default: "",
    },
    revisionDate: {
      type: String,
      default: "",
      validate: {
        validator: (value) => value === "" || isISODate(value),
        message: "Revision date must be a valid YYYY-MM-DD date",
      },
    },
    notes: { type: String, default: "", maxlength: 5000 },
    relatedTaskId: {
      type: Schema.Types.ObjectId,
      ref: "TaskTracker",
      default: null,
    },
  },
  { timestamps: true },
);

topicSessionSchema.pre("validate", function validateTopicSession() {
  if (this.correct > this.attempted) {
    this.invalidate("correct", "Correct answers cannot exceed questions attempted");
  }
  if (this.total != null && this.attempted > this.total) {
    this.invalidate("attempted", "Questions attempted cannot exceed total questions");
  }
  if (
    this.total != null &&
    this.unattempted != null &&
    this.attempted + this.unattempted !== this.total
  ) {
    this.invalidate("unattempted", "Attempted and unattempted counts must equal total");
  }
  if (
    this.incorrect != null &&
    this.correct + this.incorrect !== this.attempted
  ) {
    this.invalidate("incorrect", "Correct and incorrect counts must equal attempted");
  }
});

topicSessionSchema.index({ userId: 1, section: 1, topic: 1, date: -1 });
topicSessionSchema.index(
  { userId: 1, relatedTaskId: 1 },
  {
    unique: true,
    partialFilterExpression: { relatedTaskId: { $type: "objectId" } },
  },
);

export default models.TopicSession ||
  model("TopicSession", topicSessionSchema);
