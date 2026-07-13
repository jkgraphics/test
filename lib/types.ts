export type ExtraType = 'Wd' | 'Nb' | 'By' | 'Lb' | 'None';

export type WicketType = 'Bowled' | 'Caught' | 'LBW' | 'Run Out' | 'Stumped' | 'Hit Wicket' | 'Retired Hurt' | 'Other';

export interface PlayerStats {
  name: string;
  runsScored: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  howOut?: string;
  bowlerName?: string;
  // Bowling
  ballsBowled: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
}

export interface Team {
  id: string;
  name: string;
  players: string[]; // List of player names
  playerImages?: { [playerName: string]: string }; // Optional map of player name to profile image URL
}

export interface BallRecord {
  ballId: string;
  overNumber: number; // 0-indexed over
  ballInOver: number; // 1-indexed legal ball count (1 to 6)
  bowler: string;
  striker: string;
  nonStriker: string;
  runsBat: number; // Runs scored from the bat
  extraType: ExtraType;
  extraRuns: number; // Penalties or extra runs (e.g. 1 for wide)
  runsTotal: number; // Total runs on this ball (runsBat + extraRuns)
  isLegal: boolean;
  wicket?: {
    type: WicketType;
    playerOut: string; // Name of player who got out
    fielder?: string; // Fielder involved in run out, catch or stumping
  };
  commentary?: string;
}

export interface MatchInning {
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  overs: number; // Completed overs count
  ballsInCurrentOver: number; // Legal balls in current over (0-5)
  extras: {
    wides: number;
    noBalls: number;
    byes: number;
    legByes: number;
    total: number;
  };
  batsmen: {
    [name: string]: {
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
      isOut: boolean;
      howOut?: string;
      bowledBy?: string;
    }
  };
  bowlers: {
    [name: string]: {
      balls: number;
      maidens: number;
      runs: number;
      wickets: number;
    }
  };
  currentOverBalls: string[]; // Ball labels for visual over timeline (e.g., "1", "Wd", "4", "W")
  ballRecords: BallRecord[]; // Detailed ledger of every ball in this inning
  fallOfWickets: {
    runs: number;
    wickets: number;
    oversString: string;
    batsmanName: string;
  }[];
}

export interface Match {
  id: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  oversAllowed: number;
  tossWinnerId?: string;
  tossDecision?: 'Bat' | 'Bowl';
  status: 'Setup' | 'Toss' | 'Ongoing' | 'InningsBreak' | 'Chasing' | 'Completed';
  currentInningIndex: number; // 0 for Inning 1, 1 for Inning 2
  innings: MatchInning[];
  currentStriker: string; // Name of current striker
  currentNonStriker: string; // Name of current non-striker
  currentBowler: string; // Name of current bowler
  matchResult?: string;
  playerOfTheMatch?: string;
  date: string;
  tournamentId?: string;
  isLiveStreamed?: boolean;
  youtubeId?: string;
}

export interface TournamentMatch {
  id: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  oversAllowed: number;
  status: 'Scheduled' | 'Ongoing' | 'Completed';
  matchId?: string; // Linked Match ID when played
  matchResult?: string;
  date: string;
}

export interface TournamentTeamPoints {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
  runsScored: number;
  ballsFaced: number; // For NRR calculation: NRR = (Runs Scored / Overs Faced) - (Runs Conceded / Overs Bowled)
  runsConceded: number;
  ballsBowled: number;
  nrr: number;
}

export interface Tournament {
  id: string;
  name: string;
  teams: Team[];
  matches: TournamentMatch[];
  pointsTable: {
    [teamId: string]: TournamentTeamPoints;
  };
}

export interface LiveStreamUpdate {
  matchId: string;
  match: Match;
  lastUpdated: string;
}
