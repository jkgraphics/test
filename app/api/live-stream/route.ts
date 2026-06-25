import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Match } from "@/lib/types";

// In-memory fallback
let memoryCache: { [id: string]: { match: Match; lastUpdated: number } } = {};
const CACHE_FILE = path.join("/tmp", "gully_live_scores.json");

// Helper to load cache from disk
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, "utf-8");
      const diskData = JSON.parse(content);
      // Merge disk data with memory cache (keep newer timestamps)
      for (const id in diskData) {
        if (!memoryCache[id] || memoryCache[id].lastUpdated < diskData[id].lastUpdated) {
          memoryCache[id] = diskData[id];
        }
      }
    }
  } catch (err) {
    console.warn("Could not load disk cache", err);
  }
}

// Helper to save cache to disk
function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(memoryCache, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not save to disk cache", err);
  }
}

// Initialize cache
loadCache();

export async function GET(req: NextRequest) {
  loadCache();
  const searchParams = req.nextUrl.searchParams;
  const matchId = searchParams.get("matchId");

  if (matchId) {
    const cached = memoryCache[matchId];
    if (!cached) {
      return NextResponse.json({ error: "Match stream not found" }, { status: 404 });
    }
    return NextResponse.json({ match: cached.match, lastUpdated: cached.lastUpdated });
  }

  // If no matchId, return all active/live matches
  const now = Date.now();
  const activeStreams = Object.values(memoryCache)
    .filter((entry) => {
      const match = entry.match;
      // Show games that are ongoing, breaking, chasing, or completed within the last 2 hours
      const isRecentlyActive = now - entry.lastUpdated < 2 * 60 * 60 * 1000;
      return (
        match.status === "Ongoing" ||
        match.status === "Chasing" ||
        match.status === "InningsBreak" ||
        (match.status === "Completed" && isRecentlyActive)
      );
    })
    .map((entry) => ({
      id: entry.match.id,
      teamAName: entry.match.teamAName,
      teamBName: entry.match.teamBName,
      status: entry.match.status,
      oversAllowed: entry.match.oversAllowed,
      lastUpdated: entry.lastUpdated,
      innings: entry.match.innings,
      currentInningIndex: entry.match.currentInningIndex,
    }));

  return NextResponse.json({ matches: activeStreams });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { matchId, match } = body;

    if (!matchId || !match) {
      return NextResponse.json({ error: "Missing matchId or match state" }, { status: 400 });
    }

    loadCache();
    memoryCache[matchId] = {
      match,
      lastUpdated: Date.now(),
    };
    saveCache();

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update live stream score: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
