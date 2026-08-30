import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, ChevronRight, Crown, Medal, Trophy } from 'lucide-react';
import type { GameMode } from '../types';

type HighScore = {
  mode: GameMode;
  score: number;
  projected_wins: number;
  net_rating: number;
};

type LeaderboardEntry = {
  player_label: string;
  lineup: Array<{ name: string }>;
  score: number;
};

type HomeScreenProps = {
  open: boolean;
  username: string;
  highScores: HighScore[];
  dailyLeaderboard: LeaderboardEntry[];
  leaderboardLoading: boolean;
  onStartMode: (mode: GameMode) => void;
  onOpenProfile: () => void;
  onSignOut: () => void;
  onOpenStats: () => void;
};

const modes: Array<{
  id: GameMode;
  title: string;
  copy: string;
  icon: string;
}> = [
  {
    id: 'daily',
    title: 'Daily Challenge',
    copy: 'Same pool and $150 cap for everyone today.',
    icon: '🏆',
  },
  {
    id: 'classic',
    title: 'Classic',
    copy: 'One attempt, then compare with the ideal lineup.',
    icon: '🎲',
  },
  {
    id: 'unlimited',
    title: 'Unlimited',
    copy: 'Keep solving the same pool until you find the best five.',
    icon: '♾️',
  },
  {
    id: 'historic',
    title: 'Historic',
    copy: 'Draft 100 player-seasons from across NBA history.',
    icon: '🕰️',
  },
];

const recordModes: GameMode[] = ['classic', 'daily', 'unlimited', 'historic'];

export function HomeScreen({
  open,
  username,
  highScores,
  dailyLeaderboard,
  leaderboardLoading,
  onStartMode,
  onOpenProfile,
  onSignOut,
  onOpenStats,
}: HomeScreenProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.section
          className="mobile-home fixed inset-0 z-[55] overflow-y-auto bg-[#050816] bg-[radial-gradient(circle_at_18%_0%,rgba(37,99,235,.26),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(225,29,72,.18),transparent_28%)] px-4 pb-10 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-8 md:px-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="mx-auto flex min-h-full max-w-5xl flex-col">
            <div className="mt-5 text-center md:mt-12">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] bg-gradient-to-br from-blue-500 to-rose-500 shadow-[0_20px_70px_rgba(59,130,246,.35)] md:h-24 md:w-24 md:rounded-[32px]">
                <Trophy size={38} />
              </div>
              <p className="mt-6 text-xs font-black uppercase tracking-[.3em] text-blue-400">
                Build five. Beat the cap.
              </p>
              <h1 className="mt-2 text-4xl font-black leading-tight md:text-6xl">
                NBA Stat
                <br />
                <span className="text-gradient">Auction</span>
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-400 md:text-base">
                Draft a balanced starting five, stay under budget, and see how your lineup projects.
              </p>
            </div>

            <div className="mt-8 grid gap-3 md:mt-10 md:grid-cols-2 md:gap-4">
              {modes.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onStartMode(item.id)}
                  className="group flex min-h-[96px] w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[.055] p-4 text-left transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[.08] active:scale-[.98] md:p-5"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/5 text-2xl md:h-14 md:w-14 md:text-3xl">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-black md:text-xl">{item.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-400">{item.copy}</span>
                  </span>
                  <ChevronRight className="text-slate-600" />
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[.045] p-5 text-left">
                <div className="flex items-center gap-2">
                  <Medal className="text-amber-300" size={18} />
                  <h3 className="font-black">My Records</h3>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {recordModes.map((recordMode) => {
                    const record = highScores.find((item) => item.mode === recordMode);
                    return (
                      <div key={recordMode} className="rounded-xl bg-black/20 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          {recordMode}
                        </p>
                        <p className="mt-1 text-2xl font-black">{record?.score ?? '—'}</p>
                        <p className="text-[10px] text-slate-500">
                          {record
                            ? record.projected_wins +
                              '-' +
                              (82 - record.projected_wins) +
                              ' · ' +
                              (record.net_rating > 0 ? '+' : '') +
                              record.net_rating +
                              ' net'
                            : 'No score yet'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-300/15 bg-amber-400/[.055] p-5 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="text-amber-300" size={18} />
                    <h3 className="font-black">Today’s Leaders</h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">TOP 3</span>
                </div>

                <div className="mt-4 space-y-2">
                  {dailyLeaderboard.slice(0, 3).map((entry, index) => (
                    <div
                      key={entry.player_label + '-' + index}
                      className="flex items-center gap-3 rounded-xl bg-black/20 p-3"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-400/10 text-xs font-black text-amber-200">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{entry.player_label}</p>
                        <p className="truncate text-[10px] text-slate-500">
                          {entry.lineup.map((player) => player.name).join(' · ')}
                        </p>
                      </div>
                      <p className="text-xl font-black">{entry.score}</p>
                    </div>
                  ))}

                  {!dailyLeaderboard.length && (
                    <p className="rounded-xl bg-black/20 p-4 text-sm text-slate-500">
                      {leaderboardLoading
                        ? 'Loading leaderboard…'
                        : 'No Daily scores yet. Be the first.'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="mx-auto mt-5 flex w-full max-w-md items-center justify-between rounded-2xl border border-white/10 bg-white/[.035] p-3">
              <div className="min-w-0 text-left">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Signed in as
                </p>
                <p className="truncate font-black text-blue-300">@{username}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onOpenProfile}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold hover:bg-white/10"
                >
                  Profile
                </button>
                <button
                  onClick={onSignOut}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  Sign out
                </button>
              </div>
            </div>

            <button
              onClick={onOpenStats}
              className="mx-auto mt-3 flex min-h-14 w-full max-w-md items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 font-bold transition hover:bg-white/10"
            >
              <BarChart3 size={18} />
              Player Statistics
            </button>

            <p className="mt-auto pt-8 text-center text-[11px] text-slate-600 md:text-xs">
              2 Guards · 2 Forwards · 1 Center
            </p>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
