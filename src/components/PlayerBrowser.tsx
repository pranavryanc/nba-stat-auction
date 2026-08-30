import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronRight, RefreshCcw, Search } from 'lucide-react';
import type { GameMode, Player, Position } from '../types';
import { canStillBuildValidRoster, positionBreakdownText, positionText } from '../lib/gameLogic';
import { PlayerImage, TeamLogo } from './PlayerMedia';

type PlayerBrowserProps = {
  displayed: Player[];
  selected: Player[];
  remaining: number;
  teams: string[];
  search: string;
  teamFilter: string;
  positionFilter: 'ALL' | Position;
  sort: string;
  maxPrice: number;
  mode: GameMode;
  onSearchChange: (value: string) => void;
  onTeamFilterChange: (value: string) => void;
  onPositionFilterChange: (value: 'ALL' | Position) => void;
  onSortChange: (value: string) => void;
  onMaxPriceChange: (value: number) => void;
  onNewPool: () => void;
  onSelectPlayer: (player: Player) => void;
};

export function PlayerBrowser({
  displayed,
  selected,
  remaining,
  teams,
  search,
  teamFilter,
  positionFilter,
  sort,
  maxPrice,
  mode,
  onSearchChange,
  onTeamFilterChange,
  onPositionFilterChange,
  onSortChange,
  onMaxPriceChange,
  onNewPool,
  onSelectPlayer,
}: PlayerBrowserProps) {
  return (
    <div>
      <div className="glass mb-4 hidden rounded-2xl p-3 sm:mb-5 sm:block">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_.7fr_.7fr_.8fr_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              aria-label="Search players"
              placeholder="Search players..."
              className="col-span-2 w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-10 pr-3 text-sm placeholder:text-slate-600"
            />
          </label>

          <select
            aria-label="Filter by team"
            value={teamFilter}
            onChange={(event) => onTeamFilterChange(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm"
          >
            <option value="ALL">All teams</option>
            {teams.map((team) => (
              <option key={team}>{team}</option>
            ))}
          </select>

          <select
            aria-label="Filter by position"
            value={positionFilter}
            onChange={(event) => onPositionFilterChange(event.target.value as 'ALL' | Position)}
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm"
          >
            <option value="ALL">All positions</option>
            <option value="G">Guards</option>
            <option value="F">Forwards</option>
            <option value="C">Centers</option>
          </select>

          <select
            aria-label="Sort players"
            value={sort}
            onChange={(event) => onSortChange(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm"
          >
            <option value="price-desc">Price: high to low</option>
            <option value="price-asc">Price: low to high</option>
            <option value="points">Points</option>
            <option value="rebounds">Rebounds</option>
            <option value="assists">Assists</option>
            <option value="steals">Steals</option>
            <option value="blocks">Blocks</option>
            <option value="alpha">Alphabetical</option>
          </select>

          <button
            onClick={onNewPool}
            disabled={mode === 'daily'}
            title={
              mode === 'daily' ? 'Daily pool is fixed for everyone' : 'Generate a new player pool'
            }
            className="col-span-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold sm:col-span-1 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCcw className="mr-1 inline" size={17} />
            <span className="hidden 2xl:inline">Reset pool</span>
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3 px-1">
          <span className="text-xs font-bold text-slate-500">Max price ${maxPrice}</span>
          <input
            type="range"
            aria-label={`Maximum player price: $${maxPrice}`}
            min="0"
            max="80"
            value={maxPrice}
            onChange={(event) => onMaxPriceChange(Number(event.target.value))}
            className="h-1 flex-1 accent-blue-500"
          />
          <span className="text-xs text-slate-600">{displayed.length} players</span>
        </div>
      </div>

      <motion.div
        layout
        className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-4"
      >
        <AnimatePresence>
          {displayed.map((player, index) => {
            const active = selected.some((selectedPlayer) => selectedPlayer.id === player.id);
            const unavailable =
              !active &&
              (player.price > remaining ||
                selected.length >= 5 ||
                !canStillBuildValidRoster([...selected, player]));

            return (
              <motion.article
                layout
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: Math.min(index * 0.015, 0.25) }}
                key={player.id}
                className={`group relative overflow-hidden rounded-2xl border transition duration-300 touch-manipulation ${active ? 'border-blue-400 bg-blue-500/10 shadow-[0_0_35px_rgba(59,130,246,.22)]' : 'border-white/10 bg-slate-900/60 hover:-translate-y-1 hover:border-white/25 hover:bg-slate-900/90'}`}
              >
                <div className="relative h-44 overflow-hidden bg-gradient-to-b from-slate-700 to-slate-950">
                  <PlayerImage player={player} />
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950 to-transparent" />
                  <div className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/75 backdrop-blur">
                    <TeamLogo player={player} />
                  </div>
                  <div
                    title={positionBreakdownText(player)}
                    className="absolute right-3 top-3 rounded-full border border-white/10 bg-slate-950/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
                  >
                    {positionText(player)}
                  </div>
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {player.teamAbbreviation}
                        {player.season ? ` · ${player.season}` : ''}
                      </p>
                      <h3 className="max-w-[155px] text-lg font-black leading-tight">
                        {player.name}
                      </h3>
                    </div>
                    <div className="rounded-xl bg-emerald-400 px-3 py-2 text-lg font-black text-emerald-950">
                      ${player.price}
                    </div>
                  </div>
                </div>

                <div className="p-2.5 sm:p-4">
                  <div className="mb-3 grid grid-cols-5 sm:mb-4 divide-x divide-white/10 rounded-xl bg-black/20 py-3 text-center">
                    <div>
                      <p className="text-[9px] font-bold text-slate-500">PTS</p>
                      <p className="font-black">{player.points.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-500">REB</p>
                      <p className="font-black">{player.rebounds.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-500">AST</p>
                      <p className="font-black">{player.assists.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-500">STL</p>
                      <p className="font-black">{player.steals.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-500">BLK</p>
                      <p className="font-black">{player.blocks.toFixed(1)}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectPlayer(player)}
                    disabled={unavailable}
                    aria-pressed={active}
                    aria-label={`${active ? 'Remove' : 'Select'} ${player.name}, $${player.price}`}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black transition ${active ? 'bg-blue-500 text-white hover:bg-blue-400' : unavailable ? 'cursor-not-allowed bg-white/5 text-slate-600' : 'bg-white text-slate-950 hover:bg-blue-100'}`}
                  >
                    {active ? (
                      <>
                        <Check size={17} />
                        Selected
                      </>
                    ) : (
                      <>
                        Select Player
                        <ChevronRight size={17} />
                      </>
                    )}
                  </button>
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
