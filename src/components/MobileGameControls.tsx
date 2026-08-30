import { AnimatePresence, motion } from 'framer-motion';
import { Home, Layers3, ListFilter, Search, Users, X } from 'lucide-react';
import type { Position } from '../types';

type MobileGameControlsProps = {
  filtersOpen: boolean;
  selectedCount: number;
  displayedCount: number;
  teams: string[];
  search: string;
  teamFilter: string;
  positionFilter: 'ALL' | Position;
  sort: string;
  maxPrice: number;
  onHome: () => void;
  onPlayers: () => void;
  onOpenFilters: () => void;
  onOpenRoster: () => void;
  onCloseFilters: () => void;
  onSearchChange: (value: string) => void;
  onTeamFilterChange: (value: string) => void;
  onPositionFilterChange: (value: 'ALL' | Position) => void;
  onSortChange: (value: string) => void;
  onMaxPriceChange: (value: number) => void;
};

export function MobileGameControls(props: MobileGameControlsProps) {
  return (
    <>
      <nav
        aria-label="Game navigation"
        className="mobile-tab-bar fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/95 px-2 pb-[max(.55rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl xl:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
          <button onClick={props.onHome} className="mobile-tab">
            <Home size={19} />
            <span>Home</span>
          </button>
          <button onClick={props.onPlayers} className="mobile-tab mobile-tab-active">
            <Layers3 size={19} />
            <span>Players</span>
          </button>
          <button onClick={props.onOpenFilters} className="mobile-tab">
            <ListFilter size={19} />
            <span>Search</span>
          </button>
          <button onClick={props.onOpenRoster} className="mobile-tab relative">
            <Users size={19} />
            <span>Lineup</span>
            {props.selectedCount > 0 && (
              <span className="absolute right-3 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-blue-500 px-1 text-[10px] font-black">
                {props.selectedCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {props.filtersOpen && (
          <motion.div
            className="fixed inset-0 z-[64] bg-black/70 backdrop-blur-sm xl:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={props.onCloseFilters}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-filters-title"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              onClick={(event) => event.stopPropagation()}
              className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-slate-950 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20" />
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-400">
                    Find players
                  </p>
                  <h3 id="mobile-filters-title" className="text-2xl font-black">
                    Search & Filters
                  </h3>
                </div>
                <button
                  onClick={props.onCloseFilters}
                  aria-label="Close search and filters"
                  className="grid h-11 w-11 place-items-center rounded-full bg-white/5"
                >
                  <X size={20} />
                </button>
              </div>
              <label className="relative block">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  size={18}
                />
                <input
                  autoFocus
                  aria-label="Search players"
                  value={props.search}
                  onChange={(e) => props.onSearchChange(e.target.value)}
                  placeholder="Search player name"
                  className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-10 pr-3"
                />
              </label>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <select
                  aria-label="Filter by team"
                  value={props.teamFilter}
                  onChange={(e) => props.onTeamFilterChange(e.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3"
                >
                  <option value="ALL">All teams</option>
                  {props.teams.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <select
                  aria-label="Filter by position"
                  value={props.positionFilter}
                  onChange={(e) => props.onPositionFilterChange(e.target.value as 'ALL' | Position)}
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3"
                >
                  <option value="ALL">All positions</option>
                  <option value="G">Guards</option>
                  <option value="F">Forwards</option>
                  <option value="C">Centers</option>
                </select>
              </div>
              <select
                aria-label="Sort players"
                value={props.sort}
                onChange={(e) => props.onSortChange(e.target.value)}
                className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3"
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
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-xs font-bold">
                  <span>Maximum price</span>
                  <span>${props.maxPrice}</span>
                </div>
                <input
                  type="range"
                  aria-label={`Maximum player price: $${props.maxPrice}`}
                  min="0"
                  max="80"
                  value={props.maxPrice}
                  onChange={(e) => props.onMaxPriceChange(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
              <button
                onClick={props.onCloseFilters}
                className="mt-6 min-h-14 w-full rounded-xl bg-blue-500 font-black"
              >
                Show {props.displayedCount} Players
              </button>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
