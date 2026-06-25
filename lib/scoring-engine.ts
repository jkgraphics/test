import { Match, MatchInning, BallRecord, ExtraType, WicketType } from "./types";

export function createInning(battingTeamId: string, bowlingTeamId: string): MatchInning {
  return {
    battingTeamId,
    bowlingTeamId,
    runs: 0,
    wickets: 0,
    overs: 0,
    ballsInCurrentOver: 0,
    extras: {
      wides: 0,
      noBalls: 0,
      byes: 0,
      legByes: 0,
      total: 0,
    },
    batsmen: {},
    bowlers: {},
    currentOverBalls: [],
    ballRecords: [],
    fallOfWickets: [],
  };
}

// Rotates the strike (swaps striker and non-striker names)
export function rotateStrike(match: Match): { currentStriker: string; currentNonStriker: string } {
  return {
    currentStriker: match.currentNonStriker,
    currentNonStriker: match.currentStriker,
  };
}

export function handleBallScored(
  match: Match,
  ballInput: {
    runsBat: number;
    extraType: ExtraType;
    extraRuns: number; // For wides/no-balls, usually 1 run penalty, plus any extra runs run by players
    wicket?: {
      type: WicketType;
      playerOut: string;
      fielder?: string;
    };
  }
): Match {
  // Deep clone to avoid mutating standard models
  const updatedMatch = JSON.parse(JSON.stringify(match)) as Match;
  const currentInning = updatedMatch.innings[updatedMatch.currentInningIndex];

  if (!currentInning) return updatedMatch;

  const striker = updatedMatch.currentStriker;
  const nonStriker = updatedMatch.currentNonStriker;
  const bowler = updatedMatch.currentBowler;

  if (!striker || !nonStriker || !bowler) {
    return updatedMatch;
  }

  // Ensure batsman and bowler exist in statistics mapping
  if (!currentInning.batsmen[striker]) {
    currentInning.batsmen[striker] = { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false };
  }
  if (!currentInning.batsmen[nonStriker]) {
    currentInning.batsmen[nonStriker] = { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false };
  }
  if (!currentInning.bowlers[bowler]) {
    currentInning.bowlers[bowler] = { balls: 0, maidens: 0, runs: 0, wickets: 0 };
  }

  const { runsBat, extraType, extraRuns, wicket } = ballInput;

  // Let's determine legality: wides and no-balls are NOT legal deliveries
  const isLegal = extraType !== "Wd" && extraType !== "Nb";

  // Calculate ball total runs
  let ballTotalRuns = runsBat;
  if (extraType === "Wd" || extraType === "Nb") {
    ballTotalRuns += extraRuns; // E.g. Wide (1pt penalty) + 1 run scored = 2 runs
  } else if (extraType === "By" || extraType === "Lb") {
    ballTotalRuns += extraRuns; // Byes or legbyes scored
  }

  // Update Inning overall statistics
  currentInning.runs += ballTotalRuns;

  // Update extras ledger
  if (extraType === "Wd") {
    currentInning.extras.wides += extraRuns;
    currentInning.extras.total += extraRuns;
  } else if (extraType === "Nb") {
    currentInning.extras.noBalls += extraRuns;
    currentInning.extras.total += extraRuns;
  } else if (extraType === "By") {
    currentInning.extras.byes += extraRuns;
    currentInning.extras.total += extraRuns;
  } else if (extraType === "Lb") {
    currentInning.extras.legByes += extraRuns;
    currentInning.extras.total += extraRuns;
  }

  // Update Batsman Stats
  // Wide balls do not count as a delivery faced for the batsman
  if (extraType !== "Wd") {
    currentInning.batsmen[striker].balls += 1;
  }
  // Runs completed by bat count towards batsman's runs
  if (extraType === "None" || extraType === "Nb") {
    currentInning.batsmen[striker].runs += runsBat;
    if (runsBat === 4) currentInning.batsmen[striker].fours += 1;
    if (runsBat === 6) currentInning.batsmen[striker].sixes += 1;
  }

  // Update Bowler Stats
  // Only legal balls are loaded against bowler's balls count
  if (isLegal) {
    currentInning.bowlers[bowler].balls += 1;
  }
  // Runs that count against Bowlers: runsBat + wides + no-balls. Byes and Leg-byes are NOT loaded against bowlers.
  if (extraType !== "By" && extraType !== "Lb") {
    currentInning.bowlers[bowler].runs += ballTotalRuns;
  }

  // Handle Wickets
  if (wicket) {
    currentInning.wickets += 1;
    const dismissedPlayer = wicket.playerOut;

    // Record Fall of Wickets
    const overDisplayStr = `${currentInning.overs}.${
      isLegal ? currentInning.ballsInCurrentOver + 1 : currentInning.ballsInCurrentOver
    }`;
    currentInning.fallOfWickets.push({
      runs: currentInning.runs,
      wickets: currentInning.wickets,
      oversString: overDisplayStr,
      batsmanName: dismissedPlayer,
    });

    if (currentInning.batsmen[dismissedPlayer]) {
      currentInning.batsmen[dismissedPlayer].isOut = true;
      currentInning.batsmen[dismissedPlayer].howOut = wicket.type;
      currentInning.batsmen[dismissedPlayer].bowledBy = bowler;
    }

    // Bowler gets credit for Bowled, Caught, LBW, Stumped, and Hit Wicket.
    // DOES NOT get credit for Run Out, Retired Hurt, or Obstructing the field.
    const bowlerCredited =
      wicket.type === "Bowled" ||
      wicket.type === "Caught" ||
      wicket.type === "LBW" ||
      wicket.type === "Stumped" ||
      wicket.type === "Hit Wicket";

    if (bowlerCredited) {
      currentInning.bowlers[bowler].wickets += 1;
    }

    // Set out parameters in active strikers if they got out
    if (dismissedPlayer === striker) {
      updatedMatch.currentStriker = "";
    } else if (dismissedPlayer === nonStriker) {
      updatedMatch.currentNonStriker = "";
    }
  }

  // Add Ball Record to Ledger
  const ballLabel = getBallLabel(runsBat, extraType, extraRuns, wicket);
  currentInning.currentOverBalls.push(ballLabel);

  const ballRecord: BallRecord = {
    ballId: Math.random().toString(36).substring(2, 9),
    overNumber: currentInning.overs,
    ballInOver: isLegal ? currentInning.ballsInCurrentOver + 1 : currentInning.ballsInCurrentOver,
    bowler,
    striker,
    nonStriker,
    runsBat,
    extraType,
    extraRuns,
    runsTotal: ballTotalRuns,
    isLegal,
    wicket: wicket ? { type: wicket.type, playerOut: wicket.playerOut, fielder: wicket.fielder } : undefined,
  };
  currentInning.ballRecords.push(ballRecord);

  // Advance over if a legal ball was bowled
  if (isLegal) {
    currentInning.ballsInCurrentOver += 1;

    // Check if over is completed (6 legal balls)
    if (currentInning.ballsInCurrentOver === 6) {
      // Archive current over to history
      // Check for Maiden Over:
      // An over is maiden if bowler bowled 6 legal balls in it and conceded 0 runs (bat runs + wide runs + no ball runs).
      const currentOverRecords = currentInning.ballRecords.filter((r) => r.overNumber === currentInning.overs);
      const runsConcededInOver = currentOverRecords
        .filter((r) => r.extraType !== "By" && r.extraType !== "Lb")
        .reduce((sum, r) => sum + r.runsTotal, 0);

      if (runsConcededInOver === 0) {
        currentInning.bowlers[bowler].maidens += 1;
      }

      currentInning.overs += 1;
      currentInning.ballsInCurrentOver = 0;
      currentInning.currentOverBalls = []; // Reset visual overlay for next over

      // After over completion, batsman swap strike (standard rules)
      if (updatedMatch.currentStriker && updatedMatch.currentNonStriker) {
        const swapped = rotateStrike(updatedMatch);
        updatedMatch.currentStriker = swapped.currentStriker;
        updatedMatch.currentNonStriker = swapped.currentNonStriker;
      }

      // Bowler needs to be updated next: reset current bowler to force selection
      updatedMatch.currentBowler = "";
    } else {
      // For runs off bats or byes, rotate strike on odd runs inside the over
      // Standard: 1, 3, 5 runs rotate strike
      const runsThatRotate = runsBat + (extraType === "By" || extraType === "Lb" ? extraRuns : 0);
      if (runsThatRotate % 2 === 1) {
        if (updatedMatch.currentStriker && updatedMatch.currentNonStriker) {
          const swapped = rotateStrike(updatedMatch);
          updatedMatch.currentStriker = swapped.currentStriker;
          updatedMatch.currentNonStriker = swapped.currentNonStriker;
        }
      }
    }
  } else {
    // If illegal (Wide or No Ball) and extra runs including ran runs are odd (e.g., Wide + 1 run ran, making 2 runs total, but wait—
    // if wide is bowled, that's 1 extra. If they run 1 more, that's 2 runs total.
    // If they run an odd number of extra runs, strike rotates!
    // Let's check: if wides ran is odd, swap strike
    const ranRunsOnWide = extraRuns - 1; // 1 is wide penalty, others are ran
    if (extraType === "Wd" && ranRunsOnWide > 0 && ranRunsOnWide % 2 === 1) {
      if (updatedMatch.currentStriker && updatedMatch.currentNonStriker) {
        const swapped = rotateStrike(updatedMatch);
        updatedMatch.currentStriker = swapped.currentStriker;
        updatedMatch.currentNonStriker = swapped.currentNonStriker;
      }
    } else if (extraType === "Nb" && runsBat % 2 === 1) {
      // rotate strike if runs bat on No Ball is odd
      if (updatedMatch.currentStriker && updatedMatch.currentNonStriker) {
        const swapped = rotateStrike(updatedMatch);
        updatedMatch.currentStriker = swapped.currentStriker;
        updatedMatch.currentNonStriker = swapped.currentNonStriker;
      }
    }
  }

  return updatedMatch;
}

// Convert a single ball stats into short graphic label (e.g. "4", "W", "1", "Wd", "Nb+4")
function getBallLabel(runsBat: number, extraType: ExtraType, extraRuns: number, wicket: any): string {
  if (wicket) {
    if (wicket.type === "Run Out") return "W (R.O)";
    return "W";
  }
  if (extraType === "Wd") {
    return extraRuns > 1 ? `${extraRuns}Wd` : "Wd";
  }
  if (extraType === "Nb") {
    return runsBat > 0 ? `${runsBat}Nb` : "Nb";
  }
  if (extraType === "By") {
    return `${extraRuns}B`;
  }
  if (extraType === "Lb") {
    return `${extraRuns}L`;
  }
  return runsBat.toString();
}

export function checkMatchStatus(match: Match, teamAPlayersCount: number, teamBPlayersCount: number): Match {
  const updatedMatch = JSON.parse(JSON.stringify(match)) as Match;
  const activeInning = updatedMatch.innings[updatedMatch.currentInningIndex];

  if (!activeInning) return updatedMatch;

  const maxOvers = updatedMatch.oversAllowed;
  const isFirstInnings = updatedMatch.currentInningIndex === 0;

  // Total wickets allowed is playersCount - 1
  const maxWickets = isFirstInnings
    ? teamAPlayersCount - 1 // Batting first
    : teamBPlayersCount - 1; // Chasing

  const overLimitReached = activeInning.overs >= maxOvers;
  const allOutReached = activeInning.wickets >= maxWickets;

  if (isFirstInnings) {
    // End of First Innings
    if (overLimitReached || allOutReached) {
      updatedMatch.status = "InningsBreak";
    }
  } else {
    // End of Second Innings (Chasing)
    const inning1 = updatedMatch.innings[0];
    const target = inning1.runs + 1;

    // SCENARIO 1: Chasing team matches or exceeds target score
    if (activeInning.runs >= target) {
      updatedMatch.status = "Completed";
      const remainingWickets = maxWickets + 1 - activeInning.wickets;
      updatedMatch.matchResult = `${updatedMatch.teamBName} won by ${remainingWickets} wickets!`;
      updatedMatch.playerOfTheMatch = pickTopPerformer(updatedMatch);
    }
    // SCENARIO 2: Chasing team is All Out or runs out of overs
    else if (allOutReached || overLimitReached) {
      updatedMatch.status = "Completed";
      if (activeInning.runs === inning1.runs) {
        updatedMatch.matchResult = "Match Tied!";
      } else {
        const margin = inning1.runs - activeInning.runs;
        updatedMatch.matchResult = `${updatedMatch.teamAName} won by ${margin} runs!`;
      }
      updatedMatch.playerOfTheMatch = pickTopPerformer(updatedMatch);
    }
  }

  return updatedMatch;
}

// Simple heuristic to extract top performer names
export function pickTopPerformer(match: Match): string {
  let bestPerformer = "No runs/wickets logged";
  let maxScore = -1;

  match.innings.forEach((inn, i) => {
    // Batting top
    Object.entries(inn.batsmen).forEach(([name, b]) => {
      const scoreValue = b.runs * 2; // Arbitrary score weighting
      if (scoreValue > maxScore) {
        maxScore = scoreValue;
        bestPerformer = `${name} (${b.runs} runs, Inn. ${i + 1})`;
      }
    });

    // Bowling top
    Object.entries(inn.bowlers).forEach(([name, bowl]) => {
      const scoreValue = bowl.wickets * 25 + bowl.maidens * 15 - bowl.runs * 0.5;
      if (scoreValue > maxScore) {
        maxScore = scoreValue;
        bestPerformer = `${name} (${bowl.wickets} wickets, ${bowl.runs} runs)`;
      }
    });
  });

  return bestPerformer;
}
