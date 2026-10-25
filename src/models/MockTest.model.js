import { Schema, models, model } from "mongoose";
import { blankToUndefined, isISODate } from "@/models/model-validators";

const sectionResultSchema = new Schema(
  {
    total: { type: Number, min: 0, validate: Number.isInteger, set: blankToUndefined },
    attempted: { type: Number, min: 0, validate: Number.isInteger, set: blankToUndefined },
    correct: { type: Number, min: 0, validate: Number.isInteger, set: blankToUndefined },
    wrongNeg: { type: Number, min: 0, validate: Number.isInteger, set: blankToUndefined },
    wrongNoNeg: { type: Number, min: 0, validate: Number.isInteger, set: blankToUndefined },
  },
  { _id: false },
);

const mockTestSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    date: {
      type: String,
      required: true,
      validate: { validator: isISODate, message: "Date must be a valid YYYY-MM-DD date" },
    },
    type: { type: String, enum: ["full", "sectional"], required: true },
    testSection: { type: String, enum: ["", "VARC", "DILR", "Quant"], default: "" },
    percentile: { type: Number, min: 0, max: 100, set: blankToUndefined },
    score: { type: Number, set: blankToUndefined },
    attempts: { type: Number, min: 0, validate: Number.isInteger, set: blankToUndefined },
    varc: { type: Number, set: blankToUndefined },
    dilr: { type: Number, set: blankToUndefined },
    quant: { type: Number, set: blankToUndefined },
    loss: { type: String, default: "", maxlength: 5000 },
    action: { type: String, default: "", maxlength: 5000 },
    sections: {
      VARC: { type: sectionResultSchema, default: undefined },
      DILR: { type: sectionResultSchema, default: undefined },
      Quant: { type: sectionResultSchema, default: undefined },
    },
  },
  { timestamps: true },
);

mockTestSchema.pre("validate", function validateMockTest() {
  if (this.type === "sectional" && !this.testSection) {
    this.invalidate("testSection", "Sectional tests require a section");
  }
  if (this.type === "full" && this.testSection) {
    this.invalidate("testSection", "Full mocks must not have a single test section");
  }

  for (const section of ["VARC", "DILR", "Quant"]) {
    const result = this.sections?.[section];
    if (!result) continue;
    if (
      result.attempted != null &&
      result.total != null &&
      result.attempted > result.total
    ) {
      this.invalidate(`sections.${section}.attempted`, "Attempted cannot exceed total");
    }
    if (
      result.correct != null &&
      result.attempted != null &&
      result.correct > result.attempted
    ) {
      this.invalidate(`sections.${section}.correct`, "Correct cannot exceed attempted");
    }
    const classifiedAttempts =
      (result.correct || 0) + (result.wrongNeg || 0) + (result.wrongNoNeg || 0);
    if (
      result.attempted != null &&
      classifiedAttempts > result.attempted
    ) {
      this.invalidate(
        `sections.${section}.attempted`,
        "Correct and incorrect counts cannot exceed attempted",
      );
    }
  }
});

mockTestSchema.index({ userId: 1, date: -1 });
mockTestSchema.index({ userId: 1, type: 1, testSection: 1, date: -1 });

export default models.MockTest || model("MockTest", mockTestSchema);
