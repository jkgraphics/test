"use client";

import React, { useState } from "react";
import { Plus, Trophy, Calendar, ClipboardList, Play, Trash2 } from "lucide-react";
import { Tournament, Team, TournamentMatch, TournamentTeamPoints } from "@/lib/types";

interface TournamentsTabProps {
  tournaments: Tournament[];
  teams: Team[];
  onSaveTournaments: (tournaments: Tournament[]) => void;
  onStartMatchFromFixture: (
    teamAId: string,
    teamBId: string,
    overs: number,
    tournamentId: string,
    fixtureId: string
  ) => void;
  isDarkMode: boolean;
}

export default function TournamentsTab({
  tournaments,
  teams,
  onSaveTournaments,
  onStartMatchFromFixture,
  isDarkMode,
}: TournamentsTabProps) {
  const [newTourneyName, setNewTourneyName] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [activeTourneyId, setActiveTourneyId] = useState<string | null>(null);

  // Scheduling state
  const [fixtureTeamA, setFixtureTeamA] = useState("");
  const [fixtureTeamB, setFixtureTeamB] = useState("");
  const [fixtureOvers, setFixtureOvers] = useState(5);
  const [fixtureDate, setFixtureDate] = useState("");

  const handleCreateTournament = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTourneyName.trim()) return;
    if (selectedTeamIds.length < 2) {
      alert("Please select at least 2 teams to participate in the tournament!");
      return;
    }

    const participatingTeams = teams.filter((t) => selectedTeamIds.includes(t.id));

    // Initialize points table records
    const initialPointsTable: { [teamId: string]: TournamentTeamPoints } = {};
    participatingTeams.forEach((t) => {
      initialPointsTable[t.id] = {
        teamId: t.id,
        teamName: t.name,
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        points: 0,
        runsScored: 0,
        ballsFaced: 0,
        runsConceded: 0,
        ballsBowled: 0,
        nrr: 0.0,
      };
    });

    const newTournament: Tournament = {
      id: "tourney-" + Math.random().toString(36).substring(2, 9),
      name: newTourneyName.trim(),
      teams: participatingTeams,
      matches: [],
      pointsTable: initialPointsTable,
    };

    const updated = [...tournaments, newTournament];
    onSaveTournaments(updated);
    setNewTourneyName("");
    setSelectedTeamIds([]);
    setActiveTourneyId(newTournament.id);
  };

  const handleDeleteTournament = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this tournament? This will drop its points table and all schedules.")) {
      const updated = tournaments.filter((t) => t.id !== id);
      onSaveTournaments(updated);
      if (activeTourneyId === id) setActiveTourneyId(null);
    }
  };

  const handleSelectTeamCheckbox = (teamId: string) => {
    if (selectedTeamIds.includes(teamId)) {
      setSelectedTeamIds(selectedTeamIds.filter((id) => id !== teamId));
    } else {
      setSelectedTeamIds([...selectedTeamIds, teamId]);
    }
  };

  const handleScheduleMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTourneyId) return;
    if (!fixtureTeamA || !fixtureTeamB) {
      alert("Please select both Team A and Team B!");
      return;
    }
    if (fixtureTeamA === fixtureTeamB) {
      alert("A team cannot play against itself!");
      return;
    }

    const tourney = tournaments.find((t) => t.id === activeTourneyId);
    if (!tourney) return;

    const teamAName = tourney.teams.find((t) => t.id === fixtureTeamA)?.name || "Team A";
    const teamBName = tourney.teams.find((t) => t.id === fixtureTeamB)?.name || "Team B";

    const newMatch: TournamentMatch = {
      id: "fixture-" + Math.random().toString(36).substring(2, 9),
      teamAId: fixtureTeamA,
      teamBId: fixtureTeamB,
      teamAName,
      teamBName,
      oversAllowed: fixtureOvers,
      status: "Scheduled",
      date: fixtureDate || new Date().toISOString().split("T")[0],
    };

    const updatedTournaments = tournaments.map((t) => {
      if (t.id === activeTourneyId) {
        return {
          ...t,
          matches: [...t.matches, newMatch],
        };
      }
      return t;
    });

    onSaveTournaments(updatedTournaments);
    setFixtureTeamA("");
    setFixtureTeamB("");
    setFixtureDate("");
  };

  const activeTourney = tournaments.find((t) => t.id === activeTourneyId);

  // Sorting Points Table: 1st by Points, 2nd by NRR
  const sortedPointsTable = activeTourney
    ? Object.values(activeTourney.pointsTable).sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        return b.nrr - a.nrr;
      })
    : [];

  return (
    <div id="tournaments-tab" className="space-y-6">
      {/* Overview Block */}
      <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl animate-pulse">
            <Trophy className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Colony Tournament Manager</h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              Set up local street leagues, generate fixtures, and auto-tally Net Run Rate metrics
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Tournament Creation and Selection */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl p-4 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold tracking-tight uppercase text-slate-400 dark:text-neutral-500">
              Create Tournament
            </h3>
            {teams.length < 2 ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 rounded-xl text-xs space-y-2">
                <p className="font-semibold">Teams Required</p>
                <p>Register at least 2 teams in the Teams tab to set up a league tournament.</p>
              </div>
            ) : (
              <form onSubmit={handleCreateTournament} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">Tournament Name</label>
                  <input
                    id="tourney-name-input"
                    type="text"
                    required
                    placeholder="e.g. Colony Premier League"
                    value={newTourneyName}
                    onChange={(e) => setNewTourneyName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400">Select Teams to Participate</label>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-100 dark:border-neutral-800 rounded-xl p-2 bg-slate-50/50 dark:bg-neutral-800/30">
                    {teams.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 cursor-pointer text-xs p-1">
                        <input
                          type="checkbox"
                          checked={selectedTeamIds.includes(t.id)}
                          onChange={() => handleSelectTeamCheckbox(t.id)}
                          className="rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span className="truncate font-medium">{t.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  id="create-tourney-btn"
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl transition shadow flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Launch League</span>
                </button>
              </form>
            )}
          </div>

          {/* Active Tournament List */}
          <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold tracking-tight uppercase text-slate-400 dark:text-neutral-500">
              Active Tournaments
            </h3>
            {tournaments.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-neutral-600">
                No active tournaments launched. Create one above.
              </div>
            ) : (
              <div id="tournaments-list" className="space-y-2">
                {tournaments.map((t) => (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer border transition ${
                      activeTourneyId === t.id
                        ? "bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800"
                        : "bg-slate-50 border-transparent hover:bg-slate-100 dark:bg-neutral-800/50 dark:hover:bg-neutral-800"
                    }`}
                    onClick={() => setActiveTourneyId(t.id)}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-sm truncate">{t.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {t.teams.length} teams • {t.matches.length} fixtures
                      </p>
                    </div>
                    <button
                      id={`delete-tournament-${t.id}`}
                      onClick={(e) => handleDeleteTournament(t.id, e)}
                      className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Standings and Matches Schedules */}
        <div className="lg:col-span-2">
          {activeTourney ? (
            <div className="space-y-6">
              {/* Standings Points Table */}
              <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-3">
                  <div>
                    <h3 className="text-md font-bold tracking-tight flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <Trophy className="w-4 h-4" />
                      <span>Standings & Points Table</span>
                    </h3>
                    <p className="text-xs text-slate-400">Tally of wins and losses sorted by Net Run Rate (NRR)</p>
                  </div>
                </div>

                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-neutral-800 text-slate-400 uppercase font-semibold text-[10px]">
                        <th className="py-2.5">Pos</th>
                        <th className="py-2.5">Team</th>
                        <th className="py-2.5 text-center">P</th>
                        <th className="py-2.5 text-center">W</th>
                        <th className="py-2.5 text-center">L</th>
                        <th className="py-2.5 text-center">PTS</th>
                        <th className="py-2.5 text-right">NRR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-neutral-800/60">
                      {sortedPointsTable.map((record, index) => (
                        <tr key={record.teamId} className="font-medium hover:bg-slate-50/70 dark:hover:bg-neutral-800/20">
                          <td className="py-3 font-bold text-slate-400">{index + 1}</td>
                          <td className="py-3 font-semibold truncate max-w-[120px]">{record.teamName}</td>
                          <td className="py-3 text-center">{record.played}</td>
                          <td className="py-3 text-center text-emerald-600 font-bold">{record.won}</td>
                          <td className="py-3 text-center text-red-500">{record.lost}</td>
                          <td className="py-3 text-center font-extrabold pr-2">{record.points}</td>
                          <td
                            className={`py-3 text-right font-mono text-[11px] font-bold ${
                              record.nrr >= 0 ? "text-emerald-500" : "text-amber-500"
                            }`}
                          >
                            {record.nrr >= 0 ? "+" : ""}
                            {record.nrr.toFixed(3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Match Fixtures and Schedule Scheduler */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Schedule New Form */}
                <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl p-4 shadow-sm space-y-4">
                  <h3 className="text-sm font-semibold tracking-tight uppercase text-slate-400 dark:text-neutral-500 flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    <span>Schedule Fixture</span>
                  </h3>

                  <form onSubmit={handleScheduleMatch} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400">Team A (Batting / Host)</label>
                      <select
                        required
                        value={fixtureTeamA}
                        onChange={(e) => setFixtureTeamA(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="">-- Choose Team --</option>
                        {activeTourney.teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400">Team B (Bowling / Guest)</label>
                      <select
                        required
                        value={fixtureTeamB}
                        onChange={(e) => setFixtureTeamB(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="">-- Choose Team --</option>
                        {activeTourney.teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400">Overs Limit</label>
                        <select
                          value={fixtureOvers}
                          onChange={(e) => setFixtureOvers(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="2">2 Overs</option>
                          <option value="5">5 Overs</option>
                          <option value="10">10 Overs</option>
                          <option value="20">20 Overs</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400">Date</label>
                        <input
                          type="date"
                          value={fixtureDate}
                          onChange={(e) => setFixtureDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <button
                      id="schedule-fixture-btn"
                      type="submit"
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl transition shadow flex items-center justify-center gap-1"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Pin Fixture</span>
                    </button>
                  </form>
                </div>

                {/* Fixtures List */}
                <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl p-4 shadow-sm space-y-4">
                  <h3 className="text-sm font-semibold tracking-tight uppercase text-slate-400 dark:text-neutral-500 flex items-center gap-1">
                    <ClipboardList className="w-4 h-4 text-emerald-500" />
                    <span>Fixtures List</span>
                  </h3>

                  {activeTourney.matches.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 dark:text-neutral-600">
                      No matches scheduled for this tournament. Use the scheduler panel.
                    </div>
                  ) : (
                    <div id="fixtures-list" className="space-y-2 max-h-64 overflow-y-auto">
                      {activeTourney.matches.map((fixture) => (
                        <div
                          key={fixture.id}
                          className="border border-slate-100 dark:border-neutral-800 p-3 rounded-xl bg-slate-50/50 dark:bg-neutral-800/40 space-y-2"
                        >
                          <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold uppercase">
                            <span>{fixture.date}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded-full ${
                                fixture.status === "Completed"
                                  ? "bg-slate-100 dark:bg-neutral-800 text-slate-500"
                                  : fixture.status === "Ongoing"
                                  ? "bg-red-50 text-red-500 animate-pulse"
                                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20"
                              }`}
                            >
                              {fixture.status}
                            </span>
                          </div>

                          <div className="text-xs space-y-1">
                            <div className="flex items-center justify-between font-semibold">
                              <span>{fixture.teamAName}</span>
                              <span className="text-[10px] text-slate-400">vs</span>
                              <span>{fixture.teamBName}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 text-center">({fixture.oversAllowed} Over limit)</p>
                          </div>

                          {fixture.status === "Scheduled" && (
                            <button
                              id={`start-fixture-${fixture.id}`}
                              onClick={() =>
                                onStartMatchFromFixture(
                                  fixture.teamAId,
                                  fixture.teamBId,
                                  fixture.oversAllowed,
                                  activeTourney.id,
                                  fixture.id
                                )
                              }
                              className="w-full mt-1.5 py-1 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-1"
                            >
                              <Play className="w-3 h-3 fill-white" />
                              <span>Score Match</span>
                            </button>
                          )}

                          {fixture.status === "Completed" && fixture.matchResult && (
                            <div className="text-[10px] font-semibold text-center text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 p-1.5 rounded-lg">
                              {fixture.matchResult}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 border-dashed rounded-2xl space-y-3">
              <span className="p-3 bg-white dark:bg-neutral-800 rounded-2xl shadow-sm text-slate-400">
                <Trophy className="w-8 h-8 text-slate-400" />
              </span>
              <p className="text-sm font-medium text-slate-500">No active tournament</p>
              <p className="text-xs text-slate-400 text-center max-w-xs">
                Select an existing tournament from the left menu or launch a new league.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
