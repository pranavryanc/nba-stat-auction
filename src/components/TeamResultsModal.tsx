import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, RefreshCcw, Shield, Trophy, X } from 'lucide-react';
import type { GameMode, Player, TeamReport } from '../types';
import { grade, positionText } from '../lib/gameLogic';
import { PlayerImage } from './PlayerMedia';

type TeamResultsModalProps = {
  report: TeamReport | null;
  isIdeal: boolean;
  mode: GameMode;
  revealIdeal: boolean;
  playoffFinish: string | null;
  submittedLineup: Player[];
  idealLineup: Player[];
  idealReport: TeamReport | null;
  idealPlayoffFinish: string | null;
  dailyBudget: number;
  dailyCountdown: string;
  onShareLineup: () => void;
  onContinueUnlimited: () => void;
  onRevealIdeal: () => void;
  onPlayAgain: () => void;
  onCloseDaily: () => void;
};

export function TeamResultsModal({
  report,
  isIdeal,
  mode,
  revealIdeal,
  playoffFinish,
  submittedLineup,
  idealLineup,
  idealReport,
  idealPlayoffFinish,
  dailyBudget,
  dailyCountdown,
  onShareLineup,
  onContinueUnlimited,
  onRevealIdeal,
  onPlayAgain,
  onCloseDaily,
}: TeamResultsModalProps) {
  return (
    <AnimatePresence>
      {report && (
        <motion.div
          className="safe-modal fixed inset-0 z-[70] overflow-y-auto bg-[#02040d]/95 p-0 sm:p-4 backdrop-blur-xl md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            className="mx-auto min-h-full max-w-6xl overflow-hidden border sm:min-h-0 sm:rounded-3xl border-white/10 bg-slate-950 shadow-2xl"
          >
            <div className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(244,63,94,.28),transparent_32%),radial-gradient(circle_at_top_left,_rgba(59,130,246,.28),transparent_34%)] px-4 pb-6 pt-8 sm:p-6 md:p-10">
              <p className="text-xs font-black uppercase tracking-[.28em] text-blue-400">
                Front office report
              </p>
              <h2 className="mt-2 text-3xl font-black md:text-5xl">
                {isIdeal ? 'Congratulations!' : 'Team Analysis'}
              </h2>
              <p className="mt-2 text-slate-400">
                {isIdeal
                  ? 'You found the ideal lineup for this player pool.'
                  : mode === 'unlimited' && !revealIdeal
                    ? 'Keep trying with this pool or give up to reveal the model-optimal lineup.'
                    : 'See how your lineup compares with the model-optimal roster.'}
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-[1.2fr_2fr]">
                <div className="flex items-center gap-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <motion.div
                    initial={{ rotate: -12, scale: 0.8 }}
                    animate={{ rotate: 0, scale: 1 }}
                    className="grid h-28 w-28 place-items-center rounded-full border-8 border-blue-500/70 bg-slate-950 text-center"
                  >
                    <div>
                      <p className="text-4xl font-black">{report.overall}</p>
                      <p className="text-[10px] font-bold text-slate-500">OVERALL</p>
                    </div>
                  </motion.div>
                  <div>
                    <p className="text-sm text-slate-400">Letter grade</p>
                    <p className="text-6xl font-black text-gradient">{report.grade}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    [`${report.projectedWins}-${82 - report.projectedWins}`, 'Projected Record'],
                    [report.offensiveRating, 'Off. Rating'],
                    [report.defensiveRating, 'Def. Rating'],
                    [`${report.netRating > 0 ? '+' : ''}${report.netRating}`, 'Net Rating'],
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-2xl font-black md:text-3xl">{value}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {playoffFinish && (
                <div className="mt-4 rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-400/10 to-orange-500/5 p-5">
                  <div className="flex items-center gap-4">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-400/10">
                      <Trophy className="text-amber-300" size={28} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">
                        Projected Playoff Finish
                      </p>
                      <p className="mt-1 text-2xl font-black text-white md:text-3xl">
                        {playoffFinish}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Based on regular-season projection, two-way strength, and lineup fit.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-6 px-4 pb-10 pt-6 sm:p-6 md:gap-8 md:p-10 lg:grid-cols-[1.25fr_.75fr]">
              <div>
                <h3 className="mb-4 text-xl font-black">Category Grades</h3>
                <div className="space-y-4">
                  {Object.entries(report.categories).map(([name, score], index) => (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.07 }}
                      key={name}
                    >
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-semibold">{name}</span>
                        <span className="font-black">
                          {score} · {grade(score)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${score}%` }}
                          transition={{ duration: 0.7, delay: index * 0.06 }}
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-rose-500"
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>

                <h3 className="mb-3 mt-8 text-lg font-black">Your lineup</h3>
                <div className="grid gap-3 sm:grid-cols-5">
                  {submittedLineup.map((player) => (
                    <div
                      key={player.id}
                      className="rounded-xl border border-white/10 bg-white/5 p-2 text-center"
                    >
                      <div className="mx-auto h-16 w-16 overflow-hidden rounded-lg">
                        <PlayerImage player={player} />
                      </div>
                      <p className="mt-2 truncate text-xs font-bold">{player.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {positionText(player)} · ${player.price}
                      </p>
                    </div>
                  ))}
                </div>

                {revealIdeal && idealLineup.length === 5 && (
                  <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">
                          Ideal lineup
                        </p>
                        <h3 className="text-xl font-black">Best roster for this pool</h3>
                      </div>
                      {idealReport && (
                        <div className="text-right">
                          <p className="text-sm font-bold text-amber-200">
                            {idealReport.overall} OVR · {idealReport.projectedWins}-
                            {82 - idealReport.projectedWins}
                          </p>
                          {idealPlayoffFinish && (
                            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-100/60">
                              {idealPlayoffFinish}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-5">
                      {idealLineup.map((player) => (
                        <div
                          key={player.id}
                          className="rounded-xl border border-amber-300/15 bg-black/20 p-2 text-center"
                        >
                          <div className="mx-auto h-16 w-16 overflow-hidden rounded-lg">
                            <PlayerImage player={player} />
                          </div>
                          <p className="mt-2 truncate text-xs font-bold">{player.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {positionText(player)} · ${player.price}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-5">
                  <h3 className="mb-3 flex items-center gap-2 font-black text-emerald-300">
                    <Shield size={18} />
                    Strengths
                  </h3>
                  <ul className="space-y-3 text-sm text-slate-300">
                    {report.strengths.map((item) => (
                      <li key={item} className="flex gap-2">
                        <Check className="mt-0.5 shrink-0 text-emerald-400" size={15} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-rose-400/15 bg-rose-400/5 p-5">
                  <h3 className="mb-3 font-black text-rose-300">Weaknesses</h3>
                  <ul className="space-y-3 text-sm text-slate-300">
                    {report.weaknesses.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={onShareLineup}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 font-bold hover:bg-white/5"
                >
                  <Copy size={16} />
                  Copy Team Result
                </button>

                {mode === 'unlimited' && !revealIdeal && !isIdeal && (
                  <>
                    <button
                      onClick={onContinueUnlimited}
                      className="w-full rounded-xl bg-blue-500 py-3 font-black hover:bg-blue-400"
                    >
                      Continue Playing
                    </button>
                    <button
                      onClick={onRevealIdeal}
                      className="w-full rounded-xl border border-rose-400/25 bg-rose-500/10 py-3 font-black text-rose-200 hover:bg-rose-500/20"
                    >
                      Give Up & Reveal Ideal
                    </button>
                  </>
                )}

                {mode !== 'daily' && (mode !== 'unlimited' || revealIdeal || isIdeal) && (
                  <button
                    onClick={onPlayAgain}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-rose-500 py-3 font-black"
                  >
                    <RefreshCcw size={17} />
                    Play Again
                  </button>
                )}

                {mode === 'daily' && (
                  <>
                    <button
                      onClick={onCloseDaily}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 font-black hover:bg-white/10"
                    >
                      <X size={17} />
                      Close Results
                    </button>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-slate-400">
                      Today’s pool and ${dailyBudget} salary cap are the same for everyone. A new
                      80-player pool loads automatically in{' '}
                      <span className="font-mono font-bold text-amber-200">{dailyCountdown}</span>.
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
