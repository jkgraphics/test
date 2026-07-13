"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  Tv,
  Video,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Sparkles,
  RefreshCw,
  Sliders,
  ChevronDown,
  Info,
  Layers,
  Flame,
  Award
} from "lucide-react";
import { ExtraType, WicketType } from "@/lib/types";

interface LiveBallEvent {
  id: string;
  runsBat: number;
  extraType: ExtraType;
  extraRuns: number;
  wicket?: { type: WicketType; playerOut: string; fielder?: string };
  strikerName: string;
  bowlerName: string;
  battingTeamName: string;
  bowlingTeamName: string;
  runs: number;
  wickets: number;
  overs: number;
  ballsInCurrentOver: number;
  oversAllowed: number;
}

interface LiveBroadcastPlayerProps {
  activeBallEvent: LiveBallEvent | null;
  autoPlay: boolean;
}

let mockCounter = 0;
function createMockHighlightEvent(highlightType: "6" | "4" | "wicket" | "dot" | "wide"): LiveBallEvent {
  mockCounter++;
  return {
    id: `mock_${mockCounter}`,
    runsBat: highlightType === "6" ? 6 : highlightType === "4" ? 4 : 0,
    extraType: highlightType === "wide" ? "Wd" : "None",
    extraRuns: highlightType === "wide" ? 1 : 0,
    wicket: highlightType === "wicket" ? { type: "Bowled", playerOut: "Dhoni" } : undefined,
    strikerName: "Dhoni",
    bowlerName: "Malinga",
    battingTeamName: "Royal Striker",
    bowlingTeamName: "Fire Bowler",
    runs: 114,
    wickets: 3,
    overs: 12,
    ballsInCurrentOver: 4,
    oversAllowed: 20
  };
}

export default function LiveBroadcastPlayer({ activeBallEvent, autoPlay }: LiveBroadcastPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Player control states
  const [isPlaying, setIsPlaying] = useState(true);
  const [quality, setQuality] = useState<"1080p" | "720p" | "360p">("1080p");
  const [activeCamera, setActiveCamera] = useState<"Wicket-to-Wicket" | "Spidercam" | "Batsman View" | "Skycam">("Wicket-to-Wicket");
  const [isMuted, setIsMuted] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showStatsOverlay, setShowStatsOverlay] = useState(true);
  
  // Animation play states
  const [playbackState, setPlaybackState] = useState<"idle" | "runup" | "delivery" | "hit" | "replay" | "celebration">("idle");
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<"1.0x" | "0.5x" | "0.25x">("0.5x");
  const [videoProgress, setVideoProgress] = useState(100);
  const [streamDuration, setStreamDuration] = useState("02:14:45");
  
  // Current playback event details
  const [currentEvent, setCurrentEvent] = useState<LiveBallEvent | null>(null);
  const [commentaryText, setCommentaryText] = useState("Stadium Atmosphere is Electrifying! Awaiting bowler run-up...");
  const [fps, setFps] = useState(60);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sound Visualizer Bars state simulation
  const [visualizerBars, setVisualizerBars] = useState<number[]>(Array.from({ length: 15 }, () => 10));

  // Initiate delivery animation sequence (hoisted standard functions)
  function startDeliveryAnimation(event: LiveBallEvent) {
    setCurrentEvent(event);
    setPlaybackState("runup");
    setIsReplayMode(false);
    setVideoProgress(15);
    setCommentaryText(`${event.bowlerName} walks to his mark...`);

    // Timeline phases
    // Run up: 1.5s
    setTimeout(() => {
      setPlaybackState("delivery");
      setVideoProgress(45);
      setCommentaryText(`${event.bowlerName} charges in and delivers the ball...`);
    }, 1500);

    // Delivery to Hit: 1.2s
    setTimeout(() => {
      setPlaybackState("hit");
      setVideoProgress(75);
      updateCommentary(event);
    }, 2700);

    // Hit to Replay/Celebration: 2.5s
    setTimeout(() => {
      if (event.runsBat === 4 || event.runsBat === 6 || event.wicket) {
        setIsReplayMode(true);
        setPlaybackState("replay");
        setVideoProgress(85);
        setCommentaryText(`[TV SLOW-MOTION REPLAY]: Outstanding execution!`);
      } else {
        setPlaybackState("celebration");
        setVideoProgress(95);
      }
    }, 5200);

    // Finish back to idle: 3.5s
    setTimeout(() => {
      setPlaybackState("idle");
      setIsReplayMode(false);
      setVideoProgress(100);
    }, 8700);
  }

  function updateCommentary(event: LiveBallEvent) {
    let text = "";
    const name = event.strikerName || "Batsman";
    const bowler = event.bowlerName || "Bowler";

    if (event.wicket) {
      const type = event.wicket.type;
      if (type === "Bowled") {
        text = `💥 GONE! BOWLED HIM! Stumps shattered by a blistering delivery from ${bowler}. ${name} departs!`;
      } else if (type === "Caught") {
        text = `🏏 OUT! Caught in the deep! ${name} lofts it high, but ${event.wicket.fielder || "the fielder"} makes no mistake. Clean catch!`;
      } else if (type === "Run Out") {
        text = `⚡ RUN OUT! Direct hit! An absolute scramble between wickets and ${name} is caught short of the crease. Brilliant fielding!`;
      } else if (type === "LBW") {
        text = `🔴 OUT! Plumb LBW! Shouts from ${bowler} and the finger goes straight up. Huge wicket!`;
      } else {
        text = `❌ OUT! ${name} dismissed by ${bowler} via ${type}!`;
      }
    } else if (event.extraType === "Wd") {
      text = `💨 Wide Ball! Bowled down leg side by ${bowler}. Free run granted to ${event.battingTeamName}.`;
    } else if (event.extraType === "Nb") {
      text = `⚠️ No Ball! Over-stepped by ${bowler}. Next delivery is a FREE HIT!`;
    } else {
      if (event.runsBat === 6) {
        text = `🚀 OUT OF THE PARK! That is massive! ${name} launches ${bowler} clean over the stadium roof for SIX!`;
      } else if (event.runsBat === 4) {
        text = `🔥 BEAUTIFULLY PLAYED! ${name} punches it past extra-cover, beats the fielder and rattles the boundary boards for FOUR!`;
      } else if (event.runsBat === 2 || event.runsBat === 3) {
        text = `🏃 Excellent running! ${name} drops it into the gap and races back to secure a comfortable ${event.runsBat} runs.`;
      } else if (event.runsBat === 1) {
        text = `🏏 Played to long-on for a quick single, bringing the non-striker onto strike.`;
      } else {
        text = `🛡️ Dot ball. ${name} defends it solidly down the pitch. Excellent line and length from ${bowler}.`;
      }
    }
    setCommentaryText(text);
  }

  // Handle incoming new ball events
  useEffect(() => {
    if (activeBallEvent && activeBallEvent.id !== currentEvent?.id) {
      const timer = setTimeout(() => {
        setCurrentEvent(activeBallEvent);
        if (autoPlay && isPlaying) {
          startDeliveryAnimation(activeBallEvent);
        } else {
          // Just update scoreboard info
          updateCommentary(activeBallEvent);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBallEvent, autoPlay, isPlaying, currentEvent?.id]);

  // Simulate stream clock and sound visualizer
  useEffect(() => {
    const clockInterval = setInterval(() => {
      // Stream duration tick
      setStreamDuration((prev) => {
        const parts = prev.split(":").map(Number);
        parts[2]++;
        if (parts[2] >= 60) {
          parts[2] = 0;
          parts[1]++;
        }
        if (parts[1] >= 60) {
          parts[1] = 0;
          parts[0]++;
        }
        return parts.map((x) => String(x).padStart(2, "0")).join(":");
      });

      // Frame rates variance simulation
      setFps(() => Math.floor(58 + Math.random() * 3));
    }, 1000);

    const visualizerInterval = setInterval(() => {
      if (isPlaying) {
        setVisualizerBars(() =>
          Array.from({ length: 15 }, () => {
            const base = isMuted ? 4 : (playbackState === "hit" ? 28 : playbackState === "delivery" ? 18 : 8);
            return Math.max(4, Math.floor(base + Math.random() * 15));
          })
        );
      } else {
        setVisualizerBars(Array.from({ length: 15 }, () => 4));
      }
    }, 120);

    return () => {
      clearInterval(clockInterval);
      clearInterval(visualizerInterval);
    };
  }, [isPlaying, isMuted, playbackState]);

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let tickCount = 0;

    // Simulation particle pool
    const particles: Array<{ x: number; y: number; vx: number; vy: number; color: string; size: number; alpha: number }> = [];

    const draw = () => {
      if (!canvas || !ctx) return;
      tickCount++;

      const width = canvas.width;
      const height = canvas.height;

      // Quality rendering scaling adjustments
      if (quality === "1080p") {
        if (canvas.width !== 640) {
          canvas.width = 640;
          canvas.height = 360;
        }
      } else if (quality === "720p") {
        if (canvas.width !== 480) {
          canvas.width = 480;
          canvas.height = 270;
        }
      } else {
        if (canvas.width !== 320) {
          canvas.width = 320;
          canvas.height = 180;
        }
      }

      // Draw beautiful stadium backgrounds
      ctx.clearRect(0, 0, width, height);

      // Render sky backdrop (day/night depending on camera)
      const gradBg = ctx.createLinearGradient(0, 0, 0, height);
      gradBg.addColorStop(0, "#0c192c"); // Dark cosmic blue night stadium sky
      gradBg.addColorStop(0.6, "#1a365d");
      gradBg.addColorStop(1, "#122a45");
      ctx.fillStyle = gradBg;
      ctx.fillRect(0, 0, width, height);

      // Draw stadium floodlights (beaming down)
      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.beginPath();
      ctx.moveTo(30, 10);
      ctx.lineTo(150, height);
      ctx.lineTo(250, height);
      ctx.moveTo(width - 30, 10);
      ctx.lineTo(width - 150, height);
      ctx.lineTo(width - 250, height);
      ctx.fill();
      ctx.restore();

      // Floodlight clusters
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "#fff";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(30, 10, 8, 0, Math.PI * 2);
      ctx.arc(width - 30, 10, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0; // reset

      // Draw circular boundary field
      const centerX = width / 2;
      const centerY = height / 2 + 10;
      const radiusX = width * 0.42;
      const radiusY = height * 0.35;

      ctx.fillStyle = "#1e4d2b"; // Green lush grass outfield
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.fill();

      // Striated lawn mowed stripes
      ctx.fillStyle = "#154220";
      for (let i = -6; i <= 6; i += 2) {
        ctx.beginPath();
        ctx.ellipse(centerX + i * 25, centerY, radiusX * 0.12, radiusY * 0.98, 0.02, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw boundary line rope
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX - 8, radiusY - 6, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Boundary advertisement hoardings (little visual blocks)
      ctx.fillStyle = "#f59e0b"; // Golden sponsors
      ctx.fillRect(centerX - 100, centerY - radiusY - 3, 40, 4);
      ctx.fillStyle = "#10b981";
      ctx.fillRect(centerX + 60, centerY - radiusY - 3, 40, 4);
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(centerX - 40, centerY + radiusY - 1, 50, 4);

      // Pitch strip coordinates (center of stadium)
      const pitchWidth = width * 0.28;
      const pitchHeight = height * 0.12;
      const pitchX = centerX - pitchWidth / 2;
      const pitchY = centerY - pitchHeight / 2;

      ctx.fillStyle = "#eab308"; // Straw clay cricket pitch color
      ctx.fillRect(pitchX, pitchY, pitchWidth, pitchHeight);

      // Crease markings (white chalk lines)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 1;
      // Left crease (bowler end)
      ctx.beginPath();
      ctx.moveTo(pitchX + 15, pitchY);
      ctx.lineTo(pitchX + 15, pitchY + pitchHeight);
      // Right crease (batsman end)
      ctx.moveTo(pitchX + pitchWidth - 15, pitchY);
      ctx.lineTo(pitchX + pitchWidth - 15, pitchY + pitchHeight);
      ctx.stroke();

      // Draw Stumps (Wickets)
      const drawStumps = (x: number) => {
        ctx.fillStyle = "#facc15"; // Wooden yellow wickets
        ctx.strokeStyle = "#854d0e";
        ctx.lineWidth = 1;
        
        // 3 stumps
        for (let i = -1; i <= 1; i++) {
          const sy = pitchY + pitchHeight / 2 + i * 4;
          ctx.fillRect(x, sy - 1, 3, 2);
          ctx.strokeRect(x, sy - 1, 3, 2);
        }

        // Bails
        ctx.fillStyle = "#9a3412";
        ctx.fillRect(x + 1, pitchY + pitchHeight / 2 - 5, 1, 10);
      };

      // Draw stumps at both ends
      const stumpsLeftX = pitchX + 6;
      const stumpsRightX = pitchX + pitchWidth - 6;
      drawStumps(stumpsLeftX);
      drawStumps(stumpsRightX);

      // ANIMATION SEQUENCING DATA MAPPING
      // Set default player coordinates
      let bowlerX = pitchX - 25;
      let bowlerY = pitchY + pitchHeight / 2;
      
      let strikerX = pitchX + pitchWidth - 16;
      let strikerY = pitchY + pitchHeight / 2 - 5;
      let strikerSwing = 0; // Rotational swing

      let ballX = pitchX + 12;
      let ballY = pitchY + pitchHeight / 2;
      let drawBall = false;

      const runs = currentEvent?.runsBat ?? 0;
      const isOut = !!currentEvent?.wicket;

      // Handle custom camera views mapping coordinates
      if (activeCamera === "Batsman View") {
        // Looking from behind the stumps at batsman end
        // Let's draw a zoomed in batsman perspective
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(0, 0, width, height);

        // Ground perspective zoom
        ctx.fillStyle = "#1e4d2b";
        ctx.beginPath();
        ctx.moveTo(centerX - 100, height);
        ctx.lineTo(centerX - 40, height - 120);
        ctx.lineTo(centerX + 40, height - 120);
        ctx.lineTo(centerX + 100, height);
        ctx.fill();

        ctx.fillStyle = "#eab308"; // pitch strip
        ctx.beginPath();
        ctx.moveTo(centerX - 35, height);
        ctx.lineTo(centerX - 12, height - 110);
        ctx.lineTo(centerX + 12, height - 110);
        ctx.lineTo(centerX + 35, height);
        ctx.fill();

        // Left crease line
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(centerX - 30, height - 30);
        ctx.lineTo(centerX + 30, height - 30);
        ctx.stroke();

        // Right stumps zoom
        ctx.fillStyle = "#facc15";
        ctx.fillRect(centerX - 6, height - 85, 3, 20);
        ctx.fillRect(centerX, height - 85, 3, 20);
        ctx.fillRect(centerX + 6, height - 85, 3, 20);
        ctx.fillStyle = "#9a3412";
        ctx.fillRect(centerX - 8, height - 88, 18, 4);

        // Adjust coordinates
        strikerX = centerX + 18;
        strikerY = height - 60;
        bowlerX = centerX;
        bowlerY = height - 110;
        ballX = centerX;
        ballY = height - 105;
      }

      // STATE SPECIFIC LOGIC
      if (playbackState === "runup") {
        // Bowler running in towards the crease
        const progress = (tickCount % 90) / 90;
        bowlerX = pitchX - 60 + progress * 50;
        // Bobbing up and down
        bowlerY = (pitchY + pitchHeight / 2) + Math.sin(tickCount * 0.4) * 2;
      } else if (playbackState === "delivery") {
        // Ball flying in air
        drawBall = true;
        const progress = (tickCount % 72) / 72; // 1.2s sequence
        ballX = (pitchX + 15) + progress * (pitchWidth - 30);
        // Trajectory with bounce parabola
        const bounceHeight = 12;
        ballY = (pitchY + pitchHeight / 2) - Math.abs(Math.sin(progress * Math.PI * 1.5)) * bounceHeight;

        // Bowler finishing stroke
        bowlerX = pitchX + 12;
      } else if (playbackState === "hit") {
        // Ball hit or missed
        drawBall = true;
        strikerSwing = Math.sin(tickCount * 0.5) * 1.2; // swing batsman bat!
        
        const hitTick = tickCount % 120;
        
        if (isOut) {
          // Wicket sequence
          if (currentEvent?.wicket?.type === "Bowled") {
            // Ball flies and strikes the stumps!
            ballX = pitchX + pitchWidth - 6;
            ballY = pitchY + pitchHeight / 2;
            
            // Stumps flying fragments!
            ctx.fillStyle = "#facc15";
            ctx.save();
            ctx.translate(pitchX + pitchWidth - 6, pitchY + pitchHeight / 2);
            ctx.rotate(tickCount * 0.1);
            ctx.fillRect(-2, -15, 3, 12);
            ctx.restore();
          } else {
            // Caught sequence: ball flies high and landing in fielder
            const progress = hitTick / 120;
            ballX = (pitchX + pitchWidth - 15) + progress * 80;
            ballY = (pitchY + pitchHeight / 2) - Math.sin(progress * Math.PI) * 45;
          }
        } else if (runs === 6) {
          // Six hit! High trajectory outwards
          const progress = hitTick / 120;
          ballX = (pitchX + pitchWidth - 15) + progress * 140;
          ballY = (pitchY + pitchHeight / 2) - Math.sin(progress * Math.PI) * 75;

          // Sparkle trails
          if (tickCount % 3 === 0) {
            particles.push({
              x: ballX,
              y: ballY,
              vx: (Math.random() - 0.5) * 2,
              vy: (Math.random() - 0.5) * 2,
              color: "#eab308",
              size: Math.random() * 3 + 1,
              alpha: 1
            });
          }
        } else if (runs === 4) {
          // Four hit! Ground shot fast towards boundary
          const progress = hitTick / 120;
          ballX = (pitchX + pitchWidth - 15) + progress * 130;
          ballY = (pitchY + pitchHeight / 2) + Math.sin(progress * Math.PI * 2) * 5; // tiny bounces

          if (tickCount % 4 === 0) {
            particles.push({
              x: ballX,
              y: ballY,
              vx: (Math.random() - 0.5) * 1.5,
              vy: (Math.random() - 0.5) * 1.5,
              color: "#10b981",
              size: Math.random() * 2 + 1,
              alpha: 0.8
            });
          }
        } else if (runs > 0) {
          // Singular scoring shot
          const progress = hitTick / 120;
          ballX = (pitchX + pitchWidth - 15) + progress * 70;
          ballY = (pitchY + pitchHeight / 2) - Math.sin(progress * Math.PI) * 18;
        } else {
          // Dot ball: captured by wicket keeper behind batsman
          ballX = pitchX + pitchWidth + 12;
          ballY = pitchY + pitchHeight / 2 - 2;
        }
      } else if (playbackState === "replay") {
        // Slow motion camera replay: identical to hit but slow & scanlines
        drawBall = true;
        strikerSwing = Math.sin(tickCount * 0.2) * 1.2;
        const replayTick = tickCount % 120;
        
        if (runs === 6) {
          const progress = replayTick / 120;
          ballX = (pitchX + pitchWidth - 15) + progress * 140;
          ballY = (pitchY + pitchHeight / 2) - Math.sin(progress * Math.PI) * 75;
        } else if (runs === 4) {
          const progress = replayTick / 120;
          ballX = (pitchX + pitchWidth - 15) + progress * 130;
          ballY = (pitchY + pitchHeight / 2) + Math.sin(progress * Math.PI * 2) * 5;
        } else if (isOut) {
          ballX = pitchX + pitchWidth - 6;
          ballY = pitchY + pitchHeight / 2;
        }
      }

      // DRAW PARTICLES
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
        } else {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Draw Bowler
      ctx.fillStyle = "#ef4444"; // Bowling team red uniform
      ctx.beginPath();
      ctx.arc(bowlerX, bowlerY, 5, 0, Math.PI * 2); // head
      ctx.fill();
      ctx.fillRect(bowlerX - 3, bowlerY + 5, 6, 10); // body

      // Draw Batsman (Striker)
      ctx.save();
      ctx.translate(strikerX, strikerY);
      ctx.fillStyle = "#3b82f6"; // Batting team blue uniform
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2); // head
      ctx.fill();
      ctx.fillRect(-3, 5, 6, 12); // body

      // Draw Cricket Bat
      ctx.save();
      ctx.translate(0, 10);
      ctx.rotate(strikerSwing);
      ctx.fillStyle = "#d97706"; // Willow bat
      ctx.fillRect(-1, 0, 2, 14);
      // Bat handle
      ctx.fillStyle = "#fff";
      ctx.fillRect(-0.5, -4, 1, 4);
      ctx.restore();

      ctx.restore(); // restore striker transform

      // Draw Wicket Keeper (behind wickets)
      const keeperX = pitchX + pitchWidth + 12;
      const keeperY = pitchY + pitchHeight / 2;
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(keeperX, keeperY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(keeperX - 2, keeperY + 5, 4, 10);

      // Draw Fielders (Scattered simple dots)
      ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
      ctx.beginPath();
      ctx.arc(centerX - 100, centerY - 60, 4, 0, Math.PI * 2); // Long off
      ctx.arc(centerX + 80, centerY - 50, 4, 0, Math.PI * 2); // Long on
      ctx.arc(centerX - 120, centerY + 30, 4, 0, Math.PI * 2); // Deep cover
      ctx.arc(centerX + 110, centerY + 40, 4, 0, Math.PI * 2); // Mid wicket
      ctx.fill();

      // DRAW BALL
      if (drawBall) {
        ctx.fillStyle = "#ef4444"; // Red Leather ball
        ctx.shadowColor = "#f43f5e";
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(ballX, ballY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      }

      // FLASHING LABELS IN CORNER OR ON SCREEN (FOUR, SIX, WICKET)
      if (playbackState === "hit" || playbackState === "replay") {
        if (runs === 6) {
          ctx.fillStyle = "#facc15";
          ctx.font = "bold 24px 'Impact', sans-serif";
          ctx.textAlign = "center";
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 4;
          ctx.strokeText("🚀 SIXER!", centerX, centerY - 30);
          ctx.fillText("🚀 SIXER!", centerX, centerY - 30);
        } else if (runs === 4) {
          ctx.fillStyle = "#10b981";
          ctx.font = "bold 24px 'Impact', sans-serif";
          ctx.textAlign = "center";
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 4;
          ctx.strokeText("🔥 FOUR!", centerX, centerY - 30);
          ctx.fillText("🔥 FOUR!", centerX, centerY - 30);
        } else if (isOut) {
          ctx.fillStyle = "#ef4444";
          ctx.font = "bold 24px 'Impact', sans-serif";
          ctx.textAlign = "center";
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 4;
          ctx.strokeText("❌ WICKET!", centerX, centerY - 30);
          ctx.fillText("❌ WICKET!", centerX, centerY - 30);
        }
      }

      // Add camera effects & vignette overlay
      const radialGrad = ctx.createRadialGradient(centerX, centerY, width * 0.3, centerX, centerY, width * 0.6);
      radialGrad.addColorStop(0, "rgba(0,0,0,0)");
      radialGrad.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = radialGrad;
      ctx.fillRect(0, 0, width, height);

      // Replay Filter Scanlines
      if (isReplayMode) {
        ctx.fillStyle = "rgba(234, 179, 8, 0.05)";
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
        ctx.lineWidth = 1;
        for (let y = 0; y < height; y += 4) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }

      if (isPlaying) {
        animationFrameId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [playbackState, activeCamera, quality, currentEvent, isPlaying, isReplayMode]);

  // Handle preset simulated highlight reel triggers
  const triggerSimulatedHighlight = (highlightType: "6" | "4" | "wicket" | "dot" | "wide") => {
    const mockEvent = createMockHighlightEvent(highlightType);
    startDeliveryAnimation(mockEvent);
  };

  return (
    <div
      id="live-stream-player-container"
      ref={containerRef}
      className="bg-black text-white rounded-2xl overflow-hidden shadow-2xl border border-slate-800/80 relative flex flex-col transition-all duration-300"
    >
      {/* 1. TOP TITLE BANNER OVERLAY */}
      <div className="bg-gradient-to-r from-neutral-900 to-slate-900 p-3.5 border-b border-neutral-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-rose-600 rounded-lg animate-pulse text-white">
            <Tv className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold tracking-wider uppercase font-mono text-emerald-400 flex items-center gap-1">
              <span>Gully Sports 1 HD</span>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">Broadcast Stream Receiver</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Signal status */}
          <div className="text-right hidden sm:block">
            <p className="text-[9px] uppercase font-bold text-emerald-400 font-mono">Stream Good</p>
            <p className="text-[9px] text-slate-500 font-mono">{fps} FPS // 10.4 Mbps</p>
          </div>
          {/* HD Quality selection badge */}
          <div className="flex bg-neutral-800 p-0.5 rounded-lg border border-neutral-700/80">
            {(["1080p", "720p", "360p"] as const).map((q) => (
              <button
                key={q}
                onClick={() => setQuality(q)}
                className={`px-2 py-0.5 text-[9px] font-bold rounded-md uppercase transition ${
                  quality === q
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. THE SIMULATOR BROADCAST CANVAS VIEW */}
      <div className="relative aspect-video w-full bg-neutral-950 flex items-center justify-center overflow-hidden border-b border-neutral-800">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover select-none pointer-events-none"
        />

        {/* Dynamic TV Watermarks Overlay */}
        <div className="absolute left-4 top-4 select-none pointer-events-none flex flex-col gap-1.5">
          <div className="bg-black/60 border border-neutral-700/50 backdrop-blur-md px-2.5 py-1 rounded-md flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
            <span className="text-[9px] font-black tracking-widest font-mono text-slate-200">LIVE</span>
          </div>
          {isReplayMode && (
            <div className="bg-yellow-500 text-black border border-yellow-400 font-black px-2.5 py-0.5 rounded text-[9px] font-mono tracking-widest animate-pulse shadow-md flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>REPLAY {replaySpeed}</span>
            </div>
          )}
        </div>

        {/* Active Camera View Watermark top right */}
        <div className="absolute right-4 top-4 select-none pointer-events-none">
          <div className="bg-black/60 border border-neutral-700/50 backdrop-blur-md px-2.5 py-1 rounded text-[9px] font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-1">
            <Video className="w-3 h-3 text-cyan-400" />
            <span>CAM: {activeCamera}</span>
          </div>
        </div>

        {/* Dynamic TV Score Bug Overlays (lower third) */}
        {showStatsOverlay && (
          <div className="absolute bottom-4 left-4 right-4 bg-gradient-to-r from-neutral-950/95 via-slate-950/95 to-neutral-950/95 border-b-2 border-emerald-500 rounded-xl p-3 border border-neutral-800/80 shadow-2xl backdrop-blur-md text-white flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 font-black text-xs px-2.5 py-1.5 rounded-lg shadow uppercase tracking-wider">
                {currentEvent ? currentEvent.battingTeamName.slice(0, 3) : "BAT"}
              </div>
              <div>
                <h4 className="text-sm font-black font-mono tracking-tight text-slate-100">
                  {currentEvent ? `${currentEvent.runs}/${currentEvent.wickets}` : "0/0"}
                  <span className="text-slate-400 text-xs font-normal ml-1.5 font-mono">
                    Overs: {currentEvent ? `${currentEvent.overs}.${currentEvent.ballsInCurrentOver}` : "0.0"}/{currentEvent?.oversAllowed ?? 5}
                  </span>
                </h4>
                <p className="text-[9px] uppercase font-bold tracking-widest text-emerald-400 font-mono">
                  Striker: {currentEvent ? currentEvent.strikerName : "Awaiting..."}*
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-neutral-800/80 pt-2 sm:pt-0">
              <div className="text-right sm:border-r border-neutral-800/80 pr-4">
                <span className="text-[8px] text-slate-400 uppercase font-bold tracking-wider font-mono block">Bowler</span>
                <span className="text-[11px] font-semibold text-slate-200">
                  {currentEvent ? currentEvent.bowlerName : "Selected Bowler"}
                </span>
              </div>

              <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-neutral-800/50">
                {visualizerBars.map((bar, idx) => (
                  <span
                    key={idx}
                    className="w-1 bg-emerald-500 rounded-full transition-all duration-100"
                    style={{ height: `${bar}px` }}
                  ></span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. MULTI-CAMERA SWITCHER AND VOLUME CONTROLS */}
      <div className="bg-neutral-900 border-b border-neutral-800/80 p-3.5 flex flex-col md:flex-row gap-3 justify-between items-center text-xs">
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <span className="text-[9px] uppercase tracking-widest font-mono font-black text-slate-400 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-emerald-500" />
            <span>Switch Cam:</span>
          </span>
          {(["Wicket-to-Wicket", "Spidercam", "Batsman View", "Skycam"] as const).map((cam) => (
            <button
              key={cam}
              onClick={() => setActiveCamera(cam)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide uppercase transition ${
                activeCamera === cam
                  ? "bg-slate-700 text-white border-b-2 border-emerald-400 shadow-md"
                  : "bg-neutral-800 text-slate-400 hover:text-white border border-neutral-700/50"
              }`}
            >
              {cam.replace("-", " ")}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {/* Live indicator & ticker */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest font-mono text-emerald-400">LIVE BUFFER</span>
            <span className="text-[10px] font-mono text-slate-400">[{streamDuration}]</span>
          </div>

          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-slate-300 transition"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* 4. REAL-TIME PLAY-BY-PLAY CAPTION SCROLLER */}
      <div className="bg-slate-950 p-3 border-b border-neutral-800 text-center font-mono relative overflow-hidden">
        {/* Animated background laser scanning */}
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-r from-emerald-500 to-transparent opacity-30 animate-[ping_3s_infinite]" />
        
        <p className="text-[11px] font-bold text-slate-300 flex items-center justify-center gap-1.5 px-4 leading-relaxed">
          <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0 animate-bounce" />
          <span className="transition-all duration-350">{commentaryText}</span>
        </p>
      </div>

      {/* 5. SAMPLE HIGHLIGHTS REEL (MANUAL TESTING BUTTONS) */}
      <div className="bg-neutral-900 p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-widest font-mono font-black text-slate-400 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
            <span>Interactive highlights reel (Manual playback testing)</span>
          </span>
          <span className="text-[9px] text-slate-500 italic">No live match scoring needed</span>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { id: "6", label: "📺 Watch Sixer", icon: "🚀", type: "6" },
            { id: "4", label: "📺 Watch Boundary", icon: "🔥", type: "4" },
            { id: "wicket", label: "📺 Watch Wicket", icon: "❌", type: "wicket" },
            { id: "wide", label: "📺 Watch Wide Ball", icon: "💨", type: "wide" },
            { id: "dot", label: "📺 Watch Defended", icon: "🛡️", type: "dot" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => triggerSimulatedHighlight(item.type as any)}
              className="py-2.5 px-1 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700/60 rounded-xl text-[10px] font-bold text-slate-200 transition flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
            >
              <span>{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
