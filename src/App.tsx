import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCcw, Sparkles } from 'lucide-react';
import type { DetailedPosition, Difficulty, GameMode, Player, TeamReport } from './types';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  createGameSession,
  deleteMyAccount,
  getDailyLeaderboard,
  getMyHighScores,
  getMyUsername,
  registerUserEmail,
  saveGameScore,
  setMyUsername,
  type DailyLeaderboardEntry,
  type SavedHighScore,
} from './lib/gameBackend';
import { getCurrentPlayers } from './lib/playerBackend';
import {
  analyzeTeam,
  canStillBuildValidRoster,
  findIdealLineup,
  isValidRoster,
  projectPlayoffFinish,
  rosterAssignment,
  sameLineup,
} from './lib/gameLogic';
import { E2E_TEST_EMAIL, E2E_TEST_MODE } from './lib/e2eFixtures';
import { PlayerBrowser } from './components/PlayerBrowser';
import { DesktopRosterSidebar, MobileRosterSheet } from './components/RosterPanels';
import { TeamResultsModal } from './components/TeamResultsModal';
import { StatsPage } from './components/StatsPage';
import { HomeScreen } from './components/HomeScreen';
import { ProfileModal } from './components/ProfileModal';
import { DailyLeaderboard } from './components/DailyLeaderboard';
import { AppHeader } from './components/AppHeader';
import {
  BackendSetupScreen,
  LoadingScreen,
  PlayerDataErrorScreen,
  PlayerDataLoadingScreen,
  SignInScreen,
  UsernameSetupScreen,
} from './components/AuthScreens';
import { MobileGameControls } from './components/MobileGameControls';
import { useAuctionFilters } from './hooks/useAuctionFilters';
import { useDailyClock } from './hooks/useDailyClock';

const POSITION_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
const ADJACENT_POSITIONS: Record<DetailedPosition, DetailedPosition[]> = {
  PG: ['SG'],
  SG: ['PG', 'SF'],
  SF: ['SG', 'PF'],
  PF: ['SF', 'C'],
  C: ['PF'],
};
const POSITION_GROUP = { PG: 'G', SG: 'G', SF: 'F', PF: 'F', C: 'C' } as const;

const normalizePlayer = (player: Player): Player => {
  const percentages = player.positionPercentages;
  const primary =
    player.listedDetailedPosition ??
    player.primaryDetailedPosition ??
    (percentages
      ? [...POSITION_ORDER].sort((a, b) => (percentages[b] ?? 0) - (percentages[a] ?? 0))[0]
      : player.detailedPositions?.[0]);
  const secondary =
    primary && percentages
      ? (ADJACENT_POSITIONS[primary] ?? [])
          .filter((position) => (percentages[position] ?? 0) >= 25)
          .sort((a, b) => (percentages[b] ?? 0) - (percentages[a] ?? 0))[0]
      : primary
        ? (ADJACENT_POSITIONS[primary] ?? []).find((position) =>
            player.detailedPositions?.includes(position),
          )
        : undefined;
  const detailedPositions = primary
    ? ([primary, ...(secondary ? [secondary] : [])] as Player['detailedPositions'])
    : player.detailedPositions?.slice(0, 1);
  const eligiblePositions = detailedPositions?.length
    ? [...new Set(detailedPositions.map((position) => POSITION_GROUP[position]))]
    : player.eligiblePositions?.length
      ? player.eligiblePositions.slice(0, 2)
      : [player.position];
  return { ...player, detailedPositions, primaryDetailedPosition: primary, eligiblePositions };
};

const BUDGETS: Record<Difficulty, number> = { easy: 175, normal: 150, hard: 125 };
const DAILY_BUDGET = 150;

function App() {
  const [mode, setMode] = useState<GameMode>('classic');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [poolKey, setPoolKey] = useState(() => crypto.randomUUID());
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerDataLoading, setPlayerDataLoading] = useState(true);
  const [playerDataError, setPlayerDataError] = useState('');
  const [playerDataReloadKey, setPlayerDataReloadKey] = useState(0);
  const [selected, setSelected] = useState<Player[]>([]);
  const [report, setReport] = useState<TeamReport | null>(null);
  const [submittedLineup, setSubmittedLineup] = useState<Player[]>([]);
  const [idealLineup, setIdealLineup] = useState<Player[]>([]);
  const [revealIdeal, setRevealIdeal] = useState(false);
  const [view, setView] = useState<'game' | 'stats'>('game');
  const [toast, setToast] = useState('');
  const [mobileRosterOpen, setMobileRosterOpen] = useState(false);
  const [mobileHomeOpen, setMobileHomeOpen] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameEditorOpen, setUsernameEditorOpen] = useState(false);
  const [accountDeleting, setAccountDeleting] = useState(false);
  const [accountDeleteError, setAccountDeleteError] = useState('');
  const [highScores, setHighScores] = useState<SavedHighScore[]>([]);
  const [dailyLeaderboard, setDailyLeaderboard] = useState<DailyLeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [gameSessionId, setGameSessionId] = useState<string | null>(null);
  const [sessionPool, setSessionPool] = useState<Player[]>([]);
  const [sessionBudget, setSessionBudget] = useState(150);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dailyDate, setDailyDate] = useState('');
  const [dailyResetsAt, setDailyResetsAt] = useState('');
  const budget = sessionBudget || (mode === 'daily' ? DAILY_BUDGET : BUDGETS[difficulty]);
  const spent = selected.reduce((sum, p) => sum + p.price, 0);
  const remaining = budget - spent;
  const pool = sessionPool;

  const {
    search,
    setSearch,
    teamFilter,
    setTeamFilter,
    positionFilter,
    setPositionFilter,
    maxPrice,
    setMaxPrice,
    sort,
    setSort,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    teams,
    displayed,
    resetAuctionFilters,
  } = useAuctionFilters(pool);

  const refreshDailyPool = useCallback(() => {
    setPoolKey(crypto.randomUUID());
  }, []);

  const { countdown: dailyCountdown } = useDailyClock(dailyResetsAt, mode, refreshDailyPool);

  useEffect(() => {
    if (!supabase) {
      setPlayerDataLoading(false);
      return;
    }

    let cancelled = false;
    setPlayerDataLoading(true);
    setPlayerDataError('');

    getCurrentPlayers()
      .then((data) => {
        if (!cancelled) setPlayers(data.map(normalizePlayer));
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setPlayerDataError(
            error instanceof Error ? error.message : 'Current player data could not be loaded.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setPlayerDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [playerDataReloadKey]);

  useEffect(() => {
    if (!userEmail) return;

    let cancelled = false;
    setSessionLoading(true);
    setPlayerDataError('');

    createGameSession(mode, difficulty)
      .then((session) => {
        if (cancelled) return;
        setGameSessionId(session.sessionId);
        setSessionBudget(session.budget);
        setSessionPool(session.players.map(normalizePlayer));
        if (session.challengeDate) setDailyDate(session.challengeDate);
        else setDailyDate('');
        setDailyResetsAt(session.resetsAt);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setGameSessionId(null);
          setSessionPool([]);
          setPlayerDataError(
            error instanceof Error ? error.message : 'Game session could not be created.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userEmail, mode, difficulty, poolKey]);

  useEffect(() => {
    if (E2E_TEST_MODE) {
      const signedOut = new URLSearchParams(window.location.search).has('e2eSignedOut');
      setUserEmail(signedOut ? null : E2E_TEST_EMAIL);
      setAuthLoading(false);
      return;
    }
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user.email ?? null;
      setUserEmail(email);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user.email ?? null;
      setUserEmail(email);
      setAuthLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const refreshAccountData = useCallback(
    async (email = userEmail) => {
      if (!email) return;

      try {
        const [records, daily] = await Promise.all([
          getMyHighScores(email),
          getDailyLeaderboard(dailyDate),
        ]);

        setHighScores(records);
        setDailyLeaderboard(daily);
      } catch (error) {
        console.error(error);
      }
    },
    [userEmail, dailyDate],
  );

  useEffect(() => {
    if (!userEmail) {
      setUsername(null);
      setUsernameDraft('');
      setUsernameLoading(false);
      return;
    }
    let cancelled = false;
    setUsernameLoading(true);
    Promise.all([registerUserEmail(userEmail), getMyUsername(userEmail)])
      .then(([, savedUsername]) => {
        if (cancelled) return;
        setUsername(savedUsername);
        setUsernameDraft(savedUsername ?? '');
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setToast('Your profile could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setUsernameLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userEmail]);

  const saveUsername = async () => {
    if (!userEmail) return;
    const cleaned = usernameDraft.trim();
    if (!/^[A-Za-z0-9_.]{3,20}$/.test(cleaned)) {
      setUsernameError('Use 3–20 letters, numbers, underscores, or periods.');
      return;
    }
    setUsernameSaving(true);
    setUsernameError('');
    try {
      const saved = await setMyUsername(userEmail, cleaned);
      setUsername(saved);
      setUsernameDraft(saved);
      setUsernameEditorOpen(false);
      await refreshAccountData(userEmail);
      setToast('Username saved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Username could not be saved.';
      setUsernameError(
        message.includes('already taken') ? 'That username is already taken.' : message,
      );
    } finally {
      setUsernameSaving(false);
    }
  };

  useEffect(() => {
    if (!userEmail) {
      setHighScores([]);
      setDailyLeaderboard([]);
      return;
    }

    setLeaderboardLoading(true);
    refreshAccountData(userEmail).finally(() => setLeaderboardLoading(false));
  }, [userEmail, refreshAccountData]);

  const signInWithGoogle = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) setToast(error.message);
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUsername(null);
    setUsernameEditorOpen(false);
    setMobileHomeOpen(true);
  };

  const deleteAccount = async () => {
    setAccountDeleting(true);
    setAccountDeleteError('');
    try {
      await deleteMyAccount();
      localStorage.removeItem('nba-stat-auction-best');
      if (supabase) await supabase.auth.signOut({ scope: 'local' });
      setUsername(null);
      setUsernameDraft('');
      setHighScores([]);
      setDailyLeaderboard([]);
      setUsernameEditorOpen(false);
      setMobileHomeOpen(true);
      setUserEmail(null);
    } catch (error) {
      console.error(error);
      setAccountDeleteError(
        error instanceof Error
          ? error.message
          : 'Your account could not be deleted. Please try again.',
      );
    } finally {
      setAccountDeleting(false);
    }
  };

  useEffect(() => {
    setSelected([]);
    setReport(null);
    setSubmittedLineup([]);
    setIdealLineup([]);
    setRevealIdeal(false);
  }, [difficulty, mode, poolKey, dailyDate]);

  useEffect(() => {
    resetAuctionFilters();
  }, [mode, poolKey, dailyDate, resetAuctionFilters]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const assignment = rosterAssignment(selected);
  const guardCount = assignment.guards.length;
  const forwardCount = assignment.forwards.length;
  const centerCount = assignment.centers.length;
  const validRoster = isValidRoster(selected) && spent <= budget;
  const isIdeal = idealLineup.length === 5 && sameLineup(submittedLineup, idealLineup);
  const idealReport = idealLineup.length === 5 ? analyzeTeam(idealLineup) : null;

  const playoffFinish = report
    ? projectPlayoffFinish(
        report.projectedWins,
        report.overall,
        report.netRating,
        report.categories.Offense ?? 0,
        report.categories.Defense ?? 0,
        report.categories['Team Fit'] ?? 0,
      )
    : null;

  const idealPlayoffFinish = idealReport
    ? projectPlayoffFinish(
        idealReport.projectedWins,
        idealReport.overall,
        idealReport.netRating,
        idealReport.categories.Offense ?? 0,
        idealReport.categories.Defense ?? 0,
        idealReport.categories['Team Fit'] ?? 0,
      )
    : null;

  const selectPlayer = (player: Player) => {
    if (selected.some((p) => p.id === player.id))
      return setSelected((s) => s.filter((p) => p.id !== player.id));
    if (selected.some((p) => p.name === player.name))
      return setToast('Only one version of each player may be selected.');
    if (selected.length >= 5) return setToast('Your roster is already full.');
    if (player.price > remaining) return setToast('That player exceeds your remaining budget.');
    const nextTeam = [...selected, player];
    if (!canStillBuildValidRoster(nextTeam))
      return setToast(
        'That player would make a valid 2-guard, 2-forward, 1-center lineup impossible.',
      );
    setSelected(nextTeam);
  };

  const newPool = () => {
    if (mode === 'daily') return;
    resetAuctionFilters();
    setPoolKey(crypto.randomUUID());
  };

  const startMobileMode = (nextMode: GameMode) => {
    resetAuctionFilters();
    setMode(nextMode);
    setMobileHomeOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const leaveGameMode = () => {
    resetAuctionFilters();
    setMobileRosterOpen(false);
    setMobileHomeOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitLineup = async () => {
    if (isSubmitting) return;
    if (!gameSessionId) {
      setToast('The secure game session is not ready yet.');
      return;
    }

    setIsSubmitting(true);
    try {
      const ideal = findIdealLineup(pool, budget);
      const userReport = analyzeTeam(selected);
      const perfect = sameLineup(selected, ideal);
      const submitted = [...selected];

      setSubmittedLineup(submitted);
      setIdealLineup(ideal);
      setRevealIdeal(mode === 'classic' || mode === 'historic' || perfect);
      setReport(userReport);

      if (userEmail) {
        const verified = await saveGameScore({
          sessionId: gameSessionId,
          lineup: submitted,
        });

        if (
          verified.score !== userReport.overall ||
          verified.projected_wins !== userReport.projectedWins ||
          Number(verified.net_rating) !== userReport.netRating ||
          verified.spent !== spent
        ) {
          console.warn('Server/client score mismatch', { verified, userReport, spent });
        }

        await refreshAccountData(userEmail);
      }
    } catch (error) {
      console.error(error);
      setToast(error instanceof Error ? error.message : 'Score could not be securely verified.');
    } finally {
      setIsSubmitting(false);
    }
  };
  const playAgain = () => {
    if (mode === 'daily') return;
    resetAuctionFilters();
    setReport(null);
    setSelected([]);
    setSubmittedLineup([]);
    setIdealLineup([]);
    setRevealIdeal(false);
    setPoolKey(crypto.randomUUID());
  };

  const continueUnlimited = () => {
    setReport(null);
    setSelected([]);
    setSubmittedLineup([]);
    setRevealIdeal(false);
  };

  const saveLineup = () => {
    try {
      localStorage.setItem(
        'nba-stat-auction-best',
        JSON.stringify({
          version: 1,
          sessionId: gameSessionId,
          mode,
          playerIds: selected.map((player) => String(player.id)),
          savedAt: new Date().toISOString(),
        }),
      );
      setToast('Lineup saved on this device.');
    } catch (error) {
      console.error(error);
      setToast('This lineup could not be saved on this device.');
    }
  };

  const loadSavedLineup = () => {
    try {
      const raw = localStorage.getItem('nba-stat-auction-best');
      if (!raw) {
        setToast('No saved lineup was found on this device.');
        return;
      }

      const parsed = JSON.parse(raw);

      // Backward compatibility: the old app stored the entire Player[] directly.
      if (Array.isArray(parsed)) {
        const legacyIds = parsed.map((player) => String(player?.id ?? '')).filter(Boolean);

        const restoredLegacy = legacyIds
          .map((id) => pool.find((player) => String(player.id) === id))
          .filter((player): player is Player => Boolean(player));

        if (legacyIds.length > 0 && restoredLegacy.length === legacyIds.length) {
          setSelected(restoredLegacy);

          localStorage.setItem(
            'nba-stat-auction-best',
            JSON.stringify({
              version: 1,
              sessionId: gameSessionId,
              mode,
              playerIds: legacyIds,
              savedAt: new Date().toISOString(),
            }),
          );

          setToast('Saved lineup restored and upgraded.');
          return;
        }

        localStorage.removeItem('nba-stat-auction-best');
        setToast('Your old saved lineup belonged to a different player pool, so it was cleared.');
        return;
      }

      const saved = parsed as {
        version?: number;
        sessionId?: string;
        playerIds?: string[];
      };

      if (!Array.isArray(saved.playerIds) || saved.playerIds.length === 0) {
        localStorage.removeItem('nba-stat-auction-best');
        setToast('The saved lineup was invalid and has been cleared.');
        return;
      }

      if (saved.sessionId !== gameSessionId) {
        setToast('That lineup belongs to a different player pool and cannot be restored.');
        return;
      }

      const restored = saved.playerIds
        .map((id) => pool.find((player) => String(player.id) === id))
        .filter((player): player is Player => Boolean(player));

      if (restored.length !== saved.playerIds.length) {
        setToast('Some saved players are no longer available in this pool.');
        return;
      }

      setSelected(restored);
      setToast('Saved lineup restored.');
    } catch (error) {
      console.error(error);
      localStorage.removeItem('nba-stat-auction-best');
      setToast('The saved lineup was corrupted and has been cleared.');
    }
  };

  const shareLineup = async () => {
    const text = `My NBA Stat Auction lineup: ${selected.map((p) => `${p.name}${p.season ? ` (${p.season})` : ''}`).join(', ')} — $${spent}/${budget}`;
    try {
      await navigator.clipboard.writeText(text);
      setToast('Lineup copied to clipboard.');
    } catch {
      setToast(text);
    }
  };

  if (authLoading) return <LoadingScreen />;

  if (!isSupabaseConfigured && !E2E_TEST_MODE) return <BackendSetupScreen />;

  if (!userEmail) return <SignInScreen onSignIn={signInWithGoogle} />;

  if (usernameLoading) return <LoadingScreen profile />;

  if (!username) {
    return (
      <UsernameSetupScreen
        usernameDraft={usernameDraft}
        usernameError={usernameError}
        usernameSaving={usernameSaving}
        onDraftChange={(value) => {
          setUsernameDraft(value);
          setUsernameError('');
        }}
        onSave={saveUsername}
        onSignOut={signOut}
      />
    );
  }

  if (playerDataLoading || sessionLoading)
    return <PlayerDataLoadingScreen sessionLoading={sessionLoading} />;

  if (playerDataError) {
    return (
      <PlayerDataErrorScreen
        error={playerDataError}
        onRetry={() => {
          setPlayerDataError('');
          setPlayerDataReloadKey((value) => value + 1);
          setPoolKey(crypto.randomUUID());
        }}
      />
    );
  }

  if (view === 'stats') {
    return <StatsPage players={players} onBack={() => setView('game')} />;
  }

  return (
    <div className="app-shell min-h-screen overflow-x-hidden bg-[#050816] bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,.22),transparent_28%),radial-gradient(circle_at_95%_10%,rgba(225,29,72,.16),transparent_24%)]">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="safe-toast fixed left-1/2 top-4 z-[80] -translate-x-1/2 rounded-full border border-white/15 bg-slate-900/90 px-5 py-3 text-sm font-semibold shadow-2xl backdrop-blur-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <ProfileModal
        open={usernameEditorOpen}
        username={username}
        userEmail={userEmail}
        highScores={highScores}
        usernameDraft={usernameDraft}
        usernameError={usernameError}
        usernameSaving={usernameSaving}
        onClose={() => setUsernameEditorOpen(false)}
        onUsernameDraftChange={(value) => {
          setUsernameDraft(value);
          setUsernameError('');
        }}
        onSaveUsername={saveUsername}
        onSignOut={signOut}
        accountDeleting={accountDeleting}
        accountDeleteError={accountDeleteError}
        onDeleteAccount={deleteAccount}
      />

      <AppHeader
        remaining={remaining}
        selectedCount={selected.length}
        guardCount={guardCount}
        forwardCount={forwardCount}
        centerCount={centerCount}
        userEmail={userEmail}
        onHome={leaveGameMode}
        onStatistics={() => setView('stats')}
        onProfile={() => {
          setUsernameDraft(username);
          setUsernameError('');
          setUsernameEditorOpen(true);
        }}
        onSignOut={signOut}
      />

      <HomeScreen
        open={mobileHomeOpen}
        username={username}
        highScores={highScores}
        dailyLeaderboard={dailyLeaderboard}
        leaderboardLoading={leaderboardLoading}
        onStartMode={startMobileMode}
        onOpenProfile={() => {
          setUsernameDraft(username);
          setUsernameError('');
          setUsernameEditorOpen(true);
        }}
        onSignOut={signOut}
        onOpenStats={() => setView('stats')}
      />

      <main className="mx-auto max-w-[1600px] px-3 pb-28 pt-4 sm:px-4 sm:py-6 md:px-7 xl:pb-6">
        <section className="mb-4 sm:hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-400">
                {mode === 'daily' ? 'Daily Challenge' : mode}
              </p>
              <h2 className="text-2xl font-black">Draft Your Five</h2>
            </div>
            <button
              onClick={newPool}
              disabled={mode === 'daily'}
              className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 disabled:opacity-30"
              aria-label="Reset player pool"
            >
              <RefreshCcw size={18} />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[9px] font-bold uppercase text-slate-500">Budget</p>
              <p className="text-xl font-black text-emerald-400">${remaining}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[9px] font-bold uppercase text-slate-500">Lineup</p>
              <p className="text-xl font-black">{selected.length}/5</p>
            </div>
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="rounded-xl border border-white/10 bg-white/5 p-3 text-left"
            >
              <p className="text-[9px] font-bold uppercase text-slate-500">Pool</p>
              <p className="text-xl font-black">{pool.length}</p>
            </button>
          </div>
          {mode === 'daily' && (
            <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
              New challenge in <span className="font-mono font-black">{dailyCountdown}</span>
            </div>
          )}
        </section>

        {mode === 'daily' && (
          <section className="mb-4 hidden sm:flex flex-col gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">
                Daily Challenge
              </p>
              <p className="text-sm font-semibold text-slate-200">
                {new Date(`${dailyDate}T12:00:00`).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                · The same 80-player pool for everyone using this calendar date.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                New pool in
              </p>
              <p className="font-mono text-lg font-black text-amber-200">{dailyCountdown}</p>
            </div>
          </section>
        )}

        {mode === 'daily' && (
          <DailyLeaderboard
            entries={dailyLeaderboard}
            loading={leaderboardLoading}
            onRefresh={() => {
              setLeaderboardLoading(true);
              refreshAccountData().finally(() => setLeaderboardLoading(false));
            }}
          />
        )}

        <section className="mb-6 hidden overflow-hidden rounded-3xl sm:block border border-white/10 bg-gradient-to-br from-blue-950/70 via-slate-950/75 to-rose-950/60 p-5 shadow-2xl md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300">
                <Sparkles size={13} />
                {mode === 'historic'
                  ? 'Historic NBA · 100 Player-Seasons'
                  : '2025–26 Regular Season · 80-Player Pool'}
              </div>
              <h2 className="text-3xl font-black leading-tight md:text-5xl">
                <span className="text-gradient">Draft the perfect five.</span>
                <br />
                Every dollar matters.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">
                Choose exactly 2 guards, 2 forwards, and 1 center. Secondary positions can satisfy
                any eligible roster slot. Player prices equal rounded points + rebounds + assists +
                steals + blocks. Historic Mode uses each player's statistics from the season shown.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:w-[520px]">
              <div className="glass rounded-2xl p-3 sm:p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  Game mode
                </p>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/20 p-1">
                  {(['classic', 'daily', 'unlimited', 'historic'] as GameMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        resetAuctionFilters();
                        setMode(m);
                      }}
                      className={`rounded-lg px-2 py-2 text-xs font-bold capitalize transition ${mode === m ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="glass rounded-2xl p-3 sm:p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  {mode === 'daily' ? 'Daily budget' : 'Difficulty'}
                </p>
                {mode === 'daily' ? (
                  <div className="rounded-xl border border-amber-300/15 bg-amber-400/10 px-4 py-3 text-center">
                    <p className="text-2xl font-black text-amber-200">${DAILY_BUDGET}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-100/70">
                      Same cap for every player
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/20 p-1">
                    {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`rounded-lg px-2 py-2 text-xs font-bold capitalize transition ${difficulty === d ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        {d}
                        <span className="block text-[9px] opacity-70">${BUDGETS[d]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <PlayerBrowser
            displayed={displayed}
            selected={selected}
            remaining={remaining}
            teams={teams}
            search={search}
            teamFilter={teamFilter}
            positionFilter={positionFilter}
            sort={sort}
            maxPrice={maxPrice}
            mode={mode}
            onSearchChange={setSearch}
            onTeamFilterChange={setTeamFilter}
            onPositionFilterChange={setPositionFilter}
            onSortChange={setSort}
            onMaxPriceChange={setMaxPrice}
            onNewPool={newPool}
            onSelectPlayer={selectPlayer}
          />
          <DesktopRosterSidebar
            selected={selected}
            remaining={remaining}
            spent={spent}
            guardCount={guardCount}
            forwardCount={forwardCount}
            centerCount={centerCount}
            validRoster={validRoster}
            isSubmitting={isSubmitting}
            gameSessionId={gameSessionId}
            onTogglePlayer={selectPlayer}
            onAnalyze={submitLineup}
            onSave={saveLineup}
            onLoad={loadSavedLineup}
            onShare={shareLineup}
          />
        </div>
      </main>

      <MobileGameControls
        filtersOpen={mobileFiltersOpen}
        selectedCount={selected.length}
        displayedCount={displayed.length}
        teams={teams}
        search={search}
        teamFilter={teamFilter}
        positionFilter={positionFilter}
        sort={sort}
        maxPrice={maxPrice}
        onHome={leaveGameMode}
        onPlayers={() => {
          setMobileHomeOpen(false);
          setMobileFiltersOpen(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenFilters={() => setMobileFiltersOpen(true)}
        onOpenRoster={() => setMobileRosterOpen(true)}
        onCloseFilters={() => setMobileFiltersOpen(false)}
        onSearchChange={setSearch}
        onTeamFilterChange={setTeamFilter}
        onPositionFilterChange={setPositionFilter}
        onSortChange={setSort}
        onMaxPriceChange={setMaxPrice}
      />

      <MobileRosterSheet
        open={mobileRosterOpen}
        selected={selected}
        remaining={remaining}
        spent={spent}
        guardCount={guardCount}
        forwardCount={forwardCount}
        centerCount={centerCount}
        validRoster={validRoster}
        isSubmitting={isSubmitting}
        gameSessionId={gameSessionId}
        onTogglePlayer={selectPlayer}
        onAnalyze={submitLineup}
        onClose={() => setMobileRosterOpen(false)}
      />
      <TeamResultsModal
        report={report}
        isIdeal={isIdeal}
        mode={mode}
        revealIdeal={revealIdeal}
        playoffFinish={playoffFinish}
        submittedLineup={submittedLineup}
        idealLineup={idealLineup}
        idealReport={idealReport}
        idealPlayoffFinish={idealPlayoffFinish}
        dailyBudget={DAILY_BUDGET}
        dailyCountdown={dailyCountdown}
        onShareLineup={shareLineup}
        onContinueUnlimited={continueUnlimited}
        onRevealIdeal={() => setRevealIdeal(true)}
        onPlayAgain={playAgain}
        onCloseDaily={() => setReport(null)}
      />
    </div>
  );
}

export default App;
