import { connectDB } from "@/config/database";
import {
  getAuthenticatedUser,
  handleAuthError,
  readJsonBody,
} from "@/lib/auth";
import { getPreparationPayload } from "@/lib/preparation";
import PreparationTracker from "@/models/preparationTracker.model";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    await connectDB();
    const preparations = await PreparationTracker.find({ user: user._id }).sort({
      date: 1,
      createdAt: 1,
    });

    return Response.json({ preparations });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await readJsonBody(request);
    if (!body) {
      return Response.json({ error: "A JSON object is required" }, { status: 400 });
    }

    const { payload, error } = getPreparationPayload(body);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    await connectDB();
    const preparation = await PreparationTracker.create({
      ...payload,
      user: user._id,
    });

    return Response.json({ preparation }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
