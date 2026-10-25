import { Schema, models, model } from "mongoose";

const UserSettingsSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    theme: { type: String, enum: ["light", "dark"], default: "light" },
  },
  { timestamps: true }
);

export default models.UserSettings ||
  model("UserSettings", UserSettingsSchema);