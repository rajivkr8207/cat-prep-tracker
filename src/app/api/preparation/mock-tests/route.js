import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  mockTestApiError,
  validateMockTestPayload,
} from "@/lib/mock-test-api";
import MockTest from "@/models/MockTest.model";

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const searchParams = new URL(request.url).searchParams;
    const type = searchParams.get("type");
    const testSection = searchParams.get("section") || searchParams.get("testSection");

    const filter = { userId: user._id };

    if (type && type !== "all" && type !== "All") {
      filter.type = type.toLowerCase();
    }

    if (testSection && testSection !== "all" && testSection !== "All") {
      filter.testSection = testSection;
    }

    await connectDB();
    const mockTests = await MockTest.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .lean();

    return Response.json({ mockTests });
  } catch (error) {
    return mockTestApiError(error);
  }
}

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "A valid JSON object is required" }, { status: 400 });
    }

    const validation = validateMockTestPayload(body);
    if (validation.error) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    await connectDB();
    const mockTest = new MockTest({
      ...validation.payload,
      userId: user._id,
    });
    await mockTest.save();

    return Response.json({ mockTest }, { status: 201 });
  } catch (error) {
    return mockTestApiError(error);
  }
}
