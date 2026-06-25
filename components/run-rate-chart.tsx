"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Match } from "@/lib/types";

interface RunRateChartProps {
  match: Match;
  isDarkMode?: boolean;
}

export default function RunRateChart({ match, isDarkMode = false }: RunRateChartProps) {
  // Extract innings
  const inning1 = match.innings[0];
  const inning2 = match.innings[1];

  const teamAName = match.teamAName || "Team A";
  const teamBName = match.teamBName || "Team B";

  // Calculate cumulative scores after each legal ball (or every ball)
  // We align them by fractional over: overNumber + (ballInOver / 6)
  const getInningProgress = (inning: typeof inning1) => {
    if (!inning || !inning.ballRecords || inning.ballRecords.length === 0) {
      return [];
    }

    let runningRuns = 0;
    const progress: { overFraction: number; overLabel: string; runs: number; wickets: number }[] = [];

    // Initial state
    progress.push({ overFraction: 0, overLabel: "0", runs: 0, wickets: 0 });

    let wicketsCount = 0;
    inning.ballRecords.forEach((ball, idx) => {
      runningRuns += ball.runsTotal;
      if (ball.wicket) {
        wicketsCount += 1;
      }
      
      // Calculate over fraction.
      // If we have ballInOver, calculate fractional position.
      // E.g., over Number 0, ballInOver 1 -> 1/6
      const ballInOverVal = ball.ballInOver || 1;
      const overFraction = ball.overNumber + (ballInOverVal / 6);
      
      const label = `${ball.overNumber}.${ballInOverVal}`;
      
      progress.push({
        overFraction,
        overLabel: label,
        runs: runningRuns,
        wickets: wicketsCount,
      });
    });

    return progress;
  };

  const progress1 = getInningProgress(inning1);
  const progress2 = getInningProgress(inning2);

  // Combine them into a single timeline for the comparison graph
  // We want to sample the run values at logical checkpoints (e.g., end of every legal ball)
  const oversAllowed = match.oversAllowed || 5;
  const totalSteps = oversAllowed * 6; // 30 steps if 5 overs

  const chartData = [];

  // Start with over 0
  chartData.push({
    overFraction: 0,
    overLabel: "Start",
    [teamAName]: 0,
    [teamBName]: inning2 ? 0 : undefined,
  });

  // Calculate run values for Team A and Team B at each fractional over
  for (let step = 1; step <= totalSteps; step++) {
    const overNum = Math.floor((step - 1) / 6);
    const ballNum = ((step - 1) % 6) + 1;
    const fraction = overNum + (ballNum / 6);
    const overLabel = `${overNum}.${ballNum}`;

    const dataItem: any = {
      overFraction: fraction,
      overLabel: ballNum === 6 ? `Over ${overNum + 1}` : overLabel,
    };

    // Find Team A's score at this fraction (or the latest ball scored <= this fraction)
    if (progress1.length > 0) {
      // Find the last item where overFraction <= fraction
      let latestState = progress1[0];
      for (const p of progress1) {
        if (p.overFraction <= fraction + 0.001) {
          latestState = p;
        } else {
          break;
        }
      }
      
      // Only include if Innings 1 is active up to this point or completed
      const totalBallsBowledA = inning1.overs * 6 + inning1.ballsInCurrentOver;
      const currentStepFractionA = totalBallsBowledA / 6;
      
      if (fraction <= currentStepFractionA + 0.001 || inning1.overs >= oversAllowed || match.status === "InningsBreak" || match.currentInningIndex > 0 || match.status === "Completed") {
        dataItem[teamAName] = latestState.runs;
        if (latestState.wickets > 0) {
          dataItem[`${teamAName} Wickets`] = latestState.runs; // For marking wickets
        }
      }
    }

    // Find Team B's score at this fraction
    if (progress2.length > 0 && inning2) {
      let latestState = progress2[0];
      for (const p of progress2) {
        if (p.overFraction <= fraction + 0.001) {
          latestState = p;
        } else {
          break;
        }
      }

      const totalBallsBowledB = inning2.overs * 6 + inning2.ballsInCurrentOver;
      const currentStepFractionB = totalBallsBowledB / 6;

      if (fraction <= currentStepFractionB + 0.001 || match.status === "Completed") {
        dataItem[teamBName] = latestState.runs;
      }
    }

    // Only add to chart data if at least Team A or Team B has played up to this point
    if (dataItem[teamAName] !== undefined || dataItem[teamBName] !== undefined) {
      chartData.push(dataItem);
    }
  }

  // Determine colors based on theme mode
  const gridColor = isDarkMode ? "#333333" : "#e5e7eb";
  const axisColor = isDarkMode ? "#999999" : "#64748b";
  const tooltipStyle = isDarkMode 
    ? { backgroundColor: "#1e1e1e", borderColor: "#444" } 
    : { backgroundColor: "#ffffff", borderColor: "#f1f5f9" };
  const tooltipTextStyle = isDarkMode ? { color: "#ffffff" } : { color: "#0f172a" };

  // Define colors for teams
  const colorTeamA = "#10b981"; // Emerald green
  const colorTeamB = "#ef4444"; // Vivid Red / Amber

  return (
    <div className="w-full flex flex-col space-y-2 mt-4 p-4 bg-slate-50/50 dark:bg-neutral-900/50 rounded-2xl border border-slate-100 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
          Run-Rate Progression (Comparative)
        </h4>
        <span className="text-[10px] bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full text-slate-500 font-medium">
          Overs limit: {oversAllowed}
        </span>
      </div>

      <div className="h-56 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis 
              dataKey="overLabel" 
              tick={{ fill: axisColor, fontSize: 10 }} 
              axisLine={false} 
              tickLine={false} 
            />
            <YAxis 
              tick={{ fill: axisColor, fontSize: 10 }} 
              axisLine={false} 
              tickLine={false} 
            />
            <Tooltip 
              contentStyle={tooltipStyle} 
              labelStyle={{ fontSize: 11, fontWeight: "bold", ...tooltipTextStyle }}
              itemStyle={{ fontSize: 11, ...tooltipTextStyle }}
            />
            <Legend verticalAlign="bottom" height={24} iconType="circle" wrapperStyle={{ fontSize: 10, fontWeight: "600" }} />
            <Line 
              type="monotone" 
              dataKey={teamAName} 
              stroke={colorTeamA} 
              strokeWidth={3} 
              dot={false}
              activeDot={{ r: 6 }} 
              name={teamAName}
              connectNulls
            />
            {inning2 && (
              <Line 
                type="monotone" 
                dataKey={teamBName} 
                stroke={colorTeamB} 
                strokeWidth={3} 
                dot={false}
                activeDot={{ r: 6 }} 
                name={teamBName}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
