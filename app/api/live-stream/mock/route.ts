import { NextRequest, NextResponse } from "next/server";
import { generateMockMatchState } from "@/lib/mock-generator";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const customYoutubeId = searchParams.get("youtubeId") || undefined;
  
  const nowInSecs = Math.floor(Date.now() / 1000);
  const match = generateMockMatchState(nowInSecs, customYoutubeId);
  
  return NextResponse.json({
    match,
    lastUpdated: Date.now()
  });
}
