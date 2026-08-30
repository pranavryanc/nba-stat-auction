import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, X } from 'lucide-react';
import type { GameMode } from '../types';

type HighScore = {
  mode: GameMode;
  score: number;
  projected_wins: number;
  net_rating: number;
};

type ProfileModalProps = {
  open: boolean;
  username: string;
  userEmail: string | null;
  highScores: HighScore[];
  usernameDraft: string;
  usernameError: string;
  usernameSaving: boolean;
  onClose: () => void;
  onUsernameDraftChange: (value: string) => void;
  onSaveUsername: () => void;
  onSignOut: () => void;
};

const recordModes: GameMode[] = ['classic', 'daily', 'unlimited', 'historic'];

export function ProfileModal({
  open,
  username,
  userEmail,
  highScores,
  usernameDraft,
  usernameError,
  usernameSaving,
  onClose,
  onUsernameDraftChange,
  onSaveUsername,
  onSignOut,
}: ProfileModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-title"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.97 }}
            onClick={(event) => event.stopPropagation()}
            className="my-6 w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.2em] text-blue-400">
                  Profile
                </p>
                <h2 id="profile-title" className="mt-1 text-3xl font-black">
                  @{username}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Your account and NBA Stat Auction records.
                </p>
              </div>
              <button
                onClick={onClose}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/5"
                aria-label="Close profile"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.035] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Google account
              </p>
              <p className="mt-1 break-all text-sm font-semibold text-slate-300">{userEmail}</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {recordModes.map((recordMode) => {
                const record = highScores.find((item) => item.mode === recordMode);
                return (
                  <div
                    key={recordMode}
                    className="rounded-xl border border-white/10 bg-black/20 p-3"
                  >
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
                        : 'No record yet'}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-sm font-black">Change username</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                This is the public name shown on Daily leaderboards. Usernames are unique.
              </p>

              <input
                value={usernameDraft}
                aria-label="Change username"
                aria-describedby="profile-username-help"
                aria-invalid={Boolean(usernameError)}
                onChange={(event) => onUsernameDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSaveUsername();
                }}
                maxLength={20}
                className="mt-4 min-h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-lg font-bold outline-none focus:border-blue-500/60"
              />

              <div id="profile-username-help" className="mt-2 flex justify-between text-xs">
                <span
                  role={usernameError ? 'alert' : undefined}
                  className={usernameError ? 'text-rose-400' : 'text-slate-600'}
                >
                  {usernameError || '3–20 characters · letters, numbers, _ or .'}
                </span>
                <span className="text-slate-600">{usernameDraft.trim().length}/20</span>
              </div>

              <button
                onClick={onSaveUsername}
                disabled={usernameSaving || usernameDraft.trim() === username}
                className="mt-4 min-h-13 w-full rounded-xl bg-blue-500 py-3 font-black hover:bg-blue-400 disabled:opacity-40"
              >
                {usernameSaving ? 'Saving…' : 'Save Username'}
              </button>
            </div>

            <button
              onClick={onSignOut}
              className="mt-3 min-h-12 w-full rounded-xl border border-white/10 bg-white/5 font-bold text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="mr-2 inline" size={16} />
              Sign out
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
