import { Schema, models, model } from "mongoose";

const monthlyReviewSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    month: { type: Number, required: true, min: 1, max: 12, validate: Number.isInteger },
    year: { type: Number, required: true, min: 2000, validate: Number.isInteger },
    goal: { type: String, default: "", maxlength: 5000 },
    topics: { type: String, default: "", maxlength: 5000 },
    evidence: { type: String, default: "", maxlength: 5000 },
    varc: { type: String, default: "", maxlength: 5000 },
    quant: { type: String, default: "", maxlength: 5000 },
    dilr: { type: String, default: "", maxlength: 5000 },
    revision: { type: String, default: "", maxlength: 5000 },
    mocks: { type: String, default: "", maxlength: 5000 },
    notWork: { type: String, default: "", maxlength: 5000 },
    next: { type: String, default: "", maxlength: 5000 },
  },
  { timestamps: true }
);

monthlyReviewSchema.index(
  { userId: 1, year: 1, month: 1 },
  { unique: true }
);

export default models.MonthlyReview ||
  model("MonthlyReview", monthlyReviewSchema);