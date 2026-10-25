import { Schema, models, model } from "mongoose";
import { blankToUndefined, isISODate } from "@/models/model-validators";

const dailyReflectionSchema = new Schema(
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
    plan: { type: String, default: "", maxlength: 5000 },
    actual: { type: String, default: "", maxlength: 5000 },
    hours: {
      type: Number,
      min: 0,
      set: blankToUndefined,
      validate: {
        validator: (value) => value == null || Number.isInteger(value * 4),
        message: "Focused hours must use quarter-hour increments",
      },
    },
    focus: { type: String, default: "", maxlength: 5000 },
    win: { type: String, default: "", maxlength: 5000 },
    weak: { type: String, default: "", maxlength: 5000 },
    tomorrow: { type: String, default: "", maxlength: 5000 },
  },
  { timestamps: true },
);

dailyReflectionSchema.index({ userId: 1, date: 1 }, { unique: true });

export default models.DailyReflection ||
  model("DailyReflection", dailyReflectionSchema);
