import { RefreshCcw, Trophy, Users } from 'lucide-react';

type UsernameSetupProps = {
  usernameDraft: string;
  usernameError: string;
  usernameSaving: boolean;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onSignOut: () => void;
};

export function LoadingScreen({ profile = false }: { profile?: boolean }) {
  const Icon = profile ? Users : Trophy;
  return (
    <div className="grid min-h-screen place-items-center bg-[#050816] text-slate-300">
      <div className="text-center" role="status" aria-live="polite">
        <Icon className="mx-auto mb-4 text-blue-400" />
        <p className="font-bold">
          {profile ? 'Loading your profile…' : 'Loading NBA Stat Auction…'}
        </p>
      </div>
    </div>
  );
}

export function BackendSetupScreen() {
  return (
    <div className="min-h-screen bg-[#050816] px-5 py-16 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-amber-300/20 bg-amber-400/10 p-7">
        <h1 className="text-3xl font-black">Backend setup required</h1>
        <p className="mt-3 leading-6 text-slate-300">
          Create a Supabase project, run <code>supabase/schema.sql</code>, and copy{' '}
          <code>.env.example</code> to <code>.env</code> with your project URL and anon key.
        </p>
      </div>
    </div>
  );
}

export function SignInScreen({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="min-h-screen bg-[#050816] bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,.25),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(225,29,72,.18),transparent_28%)] px-5 py-16 text-white">
      <div className="mx-auto flex min-h-[75vh] max-w-lg flex-col items-center justify-center text-center">
        <div className="grid h-24 w-24 place-items-center rounded-[30px] bg-gradient-to-br from-blue-500 to-rose-500 shadow-[0_20px_70px_rgba(59,130,246,.35)]">
          <Trophy size={42} />
        </div>
        <p className="mt-6 text-xs font-black uppercase tracking-[.3em] text-blue-400">
          NBA Stat Auction
        </p>
        <h1 className="mt-2 text-4xl font-black">Sign in to play</h1>
        <p className="mt-4 leading-6 text-slate-400">
          Use Google to save records, compete in the Daily Challenge, and appear by username on the
          leaderboard.
        </p>
        <button
          onClick={onSignIn}
          className="mt-7 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 font-black text-slate-950 transition hover:bg-slate-100 active:scale-[.98]"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 text-sm font-black text-blue-600">
            G
          </span>
          Continue with Google
        </button>
        <p className="mt-4 text-xs leading-5 text-slate-600">
          NBA Stat Auction stores your email as the only personal field in its application database.
          Google handles authentication and session data.
        </p>
      </div>
    </div>
  );
}

export function UsernameSetupScreen({
  usernameDraft,
  usernameError,
  usernameSaving,
  onDraftChange,
  onSave,
  onSignOut,
}: UsernameSetupProps) {
  return (
    <div className="min-h-screen bg-[#050816] bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,.25),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(225,29,72,.18),transparent_28%)] px-5 py-16 text-white">
      <div className="mx-auto flex min-h-[75vh] max-w-lg flex-col items-center justify-center text-center">
        <div className="grid h-20 w-20 place-items-center rounded-[26px] bg-gradient-to-br from-blue-500 to-rose-500 shadow-[0_20px_70px_rgba(59,130,246,.35)]">
          <Users size={34} />
        </div>
        <p className="mt-6 text-xs font-black uppercase tracking-[.3em] text-blue-400">
          One last step
        </p>
        <h1 className="mt-2 text-4xl font-black">Choose your username</h1>
        <p className="mt-4 leading-6 text-slate-400">
          This is the name other players will see on Daily leaderboards. Your email stays private.
        </p>
        <input
          autoFocus
          value={usernameDraft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSave();
          }}
          maxLength={20}
          aria-label="Username"
          aria-describedby="username-help"
          aria-invalid={Boolean(usernameError)}
          placeholder="Example: KingJames"
          className="mt-7 min-h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-lg font-bold outline-none placeholder:text-slate-600 focus:border-blue-500/60"
        />
        <div id="username-help" className="mt-2 flex w-full justify-between px-1 text-xs">
          <span
            role={usernameError ? 'alert' : undefined}
            className={usernameError ? 'text-rose-400' : 'text-slate-600'}
          >
            {usernameError || 'Letters, numbers, _ and . only'}
          </span>
          <span className="text-slate-600">{usernameDraft.trim().length}/20</span>
        </div>
        <button
          onClick={onSave}
          disabled={usernameSaving || !usernameDraft.trim()}
          className="mt-5 min-h-14 w-full rounded-2xl bg-gradient-to-r from-blue-500 to-rose-500 px-5 font-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {usernameSaving ? 'Saving…' : 'Enter NBA Stat Auction'}
        </button>
        <button
          onClick={onSignOut}
          className="mt-3 min-h-11 px-4 text-sm font-bold text-slate-500 hover:text-white"
        >
          Use a different Google account
        </button>
      </div>
    </div>
  );
}

export function PlayerDataLoadingScreen({ sessionLoading }: { sessionLoading: boolean }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#050816] text-slate-300">
      <div className="text-center" role="status" aria-live="polite">
        <RefreshCcw className="mx-auto mb-4 animate-spin text-blue-400" />
        <p className="font-bold">
          {sessionLoading ? 'Building a secure game session…' : 'Loading player database…'}
        </p>
      </div>
    </div>
  );
}

export function PlayerDataErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-[#050816] px-5 py-16 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-rose-300/20 bg-rose-400/10 p-7">
        <h1 className="text-3xl font-black">Player database unavailable</h1>
        <p className="mt-3 leading-6 text-slate-300" role="alert">
          {error}
        </p>
        <button
          onClick={onRetry}
          className="mt-6 rounded-xl bg-white px-5 py-3 font-black text-slate-950"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
