import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import Config from "@/config/Config";
import { connectDB } from "@/config/database";
import UserModel from "@/models/user.model";

export const AUTH_COOKIE_NAME = "auth_token";
export const ACCESS_TOKEN_COOKIE_NAME = "access_token";
export const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

function tokenMaxAge(expiry) {
  const match = /^(\d+)(s|m|h|d|w|y)?$/.exec(expiry || "");
  if (!match) return 15 * 60;

  const units = { s: 1, m: 60, h: 3600, d: 86400, w: 604800, y: 31536000 };
  return Number(match[1]) * units[match[2] || "s"];
}

function setCookie(response, name, value, maxAge) {
  if (!(response instanceof NextResponse)) {
    throw new TypeError("Auth cookies must be set on a NextResponse");
  }

  response.cookies.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export function setAuthCookies(response, accessToken, refreshToken) {
  setCookie(
    response,
    ACCESS_TOKEN_COOKIE_NAME,
    accessToken,
    tokenMaxAge(Config.JWT_ACCESS_EXPIRES_IN),
  );
  setCookie(
    response,
    REFRESH_TOKEN_COOKIE_NAME,
    refreshToken,
    tokenMaxAge(Config.JWT_REFRESH_EXPIRES_IN),
  );
  return response;
}

export function clearAuthCookies(response) {
  if (!(response instanceof NextResponse)) {
    throw new TypeError("Auth cookies must be cleared on a NextResponse");
  }

  for (const name of [
    ACCESS_TOKEN_COOKIE_NAME,
    REFRESH_TOKEN_COOKIE_NAME,
    AUTH_COOKIE_NAME,
  ]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}

function getAccessTokenSecret() {
  if (!Config.JWT_ACCESS_SECRET || Config.JWT_ACCESS_SECRET.length < 32) {
    throw new Error(
      "JWT_ACCESS_SECRET must be set to a random secret of at least 32 characters",
    );
  }

  return Config.JWT_ACCESS_SECRET;
}

function getRefreshTokenSecret() {
  if (!Config.JWT_REFRESH_SECRET || Config.JWT_REFRESH_SECRET.length < 32) {
    throw new Error(
      "JWT_REFRESH_SECRET must be set to a different random secret of at least 32 characters",
    );
  }

  return Config.JWT_REFRESH_SECRET;
}

export function createSessionTokens(user) {
  return {
    accessToken: user.generateAccessToken(),
    refreshToken: user.generateRefreshToken(),
  };
}

export function setRefreshTokenHash(user, token) {
  user.refreshTokenHash = user.hashToken(token);
}

export async function getAuthenticatedUser(request) {
  const token =
    request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value ||
    request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  let payload;
  try {
    payload = jwt.verify(token, getAccessTokenSecret());
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError
    ) {
      return null;
    }
    throw error;
  }

  if (typeof payload !== "object" || typeof payload.id !== "string") {
    return null;
  }

  await connectDB();
  const user = await UserModel.findById(payload.id);
  if (
    !user ||
    user.isBlocked ||
    !user.isApproved ||
    payload.version !== (user.authVersion || 0)
  ) {
    return null;
  }

  return user;
}

export async function revokeSession(request) {
  const token =
    request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value ||
    request.cookies.get(AUTH_COOKIE_NAME)?.value ||
    request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value;
  if (!token) return;

  let payload;
  try {
    payload = jwt.verify(token, getAccessTokenSecret(), {
      ignoreExpiration: true,
    });
  } catch (accessError) {
    if (
      !(accessError instanceof jwt.JsonWebTokenError) &&
      !(accessError instanceof jwt.TokenExpiredError)
    ) {
      throw accessError;
    }

    try {
      payload = jwt.verify(token, getRefreshTokenSecret(), {
        ignoreExpiration: true,
      });
    } catch (refreshError) {
      if (
        refreshError instanceof jwt.JsonWebTokenError ||
        refreshError instanceof jwt.TokenExpiredError
      ) {
        return;
      }
      throw refreshError;
    }
  }

  const userId = typeof payload === "object" ? payload.id || payload.sub : null;
  if (typeof userId !== "string") return;

  await connectDB();
  const user = await UserModel.findById(userId);
  if (user) {
    user.authVersion = (user.authVersion || 0) + 1;
    user.refreshTokenHash = null;
    await user.save();
  }
}

export async function rotateRefreshToken(request) {
  const token = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value;
  if (!token) return null;

  let payload;
  try {
    payload = jwt.verify(token, getRefreshTokenSecret());
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError
    ) {
      return null;
    }
    throw error;
  }

  if (typeof payload !== "object" || typeof payload.id !== "string") {
    return null;
  }

  await connectDB();
  const user = await UserModel.findById(payload.id).select("+refreshTokenHash");
  if (
    !user ||
    user.isBlocked ||
    !user.isApproved ||
    payload.version !== (user.authVersion || 0) ||
    !user.compareRefreshToken(token)
  ) {
    return null;
  }

  const tokens = createSessionTokens(user);
  setRefreshTokenHash(user, tokens.refreshToken);
  await user.save();
  return { user, ...tokens };
}

export function publicUser(user) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    isApproved: user.isApproved,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function readJsonBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? body
      : null;
  } catch {
    return null;
  }
}

export function handleAuthError(error) {
  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "Field";
    return Response.json(
      { error: `${field} is already in use` },
      { status: 409 },
    );
  }

  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return Response.json({ error: error.message }, { status: 400 });
  }

  console.error("Auth API error:", error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
