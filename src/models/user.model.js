import { ROLE_VALUES, ROLES } from "@/constants/Roles";
import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import Config from "@/config/Config";

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
      match: [
        /^[a-z0-9]+$/,
        "Username can only contain lowercase letters and numbers",
      ],
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email"],
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
      default: null,
    },

    mobile: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      default: undefined,
      match: [/^[6-9]\d{9}$/, "Please enter a valid mobile number"],
    },
    role: {
      type: String,
      enum: ROLE_VALUES,
      default: ROLES.STUDENT,
      index: true,
    },
    isApproved: {
      type: Boolean,
      default: true,
      index: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    authVersion: {
      type: Number,
      default: 0,
    },
    refreshTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetOtpHash: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetOtpExpiresAt: {
      type: Date,
      default: null,
    },
    passwordResetOtpSentAt: {
      type: Date,
      default: null,
    },
    passwordResetOtpAttempts: {
      type: Number,
      default: 0,
    },
    passwordResetTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetTokenExpiresAt: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function () {
  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  return;
});

userSchema.methods.comparePassword = async function comparePassword(password) {
  if (!password || !this.password) {
    return false;
  }
  return bcrypt.compare(password, this.password);
};

userSchema.methods.hashToken = function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
};

userSchema.methods.setRefreshTokenHash = function setRefreshTokenHash(token) {
  if (!token) {
    return null;
  }
  this.refreshTokenHash = this.hashToken(token);
  return this.refreshTokenHash;
};

userSchema.methods.compareRefreshToken = function compareRefreshToken(token) {
  if (!token || !this.refreshTokenHash) return false;
  const incomingHash = Buffer.from(this.hashToken(token), "hex");
  const storedHash = Buffer.from(this.refreshTokenHash, "hex");
  return (
    incomingHash.length === storedHash.length &&
    crypto.timingSafeEqual(incomingHash, storedHash)
  );
};

userSchema.methods.generateAccessToken = function generateAccessToken() {
  return jwt.sign(
    {
      sub: this._id.toString(),
      id: this._id.toString(),
      role: this.role,
      email: this.email,
      provider: this.provider,
      version: this.authVersion || 0,
    },
    Config.JWT_ACCESS_SECRET,
    {
      expiresIn: Config.JWT_ACCESS_EXPIRES_IN,
    },
  );
};

userSchema.methods.generateRefreshToken = function generateRefreshToken() {
  return jwt.sign(
    {
      id: this._id.toString(),
      version: this.authVersion || 0,
      provider: this.provider,
    },
    Config.JWT_REFRESH_SECRET,
    {
      expiresIn: Config.JWT_REFRESH_EXPIRES_IN,
    },
  );
};
const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

export default UserModel;
