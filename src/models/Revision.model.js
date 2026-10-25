import { Schema, models, model } from "mongoose";
import { isISODate } from "@/models/model-validators";

const revisionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, trim: true, maxlength: 300 },
    topic: { type: String, trim: true, maxlength: 300 },
    topicId: {
      type: Schema.Types.ObjectId,
      ref: "Topic",
      default: null,
    },
    section: { type: String, enum: ["VARC", "DILR", "Quant"] },
    subject: { type: String, enum: ["VARC", "DILR", "Quant"] },
    date: {
      type: String,
      default: "",
      validate: {
        validator: (value) => value === "" || isISODate(value),
        message: "Revision date must be a valid YYYY-MM-DD date",
      },
    },
    result: {
      type: String,
      enum: [
        "Not attempted",
        "Wrong again",
        "Correct with hint",
        "Correct independently",
      ],
      default: "Not attempted",
    },
    notes: { type: String, default: "", maxlength: 5000 },
    status: {
      type: String,
      enum: ["pending", "completed", "Pending", "Completed"],
      default: "pending",
    },
    completed: { type: Boolean, default: false },
    completedOn: {
      type: String,
      default: "",
      validate: {
        validator: (value) => value === "" || isISODate(value),
        message: "Completion date must be a valid YYYY-MM-DD date",
      },
    },
  },
  { timestamps: true },
);

revisionSchema.pre("validate", function validateCompletion() {
  if (!this.title && this.topic) {
    this.title = this.topic;
  }
  if (!this.topic && this.title) {
    this.topic = this.title;
  }
  if (!this.title && !this.topic) {
    this.invalidate("title", "Topic / title is required");
  }

  if (!this.section && this.subject) {
    this.section = this.subject;
  }
  if (!this.subject && this.section) {
    this.subject = this.section;
  }
  if (!this.section && !this.subject) {
    this.invalidate("section", "Section / subject is required");
  }

  if (this.status) {
    const s = String(this.status).toLowerCase();
    this.status = s;
    this.completed = s === "completed";
  } else {
    this.status = this.completed ? "completed" : "pending";
  }

  if (this.completed && !this.completedOn) {
    this.invalidate("completedOn", "Completed revisions require a completion date");
  }
  if (!this.completed && this.completedOn) {
    this.invalidate("completedOn", "Pending revisions cannot have a completion date");
  }
});

revisionSchema.index({ userId: 1, completed: 1, date: 1 });
revisionSchema.index({ userId: 1, status: 1, date: 1 });
revisionSchema.index({ userId: 1, completedOn: 1 });
revisionSchema.index({ userId: 1, section: 1 });
revisionSchema.index({ userId: 1, topicId: 1 });

export default models.Revision || model("Revision", revisionSchema);

