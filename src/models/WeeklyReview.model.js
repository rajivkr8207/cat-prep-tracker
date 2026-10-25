import { Schema, models, model } from "mongoose";
import { isISODate } from "@/models/model-validators";

const weeklyReviewSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    weekStart: {
      type: String,
      required: true,
      validate: { validator: isISODate, message: "Week start must be a valid YYYY-MM-DD date" },
    },
    weekEnd: {
      type: String,
      required: true,
      validate: { validator: isISODate, message: "Week end must be a valid YYYY-MM-DD date" },
    },
    goals: { type: String, default: "", maxlength: 5000 },
    varc: { type: String, default: "", maxlength: 5000 },
    quant: { type: String, default: "", maxlength: 5000 },
    dilr: { type: String, default: "", maxlength: 5000 },
    revision: { type: String, default: "", maxlength: 5000 },
    improved: { type: String, default: "", maxlength: 5000 },
    mistakes: { type: String, default: "", maxlength: 5000 },
    avoided: { type: String, default: "", maxlength: 5000 },
    next: { type: String, default: "", maxlength: 5000 },
    advice: { type: String, default: "", maxlength: 5000 },
  },
  { timestamps: true }
);

weeklyReviewSchema.index(
  { userId: 1, weekStart: 1 },
  { unique: true }
);

weeklyReviewSchema.pre("validate", function validateWeekRange() {
  if (!isISODate(this.weekStart) || !isISODate(this.weekEnd)) return;

  const start = new Date(`${this.weekStart}T00:00:00.000Z`);
  const end = new Date(`${this.weekEnd}T00:00:00.000Z`);
  if (start.getUTCDay() !== 1) {
    this.invalidate("weekStart", "Week must start on Monday");
  }
  if (end.getTime() - start.getTime() !== 6 * 24 * 60 * 60 * 1000) {
    this.invalidate("weekEnd", "Week must end six days after its Monday start");
  }
});

export default models.WeeklyReview ||
  model("WeeklyReview", weeklyReviewSchema);