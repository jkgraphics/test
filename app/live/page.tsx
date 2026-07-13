"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Match, MatchInning, ExtraType, WicketType, Team } from "@/lib/types";
import LiveBroadcastPlayer from "@/components/live-broadcast-player";
import { 
  Trophy, 
  Tv, 
  Sparkles, 
  ArrowLeft, 
  Play, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Crown, 
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Flame,
  Award
} from "lucide-react";

// Suspense wrapper required for useSearchParams in Next.js App Router
export default function LivePage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white font-mono space-y-4">
        <Tv className="w-12 h-12 text-emerald-500 animate-pulse" />
        <p className="text-sm font-bold tracking-widest uppercase">Initializing Broadcaster Feed...</p>
      </div>
    }>
      <LivePageContent />
    </React.Suspense>
  );
}

function LivePageContent() {
  const searchParams = useSearchParams();
  const matchId = searchParams.get("matchId");

  // State
  const [match, setMatch] = useState<Match | null>(null);
  const [prevMatch, setPrevMatch] = useState<Match | null>(null);
  const [activeLiveBallEvent, setActiveLiveBallEvent] = useState<any>(null);
  const [scoreboardDesign, setScoreboardDesign] = useState<string>("broadcaster");
  const [activeMatchesList, setActiveMatchesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<number>(2000); // 2 seconds

  // Fetch match details
  const fetchMatchState = async () => {
    if (!matchId) {
      // Fetch all active live stream matches
      try {
        const res = await fetch("/api/live-stream");
        if (res.ok) {
          const data = await res.json();
          setActiveMatchesList(data.matches || []);
        }
      } catch (err) {
        console.warn("Error fetching active matches", err);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await fetch(`/api/live-stream?matchId=${matchId}`);
      if (res.ok) {
        const data = await res.json();
        setMatch(data.match);
        setError(null);
      } else {
        setError("Match stream not found. Make sure live streaming is toggled on inside the Scorer tab!");
      }
    } catch (err) {
      setError("Failed to connect to the live stream service.");
    } finally {
      setLoading(false);
    }
  };

  // Poll for updates
  useEffect(() => {
    fetchMatchState();
    const interval = setInterval(fetchMatchState, pollingInterval);
    return () => clearInterval(interval);
  }, [matchId, pollingInterval]);

  // Track state changes to trigger automated live broadcast animations
  useEffect(() => {
    if (!match) return;

    // First load setup
    if (!prevMatch || prevMatch.id !== match.id) {
      setPrevMatch(match);
      return;
    }

    const currentInning = match.innings[match.currentInningIndex];
    const prevInning = prevMatch.innings[prevMatch.currentInningIndex];

    if (!currentInning || !prevInning) {
      setPrevMatch(match);
      return;
    }

    const currentBallsCount = currentInning.ballRecords?.length || 0;
    const prevBallsCount = prevInning.ballRecords?.length || 0;

    // Detect if a new ball was bowled
    if (currentBallsCount > prevBallsCount) {
      const latestRecord = currentInning.ballRecords[currentBallsCount - 1];
      if (latestRecord) {
        const battingTeamName = currentInning.battingTeamId === match.teamAId ? match.teamAName : match.teamBName;
        const bowlingTeamName = currentInning.bowlingTeamId === match.teamAId ? match.teamAName : match.teamBName;

        const liveEvent = {
          id: latestRecord.ballId || `live_poll_${Date.now()}`,
          runsBat: latestRecord.runsBat,
          extraType: latestRecord.extraType,
          extraRuns: latestRecord.extraRuns,
          wicket: latestRecord.wicket,
          strikerName: latestRecord.striker || "Striker",
          bowlerName: latestRecord.bowler || "Bowler",
          battingTeamName,
          bowlingTeamName,
          runs: currentInning.runs,
          wickets: currentInning.wickets,
          overs: currentInning.overs,
          ballsInCurrentOver: currentInning.ballsInCurrentOver,
          oversAllowed: match.oversAllowed
        };

        setActiveLiveBallEvent(liveEvent);
      }
    }

    setPrevMatch(match);
  }, [match]);

  // Derived properties
  const activeInning = match?.innings[match.currentInningIndex];
  const battingTeamName = activeInning?.battingTeamId === match?.teamAId ? match?.teamAName : match?.teamBName;
  const bowlingTeamName = activeInning?.bowlingTeamId === match?.teamAId ? match?.teamAName : match?.teamBName;

  const totalBallsPlayed = activeInning ? activeInning.overs * 6 + activeInning.ballsInCurrentOver : 0;
  const computedCRR = activeInning && totalBallsPlayed > 0 ? ((activeInning.runs / totalBallsPlayed) * 6).toFixed(2) : "0.00";
  
  const computedRemainingBalls = activeInning && match ? (match.oversAllowed * 6) - totalBallsPlayed : 0;
  const firstInningsRuns = match?.innings?.[0]?.runs ?? 0;
  const computedRunsNeeded = activeInning && match ? (firstInningsRuns + 1) - activeInning.runs : 0;
  const computedRRR = activeInning && match && computedRemainingBalls > 0 ? Math.max(0, (computedRunsNeeded / computedRemainingBalls) * 6).toFixed(2) : "0.00";

  // Get active batsman stats
  const currentStrikerStats = useMemo(() => {
    if (!activeInning || !match?.currentStriker) return null;
    return activeInning.batsmen[match.currentStriker];
  }, [activeInning, match?.currentStriker]);

  const currentNonStrikerStats = useMemo(() => {
    if (!activeInning || !match?.currentNonStriker) return null;
    return activeInning.batsmen[match.currentNonStriker];
  }, [activeInning, match?.currentNonStriker]);

  const currentBowlerStats = useMemo(() => {
    if (!activeInning || !match?.currentBowler) return null;
    return activeInning.bowlers[match.currentBowler];
  }, [activeInning, match?.currentBowler]);

  // Lobby view if no matchId
  if (!matchId) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
        {/* Header */}
        <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-10 py-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-700/20">
              <Tv className="w-5 h-5 fill-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
                Gully<span className="text-emerald-500">Score</span> Live TV
              </h1>
              <p className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-widest">Broadcaster Hub</p>
            </div>
          </div>
          <button 
            onClick={() => window.location.href = "/"}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 font-bold text-xs rounded-xl transition flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go to Scorer</span>
          </button>
        </header>

        {/* Content */}
        <main className="max-w-4xl mx-auto px-6 py-12 flex-1 w-full space-y-8">
          <div className="text-center space-y-2 max-w-lg mx-auto">
            <h2 className="text-2xl font-extrabold tracking-tight">Active Broadcaster Streams</h2>
            <p className="text-sm text-neutral-400">
              Discover ongoing matches being scored live on GullyScore and launch a virtual television stream layout on this screen!
            </p>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm font-mono text-neutral-500 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
              <span>Scanning channels...</span>
            </div>
          ) : activeMatchesList.length === 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-12 text-center space-y-4 max-w-md mx-auto">
              <div className="w-12 h-12 bg-neutral-800 text-neutral-500 rounded-full flex items-center justify-center mx-auto">
                <Tv className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-md text-white">No active matches found</h4>
                <p className="text-xs text-neutral-400">
                  Ensure you have an ongoing match configured inside the Scorer panel, and the &quot;Live Stream&quot; indicator is active.
                </p>
              </div>
              <button 
                onClick={() => window.location.href = "/"}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow"
              >
                Go Start a Match
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeMatchesList.map((m) => (
                <div 
                  key={m.id}
                  onClick={() => window.location.href = `/live?matchId=${m.id}`}
                  className="bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 rounded-2xl p-5 cursor-pointer transition-all duration-300 group flex flex-col justify-between space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-0.5 bg-emerald-950/40 text-emerald-400 text-[9px] font-black uppercase tracking-widest border border-emerald-900/30 rounded-lg flex items-center gap-1.5 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>IN PLAY</span>
                    </span>
                    <span className="text-[10px] font-mono text-neutral-500">Feed ID: {m.id}</span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-lg font-black text-white group-hover:text-emerald-400 transition-colors">
                      {m.teamAName} <span className="text-xs text-neutral-500">vs</span> {m.teamBName}
                    </h4>
                    <p className="text-xs text-neutral-400">
                      Overs Allowed: {m.oversAllowed} Overs • Status: {m.status}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-neutral-800/80">
                    <div className="text-xs font-mono font-bold text-neutral-400">
                      Score: {m.innings?.[m.currentInningIndex]?.runs ?? 0}/{m.innings?.[m.currentInningIndex]?.wickets ?? 0}
                    </div>
                    <span className="text-xs font-bold text-emerald-500 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      <span>Watch Stream</span>
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // Active Stream Screen
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans select-none">
      {/* Top Banner Broadcaster Controls */}
      <header className="border-b border-neutral-900 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-30 py-3 px-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.location.href = "/live"}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition"
            title="Lobby"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <h1 className="text-sm font-black uppercase tracking-wider text-neutral-200">
              GULLYSCORE TV FEED: {battingTeamName || "LIVE"} vs {bowlingTeamName || "OPPONENT"}
            </h1>
          </div>
        </div>

        {/* Scoreboard theme chooser directly in the popout live window */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-neutral-400 font-mono">Overlay Theme:</span>
          <select
            value={scoreboardDesign}
            onChange={(e) => setScoreboardDesign(e.target.value)}
            className="px-2.5 py-1 text-xs bg-neutral-900 border border-neutral-800 rounded-lg font-bold text-emerald-400 focus:outline-none"
          >
            <option value="default">Cricbuzz Glow</option>
            <option value="broadcaster">TV Broadcaster</option>
            <option value="neon">Cyberpunk Neon</option>
            <option value="minimalist">OLED Minimal</option>
            <option value="retro">8-Bit Arcade</option>
            <option value="royal">Royal Gold</option>
          </select>

          <button
            onClick={fetchMatchState}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition text-neutral-300"
            title="Force refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main split-screen display */}
      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-sm font-bold text-red-400">{error}</p>
          <button 
            onClick={() => window.location.href = "/"}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs rounded-xl transition"
          >
            Go Back to Scorer
          </button>
        </div>
      ) : !match || !activeInning ? (
        <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 font-mono gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
          <span>Syncing Match Broadcast Stream...</span>
        </div>
      ) : (
        <div className="flex-1 p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto w-full">
          {/* Left panel (col-span-2): Animated Live Video Feed */}
          <div className="lg:col-span-2 space-y-4 flex flex-col justify-between">
            <div className="bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl flex-1 flex flex-col">
              <div className="bg-neutral-950 px-4 py-2 border-b border-neutral-800 flex justify-between items-center text-xs">
                <span className="font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                  <span>FEED LIVE ON CHANNEL 01</span>
                </span>
                <span className="text-[10px] font-mono text-neutral-500">POLLING DELAY: {pollingInterval}ms</span>
              </div>
              <div className="flex-1 bg-black relative flex items-center justify-center min-h-[400px] lg:min-h-[480px]">
                <LiveBroadcastPlayer
                  activeBallEvent={activeLiveBallEvent}
                  autoPlay={true}
                />
              </div>
            </div>

            {/* Innings details, Partnership and Fall of Wickets */}
            <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-neutral-500 font-bold block uppercase text-[10px]">Active Partnership</span>
                <p className="text-white font-bold">
                  {match.currentStriker && match.currentNonStriker 
                    ? `${match.currentStriker} & ${match.currentNonStriker}` 
                    : "No partnership established"
                  }
                </p>
                <p className="text-neutral-400 text-[10px]">
                  Total batting partnership in progress
                </p>
              </div>

              <div className="space-y-1 sm:border-l sm:border-neutral-800 sm:pl-4">
                <span className="text-neutral-500 font-bold block uppercase text-[10px]">Current Over Bowler</span>
                <p className="text-white font-bold flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-purple-400" />
                  <span>{match.currentBowler || "Awaiting Bowler"}</span>
                </p>
                {currentBowlerStats && (
                  <p className="text-neutral-400 text-[10px] font-mono">
                    Wkts: {currentBowlerStats.wickets} | Runs Conceded: {currentBowlerStats.runs}
                  </p>
                )}
              </div>

              <div className="space-y-1 sm:border-l sm:border-neutral-800 sm:pl-4">
                <span className="text-neutral-500 font-bold block uppercase text-[10px]">Last Wicket Dismissed</span>
                <p className="text-white font-bold flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
                  <span>
                    {activeInning.fallOfWickets.length > 0 
                      ? activeInning.fallOfWickets[activeInning.fallOfWickets.length - 1].batsmanName
                      : "No wickets fallen"
                    }
                  </span>
                </p>
                {activeInning.fallOfWickets.length > 0 && (
                  <p className="text-neutral-400 text-[10px] font-mono">
                    FOW: {activeInning.fallOfWickets[activeInning.fallOfWickets.length - 1].wickets}-{activeInning.fallOfWickets[activeInning.fallOfWickets.length - 1].runs}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right panel: Gorgeous Custom Live Scoreboard Viewports */}
          <div className="space-y-4">
            
            {/* Scoreboard styles selection rendering */}
            {scoreboardDesign === "default" && (
              <div className="bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 border border-neutral-800 text-white rounded-2xl p-5 shadow-lg space-y-4 relative overflow-hidden">
                <div className="absolute right-2 top-2">
                  <span className="inline-flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-red-400"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                </div>

                <div className="text-xs uppercase tracking-wider font-mono font-bold bg-neutral-800 px-2 py-0.5 rounded text-emerald-400 inline-block">
                  {match.status === "Chasing" ? "Innings 2 (Chasing)" : "Innings 1"}
                </div>

                <div className="flex justify-between items-center mt-2">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight">{battingTeamName}</h3>
                    <p className="text-[10px] text-slate-400">vs {bowlingTeamName}</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-4xl font-extrabold text-emerald-400 font-sans tracking-tight">
                      {activeInning.runs}/{activeInning.wickets}
                    </h2>
                    <p className="text-xs opacity-80 font-mono mt-1">
                      Overs: {activeInning.overs}.{activeInning.ballsInCurrentOver} / {match.oversAllowed}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 border-t border-neutral-800/80 pt-3 flex-wrap text-xs font-medium text-slate-300 items-center">
                  <div>CRR: <span className="text-white font-bold">{computedCRR}</span></div>
                  {match.status === "Chasing" && (
                    <div>RRR: <span className="text-emerald-400 font-extrabold">{computedRRR}</span></div>
                  )}
                  <div>Extras: <span className="text-white font-bold">{activeInning.extras.total}</span></div>
                </div>

                {match.status === "Chasing" && (
                  <div className="p-3 bg-neutral-800/40 rounded-xl text-xs space-y-1.5 border border-neutral-800 text-center text-emerald-300">
                    <p className="font-semibold text-white">Target: {firstInningsRuns + 1} runs</p>
                    <p>Need <span className="font-bold text-emerald-400">{computedRunsNeeded}</span> runs from <span className="font-bold text-emerald-400">{computedRemainingBalls}</span> balls.</p>
                  </div>
                )}

                <div className="flex items-center gap-1.5 flex-wrap border-t border-neutral-800/50 pt-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Over:</span>
                  {activeInning.currentOverBalls.length === 0 ? (
                    <span className="text-[10px] italic text-neutral-500">First delivery...</span>
                  ) : (
                    activeInning.currentOverBalls.map((label, idx) => (
                      <span
                        key={idx}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                          label.includes("W")
                            ? "bg-red-600 text-white shadow"
                            : label === "4" || label === "6"
                            ? "bg-emerald-600 text-white"
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

            {scoreboardDesign === "broadcaster" && (
              <div className="bg-slate-900 border-b-4 border-emerald-500 text-white rounded-2xl p-5 shadow-xl space-y-4 relative overflow-hidden font-sans">
                <div className="absolute top-0 left-0 right-0 h-[50%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
                
                <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-red-600 text-white text-[9px] px-2 py-0.5 rounded font-extrabold uppercase animate-pulse flex items-center gap-1 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                      <span>LIVE BROADCAST</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest bg-yellow-950/30 px-2 py-0.5 rounded border border-yellow-900/30 font-mono">
                    {match.status === "Chasing" ? "2nd Inning" : "1st Inning"}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">NOW BATTING</span>
                  <h3 className="text-2xl font-black text-slate-100 tracking-tight leading-tight uppercase">
                    {battingTeamName}
                  </h3>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex justify-between items-center shadow-inner">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Score</span>
                    <h2 className="text-3xl font-extrabold text-emerald-400 tracking-tight font-mono">
                      {activeInning.runs} <span className="text-slate-450 text-xl">/</span> {activeInning.wickets}
                    </h2>
                  </div>
                  <div className="text-right border-l border-slate-800 pl-4">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Overs</span>
                    <p className="text-xl font-bold font-mono text-slate-100">
                      {activeInning.overs}.{activeInning.ballsInCurrentOver}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800/80 text-xs font-mono">
                  <div className="text-center">
                    <span className="text-slate-550 block text-[9px] uppercase font-bold">CRR</span>
                    <span className="font-extrabold text-slate-200">{computedCRR}</span>
                  </div>
                  <div className="text-center border-x border-slate-800">
                    <span className="text-slate-550 block text-[9px] uppercase font-bold">EXTRAS</span>
                    <span className="font-extrabold text-yellow-400">{activeInning.extras.total}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-slate-550 block text-[9px] uppercase font-bold">
                      {match.status === "Chasing" ? "REQ RR" : "PROJ"}
                    </span>
                    <span className="font-extrabold text-emerald-400">
                      {match.status === "Chasing" ? computedRRR : (parseFloat(computedCRR) * match.oversAllowed).toFixed(0)}
                    </span>
                  </div>
                </div>

                {match.status === "Chasing" && (
                  <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 text-center space-y-1 text-xs">
                    <p className="font-bold text-slate-300">Target: {firstInningsRuns + 1} Runs</p>
                    <p className="text-emerald-400 font-bold">Need {computedRunsNeeded} runs from {computedRemainingBalls} balls</p>
                  </div>
                )}
              </div>
            )}

            {scoreboardDesign === "neon" && (
              <div className="bg-[#080315] border-2 border-fuchsia-500 text-cyan-400 rounded-2xl p-5 shadow-[0_0_20px_rgba(217,70,239,0.25)] space-y-4 relative overflow-hidden font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] tracking-widest font-bold uppercase text-cyan-400 animate-pulse">
                    [ STREAM_ACTIVE ]
                  </span>
                  <span className="text-[9px] text-fuchsia-400">CYBER_CRIC</span>
                </div>

                <div className="border border-cyan-900/50 bg-[#0d0722] p-4 rounded-xl space-y-3">
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-semibold">[BATTING_COGNITIVE]</span>
                    <h3 className="text-xl font-bold tracking-tight text-white">{battingTeamName}</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-cyan-950 pt-3">
                    <div>
                      <span className="text-[9px] text-cyan-500 uppercase font-bold">TOTAL_SCORE</span>
                      <div className="text-4xl font-extrabold text-fuchsia-500">
                        {activeInning.runs}<span className="text-cyan-450 text-2xl">/</span>{activeInning.wickets}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-cyan-500 uppercase font-bold">CYCLE_OVERS</span>
                      <div className="text-3xl font-bold text-cyan-300">
                        {activeInning.overs}.{activeInning.ballsInCurrentOver}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-[#0b051c] border border-cyan-950 p-2 rounded-lg">
                    <span className="text-[8px] text-slate-500 block">CRR_FLOW</span>
                    <span className="text-cyan-400 font-extrabold">{computedCRR}</span>
                  </div>
                  <div className="bg-[#0b051c] border border-cyan-950 p-2 rounded-lg">
                    <span className="text-[8px] text-slate-500 block">SYS_EXT</span>
                    <span className="text-fuchsia-400 font-bold">{activeInning.extras.total}</span>
                  </div>
                  <div className="bg-[#0b051c] border border-cyan-950 p-2 rounded-lg">
                    <span className="text-[8px] text-slate-500 block">REQ_VELOCITY</span>
                    <span className="text-emerald-400 font-extrabold">
                      {match.status === "Chasing" ? computedRRR : (parseFloat(computedCRR) * match.oversAllowed).toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {scoreboardDesign === "minimalist" && (
              <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-neutral-100 rounded-2xl p-6 shadow space-y-5 font-sans">
                <div className="flex justify-between items-center text-xs tracking-tight text-slate-400 border-b border-slate-100 dark:border-neutral-900 pb-2">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">LIVE SCORE INDICATOR</span>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-slate-400 uppercase font-medium tracking-widest font-mono">BATTING</span>
                  <h3 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {battingTeamName}
                  </h3>
                </div>

                <div className="flex justify-between items-center py-4 border-y border-slate-150 dark:border-neutral-900">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">SCORE</span>
                    <div className="text-5xl font-light tracking-tighter text-slate-900 dark:text-white flex items-baseline">
                      <span>{activeInning.runs}</span>
                      <span className="text-slate-300 dark:text-neutral-700 mx-2 font-thin">/</span>
                      <span className="text-slate-500 font-normal text-3xl">{activeInning.wickets}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">OVERS</span>
                    <p className="text-3xl font-semibold text-slate-800 dark:text-neutral-200 font-mono">
                      {activeInning.overs}.{activeInning.ballsInCurrentOver}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">Current Run Rate</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{computedCRR}</span>
                  </div>
                  {match.status === "Chasing" && (
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 block uppercase">Required Rate</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{computedRRR}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {scoreboardDesign === "retro" && (
              <div className="bg-neutral-950 border-4 border-dashed border-amber-500 text-amber-400 rounded-2xl p-5 shadow-[inset_0_0_15px_rgba(245,158,11,0.2)] space-y-4 relative overflow-hidden font-mono select-none">
                <div className="flex justify-between items-center border-b-2 border-amber-500/30 pb-2">
                  <span className="text-[10px] uppercase animate-pulse">** TV FEED STREAM ACTIVE **</span>
                </div>

                <div className="text-center space-y-1">
                  <p className="text-[10px] text-yellow-500 font-bold uppercase">[ BATTING TEAM ]</p>
                  <h3 className="text-xl font-extrabold uppercase text-white tracking-widest border-2 border-dashed border-amber-800 p-2 rounded-lg bg-neutral-900">
                    {battingTeamName}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4 py-3 bg-black/60 rounded-xl border border-amber-500/25 p-3">
                  <div>
                    <span className="text-[9px] text-amber-500 uppercase block">== RUNS/WKTS ==</span>
                    <div className="text-4xl font-bold font-mono tracking-wider text-amber-300">
                      {activeInning.runs.toString().padStart(3, "0")}-{activeInning.wickets}
                    </div>
                  </div>
                  <div className="text-right border-l border-amber-900/40 pl-4">
                    <span className="text-[9px] text-amber-500 uppercase block">== OVERS ==</span>
                    <div className="text-3xl font-bold font-mono tracking-wider text-amber-300">
                      {activeInning.overs}.{activeInning.ballsInCurrentOver}
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
                    <span className="text-[8px] text-yellow-600 block">TARGET</span>
                    <span className="font-bold text-yellow-300">
                      {match.status === "Chasing" ? firstInningsRuns + 1 : "-"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {scoreboardDesign === "royal" && (
              <div className="bg-gradient-to-br from-[#11241a] via-[#09140f] to-[#132c20] border-2 border-amber-400 text-amber-100 rounded-2xl p-5 shadow-2xl space-y-4 relative overflow-hidden font-serif">
                <div className="flex justify-between items-center border-b border-amber-400/30 pb-2.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-400 animate-bounce" />
                    <span className="uppercase font-bold tracking-widest text-[9px] text-amber-400 font-sans">
                      ROYAL LIVE OVERLAY
                    </span>
                  </div>
                </div>

                <div className="text-center space-y-1 py-1">
                  <p className="text-[10px] text-amber-400/70 uppercase tracking-widest font-sans font-bold">CURRENT TEAM BATTING</p>
                  <h3 className="text-2xl font-bold tracking-wide text-amber-200 uppercase">
                    {battingTeamName}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-y border-amber-400/30 text-center">
                  <div className="space-y-1">
                    <span className="text-[10px] text-amber-400/60 uppercase tracking-wider font-sans font-bold block">TOTAL RECORD</span>
                    <div className="text-4xl font-extrabold text-amber-300 tracking-tight font-sans">
                      {activeInning.runs} <span className="text-amber-500 font-light text-2xl">/</span> {activeInning.wickets}
                    </div>
                  </div>
                  <div className="space-y-1 border-l border-amber-400/20">
                    <span className="text-[10px] text-amber-400/60 uppercase tracking-wider font-sans font-bold block">OVERS COMPLETED</span>
                    <div className="text-4xl font-extrabold text-amber-300 tracking-tight font-sans font-mono">
                      {activeInning.overs}.{activeInning.ballsInCurrentOver}
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
                    <span className="text-[8px] text-amber-400/60 block uppercase font-bold">REQ RATE</span>
                    <span className="font-bold text-amber-300">
                      {match.status === "Chasing" ? computedRRR : "-"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Current Batsmen Stats Grid */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase text-neutral-400 tracking-wider">Batting Unit</h4>
              
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-xs text-neutral-400 border-b border-neutral-800 pb-1 font-semibold">
                  <span>Batsman</span>
                  <span className="font-mono">R (B)</span>
                </div>

                {match.currentStriker ? (
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="text-emerald-500">🏏</span> {match.currentStriker}*
                    </span>
                    <span className="font-mono font-extrabold text-white">
                      {currentStrikerStats ? `${currentStrikerStats.runs} (${currentStrikerStats.balls})` : "0 (0)"}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-500 italic">No batsman on strike</div>
                )}

                {match.currentNonStriker ? (
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-neutral-300 pl-4">
                      {match.currentNonStriker}
                    </span>
                    <span className="font-mono text-neutral-450">
                      {currentNonStrikerStats ? `${currentNonStrikerStats.runs} (${currentNonStrikerStats.balls})` : "0 (0)"}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-500 italic">No batsman at non-strike</div>
                )}
              </div>
            </div>

            {/* Live Ticker Commentary Tape */}
            {activeInning.ballRecords && activeInning.ballRecords.length > 0 && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-2.5">
                <h4 className="text-xs font-bold uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                  <Sparkles className="text-emerald-500 w-3.5 h-3.5 animate-pulse" />
                  <span>Ball-by-Ball Live Commentary</span>
                </h4>
                
                <div className="bg-black/40 border border-neutral-800 p-3 rounded-xl max-h-32 overflow-y-auto space-y-2 text-xs">
                  {activeInning.ballRecords.slice(-3).reverse().map((rec, index) => (
                    <div key={rec.ballId || index} className="space-y-0.5 border-b border-neutral-850/60 pb-2 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/20 px-1.5 py-0.5 rounded">
                          Over {rec.overNumber}.{rec.ballInOver}
                        </span>
                        <span className="font-mono font-extrabold text-white bg-neutral-800 px-1 rounded text-[10px]">
                          {rec.runsTotal} Runs {rec.wicket ? "• WICKET" : ""}
                        </span>
                      </div>
                      <p className="text-neutral-300 text-[11px] leading-relaxed italic">
                        {rec.commentary || `${rec.bowler} to ${rec.striker}, scored ${rec.runsTotal} runs.`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
