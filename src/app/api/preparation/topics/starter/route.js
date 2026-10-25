import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import { CAT_STARTER_TOPICS, topicApiError } from "@/lib/topic-api";
import Topic from "@/models/Topic.model";

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    await connectDB();
    const existingTopics = await Topic.find({ userId: user._id })
      .select("section name")
      .lean();

    const existingSet = new Set(
      existingTopics.map((t) => `${t.section}|||${String(t.name).trim().toLowerCase()}`),
    );

    const toInsert = [];
    for (const item of CAT_STARTER_TOPICS) {
      const key = `${item.section}|||${item.name.toLowerCase()}`;
      if (!existingSet.has(key)) {
        toInsert.push({
          userId: user._id,
          section: item.section,
          name: item.name,
          priority: item.priority,
          status: "Not started",
          notes: "",
        });
        existingSet.add(key);
      }
    }

    if (toInsert.length > 0) {
      await Topic.insertMany(toInsert);
    }

    const allTopics = await Topic.find({ userId: user._id })
      .sort({ updatedAt: -1 })
      .lean();

    return Response.json({
      added: toInsert.length,
      topics: allTopics,
    });
  } catch (error) {
    return topicApiError(error);
  }
}
