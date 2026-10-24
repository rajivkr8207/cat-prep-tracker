import { connectDB } from "@/config/database";
import {
  getAuthenticatedUser,
  handleAuthError,
  readJsonBody,
} from "@/lib/auth";
import {
  getPreparationPayload,
  PREPARATION_FIELDS,
} from "@/lib/preparation";
import PreparationTracker from "@/models/preparationTracker.model";

const OBJECT_ID_PATTERN = /^[\da-f]{24}$/i;
const REPLACEMENT_FIELDS = PREPARATION_FIELDS.filter(
  (field) => field !== "notes",
);

function isValidId(id) {
  return typeof id === "string" && OBJECT_ID_PATTERN.test(id);
}

export async function GET(request, { params }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    if (!isValidId(id)) {
      return Response.json({ error: "Invalid preparation id" }, { status: 400 });
    }

    await connectDB();
    const preparation = await PreparationTracker.findOne({
      _id: id,
      user: user._id,
    });
    if (!preparation) {
      return Response.json({ error: "Preparation not found" }, { status: 404 });
    }

    return Response.json({ preparation });
  } catch (error) {
    return handleAuthError(error);
  }
}

async function updatePreparation(request, params, replace) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    if (!isValidId(id)) {
      return Response.json({ error: "Invalid preparation id" }, { status: 400 });
    }

    const body = await readJsonBody(request);
    if (!body) {
      return Response.json({ error: "A JSON object is required" }, { status: 400 });
    }

    const { payload, error } = getPreparationPayload(body);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    if (Object.keys(payload).length === 0) {
      return Response.json(
        { error: "Provide at least one preparation field to update" },
        { status: 400 },
      );
    }

    if (
      replace &&
      REPLACEMENT_FIELDS.some((field) => !Object.hasOwn(payload, field))
    ) {
      return Response.json(
        { error: "PUT requires all preparation fields except notes" },
        { status: 400 },
      );
    }

    await connectDB();
    const preparation = await PreparationTracker.findOne({
      _id: id,
      user: user._id,
    });
    if (!preparation) {
      return Response.json({ error: "Preparation not found" }, { status: 404 });
    }

    if (replace) {
      preparation.set({
        ...payload,
        notes: Object.hasOwn(payload, "notes") ? payload.notes : "",
      });
    } else {
      preparation.set(payload);
    }

    await preparation.save();
    return Response.json({ preparation });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(request, { params }) {
  return updatePreparation(request, params, false);
}

export async function PUT(request, { params }) {
  return updatePreparation(request, params, true);
}

export async function DELETE(request, { params }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    if (!isValidId(id)) {
      return Response.json({ error: "Invalid preparation id" }, { status: 400 });
    }

    await connectDB();
    const preparation = await PreparationTracker.findOneAndDelete({
      _id: id,
      user: user._id,
    });
    if (!preparation) {
      return Response.json({ error: "Preparation not found" }, { status: 404 });
    }

    return Response.json({ message: "Preparation deleted" });
  } catch (error) {
    return handleAuthError(error);
  }
}
