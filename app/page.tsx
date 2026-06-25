"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useMemo } from "react";
import {
  Trophy,
  Users,
  Play,
  History,
  FileText,
  Sparkles,
  Search,
  CheckCircle2,
  Trash2,
  Moon,
  Sun,
  Lightbulb,
  CornerDownRight,
  Database,
  ArrowRight,
  Download
} from "lucide-react";
import { Match, Team, Tournament, TournamentMatch } from "@/lib/types";
import TeamsTab from "@/components/teams-tab";
import ScoringTab from "@/components/scoring-tab";
import TournamentsTab from "@/components/tournaments-tab";
import RunRateChart from "@/components/run-rate-chart";
import { pickTopPerformer, createInning } from "@/lib/scoring-engine";
import { toJpeg } from "html-to-image";

export default function GullyScoreApp() {
  const [tab, setTab] = useState<"dashboard" | "teams" | "scoring" | "tournaments" | "history">("dashboard");
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [historyMatches, setHistoryMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // History search/filter
  const [historySearch, setHistorySearch] = useState("");
  const [selectedHistoryMatch, setSelectedHistoryMatch] = useState<Match | null>(null);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiReportText, setAiReportText] = useState("");
  const [activeScorecardTab, setActiveScorecardTab] = useState<0 | 1>(0);
  const [isDownloadingJpg, setIsDownloadingJpg] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState<"batting" | "bowling">("batting");

  // Dynamically aggregate individual statistics for gully cricket leaderboards
  const leaderboardStats = useMemo(() => {
    const batsmenMap: {
      [name: string]: {
        name: string;
        runs: number;
        balls: number;
        fours: number;
        sixes: number;
        innings: number;
        outs: number;
      };
    } = {};

    const bowlersMap: {
      [name: string]: {
        name: string;
        balls: number;
        runs: number;
        wickets: number;
        maidens: number;
        innings: number;
      };
    } = {};

    historyMatches.forEach((match) => {
      if (!match || !match.innings) return;
      match.innings.forEach((inning) => {
        if (!inning) return;
        // Batsmen
        if (inning.batsmen) {
          Object.entries(inning.batsmen).forEach(([name, data]) => {
            if (!name || name.trim() === "") return;
            if (!batsmenMap[name]) {
              batsmenMap[name] = { name, runs: 0, balls: 0, fours: 0, sixes: 0, innings: 0, outs: 0 };
            }
            batsmenMap[name].runs += data.runs || 0;
            batsmenMap[name].balls += data.balls || 0;
            batsmenMap[name].fours += data.fours || 0;
            batsmenMap[name].sixes += data.sixes || 0;
            batsmenMap[name].innings += 1;
            if (data.isOut) {
              batsmenMap[name].outs += 1;
            }
          });
        }
        // Bowlers
        if (inning.bowlers) {
          Object.entries(inning.bowlers).forEach(([name, data]) => {
            if (!name || name.trim() === "") return;
            if (!bowlersMap[name]) {
              bowlersMap[name] = { name, balls: 0, runs: 0, wickets: 0, maidens: 0, innings: 0 };
            }
            bowlersMap[name].balls += data.balls || 0;
            bowlersMap[name].runs += data.runs || 0;
            bowlersMap[name].wickets += data.wickets || 0;
            bowlersMap[name].maidens += data.maidens || 0;
            bowlersMap[name].innings += 1;
          });
        }
      });
    });

    const topBatsmen = Object.values(batsmenMap)
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 5);

    const topBowlers = Object.values(bowlersMap)
      .sort((a, b) => {
        if (b.wickets !== a.wickets) {
          return b.wickets - a.wickets;
        }
        const econA = a.balls > 0 ? a.runs / (a.balls / 6) : 999;
        const econB = b.balls > 0 ? b.runs / (b.balls / 6) : 999;
        return econA - econB;
      })
      .slice(0, 5);

    return { topBatsmen, topBowlers };
  }, [historyMatches]);

  const handleDownloadJpg = async () => {
    const node = document.getElementById("downloadable-scorecard");
    if (!node) return;

    try {
      setIsDownloadingJpg(true);
      // Wait a tiny bit for render
      await new Promise((resolve) => setTimeout(resolve, 200));

      const dataUrl = await toJpeg(node, {
        quality: 0.95,
        backgroundColor: "#f8fafc", // slate-50 matches our offline card background
        cacheBust: true,
        style: {
          opacity: "1",
          transform: "scale(1)",
          left: "0",
          top: "0",
          position: "relative",
          margin: "0",
          visibility: "visible",
        }
      });

      const teamA = (selectedHistoryMatch?.teamAName || "team-a").toLowerCase().replace(/\s+/g, "-");
      const teamB = (selectedHistoryMatch?.teamBName || "team-b").toLowerCase().replace(/\s+/g, "-");
      const filename = `gully-scorecard-${teamA}-vs-${teamB}.jpg`;

      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to generate JPG scorecard", error);
      alert("Failed to export JPG scorecard. Please try again.");
    } finally {
      setIsDownloadingJpg(false);
    }
  };



  // Sync state with LocalStorage for offline resilience
  useEffect(() => {
    const savedTeams = localStorage.getItem("gully_teams");
    const savedActive = localStorage.getItem("gully_active_match");
    const savedHistory = localStorage.getItem("gully_history");
    const savedTourneys = localStorage.getItem("gully_tournaments");
    const savedTheme = localStorage.getItem("gully_darkmode");

    if (savedTeams) {
      setTeams(JSON.parse(savedTeams));
    }
    if (savedActive) {
      setActiveMatch(JSON.parse(savedActive));
    }
    if (savedHistory) {
      setHistoryMatches(JSON.parse(savedHistory));
    }
    if (savedTourneys) {
      setTournaments(JSON.parse(savedTourneys));
    }
    if (savedTheme) {
      setIsDarkMode(savedTheme === "true");
    } else {
      setIsDarkMode(true); // default dark
    }
  }, []);

  const saveTeams = (newTeams: Team[]) => {
    setTeams(newTeams);
    localStorage.setItem("gully_teams", JSON.stringify(newTeams));
  };

  const saveActiveMatch = (match: Match | null) => {
    setActiveMatch(match);
    if (match) {
      localStorage.setItem("gully_active_match", JSON.stringify(match));
    } else {
      localStorage.removeItem("gully_active_match");
    }
  };

  const saveHistoryMatches = (history: Match[]) => {
    setHistoryMatches(history);
    localStorage.setItem("gully_history", JSON.stringify(history));
  };

  const saveTournaments = (tourneys: Tournament[]) => {
    setTournaments(tourneys);
    localStorage.setItem("gully_tournaments", JSON.stringify(tourneys));
  };

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    localStorage.setItem("gully_darkmode", String(next));
  };

  // 1. LINK TO TOURNAMENTS FIXTURE GAME ENGINE
  const handleStartMatchFromFixture = (
    teamAId: string,
    teamBId: string,
    overs: number,
    tournamentId: string,
    fixtureId: string
  ) => {
    const tAName = teams.find((t) => t.id === teamAId)?.name || "Team A";
    const tBName = teams.find((t) => t.id === teamBId)?.name || "Team B";

    const newMatch: Match = {
      id: "match-" + Math.random().toString(36).substring(2, 9),
      teamAId,
      teamBId,
      teamAName: tAName,
      teamBName: tBName,
      oversAllowed: overs,
      status: "Toss",
      currentInningIndex: 0,
      innings: [],
      currentStriker: "",
      currentNonStriker: "",
      currentBowler: "",
      date: new Date().toISOString().split("T")[0],
      tournamentId, // tag linked tournament
    };

    saveActiveMatch(newMatch);

    // Update scheduled fixture in tournament as 'Ongoing'
    const updatedTourneys = tournaments.map((t) => {
      if (t.id === tournamentId) {
        return {
          ...t,
          matches: t.matches.map((m) => {
            if (m.id === fixtureId) {
              return { ...m, status: "Ongoing" as const, matchId: newMatch.id };
            }
            return m;
          }),
        };
      }
      return t;
    });
    saveTournaments(updatedTourneys);

    setTab("scoring");
  };

  // 2. RETRIEVE COMPLETED MATCH INNING DETAIL TO ARCHIVE / TALLY STANDINGS
  const handleArchiveCompletedMatch = (completedMatch: Match) => {
    // Add to local archives
    const updatedHistory = [completedMatch, ...historyMatches];
    saveHistoryMatches(updatedHistory);

    // If game belongs to a tournament, recalculate and update League Points Standings Table!
    if (completedMatch.tournamentId) {
      const updatedTourneys = tournaments.map((t) => {
        if (t.id === completedMatch.tournamentId) {
          // Update completed fixture results
          const updatedMatches = t.matches.map((m) => {
            if (m.matchId === completedMatch.id) {
              return {
                ...m,
                status: "Completed" as const,
                matchResult: completedMatch.matchResult,
              };
            }
            return m;
          });

          // Deep recalculation of points table based on all completed games in tournament
          const pointsTable = { ...t.pointsTable };

          // Reset all tallies
          Object.keys(pointsTable).forEach((teamId) => {
            pointsTable[teamId] = {
              ...pointsTable[teamId],
              played: 0,
              won: 0,
              lost: 0,
              tied: 0,
              points: 0,
              runsScored: 0,
              ballsFaced: 0,
              runsConceded: 0,
              ballsBowled: 0,
              nrr: 0,
            };
          });

          // Loop over completed games in tournament to score tally
          updatedMatches.forEach((m) => {
            if (m.status !== "Completed" || !m.matchId) return;

            // Find match details in history matches
            const mat = updatedHistory.find((hm) => hm.id === m.matchId);
            if (!mat) return;

            const inn1 = mat.innings[0];
            const inn2 = mat.innings[1];
            if (!inn1 || !inn2) return;

            const tAId = mat.teamAId; // Batting Inning 1
            const tBId = mat.teamBId; // Batting Inning 2 (Chasing)

            const tAPt = pointsTable[tAId];
            const tBPt = pointsTable[tBId];
            if (!tAPt || !tBPt) return;

            tAPt.played += 1;
            tBPt.played += 1;

            // Net Run Rate calculation specs:
            // Team NRR = (Total Runs Scored / Total Overs Faced) - (Total Runs Conceded / Total Overs Bowled)
            // Note: If a team is bowled out, their full over quota (oversAllowed) applies!
            const normalMaxBalls = mat.oversAllowed * 6;

            const inn1BallsFaced = inn1.wickets >= (teams.find(team => team.id === tAId)?.players.length || 11) - 1 ? normalMaxBalls : (inn1.overs * 6 + inn1.ballsInCurrentOver);
            const inn2BallsFaced = inn2.wickets >= (teams.find(team => team.id === tBId)?.players.length || 11) - 1 ? normalMaxBalls : (inn2.overs * 6 + inn2.ballsInCurrentOver);

            // Record runs scored / conceded
            tAPt.runsScored += inn1.runs;
            tAPt.ballsFaced += inn1BallsFaced;
            tAPt.runsConceded += inn2.runs;
            tAPt.ballsBowled += inn2BallsFaced;

            tBPt.runsScored += inn2.runs;
            tBPt.ballsFaced += inn2BallsFaced;
            tBPt.runsConceded += inn1.runs;
            tBPt.ballsBowled += inn1BallsFaced;

            // Determine Winner/Loser based on result text
            if (mat.matchResult?.includes("Match Tied")) {
              tAPt.tied += 1;
              tBPt.tied += 1;
              tAPt.points += 1;
              tBPt.points += 1;
            } else if (mat.matchResult?.includes(mat.teamAName)) {
              // Team A won
              tAPt.won += 1;
              tAPt.points += 2;
              tBPt.lost += 1;
            } else {
              // Team B won
              tBPt.won += 1;
              tBPt.points += 2;
              tAPt.lost += 1;
            }
          });

          // Re-compute NRR values
          Object.keys(pointsTable).forEach((teamId) => {
            const pt = pointsTable[teamId];
            if (pt.played > 0) {
              const oversFacedFraction = pt.ballsFaced / 6;
              const oversBowledFraction = pt.ballsBowled / 6;

              const batRate = oversFacedFraction > 0 ? pt.runsScored / oversFacedFraction : 0;
              const bowlRate = oversBowledFraction > 0 ? pt.runsConceded / oversBowledFraction : 0;

              pt.nrr = batRate - bowlRate;
            }
          });

          return {
            ...t,
            matches: updatedMatches,
            pointsTable,
          };
        }
        return t;
      });

      saveTournaments(updatedTourneys);
    }
  };

  // 3. SEEDING REALISTIC DEMO DATA
  const handleLoadDemoData = () => {
    const demoTeams: Team[] = [
      {
        id: "demo-t1",
        name: "Colony Kings",
        players: ["Raju", "Sanjay", "Vikram", "Sachin", "Amit", "Rahul", "Vicky", "Sonu", "Sunny", "Bunty", "Rohit"],
      },
      {
        id: "demo-t2",
        name: "Street Blasters",
        players: ["Bablu", "Chintu", "Monty", "Bunty", "Tony", "Sam", "Golu", "Vicky", "Samir", "Pappu", "Bittu"],
      },
      {
        id: "demo-t3",
        name: "Gully Gladiators",
        players: ["Karan", "Kabir", "Jay", "Dev", "Harsh", "Raj", "Aman", "Yash", "Sunny", "Manish", "Gaurav"],
      },
    ];

    saveTeams(demoTeams);

    // Initial draft completed scorecard
    const demoInning1 = createInning("demo-t2", "demo-t1");
    demoInning1.runs = 45;
    demoInning1.wickets = 3;
    demoInning1.overs = 5;
    demoInning1.ballsInCurrentOver = 0;
    demoInning1.extras = { wides: 2, noBalls: 1, byes: 1, legByes: 1, total: 5 };
    demoInning1.batsmen = {
      Bablu: { runs: 24, balls: 15, fours: 3, sixes: 1, isOut: true, howOut: "Caught", bowledBy: "Sanjay" },
      Chintu: { runs: 12, balls: 11, fours: 1, sixes: 0, isOut: false },
      Monty: { runs: 4, balls: 4, fours: 0, sixes: 0, isOut: true, howOut: "Bowled", bowledBy: "Vikram" },
    };
    demoInning1.bowlers = {
      Sanjay: { balls: 12, maidens: 0, runs: 14, wickets: 1 },
      Vikram: { balls: 12, maidens: 1, runs: 11, wickets: 1 },
      Sachin: { balls: 6, maidens: 0, runs: 15, wickets: 0 },
    };

    const demoInning2 = createInning("demo-t1", "demo-t2");
    demoInning2.runs = 46;
    demoInning2.wickets = 1;
    demoInning2.overs = 4;
    demoInning2.ballsInCurrentOver = 3;
    demoInning2.extras = { wides: 1, noBalls: 0, byes: 0, legByes: 0, total: 1 };
    demoInning2.batsmen = {
      Raju: { runs: 30, balls: 18, fours: 4, sixes: 2, isOut: false },
      Sanjay: { runs: 15, balls: 9, fours: 2, sixes: 0, isOut: false },
    };
    demoInning2.bowlers = {
      Bablu: { balls: 12, maidens: 0, runs: 18, wickets: 0 },
      Chintu: { balls: 12, maidens: 0, runs: 16, wickets: 1 },
      Sam: { balls: 3, maidens: 0, runs: 11, wickets: 0 },
    };

    const demoCompletedMatch: Match = {
      id: "demo-match-1",
      teamAId: "demo-t2",
      teamBId: "demo-t1",
      teamAName: "Street Blasters",
      teamBName: "Colony Kings",
      oversAllowed: 5,
      tossWinnerId: "demo-t2",
      tossDecision: "Bat",
      status: "Completed",
      currentInningIndex: 1,
      innings: [demoInning1, demoInning2],
      currentStriker: "Raju",
      currentNonStriker: "Sanjay",
      currentBowler: "Sam",
      matchResult: "Colony Kings won by 9 wickets!",
      playerOfTheMatch: "Raju (30 runs, Inn. 2)",
      date: "2026-06-18",
    };

    saveHistoryMatches([demoCompletedMatch]);

    // Create tournament with standings pre-tallied
    const activeTourneyPointsTable = {
      "demo-t1": {
        teamId: "demo-t1",
        teamName: "Colony Kings",
        played: 1,
        won: 1,
        lost: 0,
        tied: 0,
        points: 2,
        runsScored: 46,
        ballsFaced: 27,
        runsConceded: 45,
        ballsBowled: 30,
        nrr: 1.222,
      },
      "demo-t2": {
        teamId: "demo-t2",
        teamName: "Street Blasters",
        played: 1,
        won: 0,
        lost: 1,
        tied: 0,
        points: 0,
        runsScored: 45,
        ballsFaced: 30,
        runsConceded: 46,
        ballsBowled: 27,
        nrr: -1.222,
      },
      "demo-t3": {
        teamId: "demo-t3",
        teamName: "Gully Gladiators",
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        points: 0,
        runsScored: 0,
        ballsFaced: 0,
        runsConceded: 0,
        ballsBowled: 0,
        nrr: 0,
      },
    };

    const demoTournament: Tournament = {
      id: "demo-tourney-1",
      name: "Colony Champions League 2026",
      teams: demoTeams,
      matches: [
        {
          id: "fixture-1",
          teamAId: "demo-t2",
          teamBId: "demo-t1",
          teamAName: "Street Blasters",
          teamBName: "Colony Kings",
          oversAllowed: 5,
          status: "Completed",
          matchId: "demo-match-1",
          matchResult: "Colony Kings won by 9 wickets!",
          date: "2026-06-18",
        },
        {
          id: "fixture-2",
          teamAId: "demo-t1",
          teamBId: "demo-t3",
          teamAName: "Colony Kings",
          teamBName: "Gully Gladiators",
          oversAllowed: 5,
          status: "Scheduled",
          date: "2026-06-20",
        },
      ],
      pointsTable: activeTourneyPointsTable,
    };

    saveTournaments([demoTournament]);
    alert("Realistic demo teams, points table, and scorecard loaded successfully!");
  };

  const clearAllData = () => {
    if (confirm("Reset App? This will clear all local storage, ongoing games, and rosters.")) {
      localStorage.clear();
      setTeams([]);
      setActiveMatch(null);
      setHistoryMatches([]);
      setTournaments([]);
      setTab("dashboard");
    }
  };

  // Detailed AI Match report summary trigger
  const handleGenerateAIReport = async (match: Match) => {
    try {
      setAiReportLoading(true);
      setAiReportText("");

      const res = await fetch("/api/gemini/commentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "summary",
          match,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiReportText(data.text);
      } else {
        setAiReportText("Gemini is currently chasing down high targets on the street. Retry shortly!");
      }
    } catch (e) {
      setAiReportText("Could not connect to Gemini. Verify GEMINI_API_KEY secret configurations.");
    } finally {
      setAiReportLoading(false);
    }
  };

  const filteredHistory = historyMatches.filter((m) =>
    m.teamAName.toLowerCase().includes(historySearch.toLowerCase()) ||
    m.teamBName.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className={`min-h-screen pb-24 transition-colors duration-200 ${isDarkMode ? "dark bg-neutral-950 text-neutral-100" : "bg-slate-50 text-neutral-900"}`}>
      {/* Top Header Navbar */}
      <header className="sticky top-0 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-slate-150 dark:border-neutral-800 z-40 py-3.5 px-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600 text-white shadow-md shadow-emerald-700/20">
              <Trophy className="w-4 h-4 fill-white animate-bounce" />
            </div>
            <div>
              <h1 className="text-md font-extrabold tracking-tight font-sans">
                Gully<span className="text-emerald-500">Score</span>
              </h1>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Street Cricket Tracker</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Stream Discovery Indicator */}
            {activeMatch && (
              <button
                onClick={() => setTab("scoring")}
                className="px-2.5 py-1 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-lg flex items-center gap-1.5 animate-pulse"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                <span>Ongoing Match</span>
              </button>
            )}

            <button
              onClick={toggleDarkMode}
              className="p-2 text-slate-400 dark:text-neutral-500 hover:bg-slate-50 dark:hover:bg-neutral-800 rounded-xl transition"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Render Active Page Tab view routing */}
        {tab === "dashboard" && (
          <div id="dashboard-view" className="space-y-6">
            {/* Hero Card */}
            <div className="relative overflow-hidden bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-3xl p-6 shadow-lg space-y-3">
              <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
                <Trophy className="w-48 h-48" />
              </div>
              <div className="space-y-1.5 max-w-sm relative z-10">
                <h2 className="text-xl font-extrabold tracking-tight">Colony & Gully Cricket Scoring Suite</h2>
                <p className="text-xs opacity-90 leading-relaxed">
                  Track dynamic street-cricket matches, schedule matches, build rosters, and auto-tally point standing tables with ease!
                </p>
              </div>

              {teams.length === 0 && (
                <div className="pt-3 flex gap-3 relative z-10 flex-wrap">
                  <button
                    onClick={() => setTab("teams")}
                    className="px-4 py-2 bg-white text-emerald-700 font-bold text-xs rounded-xl hover:bg-slate-50 shadow transition flex items-center gap-1"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Roster Players</span>
                  </button>
                  <button
                    onClick={handleLoadDemoData}
                    className="px-4 py-2 bg-emerald-805 hover:bg-emerald-800 border border-white/20 text-white font-bold text-xs rounded-xl transition flex items-center gap-1"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Load Demo Standings</span>
                  </button>
                </div>
              )}
            </div>

            {/* In-Play and Discoverable scores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ongoing Matches Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Active Scores & Scoring</h3>
                {activeMatch ? (
                  <div className="p-4 bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl flex justify-between items-center shadow-sm">
                    <div className="space-y-1">
                      <p className="font-bold text-sm">
                        {activeMatch.teamAName} <span className="text-[10px] text-slate-400">vs</span> {activeMatch.teamBName}
                      </p>
                      <p className="text-xs text-slate-400">Status: In progress • {activeMatch.oversAllowed} Overs</p>
                    </div>
                    <button
                      onClick={() => setTab("scoring")}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5"
                    >
                      <span>Resume</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl p-6 text-center shadow-sm space-y-4">
                    <p className="text-xs text-slate-400">No active game in progress. Setup and toss first.</p>
                    <button
                      onClick={() => setTab("scoring")}
                      className="inline-flex mx-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Score Fresh Match</span>
                    </button>
                  </div>
                )}
              </div>


            </div>

            {/* Quick stats dashboard elements */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Registered Statistics</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 p-4 rounded-2xl text-center shadow-sm space-y-1">
                  <Users className="w-5 h-5 mx-auto text-slate-350 dark:text-neutral-500" />
                  <h4 className="text-lg font-extrabold">{teams.length}</h4>
                  <p className="text-[10px] text-slate-405">Squads</p>
                </div>
                <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 p-4 rounded-2xl text-center shadow-sm space-y-1">
                  <CheckCircle2 className="w-5 h-5 mx-auto text-slate-350 dark:text-neutral-500" />
                  <h4 className="text-lg font-extrabold">{historyMatches.length}</h4>
                  <p className="text-[10px] text-slate-405">Completed</p>
                </div>
                <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 p-4 rounded-2xl text-center shadow-sm space-y-1">
                  <Trophy className="w-5 h-5 mx-auto text-slate-350 dark:text-neutral-500" />
                  <h4 className="text-lg font-extrabold">{tournaments.length}</h4>
                  <p className="text-[10px] text-slate-405">Leagues</p>
                </div>
              </div>
            </div>

            {/* Gully Cricket Leaderboard Bento Section */}
            <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-800 dark:text-neutral-200 tracking-wider">
                    🏆 Individual Leaderboard
                  </h3>
                  <p className="text-xs text-slate-405 dark:text-neutral-500">
                    Top players aggregated from completed matches
                  </p>
                </div>
                <div className="flex bg-slate-50 dark:bg-neutral-950 p-1 rounded-xl border border-slate-100 dark:border-neutral-800">
                  <button
                    onClick={() => setLeaderboardTab("batting")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      leaderboardTab === "batting"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200"
                    }`}
                  >
                    🏏 Orange Cap (Runs)
                  </button>
                  <button
                    onClick={() => setLeaderboardTab("bowling")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      leaderboardTab === "bowling"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200"
                    }`}
                  >
                    🎯 Purple Cap (Wkts)
                  </button>
                </div>
              </div>

              {historyMatches.length === 0 ? (
                <div className="py-6 text-center text-slate-400 dark:text-neutral-500 text-xs space-y-2">
                  <p>No matches recorded yet. Roster teams and complete a game to populate individual leaderboards!</p>
                  {teams.length === 0 && (
                    <button
                      onClick={handleLoadDemoData}
                      className="px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 font-bold rounded-xl transition"
                    >
                      Quick-load Seeding Data
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {leaderboardTab === "batting" ? (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-150 dark:border-neutral-800 text-slate-400 font-semibold">
                          <th className="py-2.5">Rank & Batsman</th>
                          <th className="py-2.5 text-center">Innings</th>
                          <th className="py-2.5 text-center font-bold text-slate-700 dark:text-neutral-300">Runs</th>
                          <th className="py-2.5 text-center">Balls</th>
                          <th className="py-2.5 text-center">4s / 6s</th>
                          <th className="py-2.5 text-right">SR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-neutral-800/40">
                        {leaderboardStats.topBatsmen.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-slate-400">No batting stats logged yet.</td>
                          </tr>
                        ) : (
                          leaderboardStats.topBatsmen.map((b, idx) => (
                            <tr key={b.name} className="font-medium hover:bg-slate-50/50 dark:hover:bg-neutral-800/10">
                              <td className="py-3 flex items-center gap-1.5">
                                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                                  idx === 0 
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" 
                                    : "bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400"
                                }`}>
                                  {idx + 1}
                                </span>
                                <span className="font-bold text-slate-800 dark:text-neutral-200 flex items-center gap-1">
                                  {b.name}
                                  {idx === 0 && <span className="text-amber-500 animate-pulse animate-bounce" title="Orange Cap Holder">👑</span>}
                                </span>
                              </td>
                              <td className="py-3 text-center text-slate-500 dark:text-neutral-400">{b.innings}</td>
                              <td className="py-3 text-center font-black text-amber-600 dark:text-amber-400 text-sm">{b.runs}</td>
                              <td className="py-3 text-center text-slate-500 dark:text-neutral-400">{b.balls}</td>
                              <td className="py-3 text-center text-slate-400 dark:text-neutral-500">{b.fours} / {b.sixes}</td>
                              <td className="py-3 text-right font-mono text-slate-600 dark:text-neutral-400">
                                {b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : "0.0"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-150 dark:border-neutral-800 text-slate-400 font-semibold">
                          <th className="py-2.5">Rank & Bowler</th>
                          <th className="py-2.5 text-center">Overs</th>
                          <th className="py-2.5 text-center font-bold text-slate-700 dark:text-neutral-300">Wickets</th>
                          <th className="py-2.5 text-center">Runs</th>
                          <th className="py-2.5 text-center">Maidens</th>
                          <th className="py-2.5 text-right">Econ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-neutral-800/40">
                        {leaderboardStats.topBowlers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-slate-400">No bowling stats logged yet.</td>
                          </tr>
                        ) : (
                          leaderboardStats.topBowlers.map((b, idx) => (
                            <tr key={b.name} className="font-medium hover:bg-slate-50/50 dark:hover:bg-neutral-800/10">
                              <td className="py-3 flex items-center gap-1.5">
                                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                                  idx === 0 
                                    ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400" 
                                    : "bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400"
                                }`}>
                                  {idx + 1}
                                </span>
                                <span className="font-bold text-slate-800 dark:text-neutral-200 flex items-center gap-1">
                                  {b.name}
                                  {idx === 0 && <span className="text-purple-500 animate-pulse" title="Purple Cap Holder">⭐</span>}
                                </span>
                              </td>
                              <td className="py-3 text-center text-slate-500 dark:text-neutral-400">
                                {Math.floor(b.balls / 6)}.{b.balls % 6}
                              </td>
                              <td className="py-3 text-center font-black text-purple-600 dark:text-purple-400 text-sm">{b.wickets}</td>
                              <td className="py-3 text-center text-slate-500 dark:text-neutral-400">{b.runs}</td>
                              <td className="py-3 text-center text-slate-400 dark:text-neutral-500">{b.maidens}</td>
                              <td className="py-3 text-right font-mono text-slate-600 dark:text-neutral-400">
                                {b.balls > 0 ? ((b.runs / (b.balls / 6))).toFixed(2) : "0.00"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* Reset helper */}
            <div className="flex justify-between items-center text-xs p-3.5 bg-slate-100/50 dark:bg-neutral-900/50 border border-slate-150 dark:border-neutral-800 rounded-2xl">
              <span className="text-slate-405 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Adjust, roster, reset, or load mock data inside options.</span>
              </span>
              <button onClick={clearAllData} className="text-red-500 font-bold hover:underline">
                Reset App
              </button>
            </div>
          </div>
        )}

        {tab === "teams" && (
          <TeamsTab teams={teams} onSaveTeams={saveTeams} isDarkMode={isDarkMode} />
        )}

        {tab === "scoring" && (
          <ScoringTab
            teams={teams}
            activeMatch={activeMatch}
            onSaveActiveMatch={saveActiveMatch}
            onArchiveMatch={handleArchiveCompletedMatch}
            onSaveTeams={saveTeams}
            isDarkMode={isDarkMode}
          />
        )}

        {tab === "tournaments" && (
          <TournamentsTab
            tournaments={tournaments}
            teams={teams}
            onSaveTournaments={saveTournaments}
            onStartMatchFromFixture={handleStartMatchFromFixture}
            isDarkMode={isDarkMode}
          />
        )}



        {tab === "history" && (
          <div id="history-view" className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-lg font-extrabold">Completed Matches History</h3>
                <p className="text-xs text-slate-400">Browse previous games scorecards and AI analysis reports</p>
              </div>

              {/* Search bar */}
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Teams (e.g. Blasters)"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full sm:w-60 pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none"
                />
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl py-12 text-center text-xs text-slate-400">
                No archived matches found in records.
              </div>
            ) : (
              <div id="history-list" className="space-y-3">
                {filteredHistory.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      setSelectedHistoryMatch(m);
                      setAiReportText("");
                    }}
                    className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl p-4 shadow-sm hover:border-slate-200 dark:hover:border-neutral-700 cursor-pointer transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                  >
                    <div className="space-y-1">
                      <p className="text-xs text-slate-400 font-semibold">{m.date}</p>
                      <h4 className="font-bold text-sm">
                        {m.teamAName} vs {m.teamBName}
                      </h4>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">{m.matchResult || "Tournament game"}</p>
                    </div>

                    <div className="flex gap-2 text-right text-xs font-mono font-bold text-slate-500 dark:text-neutral-400">
                      <div>
                        <p className="text-[10px] font-normal uppercase text-slate-400">Inn 1</p>
                        <p>{m.innings[0]?.runs}/{m.innings[0]?.wickets}</p>
                      </div>
                      <div className="pl-2 border-l border-slate-100 dark:border-neutral-800">
                        <p className="text-[10px] font-normal uppercase text-slate-400">Inn 2</p>
                        <p>{m.innings[1] ? `${m.innings[1].runs}/${m.innings[1].wickets}` : "DNB"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Detailed Completed Match Scorecard Modal Dialog Drawer */}
            {selectedHistoryMatch && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 overflow-y-auto p-4 flex items-start justify-center">
                <div className="my-8 bg-white dark:bg-neutral-900 border border-slate-150 dark:border-neutral-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 relative">
                  <div className="absolute right-4 top-4 flex gap-2">
                    <button
                      onClick={handleDownloadJpg}
                      disabled={isDownloadingJpg}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isDownloadingJpg ? "Exporting..." : "Download JPG"}</span>
                    </button>
                    <button
                      onClick={() => setSelectedHistoryMatch(null)}
                      className="px-3 py-1.5 bg-slate-50 dark:bg-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-700 text-xs font-bold rounded-lg border border-slate-100 dark:border-neutral-800 text-slate-700 dark:text-neutral-200"
                    >
                      Close Sheet
                    </button>
                  </div>

                  {/* Hidden high-res offscreen scorecard sheet for downloading as JPG */}
                  <div
                    id="downloadable-scorecard"
                    className="fixed left-[-9999px] top-0 w-[720px] bg-slate-50 text-slate-900 p-8 rounded-3xl space-y-6 border border-slate-200 z-[-100] pointer-events-none"
                    style={{ fontFamily: "system-ui, sans-serif" }}
                  >
                      {/* Brand Header */}
                      <div className="flex justify-between items-center border-b-2 border-slate-200 pb-4">
                        <div>
                          <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest font-mono block">
                            🏏 GULLY CRICKET ASSOCIATION
                          </span>
                          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">
                            OFFICIAL MATCH SCORECARD
                          </h1>
                        </div>
                        <div className="text-right text-xs text-slate-400 font-mono">
                          <p>Date: {selectedHistoryMatch.date}</p>
                          <p>Format: {selectedHistoryMatch.oversAllowed} Overs Friendly</p>
                        </div>
                      </div>

                      {/* Match Result Banner */}
                      <div className="bg-emerald-600 text-white p-4 rounded-2xl text-center shadow">
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Match Result</p>
                        <h3 className="text-lg font-black mt-0.5">{selectedHistoryMatch.matchResult}</h3>
                      </div>

                      {/* Team overview side-by-side */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-slate-100 text-center shadow-sm">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">First Innings</p>
                          <h2 className="text-lg font-extrabold text-slate-800 truncate mt-1">{selectedHistoryMatch.teamAName}</h2>
                          <p className="text-3xl font-black text-emerald-600 mt-2">
                            {selectedHistoryMatch.innings[0]?.runs}/{selectedHistoryMatch.innings[0]?.wickets}
                          </p>
                          <p className="text-xs text-slate-400 font-mono mt-1">
                            Overs: {selectedHistoryMatch.innings[0]?.overs}.{selectedHistoryMatch.innings[0]?.ballsInCurrentOver}
                          </p>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-100 text-center shadow-sm">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Second Innings</p>
                          <h2 className="text-lg font-extrabold text-slate-800 truncate mt-1">{selectedHistoryMatch.teamBName}</h2>
                          <p className="text-3xl font-black text-emerald-600 mt-2">
                            {selectedHistoryMatch.innings[1] ? `${selectedHistoryMatch.innings[1].runs}/${selectedHistoryMatch.innings[1].wickets}` : "DNB"}
                          </p>
                          <p className="text-xs text-slate-400 font-mono mt-1">
                            Overs: {selectedHistoryMatch.innings[1] ? `${selectedHistoryMatch.innings[1].overs}.${selectedHistoryMatch.innings[1].ballsInCurrentOver}` : "0.0"}
                          </p>
                        </div>
                      </div>

                      {/* Detailed Innings Cards */}
                      {selectedHistoryMatch.innings.map((inning, innIdx) => {
                        if (!inning) return null;
                        const teamName = innIdx === 0 ? selectedHistoryMatch.teamAName : selectedHistoryMatch.teamBName;
                        return (
                          <div key={innIdx} className="bg-white p-6 rounded-2xl border border-slate-100 space-y-4 shadow-sm">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                                {teamName} Batting Ledger
                              </h3>
                              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                                {inning.runs}/{inning.wickets} ({inning.overs}.{inning.ballsInCurrentOver} Ov)
                              </span>
                            </div>

                            {/* Batting details */}
                            <div className="overflow-x-auto w-full">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="border-b border-slate-150 text-slate-400 font-semibold">
                                    <th className="py-2">Batsman</th>
                                    <th className="py-2">Dismissal Status</th>
                                    <th className="py-2 text-center">R</th>
                                    <th className="py-2 text-center">B</th>
                                    <th className="py-2 text-center">4s</th>
                                    <th className="py-2 text-center">6s</th>
                                    <th className="py-2 text-right">SR</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(inning.batsmen).map(([name, b]) => (
                                    <tr key={name} className="border-b border-slate-50 font-medium">
                                      <td className="py-2 font-bold text-slate-700">{name}</td>
                                      <td className="py-2 text-slate-400 max-w-[150px] truncate">
                                        {b.isOut ? `out (${b.howOut || "Dismissed"})` : "not out"}
                                      </td>
                                      <td className="py-2 text-center font-extrabold text-slate-800">{b.runs}</td>
                                      <td className="py-2 text-center text-slate-500 font-semibold">{b.balls}</td>
                                      <td className="py-2 text-center text-slate-400">{b.fours}</td>
                                      <td className="py-2 text-center text-slate-400">{b.sixes}</td>
                                      <td className="py-2 text-right text-slate-500 font-mono">
                                        {b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : "0.0"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Bowling details */}
                            <div className="pt-4 border-t border-slate-100 space-y-2">
                              <h4 className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Bowling Performance</h4>
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="border-b border-slate-150 text-slate-400 font-semibold">
                                    <th className="py-2">Bowler</th>
                                    <th className="py-2 text-center">Overs</th>
                                    <th className="py-2 text-center">M</th>
                                    <th className="py-2 text-center">Runs</th>
                                    <th className="py-2 text-center">Wickets</th>
                                    <th className="py-2 text-right">Econ</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(inning.bowlers).map(([name, b]) => (
                                    <tr key={name} className="border-b border-slate-50 font-medium">
                                      <td className="py-2 font-bold text-slate-700">{name}</td>
                                      <td className="py-2 text-center font-mono">
                                        {Math.floor(b.balls / 6)}.{b.balls % 6}
                                      </td>
                                      <td className="py-2 text-center text-slate-500">{b.maidens}</td>
                                      <td className="py-2 text-center font-semibold text-red-500">{b.runs}</td>
                                      <td className="py-2 text-center font-extrabold text-emerald-600">{b.wickets}</td>
                                      <td className="py-2 text-right font-mono text-slate-500">
                                        {b.balls > 0 ? ((b.runs / (b.balls / 6))).toFixed(2) : "0.00"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Fall of Wickets */}
                            {inning.fallOfWickets.length > 0 && (
                              <div className="pt-3 border-t border-slate-100">
                                <h4 className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Fall of Wickets</h4>
                                <div className="flex gap-2 flex-wrap text-[9px] text-slate-500 font-medium mt-1">
                                  {inning.fallOfWickets.map((fow, idx) => (
                                    <span key={idx} className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                      {fow.wickets}-{fow.runs} ({fow.batsmanName}, {fow.oversString} ov)
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Footer bar */}
                      <div className="border-t border-slate-200 pt-4 text-center">
                        <p className="text-[9px] text-slate-450 font-black tracking-widest uppercase">
                          Colony & Gully Cricket Scorer Suite
                        </p>
                        <p className="text-[8px] text-slate-350 mt-0.5">
                          Fast, offline, and reliable neighborhood match tallying engine
                        </p>
                      </div>
                    </div>

                  <div className="space-y-1">
                    <p className="text-xs text-slate-400 font-semibold">{selectedHistoryMatch.date}</p>
                    <h3 className="text-lg font-extrabold">
                      {selectedHistoryMatch.teamAName} vs {selectedHistoryMatch.teamBName}
                    </h3>
                    <p className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded-xl border border-emerald-100/30">
                      Result: {selectedHistoryMatch.matchResult}
                    </p>
                  </div>

                  {/* Run-rate Progression Chart */}
                  <RunRateChart match={selectedHistoryMatch} isDarkMode={isDarkMode} />

                  {/* Tabs for Innings details */}
                  <div className="border-b border-slate-100">
                    <div className="flex gap-3 text-xs font-bold">
                      <button
                        onClick={() => setActiveScorecardTab(0)}
                        className={`pb-2 border-b-2 px-1 transition ${
                          activeScorecardTab === 0 ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500"
                        }`}
                      >
                        {selectedHistoryMatch.teamAName} Innings
                      </button>
                      <button
                        onClick={() => setActiveScorecardTab(1)}
                        className={`pb-2 border-b-2 px-1 transition ${
                          activeScorecardTab === 1 ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500"
                        }`}
                      >
                        {selectedHistoryMatch.teamBName} Innings
                      </button>
                    </div>
                  </div>

                  {/* scorecard statistics table */}
                  {selectedHistoryMatch.innings[activeScorecardTab] ? (
                    <div className="space-y-4">
                      {/* Batting Card */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase text-slate-400">Batting Card</h4>
                        <div className="overflow-x-auto w-full">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-100 font-semibold text-slate-400">
                                <th className="py-2">Batsman</th>
                                <th className="py-2">Status</th>
                                <th className="py-2 text-center">R</th>
                                <th className="py-2 text-center">B</th>
                                <th className="py-2 text-center">4s</th>
                                <th className="py-2 text-center">6s</th>
                                <th className="py-2 text-right">SR</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(selectedHistoryMatch.innings[activeScorecardTab].batsmen).map(([name, b]) => (
                                <tr key={name} className="border-b border-slate-50 hover:bg-slate-50/50">
                                  <td className="py-2 font-bold">{name}</td>
                                  <td className="py-2 text-slate-400 truncate max-w-[100px]">
                                    {b.isOut ? `out (${b.howOut || "Dismissed"})` : "not out"}
                                  </td>
                                  <td className="py-2 text-center font-extrabold">{b.runs}</td>
                                  <td className="py-2 text-center font-semibold">{b.balls}</td>
                                  <td className="py-2 text-center text-slate-400">{b.fours}</td>
                                  <td className="py-2 text-center text-slate-400">{b.sixes}</td>
                                  <td className="py-2 text-right text-slate-500 font-mono">
                                    {b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : "0.0"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Bowling Card */}
                      <div className="space-y-2 border-t border-slate-100 pt-3">
                        <h4 className="text-xs font-bold uppercase text-slate-400 animate-pulse">Bowlers ledger</h4>
                        <div className="overflow-x-auto w-full">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-100 font-semibold text-slate-400">
                                <th className="py-2">Bowler</th>
                                <th className="py-2 text-center">Overs</th>
                                <th className="py-2 text-center">Maidens</th>
                                <th className="py-2 text-center">Runs</th>
                                <th className="py-2 text-center">Wickets</th>
                                <th className="py-2 text-right">ECON</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(selectedHistoryMatch.innings[activeScorecardTab].bowlers).map(([name, b]) => (
                                <tr key={name} className="border-b border-slate-50">
                                  <td className="py-2 font-bold">{name}</td>
                                  <td className="py-2 text-center font-mono">
                                    {Math.floor(b.balls / 6)}.{b.balls % 6}
                                  </td>
                                  <td className="py-2 text-center">{b.maidens}</td>
                                  <td className="py-2 text-center text-red-500">{b.runs}</td>
                                  <td className="py-2 text-center text-emerald-600 font-extrabold">{b.wickets}</td>
                                  <td className="py-2 text-right text-slate-550 font-mono">
                                    {b.balls > 0 ? ((b.runs / (b.balls / 6))).toFixed(2) : "0.00"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Fall of Wickets Timeline */}
                      {selectedHistoryMatch.innings[activeScorecardTab].fallOfWickets.length > 0 && (
                        <div className="space-y-2 border-t border-slate-100 pt-3">
                          <h4 className="text-xs font-bold uppercase text-slate-400">Fall of Wickets</h4>
                          <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap text-[10px] font-semibold text-slate-500">
                            {selectedHistoryMatch.innings[activeScorecardTab].fallOfWickets.map((fow, idx) => (
                              <span key={idx} className="bg-slate-50 dark:bg-neutral-800 p-1.5 rounded-lg border">
                                {fow.wickets}-{fow.runs} ({fow.batsmanName}, {fow.oversString} ov)
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-slate-405">Inning not played.</div>
                  )}

                  {/* Gemini AI Summary report generation inside History detail drawer */}
                  <div className="bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/30 p-4 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-emerald-100/40">
                      <h4 className="text-xs font-bold uppercase text-slate-650 dark:text-neutral-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Gemini AI Humorous Street Match Commentary Summary</span>
                      </h4>
                      <button
                        onClick={() => handleGenerateAIReport(selectedHistoryMatch)}
                        disabled={aiReportLoading}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition disabled:opacity-45"
                      >
                        {aiReportLoading ? "Composing..." : "Compose Summary"}
                      </button>
                    </div>

                    {aiReportText ? (
                      <p className="text-xs italic leading-relaxed whitespace-pre-line border-l-2 border-emerald-400 pl-3">
                        {aiReportText}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-405 text-center">
                        Generate a hilarious, custom, street-cricket styled analysis of this clash using Gemini&apos;s knowledge!
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modern bottom mobile floating navbar */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-t border-slate-150 dark:border-neutral-850 py-2.5 px-4 shadow-2xl z-45 max-w-4xl mx-auto flex items-center justify-around rounded-t-2xl">
        <button
          onClick={() => {
            setSelectedHistoryMatch(null);
            setTab("dashboard");
          }}
          className={`flex flex-col items-center gap-1 transition ${
            tab === "dashboard" ? "text-emerald-500 font-extrabold scale-105" : "text-slate-450 dark:text-neutral-500"
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span className="text-[9px]">Lobby</span>
        </button>

        <button
          onClick={() => {
            setSelectedHistoryMatch(null);
            setTab("teams");
          }}
          className={`flex flex-col items-center gap-1 transition ${
            tab === "teams" ? "text-emerald-500 font-extrabold scale-105" : "text-slate-450 dark:text-neutral-500"
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="text-[9px]">Teams</span>
        </button>

        <button
          onClick={() => {
            setSelectedHistoryMatch(null);
            setTab("scoring");
          }}
          className={`flex flex-col items-center gap-1 transition ${
            tab === "scoring" ? "text-emerald-500 font-extrabold scale-105" : "text-slate-450 dark:text-neutral-500"
          }`}
        >
          <Play className="w-4 h-4" />
          <span className="text-[9px]">Scoring</span>
        </button>

        <button
          onClick={() => {
            setSelectedHistoryMatch(null);
            setTab("tournaments");
          }}
          className={`flex flex-col items-center gap-1 transition ${
            tab === "tournaments" ? "text-emerald-500 font-extrabold scale-105" : "text-slate-450 dark:text-neutral-500"
          }`}
        >
          <Trophy className="w-4 h-4 fill-none" />
          <span className="text-[9px]">Leagues</span>
        </button>

        <button
          onClick={() => {
            setSelectedHistoryMatch(null);
            setTab("history");
          }}
          className={`flex flex-col items-center gap-1 transition ${
            tab === "history" ? "text-emerald-500 font-extrabold scale-105" : "text-slate-450 dark:text-neutral-500"
          }`}
        >
          <History className="w-4 h-4" />
          <span className="text-[9px]">History</span>
        </button>
      </nav>
    </div>
  );
}
