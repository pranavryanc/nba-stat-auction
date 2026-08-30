import { motion } from 'framer-motion';
import { BarChart3, Home, LogOut, Trophy, Users } from 'lucide-react';

type AppHeaderProps = {
  remaining: number;
  selectedCount: number;
  guardCount: number;
  forwardCount: number;
  centerCount: number;
  userEmail: string | null;
  onHome: () => void;
  onStatistics: () => void;
  onProfile: () => void;
  onSignOut: () => void;
};

export function AppHeader({
  remaining,
  selectedCount,
  guardCount,
  forwardCount,
  centerCount,
  userEmail,
  onHome,
  onStatistics,
  onProfile,
  onSignOut,
}: AppHeaderProps) {
  return (
    <header className="safe-header sticky top-0 z-50 border-b border-white/10 bg-[#050816]/80 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4 md:px-7">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-rose-500 shadow-glow">
            <Trophy size={23} />
          </div>
          <div>
            <p className="hidden text-[10px] font-black uppercase tracking-[.25em] text-blue-400 sm:block">Build five. Beat the cap.</p>
            <h1 className="text-base font-black sm:text-lg md:text-2xl">NBA Stat Auction</h1>
          </div>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <button onClick={onHome} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5"><Home className="mr-2 inline" size={16}/>Home</button>
          <button onClick={onStatistics} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5"><BarChart3 className="mr-2 inline" size={16}/>Statistics</button>
          <button onClick={onProfile} className="rounded-xl px-3 py-2 text-sm font-semibold text-blue-300 hover:bg-white/5"><Users className="mr-2 inline" size={16}/>Profile</button>
          <button onClick={onSignOut} title={userEmail ?? ''} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-white"><LogOut className="mr-2 inline" size={16}/>Sign out</button>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Budget left</p>
            <motion.p key={remaining} initial={{scale:1.2}} animate={{scale:1}} className={`text-lg font-black ${remaining < 20 ? 'text-rose-400':'text-emerald-400'}`}>${remaining}</motion.p>
          </div>
          <div className="min-w-[112px] rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-right sm:min-w-[150px]">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Lineup</p>
            <div className="flex items-end justify-end gap-2">
              <p className="text-lg font-black">{selectedCount}/5</p>
              <p className="pb-0.5 text-[9px] font-black text-slate-400">G {guardCount}/2 · F {forwardCount}/2 · C {centerCount}/1</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
