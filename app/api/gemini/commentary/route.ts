import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { Match } from "@/lib/types";

// Standard initialization with required user agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, match, context } = body as {
      type: "summary" | "commentary";
      match?: Match;
      context?: {
        bowler: string;
        striker: string;
        ballOutcome: string; // e.g. "4", "W (Caught)", "1"
        recentOverDetails: string[];
      };
    };

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { text: "Gemini API key is missing from environment. Please add it in Settings > Secrets." },
        { status: 200 } // Return gracefully so app displays setup reminder
      );
    }

    if (type === "summary" && match) {
      const activeInning = match.innings[match.currentInningIndex] || match.innings[0];
      const matchDetailsText = `
        Match Date: ${match.date}
        Teams: ${match.teamAName} vs ${match.teamBName}
        Overs Limit: ${match.oversAllowed} overs
        Status: ${match.status}
        Match Result/Verdict: ${match.matchResult || "Tournament ongoing/Match concluded"}
        Innings Details:
        ${match.innings
          .map((inn, idx) => {
            return `
            Inning ${idx + 1}: ${idx === 0 ? match.teamAName : match.teamBName} Batting
            Runs: ${inn.runs}/${inn.wickets} in ${inn.overs}.${inn.ballsInCurrentOver} overs
            Extras: ${inn.extras.wides} wides, ${inn.extras.noBalls} no balls, ${inn.extras.byes} byes, ${inn.extras.legByes} legbyes (Total ${inn.extras.total})
            Top Batsmen scorecard:
            ${Object.entries(inn.batsmen)
              .map(([name, b]) => `* ${name}: ${b.runs} off ${b.balls} balls (${b.fours} fours, ${b.sixes} sixes, ${b.isOut ? "OUT - " + b.howOut : "NOT OUT"})`)
              .join("\n")}
            Top Bowler scorecard:
            ${Object.entries(inn.bowlers)
              .map(([name, b]) => `* ${name}: ${b.runs} runs conceded, ${b.wickets} wickets, in ${Math.floor(b.balls / 6)}.${b.balls % 6} overs`)
              .join("\n")}
          `;
          })
          .join("\n")}
      `;

      const prompt = `
        You are a legendary, super energetic street-cricket commentator who has analyzed tons of "Gully Cricket" matches (like tape-ball cricket or colony tournaments).
        Provide a comical, dramatic, and highly engaging match report/summary of this specific match based on the scorecard stats.
        Use popular local/gully terms if appropriate (like 'bhatta' bowling, 'one-bounce-out', 'hitting on neighbor's terrace', 'baby over', 'gully legend', 'extra runs because ball went into the drain').
        Write with professional sports-news formatting but with top-tier humor, naming specific players from the stats who played brilliantly or tanked miserably.
        Keep it under 350 words.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `${prompt}\n\nHere are the raw match statistics:\n${matchDetailsText}`,
      });

      return NextResponse.json({ text: response.text });
    } else if (type === "commentary" && context) {
      const { bowler, striker, ballOutcome, recentOverDetails } = context;

      const prompt = `
        You are an excited gully cricket spectator sitting on the boundary wall (or a balcony overlooking the street).
        Provide a short, funny, 1-2 sentence real-time commentary for a single delivery:
        Bowler: ${bowler}
        Striker: ${striker}
        Ball Outcome: ${ballOutcome}
        Recent balls in this over: [${recentOverDetails.join(", ")}]

        Make it feel raw, local, high-energy, and full of gully cricket banter! Keep it very concise (less than 60 words).
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      return NextResponse.json({ text: response.text });
    }

    return NextResponse.json({ error: "Invalid parameters requested" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: "Error contacting Gemini: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
