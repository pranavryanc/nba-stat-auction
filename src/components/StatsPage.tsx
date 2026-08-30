import { useState } from 'react';
import { Search } from 'lucide-react';
import type { Player } from '../types';
import { positionText } from '../lib/gameLogic';

type StatsSort =
  'name' | 'price' | 'points' | 'rebounds' | 'assists' | 'steals' | 'blocks' | 'trueShooting';

type StatsPageProps = {
  players: Player[];
  onBack: () => void;
};

export function StatsPage({ players, onBack }: StatsPageProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<StatsSort>('name');

  const perPage = 20;
  const filteredPlayers = players
    .filter((player) =>
      (player.name + ' ' + player.teamAbbreviation + ' ' + positionText(player))
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === 'price') return b.price - a.price;
      if (sort === 'points') return b.points - a.points;
      if (sort === 'rebounds') return b.rebounds - a.rebounds;
      if (sort === 'assists') return b.assists - a.assists;
      if (sort === 'steals') return b.steals - a.steals;
      if (sort === 'blocks') return b.blocks - a.blocks;
      if (sort === 'trueShooting') return b.trueShooting - a.trueShooting;
      return a.name.localeCompare(b.name);
    });

  const pageCount = Math.max(1, Math.ceil(filteredPlayers.length / perPage));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * perPage;
  const visiblePlayers = filteredPlayers.slice(start, start + perPage);
  const visiblePages = Array.from({ length: pageCount }, (_, index) => index + 1).filter(
    (candidate) =>
      candidate === 1 || candidate === pageCount || Math.abs(candidate - safePage) <= 1,
  );

  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const changeSort = (value: StatsSort) => {
    setSort(value);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#18254a_0,_#050816_42%)] px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))] sm:px-5 md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 pt-3 sm:pt-0">
          <p className="text-xs font-bold uppercase tracking-[.3em] text-blue-400">
            League database
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Player Statistics</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
            Advanced metrics are visible here and in the post-auction team report. Prices include
            PTS + REB + AST + STL + BLK.
          </p>
        </div>

        <button
          onClick={onBack}
          className="mb-7 min-h-12 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold hover:bg-white/10 active:scale-[.98]"
        >
          ← Back to game
        </button>

        <div className="mb-5 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-3 sm:grid-cols-[1fr_220px]">
          <label className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              size={18}
            />
            <input
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
              placeholder="Search player, team, or position"
              className="min-h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 text-base outline-none placeholder:text-slate-600 focus:border-blue-500/60"
            />
          </label>

          <select
            value={sort}
            onChange={(event) => changeSort(event.target.value as StatsSort)}
            className="min-h-12 rounded-xl border border-white/10 bg-slate-900 px-4 text-base outline-none focus:border-blue-500/60"
          >
            <option value="name">Sort: Alphabetical</option>
            <option value="price">Sort: Price</option>
            <option value="points">Sort: Points</option>
            <option value="rebounds">Sort: Rebounds</option>
            <option value="assists">Sort: Assists</option>
            <option value="steals">Sort: Steals</option>
            <option value="blocks">Sort: Blocks</option>
            <option value="trueShooting">Sort: True Shooting</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase text-slate-400">
                <tr>
                  {[
                    'Player',
                    'Season',
                    'Pos',
                    'Price',
                    'PTS',
                    'REB',
                    'AST',
                    'STL',
                    'BLK',
                    'TS%',
                    '3P%',
                    'ORtg',
                    'DRtg',
                    'USG%',
                    'PER',
                    'BPM',
                    'EPM',
                  ].map((heading) => (
                    <th key={heading} className="whitespace-nowrap px-4 py-4">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiblePlayers.map((player) => (
                  <tr key={player.id} className="border-t border-white/5 hover:bg-white/[.03]">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold">
                      {player.name}
                      <span className="ml-2 text-xs text-slate-500">{player.teamAbbreviation}</span>
                    </td>
                    <td className="whitespace-nowrap px-4">{player.season ?? '2025-26'}</td>
                    <td className="whitespace-nowrap px-4">{positionText(player)}</td>
                    <td className="px-4">
                      {'$'}
                      {player.price}
                    </td>
                    <td className="px-4">{player.points.toFixed(1)}</td>
                    <td className="px-4">{player.rebounds.toFixed(1)}</td>
                    <td className="px-4">{player.assists.toFixed(1)}</td>
                    <td className="px-4">{player.steals.toFixed(1)}</td>
                    <td className="px-4">{player.blocks.toFixed(1)}</td>
                    <td className="px-4">{player.trueShooting.toFixed(1)}</td>
                    <td className="px-4">{player.threePointPercentage.toFixed(1)}</td>
                    <td className="px-4">{player.offensiveRating}</td>
                    <td className="px-4">{player.defensiveRating}</td>
                    <td className="px-4">{player.usageRate.toFixed(1)}</td>
                    <td className="px-4">{player.playerEfficiencyRating.toFixed(1)}</td>
                    <td className="px-4">{player.boxPlusMinus.toFixed(1)}</td>
                    <td className="px-4">{player.estimatedPlusMinus.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visiblePlayers.length === 0 && (
            <div className="px-6 py-14 text-center text-slate-400">
              No players match that search.
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-center text-sm text-slate-400 sm:text-left">
            Showing{' '}
            <span className="font-bold text-white">
              {filteredPlayers.length === 0 ? 0 : start + 1}–
              {Math.min(start + perPage, filteredPlayers.length)}
            </span>{' '}
            of <span className="font-bold text-white">{filteredPlayers.length}</span> players
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              disabled={safePage === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-35"
            >
              Previous
            </button>

            {visiblePages.map((candidate, index) => {
              const previous = visiblePages[index - 1];
              return (
                <span key={candidate} className="contents">
                  {previous && candidate - previous > 1 ? (
                    <span className="px-1 text-slate-500">…</span>
                  ) : null}
                  <button
                    onClick={() => setPage(candidate)}
                    aria-current={candidate === safePage ? 'page' : undefined}
                    className={
                      'grid h-11 min-w-11 place-items-center rounded-xl border text-sm font-black ' +
                      (candidate === safePage
                        ? 'border-blue-400 bg-blue-500 text-white'
                        : 'border-white/10 bg-white/5 text-slate-300')
                    }
                  >
                    {candidate}
                  </button>
                </span>
              );
            })}

            <button
              disabled={safePage === pageCount}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-35"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
