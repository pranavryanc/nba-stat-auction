import { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Gauge, Share2, Users, X } from 'lucide-react';
import type { Player } from '../types';
import { positionText } from '../lib/gameLogic';
import { PlayerImage } from './PlayerMedia';
import { useDialogFocus } from '../hooks/useDialogFocus';

type RosterBaseProps = {
  selected: Player[];
  remaining: number;
  spent: number;
  guardCount: number;
  forwardCount: number;
  centerCount: number;
  validRoster: boolean;
  isSubmitting: boolean;
  gameSessionId: string | null;
  onTogglePlayer: (player: Player) => void;
  onAnalyze: () => void;
};

type DesktopRosterSidebarProps = RosterBaseProps & {
  onSave: () => void;
  onLoad: () => void;
  onShare: () => void;
};

export function DesktopRosterSidebar({
  selected,
  remaining,
  spent,
  guardCount,
  forwardCount,
  centerCount,
  validRoster,
  isSubmitting,
  gameSessionId,
  onTogglePlayer,
  onAnalyze,
  onSave,
  onLoad,
  onShare,
}: DesktopRosterSidebarProps) {
  return (
    <aside className="hidden xl:sticky xl:top-24 xl:block xl:self-start">
      <div className="glass overflow-hidden rounded-3xl shadow-2xl">
        <div className="border-b border-white/10 bg-gradient-to-r from-blue-500/15 to-rose-500/10 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-400">
                Your roster
              </p>
              <h3 id="mobile-roster-title" className="text-2xl font-black">
                Starting Five
              </h3>
            </div>
            <Users className="text-slate-500" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-black/20 p-3">
              <p className="text-[10px] font-bold uppercase text-slate-500">Remaining</p>
              <motion.p
                key={remaining}
                initial={{ scale: 1.15 }}
                animate={{ scale: 1 }}
                className="text-2xl font-black text-emerald-400"
              >
                ${remaining}
              </motion.p>
            </div>
            <div className="rounded-xl bg-black/20 p-3">
              <p className="text-[10px] font-bold uppercase text-slate-500">Spent</p>
              <p className="text-2xl font-black">${spent}</p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="mb-5 grid grid-cols-3 gap-2">
            <RosterRequirement label="GUARDS" current={guardCount} required={2} />
            <RosterRequirement label="FORWARDS" current={forwardCount} required={2} />
            <RosterRequirement label="CENTER" current={centerCount} required={1} />
          </div>

          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {selected.map((player) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  key={player.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-2.5"
                >
                  <div className="h-12 w-12 overflow-hidden rounded-lg bg-slate-800">
                    <PlayerImage player={player} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{player.name}</p>
                    <p className="text-xs text-slate-500">
                      {positionText(player)} · {player.teamAbbreviation}
                      {player.season ? ` · ${player.season}` : ''} · ${player.price}
                    </p>
                  </div>
                  <button
                    onClick={() => onTogglePlayer(player)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                    aria-label={`Remove ${player.name}`}
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            {Array.from({ length: 5 - selected.length }).map((_, index) => (
              <div
                key={index}
                className="flex h-[69px] items-center justify-center rounded-xl border border-dashed border-white/10 text-xs font-semibold text-slate-700"
              >
                Empty roster slot
              </div>
            ))}
          </div>

          <button
            disabled={!validRoster || isSubmitting || !gameSessionId}
            onClick={onAnalyze}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-rose-500 py-4 font-black shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-40"
          >
            <Gauge size={18} />
            Analyze My Team
          </button>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              disabled={!selected.length}
              onClick={onSave}
              className="rounded-xl border border-white/10 py-2.5 text-xs font-bold hover:bg-white/5 disabled:opacity-30"
            >
              <Crown className="mr-1 inline" size={14} />
              Save
            </button>
            <button
              onClick={onLoad}
              className="rounded-xl border border-white/10 py-2.5 text-xs font-bold hover:bg-white/5"
            >
              Load
            </button>
            <button
              disabled={!selected.length}
              onClick={onShare}
              className="rounded-xl border border-white/10 py-2.5 text-xs font-bold hover:bg-white/5 disabled:opacity-30"
            >
              <Share2 className="mr-1 inline" size={14} />
              Share
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

type MobileRosterSheetProps = RosterBaseProps & {
  open: boolean;
  onClose: () => void;
};

export function MobileRosterSheet({
  open,
  selected,
  remaining,
  spent,
  guardCount,
  forwardCount,
  centerCount,
  validRoster,
  isSubmitting,
  gameSessionId,
  onTogglePlayer,
  onAnalyze,
  onClose,
}: MobileRosterSheetProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(open, dialogRef, { onEscape: onClose, initialFocusRef: closeButtonRef });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-sm xl:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-roster-title"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={(event) => event.stopPropagation()}
            className="safe-bottom-sheet absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-slate-950 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20" />

            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-400">
                  Your roster
                </p>
                <h3 id="mobile-roster-title" className="text-2xl font-black">
                  Starting Five
                </h3>
              </div>
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className="grid h-11 w-11 place-items-center rounded-full bg-white/5"
                aria-label="Close roster"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2">
              <MobileRequirement label="GUARDS" current={guardCount} required={2} />
              <MobileRequirement label="FORWARDS" current={forwardCount} required={2} />
              <MobileRequirement label="CENTER" current={centerCount} required={1} />
            </div>

            <div className="space-y-2">
              {selected.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5"
                >
                  <div className="h-12 w-12 overflow-hidden rounded-lg">
                    <PlayerImage player={player} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{player.name}</p>
                    <p className="text-xs text-slate-500">
                      {positionText(player)} · ${player.price}
                    </p>
                  </div>
                  <button
                    onClick={() => onTogglePlayer(player)}
                    className="grid h-11 w-11 place-items-center rounded-xl bg-rose-500/10 text-rose-300"
                    aria-label={`Remove ${player.name}`}
                  >
                    <X size={17} />
                  </button>
                </div>
              ))}
            </div>

            {!selected.length && (
              <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
                Select players to build your lineup.
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">Remaining</p>
                <p className="text-2xl font-black text-emerald-400">${remaining}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">Spent</p>
                <p className="text-2xl font-black">${spent}</p>
              </div>
            </div>

            <button
              disabled={!validRoster || isSubmitting || !gameSessionId}
              onClick={() => {
                onClose();
                onAnalyze();
              }}
              className="mt-4 min-h-14 w-full rounded-xl bg-gradient-to-r from-blue-500 to-rose-500 font-black disabled:grayscale disabled:opacity-40"
            >
              Analyze My Team
            </button>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RosterRequirement({
  label,
  current,
  required,
}: {
  label: string;
  current: number;
  required: number;
}) {
  const complete = current === required;

  return (
    <div
      className={`rounded-xl border p-2 text-center ${complete ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/5'}`}
    >
      <p className="text-[9px] font-bold text-slate-500">{label}</p>
      <p className="font-black">
        {current}/{required}
      </p>
    </div>
  );
}

function MobileRequirement({
  label,
  current,
  required,
}: {
  label: string;
  current: number;
  required: number;
}) {
  return (
    <div className="rounded-xl bg-white/5 p-3 text-center">
      <p className="text-[9px] font-bold text-slate-500">{label}</p>
      <p className="font-black">
        {current}/{required}
      </p>
    </div>
  );
}
