import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  mockTestApiError,
  parseObjectId,
  validateMockTestPayload,
} from "@/lib/mock-test-api";
import MockTest from "@/models/MockTest.model";

async function getMockId(context) {
  const { id } = await context.params;
  return id;
}

export async function GET(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getMockId(context);
    if (!parseObjectId(id)) {
      return Response.json({ error: "Invalid mock test ID" }, { status: 400 });
    }

    await connectDB();
    const mockTest = await MockTest.findOne({
      _id: id,
      userId: user._id,
    }).lean();

    if (!mockTest) {
      return Response.json({ error: "Mock test not found" }, { status: 404 });
    }

    return Response.json({ mockTest });
  } catch (error) {
    return mockTestApiError(error);
  }
}

export async function PATCH(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getMockId(context);
    if (!parseObjectId(id)) {
      return Response.json({ error: "Invalid mock test ID" }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "A valid JSON object is required" }, { status: 400 });
    }

    const validation = validateMockTestPayload(body, { partial: true });
    if (validation.error) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    await connectDB();
    const mockTest = await MockTest.findOne({
      _id: id,
      userId: user._id,
    });

    if (!mockTest) {
      return Response.json({ error: "Mock test not found" }, { status: 404 });
    }

    for (const [field, value] of Object.entries(validation.payload)) {
      mockTest.set(field, value);
    }
    await mockTest.save();

    return Response.json({ mockTest });
  } catch (error) {
    return mockTestApiError(error);
  }
}

export async function DELETE(request, context) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const id = await getMockId(context);
    if (!parseObjectId(id)) {
      return Response.json({ error: "Invalid mock test ID" }, { status: 400 });
    }

    await connectDB();
    const deleted = await MockTest.findOneAndDelete({
      _id: id,
      userId: user._id,
    });

    if (!deleted) {
      return Response.json({ error: "Mock test not found" }, { status: 404 });
    }

    return Response.json({ message: "Mock test deleted" });
  } catch (error) {
    return mockTestApiError(error);
  }
}
