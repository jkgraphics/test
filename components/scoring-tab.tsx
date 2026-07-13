"use client";

import React, { useState } from "react";
import {
  Play,
  RotateCcw,
  Sparkles,
  RefreshCw,
  Share2,
  ListRestart,
  Edit2,
  Trash2,
  AlertCircle,
  TrendingUp,
  User,
  Plus,
  Trophy,
  Tv,
  Smartphone,
  Gamepad,
  Crown,
  Cpu,
  ExternalLink
} from "lucide-react";
import { Match, Team, MatchInning, ExtraType, WicketType } from "@/lib/types";
import { createInning, handleBallScored, checkMatchStatus, pickTopPerformer, rotateStrike } from "@/lib/scoring-engine";
import RunRateChart from "./run-rate-chart";
import LiveBroadcastPlayer from "./live-broadcast-player";

let liveEventIdCounter = 0;

interface ScoringTabProps {
  teams: Team[];
  activeMatch: Match | null;
  onSaveActiveMatch: (match: Match | null) => void;
  onArchiveMatch: (match: Match) => void;
  onSaveTeams: (teams: Team[]) => void;
  isDarkMode: boolean;
}

export default function ScoringTab({
  teams,
  activeMatch,
  onSaveActiveMatch,
  onArchiveMatch,
  onSaveTeams,
  isDarkMode,
}: ScoringTabProps) {
  // Setup view states
  const [teamAId, setTeamAId] = useState("");
  const [teamBId, setTeamBId] = useState("");
  const [customOvers, setCustomOvers] = useState("5");
  const [customPlayersInput, setCustomPlayersInput] = useState<{ [id: string]: string[] }>({});

  const [tossWinner, setTossWinner] = useState("");
  const [tossDecision, setTossDecision] = useState<"Bat" | "Bowl">("Bat");

  // Undo stack in memory
  const [undoHistory, setUndoHistory] = useState<string[]>([]); // Array of stringified Match objects

  // Modals & sub-selection states
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [wicketType, setWicketType] = useState<WicketType>("Bowled");
  const [wicketFielder, setWicketFielder] = useState("");
  const [wicketDismissed, setWicketDismissed] = useState("");

  const [showExtrasModal, setShowExtrasModal] = useState(false);
  const [selectedExtraType, setSelectedExtraType] = useState<ExtraType>("None");
  const [extraCustomRuns, setExtraCustomRuns] = useState(0); // Optional runs associated with extras (e.g. ran 1 on wide)
  const [extraBatRuns, setExtraBatRuns] = useState(0); // Bat runs on a No Ball

  const [showManualEditModal, setShowManualEditModal] = useState(false);
  const [manualRuns, setManualRuns] = useState("0");
  const [manualWickets, setManualWickets] = useState("0");
  const [manualOvers, setManualOvers] = useState("0");
  const [manualBalls, setManualBalls] = useState("0");

  const [showCommentary, setShowCommentary] = useState(false);
  const [ballCommentaryText, setBallCommentaryText] = useState("");
  const [loadingCommentary, setLoadingCommentary] = useState(false);

  // Auto Live Streaming state
  const [autoLiveStream, setAutoLiveStream] = useState(true);

  // Scoreboard layout graphic style
  const [scoreboardDesign, setScoreboardDesign] = useState<"default" | "broadcaster" | "neon" | "minimalist" | "retro" | "royal">("default");

  // Live Video Play simulated ball event
  const [activeLiveBallEvent, setActiveLiveBallEvent] = useState<any>(null);

  // Active scorecard tab
  const [activeScorecardTab, setActiveScorecardTab] = useState<0 | 1>(0);

  // Share overlay
  const [showExporter, setShowExporter] = useState(false);
  const [matchSummaryText, setMatchSummaryText] = useState("");

  // Quick select batsman / bowler states (triggered when empty)
  const [tempNextStriker, setTempNextStriker] = useState("");
  const [tempNextNonStriker, setTempNextNonStriker] = useState("");
  const [tempNextBowler, setTempNextBowler] = useState("");

  const teamA = teams.find((t) => t.id === activeMatch?.teamAId);
  const teamB = teams.find((t) => t.id === activeMatch?.teamBId);

  // Broadcaster: Push score update over API if streaming is toggled
  const pushLiveStreamUpdate = async (updatedMatch: Match) => {
    if (!autoLiveStream) return;
    try {
      await fetch("/api/live-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: updatedMatch.id, match: updatedMatch }),
      });
    } catch (e) {
      console.warn("Could not push live stream update", e);
    }
  };

  // 1. START NEW GAME INITIATOR
  const handleInitiateSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamAId || !teamBId) return;
    if (teamAId === teamBId) {
      alert("A match must be played between two different teams!");
      return;
    }

    const tA = teams.find((t) => t.id === teamAId);
    const tB = teams.find((t) => t.id === teamBId);
    if (!tA || !tB) return;

    if (tA.players.length < 2 || tB.players.length < 2) {
      alert("Both selected teams must have at least 2 players in their rosters before starting!");
      return;
    }

    // Default toss winner to Team A
    setTossWinner(tA.id);
    setTossDecision("Bat");

    const newMatch: Match = {
      id: "match-" + Math.random().toString(36).substring(2, 9),
      teamAId: tA.id,
      teamBId: tB.id,
      teamAName: tA.name,
      teamBName: tB.name,
      oversAllowed: Math.max(1, Number(customOvers) || 5),
      status: "Toss",
      currentInningIndex: 0,
      innings: [],
      currentStriker: "",
      currentNonStriker: "",
      currentBowler: "",
      date: new Date().toISOString().split("T")[0],
    };

    onSaveActiveMatch(newMatch);
    setUndoHistory([]);
  };

  // 2. COMPLETE TOSS ARRANGEMENT
  const handleCompleteToss = () => {
    if (!activeMatch) return;

    const tWinner = activeMatch.teamAId === tossWinner ? activeMatch.teamAName : activeMatch.teamBName;
    const battingTeamId = tossDecision === "Bat" ? tossWinner : (tossWinner === activeMatch.teamAId ? activeMatch.teamBId : activeMatch.teamAId);
    const bowlingTeamId = battingTeamId === activeMatch.teamAId ? activeMatch.teamBId : activeMatch.teamAId;

    const inning1 = createInning(battingTeamId, bowlingTeamId);

    const updatedMatch: Match = {
      ...activeMatch,
      tossWinnerId: tossWinner,
      tossDecision,
      innings: [inning1],
      status: "Ongoing",
    };

    onSaveActiveMatch(updatedMatch);
    pushLiveStreamUpdate(updatedMatch);
  };

  const activeInning = activeMatch?.innings[activeMatch.currentInningIndex];
  const battingTeam = activeInning?.battingTeamId === activeMatch?.teamAId ? teamA : teamB;
  const bowlingTeam = activeInning?.bowlingTeamId === activeMatch?.teamAId ? teamA : teamB;

  // 3. CORE TRIGGER BALL ACCUMULATOR
  const logBallEvent = (
    runsBat: number,
    extraType: ExtraType,
    extraRuns: number,
    wicket?: { type: WicketType; playerOut: string; fielder?: string }
  ) => {
    if (!activeMatch || !activeInning) return;

    // Cache state for UNDO
    const serialized = JSON.stringify(activeMatch);
    setUndoHistory([...undoHistory, serialized]);

    // Calculate updated match
    let updatedMatch = handleBallScored(activeMatch, {
      runsBat,
      extraType,
      extraRuns,
      wicket,
    });

    // Check inning and match terminations
    const battingPlayersCount = battingTeam?.players.length || 11;
    const bowlingPlayersCount = bowlingTeam?.players.length || 11;
    updatedMatch = checkMatchStatus(updatedMatch, battingPlayersCount, bowlingPlayersCount);

    // If first inning ended, prepare Innings break state
    if (updatedMatch.status === "InningsBreak") {
      updatedMatch.currentInningIndex = 1;
      const secondBattingId = activeInning.bowlingTeamId;
      const secondBowlingId = activeInning.battingTeamId;
      const inning2 = createInning(secondBattingId, secondBowlingId);
      updatedMatch.innings.push(inning2);
      updatedMatch.currentStriker = "";
      updatedMatch.currentNonStriker = "";
      updatedMatch.currentBowler = "";
      updatedMatch.status = "Chasing"; // Instantly proceed to chasing
    }

    // Track for live simulated playback stream
    liveEventIdCounter++;
    const liveEvent = {
      id: `live_${liveEventIdCounter}`,
      runsBat,
      extraType,
      extraRuns,
      wicket,
      strikerName: activeMatch.currentStriker || "Striker",
      bowlerName: activeMatch.currentBowler || "Bowler",
      battingTeamName: battingTeam?.name || "Batting",
      bowlingTeamName: bowlingTeam?.name || "Bowling",
      runs: updatedMatch.innings[activeMatch.currentInningIndex].runs,
      wickets: updatedMatch.innings[activeMatch.currentInningIndex].wickets,
      overs: updatedMatch.innings[activeMatch.currentInningIndex].overs,
      ballsInCurrentOver: updatedMatch.innings[activeMatch.currentInningIndex].ballsInCurrentOver,
      oversAllowed: updatedMatch.oversAllowed
    };
    setActiveLiveBallEvent(liveEvent);

    onSaveActiveMatch(updatedMatch);
    pushLiveStreamUpdate(updatedMatch);
  };

  // Undo Last Ball Action
  const handleUndoButton = () => {
    if (undoHistory.length === 0) return;
    const historyCopy = [...undoHistory];
    const previousSerialized = historyCopy.pop();
    if (previousSerialized) {
      const matchState = JSON.parse(previousSerialized) as Match;
      onSaveActiveMatch(matchState);
      setUndoHistory(historyCopy);
      pushLiveStreamUpdate(matchState);
    }
  };

  // Complete & Archive finished match
  const handleCloseAndArchive = () => {
    if (!activeMatch) return;
    onArchiveMatch(activeMatch);
    onSaveActiveMatch(null);
  };

  // Select active batsmen
  const handleConfirmNextBatsmen = () => {
    if (!activeMatch) return;
    const updated = { ...activeMatch };
    if (tempNextStriker) updated.currentStriker = tempNextStriker;
    if (tempNextNonStriker) updated.currentNonStriker = tempNextNonStriker;

    onSaveActiveMatch(updated);
    pushLiveStreamUpdate(updated);
    setTempNextStriker("");
    setTempNextNonStriker("");
  };

  // Select active bowler
  const handleConfirmBowler = () => {
    if (!activeMatch || !tempNextBowler) return;
    const updated = { ...activeMatch, currentBowler: tempNextBowler };
    onSaveActiveMatch(updated);
    pushLiveStreamUpdate(updated);
    setTempNextBowler("");
  };

  // Manual Edit score overrides
  const handleSaveManualOverrides = () => {
    if (!activeMatch || !activeInning) return;
    // Cache for UNDO
    setUndoHistory([...undoHistory, JSON.stringify(activeMatch)]);

    const updated = JSON.parse(JSON.stringify(activeMatch)) as Match;
    const inn = updated.innings[updated.currentInningIndex];
    inn.runs = Math.max(0, parseInt(manualRuns) || 0);
    inn.wickets = Math.max(0, parseInt(manualWickets) || 0);
    inn.overs = Math.max(0, parseInt(manualOvers) || 0);
    inn.ballsInCurrentOver = Math.max(0, Math.min(5, parseInt(manualBalls) || 0));

    // Also trigger match status checks
    const battingPlayersCount = battingTeam?.players.length || 11;
    const bowlingPlayersCount = bowlingTeam?.players.length || 11;
    const verifiedMatch = checkMatchStatus(updated, battingPlayersCount, bowlingPlayersCount);

    onSaveActiveMatch(verifiedMatch);
    pushLiveStreamUpdate(verifiedMatch);
    setShowManualEditModal(false);
  };

  // Core dialog confirmations
  const handleConfirmWicket = () => {
    if (!activeMatch || !activeInning) return;
    const outPlayerName = wicketDismissed || activeMatch.currentStriker;

    logBallEvent(0, "None", 0, {
      type: wicketType,
      playerOut: outPlayerName,
      fielder: wicketFielder.trim() || undefined,
    });

    setShowWicketModal(false);
    setWicketFielder("");
  };

  const handleConfirmExtras = () => {
    if (selectedExtraType === "Wd") {
      // 1 Wide penalty + custom runs (default wide penalty is 1)
      logBallEvent(0, "Wd", 1 + extraCustomRuns);
    } else if (selectedExtraType === "Nb") {
      // 1 No ball penalty + runs hit by bat (runs off bat counts to batsman runs)
      logBallEvent(extraBatRuns, "Nb", 1);
    } else if (selectedExtraType === "By") {
      logBallEvent(0, "By", extraCustomRuns);
    } else if (selectedExtraType === "Lb") {
      logBallEvent(0, "Lb", extraCustomRuns);
    }

    setShowExtrasModal(false);
    setSelectedExtraType("None");
    setExtraCustomRuns(0);
    setExtraBatRuns(0);
  };

  // Export summary generator Helper
  const handleTriggerExport = () => {
    if (!activeMatch) return;
    const reportText = `
*${activeMatch.teamAName} vs ${activeMatch.teamBName} - Gully Score Summary*
Date: ${activeMatch.date}
Match Status: ${activeMatch.status}
Result: ${activeMatch.matchResult || "In progress"}

Innings Scorecard:
${activeMatch.innings
  .map((inn, idx) => {
    return `${idx === 0 ? activeMatch.teamAName : activeMatch.teamBName}: ${inn.runs}/${inn.wickets} in ${inn.overs}.${inn.ballsInCurrentOver} Overs`;
  })
  .join("\n")}
Top Performer of the Match: ${pickTopPerformer(activeMatch)}
Generated via GullyScore™
    `.trim();

    setMatchSummaryText(reportText);
    setShowExporter(true);
  };

  // Ask Gemini AI Commentary
  const handleAskCommentary = async () => {
    if (!activeMatch || !activeInning) return;
    try {
      setLoadingCommentary(true);
      const lastBalls = activeInning.currentOverBalls.slice(-10);

      const res = await fetch("/api/gemini/commentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "commentary",
          context: {
            bowler: activeMatch.currentBowler || "Bowler",
            striker: activeMatch.currentStriker || "Striker",
            ballOutcome: lastBalls[lastBalls.length - 1] || "0",
            recentOverDetails: lastBalls,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setBallCommentaryText(data.text);
      } else {
        setBallCommentaryText("Commentator is having a cup of tea near the local tea stall!");
      }
    } catch (e) {
      setBallCommentaryText("Failed to compile commentary. Ensure GEMINI_API_KEY is configured.");
    } finally {
      setLoadingCommentary(false);
    }
  };

  // View logic router
  if (!activeMatch) {
    /* SCENARIO A: Setup match form screen */
    return (
      <div id="setup-match-form" className="max-w-md mx-auto bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl p-5 shadow-sm space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-neutral-800 pb-3">
          <Play className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-bold">Start New Match</h2>
        </div>

        {teams.length < 2 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-3">
            <p>You need to register at least two teams in the &apos;Teams&apos; tab before you can score a match.</p>
          </div>
        ) : (
          <form onSubmit={handleInitiateSetup} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Team A (Host / Batting first)</label>
              <select
                required
                value={teamAId}
                onChange={(e) => setTeamAId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">-- Select Team A --</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.players.length} players)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Team B (Visitor / Bowling first)</label>
              <select
                required
                value={teamBId}
                onChange={(e) => setTeamBId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">-- Select Team B --</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.players.length} players)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Overs Limit</label>
              <div className="grid grid-cols-4 gap-2">
                {[2, 5, 10, 20].map((ov) => (
                  <button
                    key={ov}
                    type="button"
                    onClick={() => setCustomOvers(ov.toString())}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      customOvers === ov.toString()
                        ? "bg-emerald-50 text-emerald-600 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800"
                        : "border-slate-100 hover:bg-slate-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
                    }`}
                  >
                    {ov} Overs
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] text-slate-400">Custom Overs:</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={customOvers}
                  onChange={(e) => setCustomOvers(e.target.value)}
                  className="w-20 px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800"
                />
              </div>
            </div>

            <button
              id="start-match-submit-btn"
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition shadow flex items-center justify-center gap-1.5"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Configure Toss Details</span>
            </button>
          </form>
        )}
      </div>
    );
  }

  if (activeMatch.status === "Toss") {
    /* SCENARIO B: Configure Toss Screen */
    const selTA = teams.find((t) => t.id === activeMatch.teamAId);
    const selTB = teams.find((t) => t.id === activeMatch.teamBId);

    return (
      <div id="toss-setup-card" className="max-w-md mx-auto bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl p-5 shadow-sm space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-neutral-800 pb-3">
          <Play className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-bold">Configure Toss Results</h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-tight">Who won the Toss?</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTossWinner(activeMatch.teamAId)}
                className={`p-3 rounded-xl border text-sm font-semibold transition truncate ${
                  tossWinner === activeMatch.teamAId
                    ? "bg-emerald-50 text-emerald-600 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800"
                    : "border-slate-100 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800"
                }`}
              >
                {activeMatch.teamAName}
              </button>
              <button
                type="button"
                onClick={() => setTossWinner(activeMatch.teamBId)}
                className={`p-3 rounded-xl border text-sm font-semibold transition truncate ${
                  tossWinner === activeMatch.teamBId
                    ? "bg-emerald-50 text-emerald-600 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800"
                    : "border-slate-100 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800"
                }`}
              >
                {activeMatch.teamBName}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-tight font-mono">Toss Winner Elected to:</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTossDecision("Bat")}
                className={`p-3 rounded-xl border text-sm font-semibold transition ${
                  tossDecision === "Bat"
                    ? "bg-emerald-50 text-emerald-600 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800"
                    : "border-slate-100 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800"
                }`}
              >
                Bat First 🏏
              </button>
              <button
                type="button"
                onClick={() => setTossDecision("Bowl")}
                className={`p-3 rounded-xl border text-sm font-semibold transition ${
                  tossDecision === "Bowl"
                    ? "bg-emerald-50 text-emerald-600 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800"
                    : "border-slate-100 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800"
                }`}
              >
                Bowl First 🎯
              </button>
            </div>
          </div>

          <button
            id="start-live-toss-btn"
            onClick={handleCompleteToss}
            className="w-full mt-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow transition"
          >
            Start Scoring Match!
          </button>
        </div>
      </div>
    );
  }

  // Check if batsman rotation or selection is required before showing scoring pad
  const needsSelectBatsmen = activeInning && (!activeMatch.currentStriker || !activeMatch.currentNonStriker);
  const needsSelectBowler = activeInning && !activeMatch.currentBowler && activeInning.overs < activeMatch.oversAllowed;

  // Pre-calculate stats for all scoreboard themes
  const totalBallsPlayed = activeInning ? activeInning.overs * 6 + activeInning.ballsInCurrentOver : 0;
  const computedCRR = activeInning && totalBallsPlayed > 0 ? ((activeInning.runs / totalBallsPlayed) * 6).toFixed(2) : "0.00";
  
  const computedRemainingBalls = activeInning && activeMatch ? (activeMatch.oversAllowed * 6) - totalBallsPlayed : 0;
  const firstInningsRuns = activeMatch?.innings?.[0]?.runs ?? 0;
  const computedRunsNeeded = activeInning && activeMatch ? (firstInningsRuns + 1) - activeInning.runs : 0;
  const computedRRR = activeInning && activeMatch && computedRemainingBalls > 0 ? Math.max(0, (computedRunsNeeded / computedRemainingBalls) * 6).toFixed(2) : "0.00";

  return (
    <div id="scorer-main-panel" className="max-w-5xl mx-auto space-y-6 relative">
      {/* 4. MAIN LIVE SCOREPAD CONSOLE */}
      {activeInning && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: Active Score information & Action Pad */}
          <div className="lg:col-span-2 space-y-4">
            {/* Scoreboard Style/Design Selector */}
            <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800/60 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block font-mono">
                  Select Scoreboard Graphic Style
                </span>
                <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                  Live Preview
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: "default", label: "Cricbuzz Glow", icon: "✨" },
                  { id: "broadcaster", label: "TV Broadcaster", icon: "📺" },
                  { id: "neon", label: "Cyberpunk Neon", icon: "👾" },
                  { id: "minimalist", label: "OLED Minimal", icon: "📱" },
                  { id: "retro", label: "8-Bit Arcade", icon: "🕹️" },
                  { id: "royal", label: "Royal Gold", icon: "👑" },
                ].map((design) => (
                  <button
                    key={design.id}
                    type="button"
                    onClick={() => setScoreboardDesign(design.id as any)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      scoreboardDesign === design.id
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/25 border-transparent"
                        : "bg-slate-50 hover:bg-slate-100 dark:bg-neutral-800/80 dark:hover:bg-neutral-800 text-slate-600 dark:text-neutral-300 border border-slate-100 dark:border-neutral-800"
                    }`}
                  >
                    <span className="text-sm">{design.icon}</span>
                    <span className="truncate">{design.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Render selected Scoreboard design */}
            {scoreboardDesign === "default" && (
              <div className="bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 border border-neutral-800 text-white rounded-2xl p-5 shadow-lg space-y-4 relative overflow-hidden">
                <div className="absolute right-2 top-2">
                  <span className="inline-flex h-2 w-2 relative">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${autoLiveStream ? "bg-red-400" : "bg-zinc-400"}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${autoLiveStream ? "bg-red-500" : "bg-zinc-500"}`}></span>
                  </span>
                  <span className="text-[9px] uppercase font-bold tracking-wider font-mono opacity-80 text-right ml-1">
                    {autoLiveStream ? "Streaming Live" : "Offline"}
                  </span>
                </div>

                <div className="text-xs opacity-75 inline-block uppercase tracking-wider font-mono font-bold bg-neutral-800 px-2 py-0.5 rounded text-emerald-400">
                  {activeMatch.status === "Chasing" ? "Second Innings (Chasing)" : "First Innings"}
                </div>

                <div className="flex justify-between items-center mt-2">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight">{battingTeam?.name}</h3>
                    <p className="text-[10px] text-slate-400">vs {bowlingTeam?.name}</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-4xl font-extrabold text-emerald-400 font-sans tracking-tight">
                      {activeInning.runs}/{activeInning.wickets}
                    </h2>
                    <p className="text-xs opacity-80 font-mono mt-1">
                      Overs: {activeInning.overs}.{activeInning.ballsInCurrentOver} / {activeMatch.oversAllowed}
                    </p>
                  </div>
                </div>

                {/* Inning details, Runrate & Partner partnership runs */}
                <div className="flex gap-4 border-t border-neutral-800/80 pt-3 flex-wrap text-xs font-medium text-slate-300 items-center">
                  <div>
                    CRR: <span className="text-white font-bold">{computedCRR}</span>
                  </div>
                  {activeMatch.status === "Chasing" && (
                    <div>
                      RRR: <span className="text-emerald-400 font-extrabold">{computedRRR}</span>
                    </div>
                  )}
                  <div>
                    Extras: <span className="text-white font-bold">{activeInning.extras.total}</span>{" "}
                    <span className="text-[10px] text-slate-400">
                      (Wd:{activeInning.extras.wides} Nb:{activeInning.extras.noBalls} B:{activeInning.extras.byes} Lb:{activeInning.extras.legByes})
                    </span>
                  </div>
                </div>

                {/* Chasing targets */}
                {activeMatch.status === "Chasing" && (
                  <div className="p-3 bg-neutral-800/40 rounded-xl text-xs space-y-1.5 border border-neutral-800 text-center text-emerald-300 relative">
                    <p className="font-semibold text-white">Target: {firstInningsRuns + 1} runs</p>
                    <p>
                      Need <span className="font-bold text-emerald-400">{computedRunsNeeded}</span> runs from{" "}
                      <span className="font-bold text-emerald-400">{computedRemainingBalls}</span> balls.
                    </p>
                    <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-350"
                        style={{
                          width: `${Math.min(100, Math.max(0, (activeInning.runs / (firstInningsRuns + 1)) * 100))}%`
                        }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Over visual capsules timeline */}
                <div className="flex items-center gap-1.5 flex-wrap border-t border-neutral-800/50 pt-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Over Timeline:</span>
                  {activeInning.currentOverBalls.length === 0 ? (
                    <span className="text-[10px] italic text-neutral-500">First delivery...</span>
                  ) : (
                    activeInning.currentOverBalls.map((label, idx) => (
                      <span
                        key={idx}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                          label.includes("W")
                            ? "bg-red-600 text-white shadow-md shadow-red-950/40"
                            : label === "4" || label === "6"
                            ? "bg-emerald-600 text-white animate-bounce"
                            : "bg-neutral-800 text-neutral-300"
                        }`}
                      >
                        {label}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Design 2: TV Broadcaster style */}
            {scoreboardDesign === "broadcaster" && (
              <div className="bg-slate-900 border-b-4 border-emerald-500 text-white rounded-2xl p-5 shadow-xl space-y-4 relative overflow-hidden font-sans">
                {/* Simulated Glass Highlight Reflection */}
                <div className="absolute top-0 left-0 right-0 h-[50%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
                
                <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-red-600 text-white text-[9px] px-2 py-0.5 rounded font-extrabold uppercase animate-pulse flex items-center gap-1 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                      <span>LIVE BROADCAST</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                      ISB MATCH CENTER
                    </span>
                  </div>
                  <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest bg-yellow-950/30 px-2 py-0.5 rounded border border-yellow-900/30">
                    {activeMatch.status === "Chasing" ? "2nd Inning" : "1st Inning"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
                  <div className="sm:col-span-2 space-y-1">
                    <span className="text-xs uppercase text-slate-400 font-bold tracking-wider">BATTING TEAM</span>
                    <h3 className="text-2xl font-black text-slate-100 tracking-tight leading-tight uppercase">
                      {battingTeam?.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium font-mono">Opponent: {bowlingTeam?.name}</p>
                  </div>

                  <div className="sm:col-span-3 bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex justify-between items-center shadow-inner">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Score / Wickets</span>
                      <h2 className="text-3xl font-extrabold text-emerald-400 tracking-tight font-mono">
                        {activeInning.runs} <span className="text-slate-400 text-xl">/</span> {activeInning.wickets}
                      </h2>
                    </div>
                    <div className="text-right border-l border-slate-800 pl-4">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Overs Bowled</span>
                      <p className="text-xl font-bold font-mono text-slate-100">
                        {activeInning.overs}.{activeInning.ballsInCurrentOver} <span className="text-slate-500 text-xs">/ {activeMatch.oversAllowed}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* TV Graphic Ticker Crawl */}
                <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-xs font-mono">
                  <div className="text-center">
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">CRR</span>
                    <span className="font-extrabold text-slate-200">{computedCRR}</span>
                  </div>
                  <div className="text-center border-x border-slate-800">
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">EXTRAS</span>
                    <span className="font-extrabold text-yellow-400">
                      {activeInning.extras.total} <span className="text-[9px] text-slate-500 font-normal">(Wd:{activeInning.extras.wides} Nb:{activeInning.extras.noBalls})</span>
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">
                      {activeMatch.status === "Chasing" ? "REQ RR" : "PROJECTED"}
                    </span>
                    <span className="font-extrabold text-emerald-400">
                      {activeMatch.status === "Chasing" ? computedRRR : (parseFloat(computedCRR) * activeMatch.oversAllowed).toFixed(0)}
                    </span>
                  </div>
                </div>

                {/* Target progress ticker if chasing */}
                {activeMatch.status === "Chasing" && (
                  <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 text-center space-y-1.5 relative overflow-hidden">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-300">Target: {firstInningsRuns + 1} Runs</span>
                      <span className="text-emerald-400 font-bold">Need {computedRunsNeeded} runs from {computedRemainingBalls} balls</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-md overflow-hidden p-[1px]">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded"
                        style={{
                          width: `${Math.min(100, Math.max(0, (activeInning.runs / (firstInningsRuns + 1)) * 100))}%`
                        }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Over balls */}
                <div className="flex items-center gap-1.5 border-t border-slate-800 pt-3 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider">CURRENT OVER:</span>
                  {activeInning.currentOverBalls.length === 0 ? (
                    <span className="text-[10px] italic text-slate-500">Awaiting first delivery...</span>
                  ) : (
                    activeInning.currentOverBalls.map((label, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-extrabold border ${
                          label.includes("W")
                            ? "bg-red-950 text-red-400 border-red-800 shadow-sm"
                            : label === "4" || label === "6"
                            ? "bg-yellow-950 text-yellow-400 border-yellow-700 font-black animate-pulse"
                            : "bg-slate-850 text-slate-300 border-slate-700"
                        }`}
                      >
                        {label}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Design 3: Cyberpunk Neon */}
            {scoreboardDesign === "neon" && (
              <div className="bg-[#080315] border-2 border-fuchsia-500 text-cyan-400 rounded-2xl p-5 shadow-[0_0_20px_rgba(217,70,239,0.25)] space-y-4 relative overflow-hidden font-mono">
                {/* Tech scanline visual decoration */}
                <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-[0.03]"></div>
                
                {/* Corner crosshairs */}
                <div className="absolute top-2 left-2 text-[9px] text-fuchsia-500 opacity-60 font-mono">┌ CYBER_CRIC ┐</div>
                <div className="absolute bottom-2 right-2 text-[9px] text-fuchsia-500 opacity-60 font-mono">└ RUN_MATRIX ┘</div>

                <div className="flex justify-between items-center pt-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                    <span className="text-[10px] tracking-widest font-bold uppercase text-cyan-400">
                      [ NODE_ACTIVE_STREAM ]
                    </span>
                  </div>
                  <span className="text-[10px] tracking-widest text-fuchsia-400 font-bold uppercase">
                    {activeMatch.status === "Chasing" ? "SYS_CHASE_ENGAGED" : "SYS_FIRST_INNING"}
                  </span>
                </div>

                <div className="border border-cyan-900/50 bg-[#0d0722] p-4 rounded-xl space-y-3 relative">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase font-semibold">[VIRTUAL_BATTER_COGNITIVE]</span>
                      <h3 className="text-xl font-bold tracking-tight text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">
                        {battingTeam?.name}
                      </h3>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-500 block uppercase font-semibold">[TARGET_CORE]</span>
                      <h4 className="text-xs font-bold text-fuchsia-400">
                        OPP_DEFENCE: {bowlingTeam?.name}
                      </h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-cyan-950 pt-3">
                    <div>
                      <span className="text-[9px] text-cyan-500 uppercase font-bold tracking-wider">TOTAL_SCORE</span>
                      <div className="text-4xl font-extrabold text-fuchsia-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]">
                        {activeInning.runs}
                        <span className="text-cyan-400 text-2xl font-light"> / </span>
                        {activeInning.wickets}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-cyan-500 uppercase font-bold tracking-wider">CYCLE_OVERS</span>
                      <div className="text-3xl font-bold text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.4)]">
                        {activeInning.overs}.{activeInning.ballsInCurrentOver}
                        <span className="text-slate-500 text-sm"> / {activeMatch.oversAllowed}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grid matrix indicators */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-[#0b051c] border border-cyan-950 p-2 rounded-lg">
                    <span className="text-[8px] text-slate-500 block">CRR_FLOW</span>
                    <span className="text-cyan-400 font-extrabold">{computedCRR}</span>
                  </div>
                  <div className="bg-[#0b051c] border border-cyan-950 p-2 rounded-lg">
                    <span className="text-[8px] text-slate-500 block">SYS_EXTRAS</span>
                    <span className="text-fuchsia-400 font-bold">{activeInning.extras.total}</span>
                  </div>
                  <div className="bg-[#0b051c] border border-cyan-950 p-2 rounded-lg">
                    <span className="text-[8px] text-slate-500 block">
                      {activeMatch.status === "Chasing" ? "REQ_VELOCITY" : "EST_CAPACITY"}
                    </span>
                    <span className="text-emerald-400 font-extrabold">
                      {activeMatch.status === "Chasing" ? computedRRR : (parseFloat(computedCRR) * activeMatch.oversAllowed).toFixed(0)}
                    </span>
                  </div>
                </div>

                {/* Cyberpunk Progress bar */}
                {activeMatch.status === "Chasing" && (
                  <div className="bg-[#0b051c] border border-fuchsia-950 rounded-xl p-3 text-center space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">CHASE_TARGET: {firstInningsRuns + 1}</span>
                      <span className="text-[#00ffcc] font-extrabold">REMAINING: {computedRunsNeeded} RUNS</span>
                    </div>
                    <div className="w-full bg-neutral-900 h-1 rounded border border-cyan-950 overflow-hidden">
                      <div
                        className="bg-fuchsia-500 h-full shadow-[0_0_8px_#ff007f]"
                        style={{
                          width: `${Math.min(100, Math.max(0, (activeInning.runs / (firstInningsRuns + 1)) * 100))}%`
                        }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Over capsule nodes */}
                <div className="flex items-center gap-1.5 border-t border-cyan-950 pt-3 flex-wrap">
                  <span className="text-[9px] text-cyan-500 uppercase tracking-wider">TIMELINE_NODES:</span>
                  {activeInning.currentOverBalls.length === 0 ? (
                    <span className="text-[9px] italic text-slate-600">[AWAITING_SIGNAL_INPUT]</span>
                  ) : (
                    activeInning.currentOverBalls.map((label, idx) => (
                      <span
                        key={idx}
                        className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold border ${
                          label.includes("W")
                            ? "bg-red-950 text-red-400 border-red-500 animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.5)]"
                            : label === "4" || label === "6"
                            ? "bg-cyan-950 text-[#00ffcc] border-[#00ffcc] shadow-[0_0_5px_rgba(0,255,204,0.5)]"
                            : "bg-[#0b051c] text-slate-400 border-cyan-950"
                        }`}
                      >
                        {label}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Design 4: OLED Minimal */}
            {scoreboardDesign === "minimalist" && (
              <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-neutral-100 rounded-2xl p-6 shadow-xs space-y-5 relative overflow-hidden font-sans">
                <div className="flex justify-between items-center text-xs tracking-tight text-slate-400 border-b border-slate-100 dark:border-neutral-900 pb-2">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">
                    {activeMatch.status === "Chasing" ? "Run Chase Active" : "First Innings Current State"}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span className="uppercase text-[9px]">Live Scorer</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-slate-400 uppercase font-medium tracking-widest font-mono">NOW BATTING</span>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-baseline gap-2">
                    <h3 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                      {battingTeam?.name}
                    </h3>
                    <p className="text-sm text-slate-400">versus {bowlingTeam?.name}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center py-4 border-y border-slate-100 dark:border-neutral-900 gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">CURRENT SCORE</span>
                    <div className="text-5xl font-light tracking-tighter text-slate-900 dark:text-white flex items-baseline">
                      <span>{activeInning.runs}</span>
                      <span className="text-slate-300 dark:text-neutral-700 mx-2 font-thin">/</span>
                      <span className="text-slate-500 font-normal text-3xl">{activeInning.wickets}</span>
                    </div>
                  </div>

                  <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-neutral-900 pt-3 sm:pt-0 sm:pl-6">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">COMPLETED OVERS</span>
                    <p className="text-3xl font-semibold text-slate-800 dark:text-neutral-200 font-mono tracking-tight">
                      {activeInning.overs}.{activeInning.ballsInCurrentOver}
                      <span className="text-slate-400 dark:text-neutral-600 text-lg font-light"> / {activeMatch.oversAllowed}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                  <div className="bg-slate-50 dark:bg-neutral-900 p-2.5 rounded-xl">
                    <span className="text-[9px] text-slate-400 block uppercase">Current Run Rate</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{computedCRR}</span>
                  </div>
                  {activeMatch.status === "Chasing" && (
                    <div className="bg-slate-50 dark:bg-neutral-900 p-2.5 rounded-xl">
                      <span className="text-[9px] text-slate-400 block uppercase">Required Rate</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{computedRRR}</span>
                    </div>
                  )}
                  <div className="bg-slate-50 dark:bg-neutral-900 p-2.5 rounded-xl">
                    <span className="text-[9px] text-slate-400 block uppercase">Extras Offered</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{activeInning.extras.total}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-neutral-900 p-2.5 rounded-xl">
                    <span className="text-[9px] text-slate-400 block uppercase">Overs Remaining</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {(activeMatch.oversAllowed - activeInning.overs - (activeInning.ballsInCurrentOver > 0 ? 1 : 0))}
                    </span>
                  </div>
                </div>

                {activeMatch.status === "Chasing" && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Need {computedRunsNeeded} runs from {computedRemainingBalls} deliveries.</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">Target: {firstInningsRuns + 1}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-neutral-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-black dark:bg-white h-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, (activeInning.runs / (firstInningsRuns + 1)) * 100))}%`
                        }}
                      ></div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5 pt-2 flex-wrap border-t border-slate-100 dark:border-neutral-900">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Over Delivery Track:</span>
                  {activeInning.currentOverBalls.length === 0 ? (
                    <span className="text-[10px] italic text-slate-400">Empty over...</span>
                  ) : (
                    activeInning.currentOverBalls.map((label, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                          label.includes("W")
                            ? "bg-black text-white dark:bg-white dark:text-black"
                            : "bg-slate-100 text-slate-800 dark:bg-neutral-900 dark:text-slate-300"
                        }`}
                      >
                        {label}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Design 5: 8-Bit Arcade Scoreboard */}
            {scoreboardDesign === "retro" && (
              <div className="bg-neutral-950 border-4 border-dashed border-amber-500 text-amber-400 rounded-2xl p-5 shadow-[inset_0_0_15px_rgba(245,158,11,0.2)] space-y-4 relative overflow-hidden font-mono tracking-tight select-none">
                {/* Vintage arcade grid effect overlay */}
                <div className="absolute inset-0 bg-radial-vignette opacity-20 pointer-events-none"></div>

                <div className="flex justify-between items-center border-b-2 border-amber-500/30 pb-2">
                  <span className="text-[10px] uppercase animate-pulse">** STAGE 01 ACTIVE **</span>
                  <div className="text-[10px] text-right">HI-SCORE: 999</div>
                </div>

                <div className="text-center space-y-1">
                  <p className="text-[10px] text-yellow-500 font-bold uppercase">[ ACTIVE BATTER PLAYER 1 ]</p>
                  <h3 className="text-xl font-extrabold uppercase text-white tracking-widest border-2 border-dashed border-amber-800 p-2 rounded-lg bg-neutral-900">
                    {battingTeam?.name}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4 py-3 bg-black/60 rounded-xl border border-amber-500/25 p-3">
                  <div>
                    <span className="text-[9px] text-amber-500 uppercase block">== RUNS/WKTS ==</span>
                    <div className="text-4xl font-bold font-mono tracking-wider text-amber-300">
                      {activeInning.runs.toString().padStart(3, "0")}
                      <span className="text-amber-500 text-2xl font-light">-</span>
                      {activeInning.wickets}
                    </div>
                  </div>
                  <div className="text-right border-l border-amber-900/40 pl-4">
                    <span className="text-[9px] text-amber-500 uppercase block">== OVERS ==</span>
                    <div className="text-3xl font-bold font-mono tracking-wider text-amber-300">
                      {activeInning.overs}.{activeInning.ballsInCurrentOver}
                      <span className="text-amber-500 text-xs font-light">/{activeMatch.oversAllowed}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[11px] uppercase">
                  <div className="bg-neutral-900 p-1.5 rounded border border-amber-900/40">
                    <span className="text-[8px] text-yellow-600 block">CRR</span>
                    <span className="font-bold">{computedCRR}</span>
                  </div>
                  <div className="bg-neutral-900 p-1.5 rounded border border-amber-900/40">
                    <span className="text-[8px] text-yellow-600 block">EXT</span>
                    <span className="font-bold">{activeInning.extras.total}</span>
                  </div>
                  <div className="bg-neutral-900 p-1.5 rounded border border-amber-900/40">
                    <span className="text-[8px] text-yellow-600 block">
                      {activeMatch.status === "Chasing" ? "REQ_RR" : "PROJ"}
                    </span>
                    <span className="font-bold text-yellow-300">
                      {activeMatch.status === "Chasing" ? computedRRR : (parseFloat(computedCRR) * activeMatch.oversAllowed).toFixed(0)}
                    </span>
                  </div>
                </div>

                {activeMatch.status === "Chasing" && (
                  <div className="bg-black p-3 rounded border border-amber-900/30 text-center space-y-1">
                    <p className="text-[10px] text-amber-400">
                      NEED {computedRunsNeeded} RUNS FROM {computedRemainingBalls} BALLS
                    </p>
                    <div className="flex gap-1 justify-center items-center text-[8px] text-amber-600">
                      <span>[</span>
                      {Array.from({ length: 10 }).map((_, idx) => {
                        const progress = (activeInning.runs / (firstInningsRuns + 1)) * 10;
                        return (
                          <span
                            key={idx}
                            className={`w-2.5 h-1.5 inline-block ${
                              idx < progress ? "bg-amber-400" : "bg-neutral-900 border border-amber-950"
                            }`}
                          ></span>
                        );
                      })}
                      <span>]</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1 flex-wrap border-t border-amber-900/40 pt-3 text-[10px]">
                  <span className="text-[8px] text-yellow-600 uppercase">BALLS RECORD:</span>
                  {activeInning.currentOverBalls.length === 0 ? (
                    <span className="text-[8px] text-neutral-600">[ PRESS BUTTON TO LOG ]</span>
                  ) : (
                    activeInning.currentOverBalls.map((label, idx) => (
                      <span
                        key={idx}
                        className={`px-1.5 py-0.5 rounded font-bold border ${
                          label.includes("W")
                            ? "bg-red-900 text-red-100 border-red-500 animate-pulse"
                            : "bg-neutral-900 text-amber-400 border-amber-800"
                        }`}
                      >
                        {label}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Design 6: Royal Gold */}
            {scoreboardDesign === "royal" && (
              <div className="bg-gradient-to-br from-[#11241a] via-[#09140f] to-[#132c20] border-2 border-amber-400 text-amber-100 rounded-2xl p-5 shadow-2xl space-y-4 relative overflow-hidden font-serif">
                {/* Elegant Gilded flourishes visual layout */}
                <div className="absolute -right-12 -top-12 w-24 h-24 rounded-full border-4 border-amber-400/20 pointer-events-none"></div>
                <div className="absolute -left-12 -bottom-12 w-24 h-24 rounded-full border-4 border-amber-400/20 pointer-events-none"></div>

                <div className="flex justify-between items-center border-b border-amber-400/30 pb-2.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-400 animate-bounce" />
                    <span className="uppercase font-bold tracking-widest text-[9px] text-amber-400 font-sans">
                      CHAMPIONSHIP TIER MATCH
                    </span>
                  </div>
                  <span className="font-sans uppercase font-bold text-[9px] border border-amber-400/40 px-2 py-0.5 rounded text-amber-400 bg-amber-950/20">
                    {activeMatch.status === "Chasing" ? "Championship Target Chase" : "Championship Setup"}
                  </span>
                </div>

                <div className="text-center space-y-1 py-1">
                  <p className="text-[10px] text-amber-400/70 uppercase tracking-widest font-sans font-bold">CURRENT TEAM BATTING</p>
                  <h3 className="text-2xl font-bold tracking-wide text-amber-200">
                    {battingTeam?.name}
                  </h3>
                  <div className="w-16 h-[1px] bg-amber-400/50 mx-auto"></div>
                  <p className="text-[10px] italic text-amber-100/60 font-sans">Competing against {bowlingTeam?.name}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-y border-amber-400/30 text-center">
                  <div className="space-y-1">
                    <span className="text-[10px] text-amber-400/60 uppercase tracking-wider font-sans font-bold block">TOTAL RECORD</span>
                    <div className="text-4xl font-extrabold text-amber-300 tracking-tight font-sans">
                      {activeInning.runs} <span className="text-amber-500 font-light text-2xl">for</span> {activeInning.wickets}
                    </div>
                  </div>
                  <div className="space-y-1 border-l border-amber-400/20">
                    <span className="text-[10px] text-amber-400/60 uppercase tracking-wider font-sans font-bold block">OVERS COMPLETED</span>
                    <div className="text-4xl font-extrabold text-amber-300 tracking-tight font-sans font-mono">
                      {activeInning.overs}.{activeInning.ballsInCurrentOver}
                      <span className="text-amber-500/50 text-base font-normal"> / {activeMatch.oversAllowed}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs font-sans">
                  <div className="bg-[#09130e] border border-amber-400/25 p-2 rounded-lg">
                    <span className="text-[8px] text-amber-400/60 block uppercase font-bold">RUN RATE</span>
                    <span className="font-bold text-amber-200">{computedCRR}</span>
                  </div>
                  <div className="bg-[#09130e] border border-amber-400/25 p-2 rounded-lg">
                    <span className="text-[8px] text-amber-400/60 block uppercase font-bold">EXTRAS</span>
                    <span className="font-bold text-amber-200">{activeInning.extras.total}</span>
                  </div>
                  <div className="bg-[#09130e] border border-amber-400/25 p-2 rounded-lg">
                    <span className="text-[8px] text-amber-400/60 block uppercase font-bold">
                      {activeMatch.status === "Chasing" ? "REQUIRED" : "EST. SCORE"}
                    </span>
                    <span className="font-bold text-amber-300">
                      {activeMatch.status === "Chasing" ? computedRRR : (parseFloat(computedCRR) * activeMatch.oversAllowed).toFixed(0)}
                    </span>
                  </div>
                </div>

                {activeMatch.status === "Chasing" && (
                  <div className="bg-[#09130e] border border-amber-400/20 rounded-xl p-3 text-center space-y-1 font-sans">
                    <p className="text-xs text-amber-100/80">
                      Need <span className="text-amber-300 font-bold">{computedRunsNeeded}</span> runs from <span className="text-amber-300 font-bold">{computedRemainingBalls}</span> balls.
                    </p>
                    <div className="w-full bg-neutral-900 h-1 rounded-full overflow-hidden border border-amber-400/10">
                      <div
                        className="bg-amber-400 h-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, (activeInning.runs / (firstInningsRuns + 1)) * 100))}%`
                        }}
                      ></div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5 pt-2 flex-wrap border-t border-amber-400/20 text-xs font-sans">
                  <span className="text-[9px] text-amber-400/60 uppercase font-bold">Current Deliveries:</span>
                  {activeInning.currentOverBalls.length === 0 ? (
                    <span className="text-[10px] italic text-amber-100/40">First Delivery...</span>
                  ) : (
                    activeInning.currentOverBalls.map((label, idx) => (
                      <span
                        key={idx}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                          label.includes("W")
                            ? "bg-red-950 text-red-200 border-red-500 shadow-md"
                            : label === "4" || label === "6"
                            ? "bg-amber-400 text-emerald-950 border-amber-300 font-black"
                            : "bg-[#09130e] text-amber-100 border-amber-400/20"
                        }`}
                      >
                        {label}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* If setup requires selecting active cricketers */}
            {needsSelectBatsmen && (
              <div className="bg-slate-50 dark:bg-neutral-900 p-4 border border-emerald-300 dark:border-emerald-950/40 rounded-2xl space-y-3">
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>Choose Incoming Batsmen</span>
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Striker Batsman 🏏</label>
                    <select
                      value={tempNextStriker}
                      onChange={(e) => setTempNextStriker(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-semibold"
                    >
                      <option value="">-- Choose Striker --</option>
                      {battingTeam?.players
                        .filter((p) => p !== activeMatch.currentNonStriker && !activeInning.batsmen[p]?.isOut)
                        .map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400">Non-Striker Batsman</label>
                    <select
                      value={tempNextNonStriker}
                      onChange={(e) => setTempNextNonStriker(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-semibold"
                    >
                      <option value="">-- Choose Non-Striker --</option>
                      {battingTeam?.players
                        .filter((p) => p !== activeMatch.currentStriker && !activeInning.batsmen[p]?.isOut)
                        .map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <button
                  id="confirm-batsmen-selection-btn"
                  onClick={handleConfirmNextBatsmen}
                  disabled={!tempNextStriker && !tempNextNonStriker}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow disabled:opacity-40"
                >
                  Adopt Strikers
                </button>
              </div>
            )}

            {needsSelectBowler && !needsSelectBatsmen && (
              <div className="bg-slate-50 dark:bg-neutral-900 p-4 border border-emerald-300 dark:border-emerald-950/40 rounded-2xl space-y-3">
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>Choose Bowler for Over {activeInning.overs + 1}</span>
                </p>
                <div className="flex gap-2">
                  <select
                    value={tempNextBowler}
                    onChange={(e) => setTempNextBowler(e.target.value)}
                    className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-semibold text-xs"
                  >
                    <option value="">-- Select Bowler --</option>
                    {bowlingTeam?.players.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <button
                    id="confirm-bowler-btn"
                    onClick={handleConfirmBowler}
                    disabled={!tempNextBowler}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                  >
                    Adopt Bowler
                  </button>
                </div>
              </div>
            )}

            {/* Standard Scoring Big Buttons touch matrix */}
            {!needsSelectBatsmen && !needsSelectBowler && activeMatch.status !== "Completed" && (
              <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Score Pad (One-Handed Thumb Tap)
                </h4>

                {/* Score numbers matrix */}
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2, 3, 4, 6].map((run) => (
                    <button
                      key={run}
                      id={`score-pad-btn-${run}`}
                      onClick={() => logBallEvent(run, "None", 0)}
                      className="aspect-square py-5 bg-slate-50 hover:bg-slate-100 dark:bg-neutral-800/80 dark:hover:bg-neutral-800 rounded-2xl font-extrabold text-2xl transition-all shadow-sm border border-slate-100/30 active:scale-95 flex flex-col items-center justify-center gap-1"
                    >
                      <span>{run}</span>
                      <span className="text-[10px] text-slate-400 font-normal">Runs</span>
                    </button>
                  ))}
                </div>

                {/* Extras modifiers & Wicket triggers */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    id="open-extras-modal-btn"
                    onClick={() => {
                      setSelectedExtraType("Wd");
                      setShowExtrasModal(true);
                    }}
                    className="py-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-xs shadow-sm transition active:scale-95"
                  >
                    + Extras (Wd / Nb)
                  </button>
                  <button
                    id="open-wicket-modal-btn"
                    onClick={() => {
                      // default dismissed player
                      setWicketDismissed(activeMatch.currentStriker);
                      setShowWicketModal(true);
                    }}
                    className="py-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl font-bold text-xs shadow-sm transition active:scale-95"
                  >
                    OUT / Wicket 🔴
                  </button>
                </div>
              </div>
            )}

            {/* Completed Match result screen panel */}
            {activeMatch.status === "Completed" && (
              <div className="bg-yellow-50 dark:bg-yellow-950/10 border border-yellow-200 dark:border-yellow-900/30 p-5 rounded-2xl text-center space-y-4">
                <div className="inline-block p-3 bg-yellow-100 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400 rounded-2xl">
                  <Trophy className="w-8 h-8 animate-bounce" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-extrabold text-yellow-600 dark:text-yellow-400">Match Concluded!</h3>
                  <p className="text-md font-bold leading-tight">{activeMatch.matchResult}</p>
                </div>

                <div className="p-3 bg-white dark:bg-neutral-800 rounded-xl border border-slate-100/80 dark:border-neutral-700/50 max-w-sm mx-auto text-xs space-y-1">
                  <p className="font-semibold text-slate-400 uppercase text-[10px]">Top Performer</p>
                  <p className="font-bold text-sm text-yellow-600 dark:text-yellow-400">
                    {activeMatch.playerOfTheMatch}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                  <button
                    id="trigger-export-btn"
                    onClick={handleTriggerExport}
                    className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition shadow"
                  >
                    Export Report summary
                  </button>
                  <button
                    id="archive-match-btn"
                    onClick={handleCloseAndArchive}
                    className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition"
                  >
                    Save & Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right panel: Active Batsmen/Bowlers list & control actions */}
          <div className="space-y-4">
            {/* Live Video Broadcast Streamer */}
            <LiveBroadcastPlayer
              activeBallEvent={activeLiveBallEvent}
              autoPlay={true}
            />

            {/* Launch Popout Live Window Button */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-4 shadow-sm flex items-center justify-between text-white border border-emerald-500/10">
              <div className="space-y-0.5">
                <h5 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                  <Tv className="w-4 h-4 fill-white animate-pulse" />
                  <span>Live TV Stream</span>
                </h5>
                <p className="text-[10px] text-emerald-100/90 font-medium leading-normal max-w-[180px] sm:max-w-none">Broadcast match & scoreboards on secondary screens/TVs!</p>
              </div>
              <button
                id="launch-live-popout-btn"
                onClick={() => {
                  window.open(`/live?matchId=${activeMatch.id}`, `GullyLive-${activeMatch.id}`, 'width=1200,height=800,scrollbars=yes,resizable=yes');
                }}
                className="px-3.5 py-2 bg-white text-emerald-700 hover:bg-slate-50 font-black text-xs rounded-xl transition shadow-md flex items-center gap-1.5 shrink-0 active:scale-95"
              >
                <span>Launch TV</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Scorer quick action row */}
            <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl p-4 shadow-sm space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-400">System Ops</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="undo-last-ball-btn"
                  onClick={handleUndoButton}
                  disabled={undoHistory.length === 0}
                  className="py-2 bg-slate-50 hover:bg-slate-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-xl text-[11px] font-bold text-slate-600 dark:text-neutral-300 flex items-center justify-center gap-1.5 transition disabled:opacity-45"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undo ({undoHistory.length})</span>
                </button>

                <button
                  id="open-manual-edit-btn"
                  onClick={() => {
                    if (activeInning) {
                      setManualRuns(activeInning.runs.toString());
                      setManualWickets(activeInning.wickets.toString());
                      setManualOvers(activeInning.overs.toString());
                      setManualBalls(activeInning.ballsInCurrentOver.toString());
                    }
                    setShowManualEditModal(true);
                  }}
                  className="py-2 bg-slate-50 hover:bg-slate-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-xl text-[11px] font-bold text-slate-600 dark:text-neutral-300 flex items-center justify-center gap-1.5 transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Score</span>
                </button>
              </div>

              {/* Gemini Commentary Panel inside scorer */}
              {activeMatch.status !== "Completed" && (
                <div className="pt-2 border-t border-slate-50 dark:border-neutral-800/80 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 capitalize">Gemini Commentator</span>
                    <button
                      onClick={handleAskCommentary}
                      disabled={loadingCommentary || activeInning.currentOverBalls.length === 0}
                      className="px-2 py-1 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 text-[9px] font-bold rounded-lg flex items-center gap-1 disabled:opacity-45"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-500" />
                      <span>{loadingCommentary ? "Analyzing..." : "Review Ball"}</span>
                    </button>
                  </div>
                  {ballCommentaryText && (
                    <p className="text-[10px] italic border-l-2 border-emerald-400 pl-2 text-slate-500 leading-relaxed">
                      {ballCommentaryText}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Active player stats card */}
            <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl p-4 shadow-sm space-y-4">
              <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Batter / Bowler Stats</h4>

              {/* Batsmen */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-50 dark:border-neutral-800/80 pb-1">
                  <span>Batsman</span>
                  <span>R (B)</span>
                </div>
                {/* Striker details */}
                <div className="flex justify-between items-center text-xs">
                  <div className="truncate pr-2 font-semibold flex items-center gap-2">
                    <div className="relative w-5 h-5 rounded-full overflow-hidden bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-center flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={battingTeam?.playerImages?.[activeMatch.currentStriker] || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(activeMatch.currentStriker)}`}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <span>{activeMatch.currentStriker || "Striker"}*</span>
                  </div>
                  <span className="font-mono font-bold">
                    {activeInning.batsmen[activeMatch.currentStriker]?.runs || 0}{" "}
                    <span className="font-normal text-[10px] text-slate-400">
                      ({activeInning.batsmen[activeMatch.currentStriker]?.balls || 0})
                    </span>
                  </span>
                </div>
                {/* NonStriker details */}
                <div className="flex justify-between items-center text-xs">
                  <div className="truncate pr-2 font-medium flex items-center gap-2 text-slate-500 dark:text-neutral-400">
                    <div className="relative w-5 h-5 rounded-full overflow-hidden bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 flex items-center justify-center flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={battingTeam?.playerImages?.[activeMatch.currentNonStriker] || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(activeMatch.currentNonStriker)}`}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <span>{activeMatch.currentNonStriker || "Non-Striker"}</span>
                  </div>
                  <span className="font-mono text-slate-500 dark:text-neutral-400">
                    {activeInning.batsmen[activeMatch.currentNonStriker]?.runs || 0}{" "}
                    <span className="font-normal text-[10px] text-slate-400">
                      ({activeInning.batsmen[activeMatch.currentNonStriker]?.balls || 0})
                    </span>
                  </span>
                </div>
              </div>

              {/* Bowler summary */}
              <div className="space-y-2 border-t border-slate-50 dark:border-neutral-800/80 pt-3">
                <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                  <span>Current Bowler</span>
                  <span>O-M-R-W</span>
                </div>
                <div className="flex justify-between items-center text-xs font-semibold">
                  <div className="truncate pr-2 flex items-center gap-2">
                    <div className="relative w-5 h-5 rounded-full overflow-hidden bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 flex items-center justify-center flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={bowlingTeam?.playerImages?.[activeMatch.currentBowler] || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(activeMatch.currentBowler)}`}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <span className="truncate max-w-[130px]">{activeMatch.currentBowler || "Bowler name"}</span>
                  </div>
                  <span className="font-mono">
                    {activeInning.bowlers[activeMatch.currentBowler]
                      ? `${Math.floor(activeInning.bowlers[activeMatch.currentBowler].balls / 6)}.${
                          activeInning.bowlers[activeMatch.currentBowler].balls % 6
                        }-${activeInning.bowlers[activeMatch.currentBowler].maidens}-${
                          activeInning.bowlers[activeMatch.currentBowler].runs
                        }-${activeInning.bowlers[activeMatch.currentBowler].wickets}`
                      : "0.0-0-0-0"}
                  </span>
                </div>
              </div>

              {/* Manual strike rotation toggle */}
              {activeMatch.currentStriker && activeMatch.currentNonStriker && (
                <button
                  id="swap-strike-btn"
                  onClick={() => {
                    const swapped = rotateStrike(activeMatch);
                    const updated = {
                      ...activeMatch,
                      currentStriker: swapped.currentStriker,
                      currentNonStriker: swapped.currentNonStriker,
                    };
                    onSaveActiveMatch(updated);
                    pushLiveStreamUpdate(updated);
                  }}
                  className="w-full mt-2 py-1.5 bg-slate-50 dark:bg-neutral-850 hover:bg-slate-100 text-[10px] font-bold text-slate-500 rounded-lg"
                >
                  Swap Batsmen Strike 🏏
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeMatch && activeInning && (
        <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl p-2 self-stretch shadow-sm">
          <RunRateChart match={activeMatch} isDarkMode={true} />
        </div>
      )}

      {/* 5. MODAL OVERLAYS & INNER DIALOGS */}

      {/* Wicket Setup Dialog Modal */}
      {showWicketModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-md font-bold tracking-tight text-red-500 flex items-center gap-1.5 uppercase">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
              <span>Input Wicket Stats</span>
            </h3>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Dismissed Batsman</label>
                <select
                  value={wicketDismissed}
                  onChange={(e) => setWicketDismissed(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-xs font-semibold"
                >
                  <option value={activeMatch?.currentStriker}>{activeMatch?.currentStriker} (Striker)</option>
                  <option value={activeMatch?.currentNonStriker}>{activeMatch?.currentNonStriker} (Non-Striker)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Wicket Type</label>
                <select
                  value={wicketType}
                  onChange={(e) => setWicketType(e.target.value as WicketType)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-xs font-semibold"
                >
                  <option value="Bowled">Bowled</option>
                  <option value="Caught">Caught</option>
                  <option value="LBW">LBW</option>
                  <option value="Stumped">Stumped</option>
                  <option value="Run Out">Run Out</option>
                  <option value="Hit Wicket">Hit Wicket</option>
                  <option value="Retired Hurt">Retired Hurt</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Fielder involved (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Sanjay"
                  value={wicketFielder}
                  onChange={(e) => setWicketFielder(e.target.value)}
                  className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                id="cancel-wicket-modal-btn"
                onClick={() => setShowWicketModal(false)}
                className="py-2 border border-slate-100 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                id="confirm-wicket-modal-btn"
                onClick={handleConfirmWicket}
                className="py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold text-center"
              >
                Log Out 🔴
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extras Setup Dialog Modal */}
      {showExtrasModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-md font-bold tracking-tight text-blue-500 uppercase">Input Extras Delivery</h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Extras Category</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["Wd", "Nb", "By", "Lb"] as ExtraType[]).map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => {
                        setSelectedExtraType(ex);
                        setExtraCustomRuns(0);
                        setExtraBatRuns(0);
                      }}
                      className={`py-2 text-xs font-bold rounded-lg border transition ${
                        selectedExtraType === ex
                          ? "bg-blue-50 border-blue-300 text-blue-600 dark:bg-blue-950/20 dark:border-blue-900"
                          : "border-slate-100 dark:border-neutral-800"
                      }`}
                    >
                      {ex === "Wd" ? "Wide" : ex === "Nb" ? "No-B" : ex === "By" ? "Bye" : "Leg-B"}
                    </button>
                  ))}
                </div>
              </div>

              {selectedExtraType === "Wd" && (
                <div className="space-y-1 p-3 bg-blue-50/30 dark:bg-neutral-800 rounded-xl border border-blue-50/50">
                  <p className="text-[11px] font-bold text-blue-500 uppercase">Wide ball options</p>
                  <label className="text-xs text-slate-400 block pb-1">Did the players run additionals? (excluding penalty Wide run):</label>
                  <select
                    value={extraCustomRuns}
                    onChange={(e) => setExtraCustomRuns(Number(e.target.value))}
                    className="w-full p-1.5 text-xs rounded border border-slate-200"
                  >
                    <option value="0">0 (Just 1 Wide penalty)</option>
                    <option value="1">1 run ran (+1 Wide = 2 runs total)</option>
                    <option value="2">2 runs ran (+1 Wide = 3 runs total)</option>
                    <option value="3">3 runs ran (+1 Wide = 4 runs total)</option>
                    <option value="4">4 runs ran / boundary (+1 Wide = 5 runs total)</option>
                  </select>
                </div>
              )}

              {selectedExtraType === "Nb" && (
                <div className="space-y-1 p-3 bg-blue-50/30 dark:bg-neutral-800 rounded-xl border border-blue-50/50">
                  <p className="text-[11px] font-bold text-blue-500 uppercase">No Ball hit options</p>
                  <label className="text-xs text-slate-400 block pb-1">Did the batsman score runs off the bat?:</label>
                  <select
                    value={extraBatRuns}
                    onChange={(e) => setExtraBatRuns(Number(e.target.value))}
                    className="w-full p-1.5 text-xs rounded border border-slate-200"
                  >
                    <option value="0">0 runs hit (Just 1 No-ball penalty)</option>
                    <option value="1">1 run hit (striker gains 1 run, 2 runs total)</option>
                    <option value="2">2 runs hit (striker gains 2 runs, 3 runs total)</option>
                    <option value="3">3 runs hit (striker gains 3 runs, 4 runs total)</option>
                    <option value="4">4 runs hit (striker gains 4 runs, 5 runs total)</option>
                    <option value="6">6 runs hit (striker gains 6 runs, 7 runs total)</option>
                  </select>
                </div>
              )}

              {(selectedExtraType === "By" || selectedExtraType === "Lb") && (
                <div className="space-y-1 p-3 bg-blue-50/30 dark:bg-neutral-800 rounded-xl border border-blue-50/50">
                  <p className="text-[11px] font-bold text-blue-500 uppercase">Bye / Leg-Bye Runs</p>
                  <label className="text-xs text-slate-400 block pb-1">How many runs scored as byes/leg-byes? (legal delivery in over):</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={extraCustomRuns}
                    onChange={(e) => setExtraCustomRuns(Number(e.target.value))}
                    className="w-full p-1.5 text-xs rounded border border-slate-200"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button onClick={() => setShowExtrasModal(false)} className="py-2 border border-slate-100 rounded-xl text-xs font-bold">
                Cancel
              </button>
              <button onClick={handleConfirmExtras} className="py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold">
                Log extras 🔵
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Override Score Modal Dialog */}
      {showManualEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-md font-bold text-slate-700 dark:text-neutral-200 flex items-center gap-1.5 uppercase">
              <Edit2 className="w-5 h-5 text-emerald-500" />
              <span>Manual Score Override</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-400">Total Runs</label>
                <input
                  type="number"
                  value={manualRuns}
                  onChange={(e) => setManualRuns(e.target.value)}
                  className="w-full p-2 border border-slate-200 dark:border-neutral-750 bg-slate-50 dark:bg-neutral-800 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-400">Total Wickets</label>
                <input
                  type="number"
                  value={manualWickets}
                  onChange={(e) => setManualWickets(e.target.value)}
                  className="w-full p-2 border border-slate-200 bg-slate-50 dark:bg-neutral-800 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-400">Completed Overs</label>
                <input
                  type="number"
                  value={manualOvers}
                  onChange={(e) => setManualOvers(e.target.value)}
                  className="w-full p-2 border border-slate-200 bg-slate-50 dark:bg-neutral-800 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-400">Balls in Current Over</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={manualBalls}
                  onChange={(e) => setManualBalls(e.target.value)}
                  className="w-full p-2 border border-slate-200 bg-slate-50 dark:bg-neutral-800 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 text-xs font-bold">
              <button onClick={() => setShowManualEditModal(false)} className="py-2 border rounded-xl">
                Cancel
              </button>
              <button onClick={handleSaveManualOverrides} className="py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-center">
                Submit Overrides
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exporter Dialog details */}
      {showExporter && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-md font-bold flex items-center gap-1.5 uppercase">
              <Share2 className="w-5 h-5 text-emerald-500" />
              <span>Copy Scorecard Summary</span>
            </h3>

            <textarea
              readOnly
              value={matchSummaryText}
              className="w-full h-40 p-3 bg-slate-50 dark:bg-neutral-800/80 rounded-xl text-xs font-mono border border-slate-100"
            />

            <div className="grid grid-cols-2 gap-3 text-xs font-bold">
              <button onClick={() => setShowExporter(false)} className="py-2 border rounded-xl">
                Close
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(matchSummaryText);
                  alert("Scorecard Summary copied to Clipboard! Post on WhatsApp!");
                }}
                className="py-2 bg-emerald-600 text-white rounded-xl text-center"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
