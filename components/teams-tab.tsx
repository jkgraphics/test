"use client";

import React, { useState } from "react";
import { Plus, Trash2, Users, UserPlus, Info } from "lucide-react";
import { Team } from "@/lib/types";

interface TeamsTabProps {
  teams: Team[];
  onSaveTeams: (teams: Team[]) => void;
  isDarkMode: boolean;
}

export default function TeamsTab({ teams, onSaveTeams, isDarkMode }: TeamsTabProps) {
  const [newTeamName, setNewTeamName] = useState("");
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [editingPlayerName, setEditingPlayerName] = useState<string | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState("");

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    // Reject duplicates
    if (teams.some((t) => t.name.toLowerCase() === newTeamName.trim().toLowerCase())) {
      alert("A team with this name already exists!");
      return;
    }

    const newTeam: Team = {
      id: "team-" + Math.random().toString(36).substring(2, 9),
      name: newTeamName.trim(),
      players: [],
      playerImages: {},
    };

    const updated = [...teams, newTeam];
    onSaveTeams(updated);
    setNewTeamName("");
    setActiveTeamId(newTeam.id);
  };

  const handleDeleteTeam = (id: string) => {
    if (confirm("Are you sure you want to delete this team? All its players will be removed.")) {
      const updated = teams.filter((t) => t.id !== id);
      onSaveTeams(updated);
      if (activeTeamId === id) setActiveTeamId(null);
    }
  };

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeamId || !newPlayerName.trim()) return;

    const targetTeam = teams.find((t) => t.id === activeTeamId);
    if (!targetTeam) return;

    // Prevent duplicates in same team
    if (targetTeam.players.some((name) => name.toLowerCase() === newPlayerName.trim().toLowerCase())) {
      alert("This player is already on the team roster!");
      return;
    }

    const updatedTeams = teams.map((t) => {
      if (t.id === activeTeamId) {
        const trimmedName = newPlayerName.trim();
        const generatedAvatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(trimmedName)}`;
        return {
          ...t,
          players: [...t.players, trimmedName],
          playerImages: {
            ...(t.playerImages || {}),
            [trimmedName]: generatedAvatarUrl,
          },
        };
      }
      return t;
    });

    onSaveTeams(updatedTeams);
    setNewPlayerName("");
  };

  const handleRemovePlayer = (teamId: string, playerName: string) => {
    const updatedTeams = teams.map((t) => {
      if (t.id === teamId) {
        const updatedImages = { ...(t.playerImages || {}) };
        delete updatedImages[playerName];
        return {
          ...t,
          players: t.players.filter((name) => name !== playerName),
          playerImages: updatedImages,
        };
      }
      return t;
    });
    onSaveTeams(updatedTeams);
    if (editingPlayerName === playerName) {
      setEditingPlayerName(null);
    }
  };

  const handleSavePlayerImage = (teamId: string, playerName: string, imageUrl: string) => {
    const updatedTeams = teams.map((t) => {
      if (t.id === teamId) {
        return {
          ...t,
          playerImages: {
            ...(t.playerImages || {}),
            [playerName]: imageUrl.trim(),
          },
        };
      }
      return t;
    });
    onSaveTeams(updatedTeams);
  };

  const selectedTeam = teams.find((t) => t.id === activeTeamId);

  return (
    <div id="teams-tab-container" className="space-y-6">
      {/* Overview Card */}
      <div id="teams-overview" className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Teams Registry</h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              Create local teams and build your standard playing rosters (min. 2 players)
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Create & List Teams */}
        <div className="space-y-4 md:col-span-1">
          <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl p-4 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold tracking-tight uppercase text-slate-400 dark:text-neutral-500">
              Create Team
            </h3>
            <form onSubmit={handleCreateTeam} className="flex gap-2">
              <input
                id="team-name-input"
                type="text"
                placeholder="e.g. Colony Kings"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                maxLength={25}
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                id="create-team-btn"
                type="submit"
                className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition shadow-md flex items-center justify-center"
              >
                <Plus className="w-5 h-5" />
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold tracking-tight uppercase text-slate-400 dark:text-neutral-500">
              Select/Manage Team
            </h3>
            {teams.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-neutral-600">
                No teams registered. Create a team above.
              </div>
            ) : (
              <div id="teams-list" className="space-y-2 max-h-80 overflow-y-auto">
                {teams.map((t) => (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer border transition-all ${
                      activeTeamId === t.id
                        ? "bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800"
                        : "bg-slate-50 border-transparent hover:bg-slate-100 dark:bg-neutral-800/50 dark:hover:bg-neutral-800"
                    }`}
                    onClick={() => setActiveTeamId(t.id)}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-medium text-sm truncate">{t.name}</p>
                      <p className="text-xs text-slate-400 dark:text-neutral-500">
                        {t.players.length} players listed
                      </p>
                    </div>
                    <button
                      id={`delete-team-${t.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTeam(t.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Roster Management */}
        <div className="md:col-span-2">
          {selectedTeam ? (
            <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl p-5 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-neutral-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold">{selectedTeam.name} Roster</h3>
                  <p className="text-xs text-slate-400 dark:text-neutral-500">
                    Manage squad names for scorecard matches (Minimum 2 recommended)
                  </p>
                </div>
                <span className="self-start sm:self-center px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 rounded-full">
                  Total Match Squad: {selectedTeam.players.length}
                </span>
              </div>

              {/* Add Entry Card */}
              <form onSubmit={handleAddPlayer} className="flex gap-2">
                <input
                  id="player-name-input"
                  type="text"
                  placeholder="Enter Player Name (e.g. Sunny)"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  maxLength={20}
                  className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  id="add-player-btn"
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl transition flex items-center gap-1.5 shadow-md"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add Player</span>
                </button>
              </form>

              {/* Roster Listing */}
              {selectedTeam.players.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-slate-100 dark:border-neutral-800 rounded-xl space-y-2">
                  <span className="inline-block p-2.5 bg-slate-50 dark:bg-neutral-800 rounded-full text-slate-400">
                    <UserPlus className="w-6 h-6" />
                  </span>
                  <p className="text-xs text-slate-400 dark:text-neutral-500">No players in roster yet.</p>
                  <p className="text-[11px] text-slate-400">Add some names above to get started scoring!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedTeam.players.map((p, idx) => {
                    const fallbackUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(p)}`;
                    const avatarUrl = selectedTeam.playerImages?.[p] || fallbackUrl;
                    const isEditing = editingPlayerName === p;

                    return (
                      <div
                        key={p + idx}
                        className={`flex flex-col p-3 bg-slate-50 dark:bg-neutral-800/20 rounded-xl border transition-all ${
                          isEditing
                            ? "border-emerald-500/50 bg-emerald-50/5 dark:bg-emerald-950/5 ring-1 ring-emerald-500/20"
                            : "border-slate-100 dark:border-neutral-800/40 hover:border-slate-200 dark:hover:border-neutral-800"
                        }`}
                      >
                        <div className="flex items-center justify-between min-w-0">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-bold text-slate-400 font-mono w-4">{idx + 1}</span>
                            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-emerald-50 dark:bg-emerald-950/20 border border-slate-150 dark:border-neutral-800/80 flex items-center justify-center flex-shrink-0 shadow-xs">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={avatarUrl}
                                alt={`${p}'s profile`}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate text-slate-800 dark:text-neutral-100">{p}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isEditing) {
                                    setEditingPlayerName(null);
                                  } else {
                                    setEditingPlayerName(p);
                                    setCustomImageUrl(selectedTeam.playerImages?.[p] || "");
                                  }
                                }}
                                className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-medium block text-left"
                              >
                                {isEditing ? "Cancel Edit" : "Change Avatar"}
                              </button>
                            </div>
                          </div>

                          <button
                            id={`delete-player-${p}`}
                            onClick={() => handleRemovePlayer(selectedTeam.id, p)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-500 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {isEditing && (
                          <div className="pt-3 mt-3 border-t border-slate-200/50 dark:border-neutral-800/60 space-y-2.5 text-xs animate-fade-in">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider block">Custom Image URL</label>
                              <input
                                type="text"
                                placeholder="Paste an image address (e.g. https://...)"
                                value={customImageUrl}
                                onChange={(e) => setCustomImageUrl(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider block">Or Choose Preset Placeholder Styles</label>
                              <div className="flex flex-wrap gap-1">
                                {[
                                  { label: "Adventurer", url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(p)}` },
                                  { label: "Fun Emoji", url: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(p)}` },
                                  { label: "Pixel Art", url: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(p)}` },
                                  { label: "Bottts", url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p)}` },
                                  { label: "Initials", url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p)}` },
                                ].map((preset) => (
                                  <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => setCustomImageUrl(preset.url)}
                                    className={`px-2 py-1 text-[10px] font-semibold rounded-md border transition ${
                                      customImageUrl === preset.url
                                        ? "bg-emerald-50 border-emerald-300 text-emerald-600 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
                                        : "bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 hover:border-slate-300 dark:hover:border-neutral-600 text-slate-600 dark:text-neutral-300"
                                    }`}
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                handleSavePlayerImage(selectedTeam.id, p, customImageUrl || fallbackUrl);
                                setEditingPlayerName(null);
                              }}
                              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition shadow-sm cursor-pointer"
                            >
                              Save Avatar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 border-dashed rounded-2xl space-y-3">
              <span className="p-3 bg-white dark:bg-neutral-800 rounded-2xl shadow-sm text-slate-400">
                <Users className="w-8 h-8 text-slate-400 dark:text-neutral-500" />
              </span>
              <p className="text-sm font-medium text-slate-500">No active selection</p>
              <p className="text-xs text-slate-400 text-center max-w-xs">
                Select a team from the left menu or create a new one to manage its players.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
