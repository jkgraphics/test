"use client";

import { Match, MatchInning, ExtraType, WicketType, BallRecord } from "./types";

export function generateMockMatchState(currentTimeSec: number, customYoutubeId?: string): Match {
  const matchId = "mock-stream-gully-clash";
  const oversAllowed = 5;
  const cycleSeconds = 600; // 10 minutes loop
  const timeInCycle = currentTimeSec % cycleSeconds;
  
  // Each ball is bowled every 9 seconds, so 60 balls bowled in 540 seconds,
  // leaving 60 seconds of post-game or pre-game lobby.
  const secondsPerBall = 9;
  const totalBallsInCycle = 60;
  const totalLiveBowledBalls = Math.min(totalBallsInCycle, Math.floor(timeInCycle / secondsPerBall));
  
  // Players
  const teamA = {
    id: "mock-team-a",
    name: "Chawl Champions",
    players: ["Sunny", "Chiku", "Raju", "Karan", "Babloo"]
  };
  const teamB = {
    id: "mock-team-b",
    name: "Bazaar Badshahs",
    players: ["Monu", "Golu", "Vicky", "Bunty", "Bittu"]
  };

  // Define deterministic details for all balls of Inning 1 (Chawl Champions Batting)
  const inning1Props = [
    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Chiku punches the first ball to deep cover for a single." },
    { runsBat: 0, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Sunny swings and misses! Elegant line from Monu." },
    { runsBat: 4, extraType: "None" as ExtraType, extraRuns: 0, commentary: "CRACK! Sunny lofts it straight back over the bowler for four!" },
    { runsBat: 0, extraType: "Wd" as ExtraType, extraRuns: 1, commentary: "Monu tries a slower ball but sprays it wide down leg-side." },
    { runsBat: 2, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Sunny clips it off his pads, sprinting back for a speedy double." },
    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Sunny guides it to third man and keeps the strike." },
    { runsBat: 0, extraType: "None" as ExtraType, extraRuns: 0, wicket: { type: "Bowled" as WicketType, playerOut: "Sunny" }, commentary: "BOWLED HIM! Clean bowled! Monu makes a spectacular comeback!" },

    { runsBat: 0, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Raju defends watchfully to mid-on." },
    { runsBat: 6, extraType: "None" as ExtraType, extraRuns: 0, commentary: "HUGE! Raju launches Bunty into the second floor balcony! What a street six!" },
    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Raju rotates strike down to long-on." },
    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Chiku works it into the gap for a single." },
    { runsBat: 0, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Perfect Yorker! Raju did extremely well to block it." },
    { runsBat: 4, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Edged, and it races away past the slip fielders for four!" },

    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Quick single, some fielder hustle but safe." },
    { runsBat: 0, extraType: "None" as ExtraType, extraRuns: 0, wicket: { type: "Caught" as WicketType, playerOut: "Chiku", fielder: "Bittu" }, commentary: "IN THE AIR AND CAUGHT! Chiku tries to pull but catches the top-edge." },
    { runsBat: 2, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Karan gets off the mark with a double down mid-wicket." },
    { runsBat: 4, extraType: "None" as ExtraType, extraRuns: 0, commentary: "FOUR! Karan drives it through extra cover. Vintage shot!" },
    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Single to deep point." },
    { runsBat: 0, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Dot ball to end an eventful over." },

    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Karan punches it into the gaps." },
    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Raju takes a single to long-off." },
    { runsBat: 0, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Well bowled bowler! Snappy bouncer." },
    { runsBat: 6, extraType: "None" as ExtraType, extraRuns: 0, commentary: "BANG! Karan hits a massive flat six over deep square-leg!" },
    { runsBat: 2, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Drilled to deep cover, excellent running on dusty streets." },
    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Maintains strike with a single." },

    { runsBat: 4, extraType: "None" as ExtraType, extraRuns: 0, commentary: "FOUR! Karan starts the final over with a bang!" },
    { runsBat: 0, extraType: "None" as ExtraType, extraRuns: 0, wicket: { type: "Run Out" as WicketType, playerOut: "Raju", fielder: "Vicky" }, commentary: "RUN OUT! Confusion in the street! Direct hit from Vicky packs Raju!" },
    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Babloo takes a single off his first ball." },
    { runsBat: 2, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Karan whips it to fine leg for two." },
    { runsBat: 0, extraType: "Wd" as ExtraType, extraRuns: 1, commentary: "Vicky sprays it too wide down off-side." },
    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Single to keep things ticking." },
    { runsBat: 4, extraType: "None" as ExtraType, extraRuns: 0, commentary: "FOUR! Karan lofts the final ball of the innings past mid-off! High quality batting!" }
  ];

  // Define deterministic details for all balls of Inning 2 (Bazaar Badshahs Chasing)
  const inning2Props = [
    { runsBat: 0, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Monu blocks the opening bowler, Karan's fiery delivery." },
    { runsBat: 4, extraType: "None" as ExtraType, extraRuns: 0, commentary: "FOUR! Monu slices it elegantly over point for a boundary!" },
    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Monu takes a comfortable single." },
    { runsBat: 0, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Golu gets beaten by a beautiful incoming ball." },
    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Golu works it to deep midwicket." },
    { runsBat: 2, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Monu swipes, gets a double past fine leg." },

    { runsBat: 0, extraType: "None" as ExtraType, extraRuns: 0, wicket: { type: "Caught" as WicketType, playerOut: "Monu", fielder: "Chiku" }, commentary: "CAUGHT! Sunny strikes! Monu gets caught at long-on!" },
    { runsBat: 6, extraType: "None" as ExtraType, extraRuns: 0, commentary: "BOOM! Vicky is on fire! First ball, hits a towering street six over the roof!" },
    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Single taken down to cover." },
    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Golu works it away for a single." },
    { runsBat: 0, extraType: "Wd" as ExtraType, extraRuns: 1, commentary: "Wide ball from Sunny. Extra run to the Badshahs." },
    { runsBat: 4, extraType: "None" as ExtraType, extraRuns: 0, commentary: "CRACKING SHOT! Vicky punches it through covers for four!" },
    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Vicky pushes it and keeps strike." },

    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Vicky guides it into the open lane for a single." },
    { runsBat: 0, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Golu plays and misses. Sunny is bowling tight lines." },
    { runsBat: 0, extraType: "None" as ExtraType, extraRuns: 0, wicket: { type: "Bowled" as WicketType, playerOut: "Golu" }, commentary: "BOWLED! Raju gets Golu's stumps flying! Bazaar Badshahs lose their second!" },
    { runsBat: 2, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Bunty gets off the mark with a wristy couple." },
    { runsBat: 4, extraType: "None" as ExtraType, extraRuns: 0, commentary: "FOUR! Bunty smashes a loose ball through mid-wicket!" },
    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Bunty drives to long-on for a single." },

    { runsBat: 4, extraType: "None" as ExtraType, extraRuns: 0, commentary: "FOUR! Vicky hammers Babloo through point. Magnificent timing!" },
    { runsBat: 6, extraType: "None" as ExtraType, extraRuns: 0, commentary: "MASSIVE! Vicky deposits it straight over the sight-screen! What a game!" },
    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Vicky keeps strike with a single." },
    { runsBat: 0, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Dot ball. Babloo pulls his length back." },
    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Bunty works it for a speedy single." },
    { runsBat: 2, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Two runs to finish the over." },

    { runsBat: 2, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Bunty digs out a yorker, takes two runs." },
    { runsBat: 4, extraType: "None" as ExtraType, extraRuns: 0, commentary: "FOUR! Bunty finds the boundary! They are getting close to the target!" },
    { runsBat: 0, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Superb delivery! Right into the blockhole." },
    { runsBat: 1, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Single to keep the strike rotating." },
    { runsBat: 2, extraType: "None" as ExtraType, extraRuns: 0, commentary: "Vicky swipes on leg-side, running hard for a double!" },
    { runsBat: 4, extraType: "None" as ExtraType, extraRuns: 0, commentary: "FOUR! Vicky lofts it over covers for four! Exciting chase!" }
  ];

  // Helper inside generator to construct the actual inning state
  const buildInningState = (
    battingTeam: typeof teamA,
    bowlingTeam: typeof teamB,
    props: typeof inning1Props,
    numBallsToUse: number
  ): MatchInning => {
    let runs = 0;
    let wickets = 0;
    let overs = 0;
    let ballsInCurrentOver = 0;
    const currentOverBalls: string[] = [];
    const ballRecords: BallRecord[] = [];
    const fallOfWickets: any[] = [];
    
    // Players playing tracking
    let strikerIndex = 0;
    let nonStrikerIndex = 1;
    let bowlerIndex = 0;
    
    // Batsmen stats tracking
    const batsmenMap: { [name: string]: any } = {};
    battingTeam.players.forEach(p => {
      batsmenMap[p] = { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false };
    });

    // Bowlers stats tracking
    const bowlersMap: { [name: string]: any } = {};
    bowlingTeam.players.forEach(p => {
      bowlersMap[p] = { balls: 0, maidens: 0, runs: 0, wickets: 0 };
    });

    const extrasState = { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 };

    let currentStrikerName = battingTeam.players[strikerIndex];
    let currentNonStrikerName = battingTeam.players[nonStrikerIndex];
    let currentBowlerName = bowlingTeam.players[bowlerIndex];

    let actualLegalBallIndex = 0;

    for (let i = 0; i < Math.min(props.length, numBallsToUse); i++) {
      const p = props[i];
      const runsTotal = p.runsBat + p.extraRuns;
      const isLegal = p.extraType !== "Wd" && p.extraType !== "Nb";

      // Increment runs & extras
      runs += runsTotal;
      if (!isLegal) {
        if (p.extraType === "Wd") {
          extrasState.wides += runsTotal;
        } else if (p.extraType === "Nb") {
          extrasState.noBalls += runsTotal;
        }
        extrasState.total += runsTotal;
      }

      // Record batsman face
      if (currentStrikerName && batsmenMap[currentStrikerName]) {
        if (isLegal) {
          batsmenMap[currentStrikerName].balls += 1;
        }
        batsmenMap[currentStrikerName].runs += p.runsBat;
        if (p.runsBat === 4) batsmenMap[currentStrikerName].fours += 1;
        if (p.runsBat === 6) batsmenMap[currentStrikerName].sixes += 1;
      }

      // Record bowler concede
      if (currentBowlerName && bowlersMap[currentBowlerName]) {
        if (isLegal) {
          bowlersMap[currentBowlerName].balls += 1;
        }
        bowlersMap[currentBowlerName].runs += runsTotal;
      }

      // Handle over progression
      const overNum = Math.floor(actualLegalBallIndex / 6);
      const ballNum = (actualLegalBallIndex % 6) + 1;

      // Current ball symbol
      let ballLabel = p.runsBat.toString();
      if (!isLegal) {
        ballLabel = p.extraType;
      }

      // Handle Wicket
      let wicketRecord: any = undefined;
      if (p.wicket) {
        wickets += 1;
        const outPlayer = p.wicket.playerOut;
        if (batsmenMap[outPlayer]) {
          batsmenMap[outPlayer].isOut = true;
          batsmenMap[outPlayer].howOut = p.wicket.type;
        }
        
        wicketRecord = {
          type: p.wicket.type,
          playerOut: outPlayer,
          fielder: p.wicket.fielder
        };

        if (currentBowlerName && bowlersMap[currentBowlerName]) {
          bowlersMap[currentBowlerName].wickets += 1;
        }

        fallOfWickets.push({
          runs,
          wickets,
          oversString: `${overNum}.${ballNum}`,
          batsmanName: outPlayer
        });

        ballLabel = "W";

        // Bring in next batsman if available
        const nextBatsmanIdx = Math.max(strikerIndex, nonStrikerIndex) + 1;
        if (nextBatsmanIdx < battingTeam.players.length) {
          if (currentStrikerName === outPlayer) {
            strikerIndex = nextBatsmanIdx;
            currentStrikerName = battingTeam.players[strikerIndex];
          } else {
            nonStrikerIndex = nextBatsmanIdx;
            currentNonStrikerName = battingTeam.players[nonStrikerIndex];
          }
        }
      }

      currentOverBalls.push(ballLabel);

      // Save individual record
      ballRecords.push({
        ballId: `mock-ball-${i}`,
        overNumber: overNum,
        ballInOver: ballNum,
        bowler: currentBowlerName,
        striker: currentStrikerName,
        nonStriker: currentNonStrikerName,
        runsBat: p.runsBat,
        extraType: p.extraType,
        extraRuns: p.extraRuns,
        runsTotal,
        isLegal,
        wicket: wicketRecord,
        commentary: p.commentary
      });

      // Update legal balls
      if (isLegal) {
        actualLegalBallIndex += 1;
        ballsInCurrentOver += 1;
      }

      // Handle Strike Rotation (on odd runs)
      if (p.runsBat % 2 === 1 && !p.wicket) {
        const temp = currentStrikerName;
        currentStrikerName = currentNonStrikerName;
        currentNonStrikerName = temp;
      }

      // Handle End of Over
      if (isLegal && ballsInCurrentOver === 6) {
        overs += 1;
        ballsInCurrentOver = 0;
        currentOverBalls.length = 0; // Clear visual over sequence

        // Swap strike
        const temp = currentStrikerName;
        currentStrikerName = currentNonStrikerName;
        currentNonStrikerName = temp;

        // Change bowler
        bowlerIndex = (bowlerIndex + 1) % bowlingTeam.players.length;
        currentBowlerName = bowlingTeam.players[bowlerIndex];
      }
    }

    return {
      battingTeamId: battingTeam.id,
      bowlingTeamId: bowlingTeam.id,
      runs,
      wickets,
      overs,
      ballsInCurrentOver,
      extras: extrasState,
      batsmen: batsmenMap,
      bowlers: bowlersMap,
      currentOverBalls,
      ballRecords,
      fallOfWickets
    };
  };

  // Build Inning 1
  const numInning1Balls = Math.min(inning1Props.length, totalLiveBowledBalls);
  const inning1 = buildInningState(teamA, teamB, inning1Props, numInning1Balls);

  // Build Inning 2 (if we've completed All inning 1 balls)
  let innings = [inning1];
  let currentInningIndex = 0;
  let status: Match["status"] = "Ongoing";
  let target = inning1.runs + 1;
  let matchResult = "";
  
  let currentStriker = "Sunny";
  let currentNonStriker = "Chiku";
  let currentBowler = "Monu";

  if (totalLiveBowledBalls >= 31) {
    currentInningIndex = 1;
    status = "Chasing";
    const numInning2Balls = Math.min(inning2Props.length, totalLiveBowledBalls - 31);
    const inning2 = buildInningState(teamB, teamA, inning2Props, numInning2Balls);
    innings.push(inning2);

    const targetRuns = target;
    
    // Find current active players from records
    if (inning2.ballRecords.length > 0) {
      const lastRec = inning2.ballRecords[inning2.ballRecords.length - 1];
      currentStriker = lastRec.striker;
      currentNonStriker = lastRec.nonStriker;
      currentBowler = inning2.ballRecords[inning2.ballRecords.length - 1].bowler;
    } else {
      currentStriker = teamB.players[0];
      currentNonStriker = teamB.players[1];
      currentBowler = teamA.players[0];
    }

    // Check completed state
    if (inning2.runs >= targetRuns) {
      status = "Completed";
      matchResult = `Bazaar Badshahs won by ${5 - inning2.wickets} wickets (Live Streaming Broadcast)`;
    } else if (inning2.overs >= 5 || inning2.wickets >= 4) {
      status = "Completed";
      if (inning2.runs === targetRuns - 1) {
        matchResult = "Match Tied! Classic super over drama on gully layout!";
      } else {
        matchResult = `Chawl Champions won by ${targetRuns - 1 - inning2.runs} runs (Live Streaming Broadcast)`;
      }
    }
  } else {
    // Inning 1 ongoing
    if (inning1.ballRecords.length > 0) {
      const lastRec = inning1.ballRecords[inning1.ballRecords.length - 1];
      currentStriker = lastRec.striker;
      currentNonStriker = lastRec.nonStriker;
      currentBowler = lastRec.bowler;
    }
  }

  if (status === "Completed") {
    currentStriker = "";
    currentNonStriker = "";
    currentBowler = "";
  }

  return {
    id: matchId,
    teamAId: teamA.id,
    teamBId: teamB.id,
    teamAName: teamA.name,
    teamBName: teamB.name,
    oversAllowed,
    status,
    currentInningIndex,
    innings,
    currentStriker,
    currentNonStriker,
    currentBowler,
    matchResult: matchResult || undefined,
    playerOfTheMatch: status === "Completed" ? "Vicky" : undefined,
    date: "Live Broadcast Simulation",
    tournamentId: undefined,
    isLiveStreamed: true,
    youtubeId: customYoutubeId || undefined
  };
}
