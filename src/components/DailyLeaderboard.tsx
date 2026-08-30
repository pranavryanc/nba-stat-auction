import { RefreshCcw } from 'lucide-react';

type DailyLeaderboardEntry = {
  player_label: string;
  lineup: Array<{ name: string }>;
  score: number;
  projected_wins: number;
};

type DailyLeaderboardProps = {
  entries: DailyLeaderboardEntry[];
  loading: boolean;
  onRefresh: () => void;
};

export function DailyLeaderboard({ entries, loading, onRefresh }: DailyLeaderboardProps) {
  return (
    <section className="mb-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">
            Daily leaderboard
          </p>
          <h3 className="text-xl font-black">Top lineups today</h3>
        </div>
        <button
          onClick={onRefresh}
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5"
          aria-label="Refresh leaderboard"
        >
          <RefreshCcw size={16} />
        </button>
      </div>

      <div className="mt-4 grid gap-2">
        {entries.map((entry, index) => (
          <div
            key={entry.player_label + '-' + index}
            className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-xl border border-white/5 bg-black/20 p-3"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-400/10 text-sm font-black text-amber-200">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="font-bold">{entry.player_label}</p>
              <p className="truncate text-xs text-slate-500">
                {entry.lineup.map((player) => player.name).join(' · ')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black">{entry.score}</p>
              <p className="text-[10px] text-slate-500">
                {entry.projected_wins}-{82 - entry.projected_wins}
              </p>
            </div>
          </div>
        ))}

        {!entries.length && (
          <p className="rounded-xl bg-black/20 p-4 text-sm text-slate-500">
            {loading ? 'Loading leaderboard…' : 'No Daily scores have been submitted yet.'}
          </p>
        )}
      </div>
    </section>
  );
}
