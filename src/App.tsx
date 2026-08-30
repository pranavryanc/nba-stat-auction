import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3, Check, ChevronRight, CircleDollarSign, Copy, Crown, Gauge,
  RefreshCcw, Search, Share2, Shield, Sparkles, Trophy, Users, X, Home, ListFilter, Layers3, LogOut, Medal,
} from 'lucide-react';
import type { DetailedPosition, Difficulty, GameMode, Player, Position, TeamReport } from './types';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { createGameSession, getDailyLeaderboard, getMyHighScores, getMyUsername, registerUserEmail, saveGameScore, setMyUsername, type DailyLeaderboardEntry, type SavedHighScore } from './lib/gameBackend';
import { getCurrentPlayers, getHistoricPlayerPool } from './lib/playerBackend';
import { analyzeTeam, canStillBuildValidRoster, eligibility, findIdealLineup, grade, isValidRoster, positionBreakdownText, positionText, projectPlayoffFinish, rosterAssignment, sameLineup } from './lib/gameLogic';
import { E2E_TEST_EMAIL, E2E_TEST_MODE } from './lib/e2eFixtures';

const POSITION_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
const ADJACENT_POSITIONS: Record<DetailedPosition, DetailedPosition[]> = { PG: ['SG'], SG: ['PG', 'SF'], SF: ['SG', 'PF'], PF: ['SF', 'C'], C: ['PF'] };
const POSITION_GROUP = { PG: 'G', SG: 'G', SF: 'F', PF: 'F', C: 'C' } as const;

const normalizePlayer = (player: Player): Player => {
  const percentages = player.positionPercentages;
  const primary = player.listedDetailedPosition
    ?? player.primaryDetailedPosition
    ?? (percentages ? [...POSITION_ORDER].sort((a, b) => (percentages[b] ?? 0) - (percentages[a] ?? 0))[0] : player.detailedPositions?.[0]);
  const secondary = primary && percentages
    ? (ADJACENT_POSITIONS[primary] ?? [])
        .filter(position => (percentages[position] ?? 0) >= 25)
        .sort((a, b) => (percentages[b] ?? 0) - (percentages[a] ?? 0))[0]
    : primary
      ? (ADJACENT_POSITIONS[primary] ?? []).find(position => player.detailedPositions?.includes(position))
      : undefined;
  const detailedPositions = primary
    ? ([primary, ...(secondary ? [secondary] : [])] as Player['detailedPositions'])
    : player.detailedPositions?.slice(0, 1);
  const eligiblePositions = detailedPositions?.length
    ? [...new Set(detailedPositions.map(position => POSITION_GROUP[position]))]
    : (player.eligiblePositions?.length ? player.eligiblePositions.slice(0, 2) : [player.position]);
  return { ...player, detailedPositions, primaryDetailedPosition: primary, eligiblePositions };
};

const BUDGETS: Record<Difficulty, number> = { easy: 175, normal: 150, hard: 125 };
const DAILY_BUDGET = 150;

const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatCountdown = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const seededShuffle = <T,>(items: T[], seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; h += h << 5;
    const j = Math.abs(h) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

function PlayerImage({ player }: { player: Player }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 text-3xl font-black text-slate-300">{player.name.split(' ').map(n => n[0]).slice(0,2).join('')}</div>
  ) : <img src={player.photo} alt={player.name} onError={() => setFailed(true)} className="h-full w-full object-cover object-top" loading="lazy" />;
}

function Logo({ player }: { player: Player }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="text-[10px] font-black">{player.teamAbbreviation}</span> : <img src={player.teamLogo} alt={player.team} onError={() => setFailed(true)} className="h-8 w-8 object-contain" />;
}

function App() {
  const [mode, setMode] = useState<GameMode>('classic');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [poolKey, setPoolKey] = useState(() => crypto.randomUUID());
  const [players, setPlayers] = useState<Player[]>([]);
  const [historicalPlayers, setHistoricalPlayers] = useState<Player[]>([]);
  const [playerDataLoading, setPlayerDataLoading] = useState(true);
  const [historicalPoolLoading, setHistoricalPoolLoading] = useState(false);
  const [playerDataError, setPlayerDataError] = useState('');
  const [playerDataReloadKey, setPlayerDataReloadKey] = useState(0);
  const [selected, setSelected] = useState<Player[]>([]);
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [positionFilter, setPositionFilter] = useState<'ALL' | Position>('ALL');
  const [maxPrice, setMaxPrice] = useState(80);
  const [sort, setSort] = useState('price-desc');
  const [report, setReport] = useState<TeamReport | null>(null);
  const [submittedLineup, setSubmittedLineup] = useState<Player[]>([]);
  const [idealLineup, setIdealLineup] = useState<Player[]>([]);
  const [revealIdeal, setRevealIdeal] = useState(false);
  const [view, setView] = useState<'game' | 'stats'>('game');
  const [statsPage, setStatsPage] = useState(1);
  const [statsSearch, setStatsSearch] = useState('');
  const [statsSort, setStatsSort] = useState<'name' | 'price' | 'points' | 'rebounds' | 'assists' | 'steals' | 'blocks' | 'trueShooting'>('name');
  const [toast, setToast] = useState('');
  const [mobileRosterOpen, setMobileRosterOpen] = useState(false);
  const [mobileHomeOpen, setMobileHomeOpen] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameEditorOpen, setUsernameEditorOpen] = useState(false);
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
  const [dailyTimeLeft, setDailyTimeLeft] = useState(0);
  const budget = sessionBudget || (mode === 'daily' ? DAILY_BUDGET : BUDGETS[difficulty]);
  const spent = selected.reduce((sum, p) => sum + p.price, 0);
  const remaining = budget - spent;
  const pool = sessionPool;

  const teams = useMemo(() => [...new Set(pool.map(p => p.teamAbbreviation))].sort(), [pool]);

  const displayed = useMemo(() => {
    const list = pool.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) && (teamFilter === 'ALL' || p.teamAbbreviation === teamFilter) && (positionFilter === 'ALL' || eligibility(p).includes(positionFilter)) && p.price <= maxPrice);
    return [...list].sort((a,b) => {
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'price-desc') return b.price - a.price;
      if (sort === 'points') return b.points - a.points;
      if (sort === 'rebounds') return b.rebounds - a.rebounds;
      if (sort === 'assists') return b.assists - a.assists;
      if (sort === 'steals') return b.steals - a.steals;
      if (sort === 'blocks') return b.blocks - a.blocks;
      return a.name.localeCompare(b.name);
    });
  }, [pool, search, teamFilter, positionFilter, maxPrice, sort]);

  const resetAuctionFilters = () => {
    setSearch('');
    setTeamFilter('ALL');
    setPositionFilter('ALL');
    setMaxPrice(80);
    setSort('price-desc');
    setMobileFiltersOpen(false);
  };

  useEffect(() => {
    if (!supabase) {
      setPlayerDataLoading(false);
      return;
    }

    let cancelled = false;
    setPlayerDataLoading(true);
    setPlayerDataError('');

    getCurrentPlayers()
      .then(data => {
        if (!cancelled) setPlayers(data.map(normalizePlayer));
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) {
          setPlayerDataError(error instanceof Error ? error.message : 'Current player data could not be loaded.');
        }
      })
      .finally(() => {
        if (!cancelled) setPlayerDataLoading(false);
      });

    return () => { cancelled = true; };
  }, [playerDataReloadKey]);

  useEffect(() => {
    if (!userEmail) return;

    let cancelled = false;
    setSessionLoading(true);
    setPlayerDataError('');

    createGameSession(mode, difficulty)
      .then(session => {
        if (cancelled) return;
        setGameSessionId(session.sessionId);
        setSessionBudget(session.budget);
        setSessionPool(session.players.map(normalizePlayer));
        if (session.challengeDate) setDailyDate(session.challengeDate);
        else setDailyDate('');
        setDailyResetsAt(session.resetsAt);
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) {
          setGameSessionId(null);
          setSessionPool([]);
          setPlayerDataError(error instanceof Error ? error.message : 'Game session could not be created.');
        }
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false);
      });

    return () => { cancelled = true; };
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

  const refreshAccountData = async (email = userEmail) => {
    if (!email) return;
    try {
      const [records, daily] = await Promise.all([getMyHighScores(email), getDailyLeaderboard(dailyDate)]);
      setHighScores(records);
      setDailyLeaderboard(daily);
    } catch (error) {
      console.error(error);
    }
  };

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
      .catch(error => {
        console.error(error);
        if (!cancelled) setToast('Your profile could not be loaded.');
      })
      .finally(() => { if (!cancelled) setUsernameLoading(false); });
    return () => { cancelled = true; };
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
      setUsernameError(message.includes('already taken') ? 'That username is already taken.' : message);
    } finally {
      setUsernameSaving(false);
    }
  };

  useEffect(() => {
    if (!userEmail) { setHighScores([]); setDailyLeaderboard([]); return; }
    setLeaderboardLoading(true);
    refreshAccountData(userEmail).finally(() => setLeaderboardLoading(false));
  }, [userEmail, dailyDate]);

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

  useEffect(() => {
    setSelected([]);
    setReport(null);
    setSubmittedLineup([]);
    setIdealLineup([]);
    setRevealIdeal(false);
  }, [difficulty, mode, poolKey, dailyDate]);

  useEffect(() => {
    resetAuctionFilters();
  }, [mode, poolKey, dailyDate]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!dailyResetsAt) return;
    const updateDailyClock = () => {
      const milliseconds = Math.max(0, new Date(dailyResetsAt).getTime() - Date.now());
      setDailyTimeLeft(milliseconds);
      if (mode === 'daily' && milliseconds === 0) {
        setPoolKey(crypto.randomUUID());
      }
    };
    updateDailyClock();
    const timer = window.setInterval(updateDailyClock, 1000);
    return () => window.clearInterval(timer);
  }, [dailyResetsAt, mode]);

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
    if (selected.some(p => p.id === player.id)) return setSelected(s => s.filter(p => p.id !== player.id));
    if (selected.some(p => p.name === player.name)) return setToast('Only one version of each player may be selected.');
    if (selected.length >= 5) return setToast('Your roster is already full.');
    if (player.price > remaining) return setToast('That player exceeds your remaining budget.');
    const nextTeam = [...selected, player];
    if (!canStillBuildValidRoster(nextTeam)) return setToast('That player would make a valid 2-guard, 2-forward, 1-center lineup impossible.');
    setSelected(nextTeam);
  };

  const newPool = () => {
    if (mode === 'daily') return;
    resetAuctionFilters();
    if (mode === 'historic') setHistoricalPoolLoading(true);
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
    if (mode === 'historic') setHistoricalPoolLoading(true);
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
          playerIds: selected.map(player => String(player.id)),
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
        const legacyIds = parsed
          .map(player => String(player?.id ?? ''))
          .filter(Boolean);

        const restoredLegacy = legacyIds
          .map(id => pool.find(player => String(player.id) === id))
          .filter((player): player is Player => Boolean(player));

        if (
          legacyIds.length > 0 &&
          restoredLegacy.length === legacyIds.length
        ) {
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
        .map(id => pool.find(player => String(player.id) === id))
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
    const text = `My NBA Stat Auction lineup: ${selected.map(p => `${p.name}${p.season ? ` (${p.season})` : ''}`).join(', ')} — $${spent}/${budget}`;
    try {
      await navigator.clipboard.writeText(text);
      setToast('Lineup copied to clipboard.');
    } catch {
      setToast(text);
    }
  };

  if (authLoading) {
    return <div className="grid min-h-screen place-items-center bg-[#050816] text-slate-300"><div className="text-center"><Trophy className="mx-auto mb-4 text-blue-400"/><p className="font-bold">Loading NBA Stat Auction…</p></div></div>;
  }

  if (!isSupabaseConfigured && !E2E_TEST_MODE) {
    return <div className="min-h-screen bg-[#050816] px-5 py-16 text-white"><div className="mx-auto max-w-xl rounded-3xl border border-amber-300/20 bg-amber-400/10 p-7"><h1 className="text-3xl font-black">Backend setup required</h1><p className="mt-3 leading-6 text-slate-300">Create a Supabase project, run <code>supabase/schema.sql</code>, and copy <code>.env.example</code> to <code>.env</code> with your project URL and anon key.</p></div></div>;
  }

  if (!userEmail) {
    return <div className="min-h-screen bg-[#050816] bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,.25),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(225,29,72,.18),transparent_28%)] px-5 py-16 text-white"><div className="mx-auto flex min-h-[75vh] max-w-lg flex-col items-center justify-center text-center"><div className="grid h-24 w-24 place-items-center rounded-[30px] bg-gradient-to-br from-blue-500 to-rose-500 shadow-[0_20px_70px_rgba(59,130,246,.35)]"><Trophy size={42}/></div><p className="mt-6 text-xs font-black uppercase tracking-[.3em] text-blue-400">NBA Stat Auction</p><h1 className="mt-2 text-4xl font-black">Sign in to play</h1><p className="mt-4 leading-6 text-slate-400">Use Google to save records, compete in the Daily Challenge, and appear anonymously on the leaderboard.</p><button onClick={signInWithGoogle} className="mt-7 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 font-black text-slate-950 transition hover:bg-slate-100 active:scale-[.98]"><span className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 text-sm font-black text-blue-600">G</span>Continue with Google</button><p className="mt-4 text-xs leading-5 text-slate-600">NBA Stat Auction stores your email as the only personal field in its application database. Google handles authentication and session data.</p></div></div>;
  }

  if (usernameLoading) {
    return <div className="grid min-h-screen place-items-center bg-[#050816] text-slate-300"><div className="text-center"><Users className="mx-auto mb-4 text-blue-400"/><p className="font-bold">Loading your profile…</p></div></div>;
  }

  if (!username) {
    return <div className="min-h-screen bg-[#050816] bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,.25),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(225,29,72,.18),transparent_28%)] px-5 py-16 text-white"><div className="mx-auto flex min-h-[75vh] max-w-lg flex-col items-center justify-center text-center"><div className="grid h-20 w-20 place-items-center rounded-[26px] bg-gradient-to-br from-blue-500 to-rose-500 shadow-[0_20px_70px_rgba(59,130,246,.35)]"><Users size={34}/></div><p className="mt-6 text-xs font-black uppercase tracking-[.3em] text-blue-400">One last step</p><h1 className="mt-2 text-4xl font-black">Choose your username</h1><p className="mt-4 leading-6 text-slate-400">This is the name other players will see on Daily leaderboards. Your email stays private.</p><input autoFocus value={usernameDraft} onChange={event => { setUsernameDraft(event.target.value); setUsernameError(''); }} onKeyDown={event => { if (event.key === 'Enter') saveUsername(); }} maxLength={20} placeholder="Example: PranavHoops" className="mt-7 min-h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-lg font-bold outline-none placeholder:text-slate-600 focus:border-blue-500/60"/><div className="mt-2 flex w-full justify-between px-1 text-xs"><span className={usernameError ? 'text-rose-400' : 'text-slate-600'}>{usernameError || 'Letters, numbers, _ and . only'}</span><span className="text-slate-600">{usernameDraft.trim().length}/20</span></div><button onClick={saveUsername} disabled={usernameSaving || !usernameDraft.trim()} className="mt-5 min-h-14 w-full rounded-2xl bg-gradient-to-r from-blue-500 to-rose-500 px-5 font-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{usernameSaving ? 'Saving…' : 'Enter NBA Stat Auction'}</button><button onClick={signOut} className="mt-3 min-h-11 px-4 text-sm font-bold text-slate-500 hover:text-white">Use a different Google account</button></div></div>;
  }

  if (playerDataLoading || sessionLoading) {
    return <div className="grid min-h-screen place-items-center bg-[#050816] text-slate-300"><div className="text-center"><RefreshCcw className="mx-auto mb-4 animate-spin text-blue-400"/><p className="font-bold">{sessionLoading ? 'Building a secure game session…' : 'Loading player database…'}</p></div></div>;
  }

  if (playerDataError) {
    return <div className="min-h-screen bg-[#050816] px-5 py-16 text-white"><div className="mx-auto max-w-xl rounded-3xl border border-rose-300/20 bg-rose-400/10 p-7"><h1 className="text-3xl font-black">Player database unavailable</h1><p className="mt-3 leading-6 text-slate-300">{playerDataError}</p><button onClick={() => { setPlayerDataError(''); setPlayerDataReloadKey(value => value + 1); setPoolKey(crypto.randomUUID()); }} className="mt-6 rounded-xl bg-white px-5 py-3 font-black text-slate-950">Try Again</button></div></div>;
  }

  if (view === 'stats') {
    const statsPerPage = 20;
    const filteredStats = players
      .filter(player => `${player.name} ${player.teamAbbreviation} ${positionText(player)}`.toLowerCase().includes(statsSearch.toLowerCase()))
      .sort((a, b) => {
        if (statsSort === 'price') return b.price - a.price;
        if (statsSort === 'points') return b.points - a.points;
        if (statsSort === 'rebounds') return b.rebounds - a.rebounds;
        if (statsSort === 'assists') return b.assists - a.assists;
        if (statsSort === 'steals') return b.steals - a.steals;
        if (statsSort === 'blocks') return b.blocks - a.blocks;
        if (statsSort === 'trueShooting') return b.trueShooting - a.trueShooting;
        return a.name.localeCompare(b.name);
      });

    const statsPageCount = Math.max(1, Math.ceil(filteredStats.length / statsPerPage));
    const safeStatsPage = Math.min(statsPage, statsPageCount);
    const statsStart = (safeStatsPage - 1) * statsPerPage;
    const statsPlayers = filteredStats.slice(statsStart, statsStart + statsPerPage);
    const visiblePages = Array.from({ length: statsPageCount }, (_, index) => index + 1)
      .filter(page => page === 1 || page === statsPageCount || Math.abs(page - safeStatsPage) <= 1);

    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#18254a_0,_#050816_42%)] px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))] sm:px-5 md:p-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 pt-3 sm:pt-0"><p className="text-xs font-bold uppercase tracking-[.3em] text-blue-400">League database</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Player Statistics</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">Advanced metrics are visible here and in the post-auction team report. Prices include PTS + REB + AST + STL + BLK.</p></div>
          <button onClick={() => setView('game')} className="mb-7 min-h-12 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold hover:bg-white/10 active:scale-[.98]">← Back to game</button>
          <div className="mb-5 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-3 sm:grid-cols-[1fr_220px]">
            <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/><input value={statsSearch} onChange={event => { setStatsSearch(event.target.value); setStatsPage(1); }} placeholder="Search player, team, or position" className="min-h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 text-base outline-none placeholder:text-slate-600 focus:border-blue-500/60"/></label>
            <select value={statsSort} onChange={event => { setStatsSort(event.target.value as typeof statsSort); setStatsPage(1); }} className="min-h-12 rounded-xl border border-white/10 bg-slate-900 px-4 text-base outline-none focus:border-blue-500/60"><option value="name">Sort: Alphabetical</option><option value="price">Sort: Price</option><option value="points">Sort: Points</option><option value="rebounds">Sort: Rebounds</option><option value="assists">Sort: Assists</option><option value="steals">Sort: Steals</option><option value="blocks">Sort: Blocks</option><option value="trueShooting">Sort: True Shooting</option></select>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-white/5 text-xs uppercase text-slate-400"><tr>{['Player','Season','Pos','Price','PTS','REB','AST','STL','BLK','TS%','3P%','ORtg','DRtg','USG%','PER','BPM','EPM'].map(h => <th key={h} className="whitespace-nowrap px-4 py-4">{h}</th>)}</tr></thead><tbody>{statsPlayers.map(p => <tr key={p.id} className="border-t border-white/5 hover:bg-white/[.03]"><td className="whitespace-nowrap px-4 py-3 font-semibold">{p.name}<span className="ml-2 text-xs text-slate-500">{p.teamAbbreviation}</span></td><td className="whitespace-nowrap px-4">{p.season ?? '2025-26'}</td><td className="whitespace-nowrap px-4">{positionText(p)}</td><td className="px-4">${p.price}</td><td className="px-4">{p.points.toFixed(1)}</td><td className="px-4">{p.rebounds.toFixed(1)}</td><td className="px-4">{p.assists.toFixed(1)}</td><td className="px-4">{p.steals.toFixed(1)}</td><td className="px-4">{p.blocks.toFixed(1)}</td><td className="px-4">{p.trueShooting.toFixed(1)}</td><td className="px-4">{p.threePointPercentage.toFixed(1)}</td><td className="px-4">{p.offensiveRating}</td><td className="px-4">{p.defensiveRating}</td><td className="px-4">{p.usageRate.toFixed(1)}</td><td className="px-4">{p.playerEfficiencyRating.toFixed(1)}</td><td className="px-4">{p.boxPlusMinus.toFixed(1)}</td><td className="px-4">{p.estimatedPlusMinus.toFixed(1)}</td></tr>)}</tbody></table></div>
            {statsPlayers.length === 0 && <div className="px-6 py-14 text-center text-slate-400">No players match that search.</div>}
          </div>
          <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-center text-sm text-slate-400 sm:text-left">Showing <span className="font-bold text-white">{filteredStats.length === 0 ? 0 : statsStart + 1}–{Math.min(statsStart + statsPerPage, filteredStats.length)}</span> of <span className="font-bold text-white">{filteredStats.length}</span> players</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button disabled={safeStatsPage === 1} onClick={() => setStatsPage(page => Math.max(1, page - 1))} className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-35">Previous</button>
              {visiblePages.map((page, index) => {
                const previous = visiblePages[index - 1];
                return <span key={page} className="contents">{previous && page - previous > 1 ? <span className="px-1 text-slate-500">…</span> : null}<button onClick={() => setStatsPage(page)} aria-current={page === safeStatsPage ? 'page' : undefined} className={`grid h-11 min-w-11 place-items-center rounded-xl border text-sm font-black ${page === safeStatsPage ? 'border-blue-400 bg-blue-500 text-white' : 'border-white/10 bg-white/5 text-slate-300'}`}>{page}</button></span>;
              })}
              <button disabled={safeStatsPage === statsPageCount} onClick={() => setStatsPage(page => Math.min(statsPageCount, page + 1))} className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-35">Next</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen overflow-x-hidden bg-[#050816] bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,.22),transparent_28%),radial-gradient(circle_at_95%_10%,rgba(225,29,72,.16),transparent_24%)]">
      <AnimatePresence>{toast && <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} className="safe-toast fixed left-1/2 top-4 z-[80] -translate-x-1/2 rounded-full border border-white/15 bg-slate-900/90 px-5 py-3 text-sm font-semibold shadow-2xl backdrop-blur-xl">{toast}</motion.div>}</AnimatePresence>

      <AnimatePresence>{usernameEditorOpen && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm" onClick={() => setUsernameEditorOpen(false)}>
        <motion.div initial={{opacity:0,y:20,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:15,scale:.97}} onClick={event => event.stopPropagation()} className="my-6 w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-blue-400">Profile</p><h2 className="mt-1 text-3xl font-black">@{username}</h2><p className="mt-2 text-sm text-slate-500">Your account and NBA Stat Auction records.</p></div><button onClick={() => setUsernameEditorOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/5"><X size={18}/></button></div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.035] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Google account</p><p className="mt-1 break-all text-sm font-semibold text-slate-300">{userEmail}</p></div>
          <div className="mt-4 grid grid-cols-2 gap-2">{(['classic','daily','unlimited','historic'] as GameMode[]).map(recordMode => { const record = highScores.find(item => item.mode === recordMode); return <div key={recordMode} className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{recordMode}</p><p className="mt-1 text-2xl font-black">{record?.score ?? '—'}</p><p className="text-[10px] text-slate-500">{record ? `${record.projected_wins}-${82 - record.projected_wins} · ${record.net_rating > 0 ? '+' : ''}${record.net_rating} net` : 'No record yet'}</p></div>; })}</div>
          <div className="mt-6 border-t border-white/10 pt-5"><p className="text-sm font-black">Change username</p><p className="mt-1 text-xs leading-5 text-slate-500">This is the public name shown on Daily leaderboards. Usernames are unique.</p><input value={usernameDraft} onChange={event => { setUsernameDraft(event.target.value); setUsernameError(''); }} onKeyDown={event => { if (event.key === 'Enter') saveUsername(); }} maxLength={20} className="mt-4 min-h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-lg font-bold outline-none focus:border-blue-500/60"/><div className="mt-2 flex justify-between text-xs"><span className={usernameError ? 'text-rose-400' : 'text-slate-600'}>{usernameError || '3–20 characters · letters, numbers, _ or .'}</span><span className="text-slate-600">{usernameDraft.trim().length}/20</span></div><button onClick={saveUsername} disabled={usernameSaving || usernameDraft.trim() === username} className="mt-4 min-h-13 w-full rounded-xl bg-blue-500 py-3 font-black hover:bg-blue-400 disabled:opacity-40">{usernameSaving ? 'Saving…' : 'Save Username'}</button></div>
          <button onClick={signOut} className="mt-3 min-h-12 w-full rounded-xl border border-white/10 bg-white/5 font-bold text-slate-400 hover:bg-white/10 hover:text-white"><LogOut className="mr-2 inline" size={16}/>Sign out</button>
        </motion.div>
      </motion.div>}</AnimatePresence>

      <header className="safe-header sticky top-0 z-50 border-b border-white/10 bg-[#050816]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4 md:px-7">
          <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-rose-500 shadow-glow"><Trophy size={23}/></div><div><p className="hidden text-[10px] font-black uppercase tracking-[.25em] text-blue-400 sm:block">Build five. Beat the cap.</p><h1 className="text-base font-black sm:text-lg md:text-2xl">NBA Stat Auction</h1></div></div>
          <div className="hidden items-center gap-2 lg:flex"><button onClick={leaveGameMode} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5"><Home className="mr-2 inline" size={16}/>Home</button><button onClick={() => setView('stats')} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5"><BarChart3 className="mr-2 inline" size={16}/>Statistics</button><button onClick={() => { setUsernameDraft(username); setUsernameError(''); setUsernameEditorOpen(true); }} className="rounded-xl px-3 py-2 text-sm font-semibold text-blue-300 hover:bg-white/5"><Users className="mr-2 inline" size={16}/>Profile</button><button onClick={signOut} title={userEmail ?? ''} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-white"><LogOut className="mr-2 inline" size={16}/>Sign out</button></div>
          <div className="flex items-center gap-2 md:gap-4"><div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Budget left</p><motion.p key={remaining} initial={{scale:1.2}} animate={{scale:1}} className={`text-lg font-black ${remaining < 20 ? 'text-rose-400':'text-emerald-400'}`}>${remaining}</motion.p></div><div className="min-w-[112px] rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-right sm:min-w-[150px]"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Lineup</p><div className="flex items-end justify-end gap-2"><p className="text-lg font-black">{selected.length}/5</p><p className="pb-0.5 text-[9px] font-black text-slate-400">G {guardCount}/2 · F {forwardCount}/2 · C {centerCount}/1</p></div></div></div>
        </div>
      </header>

      <AnimatePresence>{mobileHomeOpen && <motion.section className="mobile-home fixed inset-0 z-[55] overflow-y-auto bg-[#050816] bg-[radial-gradient(circle_at_18%_0%,rgba(37,99,235,.26),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(225,29,72,.18),transparent_28%)] px-4 pb-10 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-8 md:px-12" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
        <div className="mx-auto flex min-h-full max-w-5xl flex-col">
          <div className="mt-5 text-center md:mt-12"><div className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] md:h-24 md:w-24 md:rounded-[32px] bg-gradient-to-br from-blue-500 to-rose-500 shadow-[0_20px_70px_rgba(59,130,246,.35)]"><Trophy size={38}/></div><p className="mt-6 text-xs font-black uppercase tracking-[.3em] text-blue-400">Build five. Beat the cap.</p><h1 className="mt-2 text-4xl font-black leading-tight md:text-6xl">NBA Stat<br/><span className="text-gradient">Auction</span></h1><p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-400 md:text-base">Draft a balanced starting five, stay under budget, and see how your lineup projects.</p></div>
          <div className="mt-8 grid gap-3 md:mt-10 md:grid-cols-2 md:gap-4">
            {[{id:'daily',title:'Daily Challenge',copy:'Same pool and $150 cap for everyone today.',icon:'🏆'},{id:'classic',title:'Classic',copy:'One attempt, then compare with the ideal lineup.',icon:'🎲'},{id:'unlimited',title:'Unlimited',copy:'Keep solving the same pool until you find the best five.',icon:'♾️'},{id:'historic',title:'Historic',copy:'Draft 100 player-seasons from across NBA history.',icon:'🕰️'}].map(item => <button key={item.id} onClick={() => startMobileMode(item.id as GameMode)} className="group flex min-h-[96px] w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[.055] p-4 text-left transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[.08] active:scale-[.98] md:p-5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/5 text-2xl md:h-14 md:w-14 md:text-3xl">{item.icon}</span><span className="min-w-0 flex-1"><span className="block text-lg font-black md:text-xl">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{item.copy}</span></span><ChevronRight className="text-slate-600"/></button>)}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[.045] p-5 text-left"><div className="flex items-center gap-2"><Medal className="text-amber-300" size={18}/><h3 className="font-black">My Records</h3></div><div className="mt-4 grid grid-cols-2 gap-2">{(['classic','daily','unlimited','historic'] as GameMode[]).map(recordMode => { const record = highScores.find(item => item.mode === recordMode); return <div key={recordMode} className="rounded-xl bg-black/20 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{recordMode}</p><p className="mt-1 text-2xl font-black">{record?.score ?? '—'}</p><p className="text-[10px] text-slate-500">{record ? `${record.projected_wins}-${82 - record.projected_wins} · ${record.net_rating > 0 ? '+' : ''}${record.net_rating} net` : 'No score yet'}</p></div>; })}</div></div>
            <div className="rounded-2xl border border-amber-300/15 bg-amber-400/[.055] p-5 text-left"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Crown className="text-amber-300" size={18}/><h3 className="font-black">Today’s Leaders</h3></div><span className="text-[10px] font-bold text-slate-500">TOP 3</span></div><div className="mt-4 space-y-2">{dailyLeaderboard.slice(0,3).map((entry,index)=><div key={`${entry.player_label}-${index}`} className="flex items-center gap-3 rounded-xl bg-black/20 p-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-amber-400/10 text-xs font-black text-amber-200">{index+1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{entry.player_label}</p><p className="truncate text-[10px] text-slate-500">{entry.lineup.map(player=>player.name).join(' · ')}</p></div><p className="text-xl font-black">{entry.score}</p></div>)}{!dailyLeaderboard.length && <p className="rounded-xl bg-black/20 p-4 text-sm text-slate-500">{leaderboardLoading ? 'Loading leaderboard…' : 'No Daily scores yet. Be the first.'}</p>}</div></div>
          </div>
          <div className="mx-auto mt-5 flex w-full max-w-md items-center justify-between rounded-2xl border border-white/10 bg-white/[.035] p-3"><div className="min-w-0 text-left"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Signed in as</p><p className="truncate font-black text-blue-300">@{username}</p></div><div className="flex gap-2"><button onClick={() => { setUsernameDraft(username); setUsernameError(''); setUsernameEditorOpen(true); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold hover:bg-white/10">Profile</button><button onClick={signOut} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-white/10 hover:text-white">Sign out</button></div></div>
          <button onClick={() => setView('stats')} className="mx-auto mt-3 flex min-h-14 w-full max-w-md items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 font-bold transition hover:bg-white/10"><BarChart3 size={18}/>Player Statistics</button>
          <p className="mt-auto pt-8 text-center text-[11px] text-slate-600 md:text-xs">2 Guards · 2 Forwards · 1 Center</p>
        </div>
      </motion.section>}</AnimatePresence>

      <main className="mx-auto max-w-[1600px] px-3 pb-28 pt-4 sm:px-4 sm:py-6 md:px-7 xl:pb-6">
        <section className="mb-4 sm:hidden">
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-400">{mode === 'daily' ? 'Daily Challenge' : mode}</p><h2 className="text-2xl font-black">Draft Your Five</h2></div><button onClick={newPool} disabled={mode === 'daily'} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 disabled:opacity-30" aria-label="Reset player pool"><RefreshCcw size={18}/></button></div>
          <div className="mt-3 grid grid-cols-3 gap-2"><div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Budget</p><p className="text-xl font-black text-emerald-400">${remaining}</p></div><div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Lineup</p><p className="text-xl font-black">{selected.length}/5</p></div><button onClick={() => setMobileFiltersOpen(true)} className="rounded-xl border border-white/10 bg-white/5 p-3 text-left"><p className="text-[9px] font-bold uppercase text-slate-500">Pool</p><p className="text-xl font-black">{pool.length}</p></button></div>
          {mode === 'daily' && <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">New challenge in <span className="font-mono font-black">{formatCountdown(dailyTimeLeft)}</span></div>}
        </section>

        {mode === 'daily' && <section className="mb-4 hidden sm:flex flex-col gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Daily Challenge</p><p className="text-sm font-semibold text-slate-200">{new Date(`${dailyDate}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} · The same 80-player pool for everyone using this calendar date.</p></div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">New pool in</p><p className="font-mono text-lg font-black text-amber-200">{formatCountdown(dailyTimeLeft)}</p></div>
        </section>}

        {mode === 'daily' && <section className="mb-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Daily leaderboard</p><h3 className="text-xl font-black">Top lineups today</h3></div><button onClick={() => { setLeaderboardLoading(true); refreshAccountData().finally(()=>setLeaderboardLoading(false)); }} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5" aria-label="Refresh leaderboard"><RefreshCcw size={16}/></button></div><div className="mt-4 grid gap-2">{dailyLeaderboard.map((entry,index)=><div key={`${entry.player_label}-${index}`} className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-xl border border-white/5 bg-black/20 p-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-amber-400/10 text-sm font-black text-amber-200">{index+1}</span><div className="min-w-0"><p className="font-bold">{entry.player_label}</p><p className="truncate text-xs text-slate-500">{entry.lineup.map(player=>player.name).join(' · ')}</p></div><div className="text-right"><p className="text-xl font-black">{entry.score}</p><p className="text-[10px] text-slate-500">{entry.projected_wins}-{82 - entry.projected_wins}</p></div></div>)}{!dailyLeaderboard.length && <p className="rounded-xl bg-black/20 p-4 text-sm text-slate-500">{leaderboardLoading ? 'Loading leaderboard…' : 'No Daily scores have been submitted yet.'}</p>}</div></section>}

        <section className="mb-6 hidden overflow-hidden rounded-3xl sm:block border border-white/10 bg-gradient-to-br from-blue-950/70 via-slate-950/75 to-rose-950/60 p-5 shadow-2xl md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between"><div className="max-w-3xl"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300"><Sparkles size={13}/>{mode === 'historic' ? 'Historic NBA · 100 Player-Seasons' : '2025–26 Regular Season · 80-Player Pool'}</div><h2 className="text-3xl font-black leading-tight md:text-5xl"><span className="text-gradient">Draft the perfect five.</span><br/>Every dollar matters.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">Choose exactly 2 guards, 2 forwards, and 1 center. Secondary positions can satisfy any eligible roster slot. Player prices equal rounded points + rebounds + assists + steals + blocks. Historic Mode uses each player's statistics from the season shown.</p></div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:w-[520px]"><div className="glass rounded-2xl p-3 sm:p-4"><p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Game mode</p><div className="grid grid-cols-2 gap-1 rounded-xl bg-black/20 p-1">{(['classic','daily','unlimited','historic'] as GameMode[]).map(m => <button key={m} onClick={() => { resetAuctionFilters(); setMode(m); }} className={`rounded-lg px-2 py-2 text-xs font-bold capitalize transition ${mode===m?'bg-blue-500 text-white':'text-slate-400 hover:text-white'}`}>{m}</button>)}</div></div><div className="glass rounded-2xl p-3 sm:p-4"><p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">{mode === 'daily' ? 'Daily budget' : 'Difficulty'}</p>{mode === 'daily' ? <div className="rounded-xl border border-amber-300/15 bg-amber-400/10 px-4 py-3 text-center"><p className="text-2xl font-black text-amber-200">${DAILY_BUDGET}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-100/70">Same cap for every player</p></div> : <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/20 p-1">{(['easy','normal','hard'] as Difficulty[]).map(d => <button key={d} onClick={() => setDifficulty(d)} className={`rounded-lg px-2 py-2 text-xs font-bold capitalize transition ${difficulty===d?'bg-rose-500 text-white':'text-slate-400 hover:text-white'}`}>{d}<span className="block text-[9px] opacity-70">${BUDGETS[d]}</span></button>)}</div>}</div></div></div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <div className="glass mb-4 hidden rounded-2xl p-3 sm:mb-5 sm:block"><div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_.7fr_.7fr_.8fr_auto]"><label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search players..." className="col-span-2 w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-10 pr-3 text-sm placeholder:text-slate-600"/></label><select value={teamFilter} onChange={e=>setTeamFilter(e.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm"><option value="ALL">All teams</option>{teams.map(t=><option key={t}>{t}</option>)}</select><select value={positionFilter} onChange={e=>setPositionFilter(e.target.value as 'ALL'|Position)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm"><option value="ALL">All positions</option><option value="G">Guards</option><option value="F">Forwards</option><option value="C">Centers</option></select><select value={sort} onChange={e=>setSort(e.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm"><option value="price-desc">Price: high to low</option><option value="price-asc">Price: low to high</option><option value="points">Points</option><option value="rebounds">Rebounds</option><option value="assists">Assists</option><option value="steals">Steals</option><option value="blocks">Blocks</option><option value="alpha">Alphabetical</option></select><button onClick={newPool} disabled={mode==='daily'} title={mode==='daily'?'Daily pool is fixed for everyone':'Generate a new player pool'} className="col-span-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold sm:col-span-1 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"><RefreshCcw className="mr-1 inline" size={17}/><span className="hidden 2xl:inline">Reset pool</span></button></div><div className="mt-3 flex items-center gap-3 px-1"><span className="text-xs font-bold text-slate-500">Max price ${maxPrice}</span><input type="range" min="0" max="80" value={maxPrice} onChange={e=>setMaxPrice(Number(e.target.value))} className="h-1 flex-1 accent-blue-500"/><span className="text-xs text-slate-600">{displayed.length} players</span></div></div>

            <motion.div layout className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-4">
              <AnimatePresence>{displayed.map((p,index) => { const active=selected.some(s=>s.id===p.id); const unavailable=!active && (p.price>remaining || selected.length>=5 || !canStillBuildValidRoster([...selected, p])); return <motion.article layout initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:.95}} transition={{delay:Math.min(index*.015,.25)}} key={p.id} className={`group relative overflow-hidden rounded-2xl border transition duration-300 touch-manipulation ${active?'border-blue-400 bg-blue-500/10 shadow-[0_0_35px_rgba(59,130,246,.22)]':'border-white/10 bg-slate-900/60 hover:-translate-y-1 hover:border-white/25 hover:bg-slate-900/90'}`}>
                <div className="relative h-44 overflow-hidden bg-gradient-to-b from-slate-700 to-slate-950"><PlayerImage player={p}/><div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950 to-transparent"/><div className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/75 backdrop-blur"><Logo player={p}/></div><div title={positionBreakdownText(p)} className="absolute right-3 top-3 rounded-full border border-white/10 bg-slate-950/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">{positionText(p)}</div><div className="absolute bottom-3 left-4 right-4 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{p.teamAbbreviation}{p.season ? ` · ${p.season}` : ''}</p><h3 className="max-w-[155px] text-lg font-black leading-tight">{p.name}</h3></div><div className="rounded-xl bg-emerald-400 px-3 py-2 text-lg font-black text-emerald-950">${p.price}</div></div></div>
                <div className="p-2.5 sm:p-4"><div className="mb-3 grid grid-cols-5 sm:mb-4 divide-x divide-white/10 rounded-xl bg-black/20 py-3 text-center"><div><p className="text-[9px] font-bold text-slate-500">PTS</p><p className="font-black">{p.points.toFixed(1)}</p></div><div><p className="text-[9px] font-bold text-slate-500">REB</p><p className="font-black">{p.rebounds.toFixed(1)}</p></div><div><p className="text-[9px] font-bold text-slate-500">AST</p><p className="font-black">{p.assists.toFixed(1)}</p></div><div><p className="text-[9px] font-bold text-slate-500">STL</p><p className="font-black">{p.steals.toFixed(1)}</p></div><div><p className="text-[9px] font-bold text-slate-500">BLK</p><p className="font-black">{p.blocks.toFixed(1)}</p></div></div><button onClick={()=>selectPlayer(p)} disabled={unavailable} className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black transition ${active?'bg-blue-500 text-white hover:bg-blue-400':unavailable?'cursor-not-allowed bg-white/5 text-slate-600':'bg-white text-slate-950 hover:bg-blue-100'}`}>{active?<><Check size={17}/>Selected</>:<>Select Player<ChevronRight size={17}/></>}</button></div>
              </motion.article>})}</AnimatePresence>
            </motion.div>
          </div>

          <aside className="hidden xl:sticky xl:top-24 xl:block xl:self-start"><div className="glass overflow-hidden rounded-3xl shadow-2xl"><div className="border-b border-white/10 bg-gradient-to-r from-blue-500/15 to-rose-500/10 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-400">Your roster</p><h3 className="text-2xl font-black">Starting Five</h3></div><Users className="text-slate-500"/></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-black/20 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Remaining</p><motion.p key={remaining} initial={{scale:1.15}} animate={{scale:1}} className="text-2xl font-black text-emerald-400">${remaining}</motion.p></div><div className="rounded-xl bg-black/20 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Spent</p><p className="text-2xl font-black">${spent}</p></div></div></div>
            <div className="p-5"><div className="mb-5 grid grid-cols-3 gap-2"><div className={`rounded-xl border p-2 text-center ${guardCount === 2?'border-emerald-400/30 bg-emerald-400/10':'border-white/10 bg-white/5'}`}><p className="text-[9px] font-bold text-slate-500">GUARDS</p><p className="font-black">{guardCount}/2</p></div><div className={`rounded-xl border p-2 text-center ${forwardCount === 2?'border-emerald-400/30 bg-emerald-400/10':'border-white/10 bg-white/5'}`}><p className="text-[9px] font-bold text-slate-500">FORWARDS</p><p className="font-black">{forwardCount}/2</p></div><div className={`rounded-xl border p-2 text-center ${centerCount === 1?'border-emerald-400/30 bg-emerald-400/10':'border-white/10 bg-white/5'}`}><p className="text-[9px] font-bold text-slate-500">CENTER</p><p className="font-black">{centerCount}/1</p></div></div>
              <div className="space-y-2"><AnimatePresence mode="popLayout">{selected.map(p=><motion.div layout initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:20}} key={p.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-2.5"><div className="h-12 w-12 overflow-hidden rounded-lg bg-slate-800"><PlayerImage player={p}/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{p.name}</p><p className="text-xs text-slate-500">{positionText(p)} · {p.teamAbbreviation}{p.season ? ` · ${p.season}` : ''} · ${p.price}</p></div><button onClick={()=>selectPlayer(p)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400" aria-label={`Remove ${p.name}`}><X size={16}/></button></motion.div>)}</AnimatePresence>{Array.from({length:5-selected.length}).map((_,i)=><div key={i} className="flex h-[69px] items-center justify-center rounded-xl border border-dashed border-white/10 text-xs font-semibold text-slate-700">Empty roster slot</div>)}</div>
              <button disabled={!validRoster || isSubmitting || !gameSessionId} onClick={submitLineup} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-rose-500 py-4 font-black shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-40"><Gauge size={18}/>Analyze My Team</button>
              <div className="mt-3 grid grid-cols-3 gap-2"><button disabled={!selected.length} onClick={saveLineup} className="rounded-xl border border-white/10 py-2.5 text-xs font-bold hover:bg-white/5 disabled:opacity-30"><Crown className="mr-1 inline" size={14}/>Save</button><button onClick={loadSavedLineup} className="rounded-xl border border-white/10 py-2.5 text-xs font-bold hover:bg-white/5">Load</button><button disabled={!selected.length} onClick={shareLineup} className="rounded-xl border border-white/10 py-2.5 text-xs font-bold hover:bg-white/5 disabled:opacity-30"><Share2 className="mr-1 inline" size={14}/>Share</button></div>
            </div></div></aside>
        </div>
      </main>

      <nav className="mobile-tab-bar fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/95 px-2 pb-[max(.55rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl xl:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
          <button onClick={leaveGameMode} className="mobile-tab"><Home size={19}/><span>Home</span></button>
          <button onClick={() => { setMobileHomeOpen(false); setMobileFiltersOpen(false); window.scrollTo({top:0,behavior:'smooth'}); }} className="mobile-tab mobile-tab-active"><Layers3 size={19}/><span>Players</span></button>
          <button onClick={() => setMobileFiltersOpen(true)} className="mobile-tab"><ListFilter size={19}/><span>Search</span></button>
          <button onClick={() => setMobileRosterOpen(true)} className="mobile-tab relative"><Users size={19}/><span>Lineup</span>{selected.length > 0 && <span className="absolute right-3 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-blue-500 px-1 text-[10px] font-black">{selected.length}</span>}</button>
        </div>
      </nav>

      <AnimatePresence>{mobileFiltersOpen && <motion.div className="fixed inset-0 z-[64] bg-black/70 backdrop-blur-sm xl:hidden" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setMobileFiltersOpen(false)}>
        <motion.section initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',damping:28,stiffness:280}} onClick={event => event.stopPropagation()} className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-slate-950 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20"/><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-400">Find players</p><h3 className="text-2xl font-black">Search & Filters</h3></div><button onClick={() => setMobileFiltersOpen(false)} className="grid h-11 w-11 place-items-center rounded-full bg-white/5"><X size={20}/></button></div>
          <label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/><input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search player name" className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-10 pr-3"/></label>
          <div className="mt-3 grid grid-cols-2 gap-3"><select value={teamFilter} onChange={e=>setTeamFilter(e.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3"><option value="ALL">All teams</option>{teams.map(t=><option key={t}>{t}</option>)}</select><select value={positionFilter} onChange={e=>setPositionFilter(e.target.value as 'ALL'|Position)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3"><option value="ALL">All positions</option><option value="G">Guards</option><option value="F">Forwards</option><option value="C">Centers</option></select></div>
          <select value={sort} onChange={e=>setSort(e.target.value)} className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3"><option value="price-desc">Price: high to low</option><option value="price-asc">Price: low to high</option><option value="points">Points</option><option value="rebounds">Rebounds</option><option value="assists">Assists</option><option value="steals">Steals</option><option value="blocks">Blocks</option><option value="alpha">Alphabetical</option></select>
          <div className="mt-5"><div className="mb-2 flex justify-between text-xs font-bold"><span>Maximum price</span><span>${maxPrice}</span></div><input type="range" min="0" max="80" value={maxPrice} onChange={e=>setMaxPrice(Number(e.target.value))} className="w-full accent-blue-500"/></div>
          <button onClick={() => setMobileFiltersOpen(false)} className="mt-6 min-h-14 w-full rounded-xl bg-blue-500 font-black">Show {displayed.length} Players</button>
        </motion.section>
      </motion.div>}</AnimatePresence>

      <AnimatePresence>{mobileRosterOpen && <motion.div className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-sm xl:hidden" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setMobileRosterOpen(false)}>
        <motion.section initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',damping:28,stiffness:280}} onClick={event => event.stopPropagation()} className="safe-bottom-sheet absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-slate-950 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20"/>
          <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-400">Your roster</p><h3 className="text-2xl font-black">Starting Five</h3></div><button onClick={() => setMobileRosterOpen(false)} className="grid h-11 w-11 place-items-center rounded-full bg-white/5" aria-label="Close roster"><X size={20}/></button></div>
          <div className="mb-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-white/5 p-3 text-center"><p className="text-[9px] font-bold text-slate-500">GUARDS</p><p className="font-black">{guardCount}/2</p></div><div className="rounded-xl bg-white/5 p-3 text-center"><p className="text-[9px] font-bold text-slate-500">FORWARDS</p><p className="font-black">{forwardCount}/2</p></div><div className="rounded-xl bg-white/5 p-3 text-center"><p className="text-[9px] font-bold text-slate-500">CENTER</p><p className="font-black">{centerCount}/1</p></div></div>
          <div className="space-y-2">{selected.map(player => <div key={player.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5"><div className="h-12 w-12 overflow-hidden rounded-lg"><PlayerImage player={player}/></div><div className="min-w-0 flex-1"><p className="truncate font-bold">{player.name}</p><p className="text-xs text-slate-500">{positionText(player)} · ${player.price}</p></div><button onClick={() => selectPlayer(player)} className="grid h-11 w-11 place-items-center rounded-xl bg-rose-500/10 text-rose-300"><X size={17}/></button></div>)}</div>
          {!selected.length && <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">Select players to build your lineup.</div>}
          <div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white/5 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Remaining</p><p className="text-2xl font-black text-emerald-400">${remaining}</p></div><div className="rounded-xl bg-white/5 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Spent</p><p className="text-2xl font-black">${spent}</p></div></div>
          <button disabled={!validRoster || isSubmitting || !gameSessionId} onClick={() => { setMobileRosterOpen(false); submitLineup(); }} className="mt-4 min-h-14 w-full rounded-xl bg-gradient-to-r from-blue-500 to-rose-500 font-black disabled:grayscale disabled:opacity-40">Analyze My Team</button>
        </motion.section>
      </motion.div>}</AnimatePresence>

      <AnimatePresence>{report && <motion.div className="safe-modal fixed inset-0 z-[70] overflow-y-auto bg-[#02040d]/95 p-0 sm:p-4 backdrop-blur-xl md:p-8" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
        <motion.div initial={{opacity:0,y:30,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:20,scale:.98}} className="mx-auto min-h-full max-w-6xl overflow-hidden border sm:min-h-0 sm:rounded-3xl border-white/10 bg-slate-950 shadow-2xl">
          <div className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(244,63,94,.28),transparent_32%),radial-gradient(circle_at_top_left,_rgba(59,130,246,.28),transparent_34%)] px-4 pb-6 pt-8 sm:p-6 md:p-10">
            <p className="text-xs font-black uppercase tracking-[.28em] text-blue-400">Front office report</p>
            <h2 className="mt-2 text-3xl font-black md:text-5xl">{isIdeal ? 'Congratulations!' : 'Team Analysis'}</h2>
            <p className="mt-2 text-slate-400">{isIdeal ? 'You found the ideal lineup for this player pool.' : mode === 'unlimited' && !revealIdeal ? 'Keep trying with this pool or give up to reveal the model-optimal lineup.' : 'See how your lineup compares with the model-optimal roster.'}</p>

            <div className="mt-8 grid gap-4 md:grid-cols-[1.2fr_2fr]">
              <div className="flex items-center gap-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                <motion.div initial={{ rotate: -12, scale: .8 }} animate={{ rotate: 0, scale: 1 }} className="grid h-28 w-28 place-items-center rounded-full border-8 border-blue-500/70 bg-slate-950 text-center">
                  <div><p className="text-4xl font-black">{report.overall}</p><p className="text-[10px] font-bold text-slate-500">OVERALL</p></div>
                </motion.div>
                <div><p className="text-sm text-slate-400">Letter grade</p><p className="text-6xl font-black text-gradient">{report.grade}</p></div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  [`${report.projectedWins}-${82 - report.projectedWins}`, 'Projected Record'],
                  [report.offensiveRating, 'Off. Rating'],
                  [report.defensiveRating, 'Def. Rating'],
                  [`${report.netRating > 0 ? '+' : ''}${report.netRating}`, 'Net Rating'],
                ].map(([v, l]) => (
                  <div key={l} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-2xl font-black md:text-3xl">{v}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{l}</p>
                  </div>
                ))}
              </div>
            </div>

            {playoffFinish && <div className="mt-4 rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-400/10 to-orange-500/5 p-5">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-400/10"><Trophy className="text-amber-300" size={28}/></div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">Projected Playoff Finish</p>
                  <p className="mt-1 text-2xl font-black text-white md:text-3xl">{playoffFinish}</p>
                  <p className="mt-1 text-xs text-slate-400">Based on regular-season projection, two-way strength, and lineup fit.</p>
                </div>
              </div>
            </div>}
          </div>

          <div className="grid gap-6 px-4 pb-10 pt-6 sm:p-6 md:gap-8 md:p-10 lg:grid-cols-[1.25fr_.75fr]">
            <div>
              <h3 className="mb-4 text-xl font-black">Category Grades</h3>
              <div className="space-y-4">{Object.entries(report.categories).map(([name,score],i)=><motion.div initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{delay:i*.07}} key={name}><div className="mb-1 flex items-center justify-between text-sm"><span className="font-semibold">{name}</span><span className="font-black">{score} · {grade(score)}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/5"><motion.div initial={{width:0}} animate={{width:`${score}%`}} transition={{duration:.7,delay:i*.06}} className="h-full rounded-full bg-gradient-to-r from-blue-500 to-rose-500"/></div></motion.div>)}</div>

              <h3 className="mb-3 mt-8 text-lg font-black">Your lineup</h3>
              <div className="grid gap-3 sm:grid-cols-5">{submittedLineup.map(p=><div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-2 text-center"><div className="mx-auto h-16 w-16 overflow-hidden rounded-lg"><PlayerImage player={p}/></div><p className="mt-2 truncate text-xs font-bold">{p.name}</p><p className="text-[10px] text-slate-500">{positionText(p)} · ${p.price}</p></div>)}</div>

              {revealIdeal && idealLineup.length === 5 && <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Ideal lineup</p><h3 className="text-xl font-black">Best roster for this pool</h3></div>{idealReport && <div className="text-right"><p className="text-sm font-bold text-amber-200">{idealReport.overall} OVR · {idealReport.projectedWins}-{82 - idealReport.projectedWins}</p>{idealPlayoffFinish && <p className="text-[10px] font-bold uppercase tracking-wide text-amber-100/60">{idealPlayoffFinish}</p>}</div>}</div><div className="mt-4 grid gap-3 sm:grid-cols-5">{idealLineup.map(p=><div key={p.id} className="rounded-xl border border-amber-300/15 bg-black/20 p-2 text-center"><div className="mx-auto h-16 w-16 overflow-hidden rounded-lg"><PlayerImage player={p}/></div><p className="mt-2 truncate text-xs font-bold">{p.name}</p><p className="text-[10px] text-slate-500">{positionText(p)} · ${p.price}</p></div>)}</div></div>}
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-5"><h3 className="mb-3 flex items-center gap-2 font-black text-emerald-300"><Shield size={18}/>Strengths</h3><ul className="space-y-3 text-sm text-slate-300">{report.strengths.map(item=><li key={item} className="flex gap-2"><Check className="mt-0.5 shrink-0 text-emerald-400" size={15}/>{item}</li>)}</ul></div>
              <div className="rounded-2xl border border-rose-400/15 bg-rose-400/5 p-5"><h3 className="mb-3 font-black text-rose-300">Weaknesses</h3><ul className="space-y-3 text-sm text-slate-300">{report.weaknesses.map(item=><li key={item} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400"/>{item}</li>)}</ul></div>
              <button onClick={shareLineup} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 font-bold hover:bg-white/5"><Copy size={16}/>Copy Team Result</button>
              {mode === 'unlimited' && !revealIdeal && !isIdeal && <><button onClick={continueUnlimited} className="w-full rounded-xl bg-blue-500 py-3 font-black hover:bg-blue-400">Continue Playing</button><button onClick={()=>setRevealIdeal(true)} className="w-full rounded-xl border border-rose-400/25 bg-rose-500/10 py-3 font-black text-rose-200 hover:bg-rose-500/20">Give Up & Reveal Ideal</button></>}
              {mode !== 'daily' && (mode !== 'unlimited' || revealIdeal || isIdeal) && <button onClick={playAgain} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-rose-500 py-3 font-black"><RefreshCcw size={17}/>Play Again</button>}
              {mode === 'daily' && <><button onClick={() => setReport(null)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 font-black hover:bg-white/10"><X size={17}/>Close Results</button><div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-slate-400">Today’s pool and ${DAILY_BUDGET} salary cap are the same for everyone. A new 80-player pool loads automatically in <span className="font-mono font-bold text-amber-200">{formatCountdown(dailyTimeLeft)}</span>.</div></>}
            </div>
          </div>
        </motion.div>
      </motion.div>}</AnimatePresence>
    </div>
  );
}

export default App;
