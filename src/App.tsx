import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3, Check, ChevronRight, CircleDollarSign, Copy, Crown, Gauge,
  RefreshCcw, Search, Share2, Shield, Sparkles, Trophy, Users, X,
} from 'lucide-react';
import rawPlayers from './data/players.json';
import rawHistoricalPlayers from './data/historicalPlayers.json';
import type { Difficulty, GameMode, Player, Position, TeamReport } from './types';

const POSITION_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
const POSITION_GROUP = { PG: 'G', SG: 'G', SF: 'F', PF: 'F', C: 'C' } as const;

const normalizePlayer = (player: Player): Player => {
  const percentages = player.positionPercentages;
  const primary = player.primaryDetailedPosition
    ?? (percentages ? [...POSITION_ORDER].sort((a, b) => (percentages[b] ?? 0) - (percentages[a] ?? 0))[0] : player.detailedPositions?.[0]);
  const secondary = primary && percentages
    ? [...POSITION_ORDER]
        .filter(position => position !== primary && (percentages[position] ?? 0) >= 25)
        .sort((a, b) => (percentages[b] ?? 0) - (percentages[a] ?? 0))[0]
    : undefined;
  const detailedPositions = primary ? ([primary, ...(secondary ? [secondary] : [])] as Player['detailedPositions']) : player.detailedPositions?.slice(0, 2);
  const eligiblePositions = detailedPositions?.length
    ? [...new Set(detailedPositions.map(position => POSITION_GROUP[position]))]
    : (player.eligiblePositions?.length ? player.eligiblePositions.slice(0, 2) : [player.position]);
  return { ...player, detailedPositions, primaryDetailedPosition: primary, eligiblePositions };
};
const players = (rawPlayers as Player[]).map(normalizePlayer);
const historicalPlayers = (rawHistoricalPlayers as Player[]).map(normalizePlayer);
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

const grade = (score: number) => score >= 95 ? 'A+' : score >= 90 ? 'A' : score >= 87 ? 'A-' : score >= 83 ? 'B+' : score >= 80 ? 'B' : score >= 77 ? 'B-' : score >= 73 ? 'C+' : score >= 70 ? 'C' : score >= 67 ? 'C-' : score >= 63 ? 'D+' : score >= 60 ? 'D' : 'F';
const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);

function analyzeTeam(team: Player[]): TeamReport {
  const scoring = clamp(average(team.map(p => p.points)) * 3.45);
  const passing = clamp(average(team.map(p => p.assistPercentage)) * 2.9);
  const rebounding = clamp(average(team.map(p => p.reboundPercentage)) * 6.0);
  const efficiency = clamp((average(team.map(p => p.trueShooting)) - 48) * 6.0);
  const defense = clamp(100 - (average(team.map(p => p.defensiveRating)) - 100) * 5.1 + average(team.map(p => p.stealPercentage + p.blockPercentage)) * 2.4);
  const spacing = clamp((average(team.map(p => p.threePointPercentage)) - 25) * 6.2 + team.filter(p => p.threePointPercentage >= 37).length * 4);
  const playmaking = clamp(passing + team.filter(p => p.assistPercentage >= 25).length * 5);
  const assignedRoster = rosterAssignment(team);
  const size = clamp((assignedRoster.forwards.length * 10 + assignedRoster.centers.length * 24) + average(team.map(p => p.reboundPercentage)) * 2.5);
  const usageSpread = Math.max(...team.map(p => p.usageRate)) - Math.min(...team.map(p => p.usageRate));
  const highUsage = team.filter(p => p.usageRate >= 29).length;
  const usagePenalty = Math.max(0, highUsage - 2) * 8 + (usageSpread < 6 ? 7 : 0);
  const guards = assignedRoster.guards.length;
  const forwards = assignedRoster.forwards.length;
  const centers = assignedRoster.centers.length;
  const balance = clamp(100 - Math.abs(guards - 2) * 20 - Math.abs(forwards - 2) * 20 - Math.abs(centers - 1) * 28);
  const fit = clamp((spacing + playmaking + defense + balance + size) / 5 - usagePenalty);
  const offense = clamp(scoring * .28 + efficiency * .25 + spacing * .21 + playmaking * .20 + fit * .06 - usagePenalty * .4);
  const defenseCategory = clamp(defense * .72 + rebounding * .16 + size * .12);
  const benchDepth = clamp(62 + average(team.map(p => p.boxPlusMinus)) * 3.4 + team.filter(p => p.usageRate < 23 && p.trueShooting > 58).length * 5);
  const overall = Math.round(clamp(offense * .27 + defenseCategory * .25 + playmaking * .13 + rebounding * .1 + spacing * .1 + fit * .15));
  const offensiveRating = Math.round((103 + offense * .18) * 10) / 10;
  const defensiveRating = Math.round((121 - defenseCategory * .17) * 10) / 10;
  const netRating = Math.round((offensiveRating - defensiveRating) * 10) / 10;
  const projectedWins = Math.round(clamp(41 + netRating * 2.15, 15, 69));
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const cats = { Offense: offense, Defense: defenseCategory, Playmaking: playmaking, Rebounding: rebounding, Spacing: spacing, 'Team Fit': fit, 'Bench Depth': benchDepth };
  Object.entries(cats).sort((a,b) => b[1]-a[1]).slice(0,3).forEach(([k]) => strengths.push(`${k} projects as a major advantage.`));
  Object.entries(cats).sort((a,b) => a[1]-b[1]).slice(0,2).forEach(([k]) => weaknesses.push(`${k} is the clearest area to improve.`));
  if (highUsage >= 4) weaknesses.push('Too many high-usage creators may reduce ball movement.');
  if (team.filter(p => p.threePointPercentage >= 37).length < 2) weaknesses.push('Limited high-level shooting could compress the floor.');
  if (defenseCategory >= 85) strengths.push('The lineup has championship-level defensive indicators.');
  return { overall, grade: grade(overall), projectedWins, offensiveRating, defensiveRating, netRating, categories: Object.fromEntries(Object.entries(cats).map(([k,v]) => [k, Math.round(v)])), strengths, weaknesses };
}


const eligibility = (player: Player) => player.eligiblePositions?.length ? player.eligiblePositions : [player.position];
const canPlayGuard = (player: Player) => eligibility(player).includes('G');
const canPlayForward = (player: Player) => eligibility(player).includes('F');
const canPlayCenter = (player: Player) => eligibility(player).includes('C');
const positionText = (player: Player) => player.detailedPositions?.length ? player.detailedPositions.join('/') : eligibility(player).join('/');
const positionBreakdownText = (player: Player) => {
  if (!player.positionPercentages) return positionText(player);
  const order = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
  const breakdown = order.map(position => `${position} ${player.positionPercentages?.[position] ?? 0}%`).join(' · ');
  return `${breakdown} · 25% eligibility threshold · maximum two positions`;
};

type RosterSlot = 'G1' | 'G2' | 'F1' | 'F2' | 'C';
const ROSTER_SLOTS: RosterSlot[] = ['G1', 'G2', 'F1', 'F2', 'C'];
const canFillSlot = (player: Player, slot: RosterSlot) =>
  slot.startsWith('G') ? canPlayGuard(player) : slot.startsWith('F') ? canPlayForward(player) : canPlayCenter(player);

function findRosterAssignment(team: Player[]) {
  if (team.length > 5) return null;
  const ordered = [...team].sort((a, b) => {
    const aOptions = ROSTER_SLOTS.filter(slot => canFillSlot(a, slot)).length;
    const bOptions = ROSTER_SLOTS.filter(slot => canFillSlot(b, slot)).length;
    return aOptions - bOptions;
  });
  const assigned = new Map<RosterSlot, Player>();
  const search = (index: number): boolean => {
    if (index === ordered.length) return true;
    const player = ordered[index];
    for (const slot of ROSTER_SLOTS) {
      if (assigned.has(slot) || !canFillSlot(player, slot)) continue;
      assigned.set(slot, player);
      if (search(index + 1)) return true;
      assigned.delete(slot);
    }
    return false;
  };
  return search(0) ? assigned : null;
}

function rosterAssignment(team: Player[]) {
  const assignment = findRosterAssignment(team);
  if (!assignment) return { guards: [] as Player[], forwards: [] as Player[], centers: [] as Player[] };
  return {
    guards: [...assignment.entries()].filter(([slot]) => slot.startsWith('G')).map(([, player]) => player),
    forwards: [...assignment.entries()].filter(([slot]) => slot.startsWith('F')).map(([, player]) => player),
    centers: [...assignment.entries()].filter(([slot]) => slot === 'C').map(([, player]) => player),
  };
}

function canStillBuildValidRoster(team: Player[]) {
  return team.length <= 5 && findRosterAssignment(team) !== null;
}

function isValidRoster(team: Player[]) {
  return team.length === 5 && findRosterAssignment(team) !== null;
}


const lineupKey = (team: Player[]) => team.map(player => String(player.id)).sort().join('|');
const sameLineup = (a: Player[], b: Player[]) => lineupKey(a) === lineupKey(b);
const individualValue = (player: Player) =>
  player.points * 1.8 + player.assists * 1.5 + player.rebounds * 1.15 + player.steals * 2.2 + player.blocks * 2.0
  + player.trueShooting * .22 + player.boxPlusMinus * 2.4 + player.estimatedPlusMinus * 2.2
  - player.price * .12;

function findIdealLineup(pool: Player[], budget: number) {
  type State = { team: Player[]; spent: number; nextIndex: number; heuristic: number };
  let beam: State[] = [{ team: [], spent: 0, nextIndex: 0, heuristic: 0 }];
  const beamWidth = 7000;
  for (let depth = 0; depth < 5; depth += 1) {
    const next: State[] = [];
    for (const state of beam) {
      for (let index = state.nextIndex; index < pool.length; index += 1) {
        const player = pool[index];
        if (state.spent + player.price > budget) continue;
        if (state.team.some(member => member.name === player.name)) continue;
        const team = [...state.team, player];
        if (!canStillBuildValidRoster(team)) continue;
        next.push({ team, spent: state.spent + player.price, nextIndex: index + 1, heuristic: state.heuristic + individualValue(player) });
      }
    }
    next.sort((a, b) => b.heuristic - a.heuristic);
    beam = next.slice(0, beamWidth);
  }
  const finalists = beam.filter(state => isValidRoster(state.team));
  if (!finalists.length) return [];
  finalists.sort((a, b) => {
    const reportA = analyzeTeam(a.team);
    const reportB = analyzeTeam(b.team);
    return reportB.overall - reportA.overall || reportB.netRating - reportA.netRating || b.spent - a.spent;
  });
  return finalists[0].team;
}


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
  const [toast, setToast] = useState('');
  const [dailyDate, setDailyDate] = useState(() => localDateKey());
  const [dailyTimeLeft, setDailyTimeLeft] = useState(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return nextMidnight.getTime() - now.getTime();
  });

  const budget = mode === 'daily' ? DAILY_BUDGET : BUDGETS[difficulty];
  const spent = selected.reduce((sum, p) => sum + p.price, 0);
  const remaining = budget - spent;
  const pool = useMemo(() => {
    const source = mode === 'historic' ? historicalPlayers : players;
    const seed = mode === 'daily' ? `daily-${dailyDate}` : `${mode}-${poolKey}`;
    const shuffled = seededShuffle(source, seed);
    if (mode !== 'historic') return shuffled.slice(0, Math.min(80, shuffled.length));
    const names = new Set<string>();
    return shuffled.filter(player => {
      const key = player.name.toLowerCase();
      if (names.has(key)) return false;
      names.add(key);
      return true;
    }).slice(0, 100);
  }, [mode, poolKey, dailyDate]);
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

  useEffect(() => { setSelected([]); setReport(null); setSubmittedLineup([]); setIdealLineup([]); setRevealIdeal(false); }, [difficulty, mode, poolKey, dailyDate]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    const updateDailyClock = () => {
      const now = new Date();
      const currentDate = localDateKey(now);
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      setDailyTimeLeft(nextMidnight.getTime() - now.getTime());
      setDailyDate(previousDate => previousDate === currentDate ? previousDate : currentDate);
    };
    updateDailyClock();
    const timer = window.setInterval(updateDailyClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const assignment = rosterAssignment(selected);
  const guardCount = assignment.guards.length;
  const forwardCount = assignment.forwards.length;
  const centerCount = assignment.centers.length;
  const validRoster = isValidRoster(selected) && spent <= budget;
  const isIdeal = idealLineup.length === 5 && sameLineup(submittedLineup, idealLineup);
  const idealReport = idealLineup.length === 5 ? analyzeTeam(idealLineup) : null;

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
    setPoolKey(crypto.randomUUID());
  };
  const submitLineup = () => {
    const ideal = findIdealLineup(pool, budget);
    const userReport = analyzeTeam(selected);
    const perfect = sameLineup(selected, ideal);
    setSubmittedLineup([...selected]);
    setIdealLineup(ideal);
    setRevealIdeal(mode === 'classic' || mode === 'historic' || perfect);
    setReport(userReport);
  };
  const playAgain = () => {
    if (mode === 'daily') return;
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
  const saveLineup = () => { localStorage.setItem('nba-stat-auction-best', JSON.stringify(selected)); setToast('Lineup saved on this device.'); };
  const shareLineup = async () => {
    const text = `My NBA Stat Auction lineup: ${selected.map(p => `${p.name}${p.season ? ` (${p.season})` : ''}`).join(', ')} — $${spent}/${budget}`;
    try { await navigator.clipboard.writeText(text); setToast('Lineup copied to clipboard.'); } catch { setToast(text); }
  };

  if (view === 'stats') return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#18254a_0,_#050816_42%)] p-5 md:p-10">
      <div className="mx-auto max-w-7xl">
        <button onClick={() => setView('game')} className="mb-6 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10">← Back to game</button>
        <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[.3em] text-blue-400">League database</p><h1 className="text-4xl font-black">Player Statistics</h1><p className="mt-2 text-slate-400">Advanced metrics are visible here and in the post-auction team report. Prices include PTS + REB + AST + STL + BLK.</p></div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-white/5 text-xs uppercase text-slate-400"><tr>{['Player','Season','Pos','Price','STL','BLK','TS%','3P%','ORtg','DRtg','USG%','PER','BPM','EPM'].map(h => <th key={h} className="px-4 py-4">{h}</th>)}</tr></thead><tbody>{players.map(p => <tr key={p.id} className="border-t border-white/5 hover:bg-white/[.03]"><td className="px-4 py-3 font-semibold">{p.name}<span className="ml-2 text-xs text-slate-500">{p.teamAbbreviation}</span></td><td className="px-4">{p.season ?? '2025-26'}</td><td className="px-4">{positionText(p)}</td><td className="px-4">${p.price}</td><td className="px-4">{p.steals.toFixed(1)}</td><td className="px-4">{p.blocks.toFixed(1)}</td><td className="px-4">{p.trueShooting.toFixed(1)}</td><td className="px-4">{p.threePointPercentage.toFixed(1)}</td><td className="px-4">{p.offensiveRating}</td><td className="px-4">{p.defensiveRating}</td><td className="px-4">{p.usageRate.toFixed(1)}</td><td className="px-4">{p.playerEfficiencyRating.toFixed(1)}</td><td className="px-4">{p.boxPlusMinus.toFixed(1)}</td><td className="px-4">{p.estimatedPlusMinus.toFixed(1)}</td></tr>)}</tbody></table></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050816] bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,.22),transparent_28%),radial-gradient(circle_at_95%_10%,rgba(225,29,72,.16),transparent_24%)]">
      <AnimatePresence>{toast && <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} className="fixed left-1/2 top-4 z-[80] -translate-x-1/2 rounded-full border border-white/15 bg-slate-900/90 px-5 py-3 text-sm font-semibold shadow-2xl backdrop-blur-xl">{toast}</motion.div>}</AnimatePresence>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050816]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 md:px-7">
          <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-rose-500 shadow-glow"><Trophy size={23}/></div><div><p className="text-[10px] font-black uppercase tracking-[.25em] text-blue-400">Build five. Beat the cap.</p><h1 className="text-lg font-black md:text-2xl">NBA Stat Auction</h1></div></div>
          <div className="hidden items-center gap-2 lg:flex"><button onClick={() => setView('stats')} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5"><BarChart3 className="mr-2 inline" size={16}/>Statistics</button></div>
          <div className="flex items-center gap-2 md:gap-4"><div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Budget left</p><motion.p key={remaining} initial={{scale:1.2}} animate={{scale:1}} className={`text-lg font-black ${remaining < 20 ? 'text-rose-400':'text-emerald-400'}`}>${remaining}</motion.p></div><div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Selected</p><p className="text-lg font-black">{selected.length}/5</p></div></div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-7">
        {mode === 'daily' && <section className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Daily Challenge</p><p className="text-sm font-semibold text-slate-200">{new Date(`${dailyDate}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} · The same 80-player pool for everyone using this calendar date.</p></div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">New pool in</p><p className="font-mono text-lg font-black text-amber-200">{formatCountdown(dailyTimeLeft)}</p></div>
        </section>}
        <section className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-blue-950/70 via-slate-950/75 to-rose-950/60 p-5 shadow-2xl md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between"><div className="max-w-3xl"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300"><Sparkles size={13}/>{mode === 'historic' ? 'Historic NBA · 100 Player-Seasons' : '2025–26 Regular Season · 80-Player Pool'}</div><h2 className="text-3xl font-black leading-tight md:text-5xl"><span className="text-gradient">Draft the perfect five.</span><br/>Every dollar matters.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">Choose exactly 2 guards, 2 forwards, and 1 center. Secondary positions can satisfy any eligible roster slot. Player prices equal rounded points + rebounds + assists + steals + blocks. Historic Mode uses each player's statistics from the season shown.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:w-[520px]"><div className="glass rounded-2xl p-4"><p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Game mode</p><div className="grid grid-cols-2 gap-1 rounded-xl bg-black/20 p-1">{(['classic','daily','unlimited','historic'] as GameMode[]).map(m => <button key={m} onClick={() => setMode(m)} className={`rounded-lg px-2 py-2 text-xs font-bold capitalize transition ${mode===m?'bg-blue-500 text-white':'text-slate-400 hover:text-white'}`}>{m}</button>)}</div></div><div className="glass rounded-2xl p-4"><p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">{mode === 'daily' ? 'Daily budget' : 'Difficulty'}</p>{mode === 'daily' ? <div className="rounded-xl border border-amber-300/15 bg-amber-400/10 px-4 py-3 text-center"><p className="text-2xl font-black text-amber-200">${DAILY_BUDGET}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-100/70">Same cap for every player</p></div> : <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/20 p-1">{(['easy','normal','hard'] as Difficulty[]).map(d => <button key={d} onClick={() => setDifficulty(d)} className={`rounded-lg px-2 py-2 text-xs font-bold capitalize transition ${difficulty===d?'bg-rose-500 text-white':'text-slate-400 hover:text-white'}`}>{d}<span className="block text-[9px] opacity-70">${BUDGETS[d]}</span></button>)}</div>}</div></div></div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <div className="glass mb-5 rounded-2xl p-3"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_.7fr_.7fr_.8fr_auto]"><label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search players..." className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-10 pr-3 text-sm placeholder:text-slate-600"/></label><select value={teamFilter} onChange={e=>setTeamFilter(e.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm"><option value="ALL">All teams</option>{teams.map(t=><option key={t}>{t}</option>)}</select><select value={positionFilter} onChange={e=>setPositionFilter(e.target.value as 'ALL'|Position)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm"><option value="ALL">All positions</option><option value="G">Guards</option><option value="F">Forwards</option><option value="C">Centers</option></select><select value={sort} onChange={e=>setSort(e.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm"><option value="price-desc">Price: high to low</option><option value="price-asc">Price: low to high</option><option value="points">Points</option><option value="rebounds">Rebounds</option><option value="assists">Assists</option><option value="steals">Steals</option><option value="blocks">Blocks</option><option value="alpha">Alphabetical</option></select><button onClick={newPool} disabled={mode==='daily'} title={mode==='daily'?'Daily pool is fixed for everyone':'Generate a new player pool'} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"><RefreshCcw className="mr-1 inline" size={17}/><span className="hidden 2xl:inline">Reset pool</span></button></div><div className="mt-3 flex items-center gap-3 px-1"><span className="text-xs font-bold text-slate-500">Max price ${maxPrice}</span><input type="range" min="0" max="80" value={maxPrice} onChange={e=>setMaxPrice(Number(e.target.value))} className="h-1 flex-1 accent-blue-500"/><span className="text-xs text-slate-600">{displayed.length} players</span></div></div>
            {mode === 'historic' && historicalPlayers.length < 100 && <div className="mb-5 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-5 text-sm text-amber-100"><p className="font-black">Historic data setup required</p><p className="mt-1 text-amber-100/75">Run <code className="rounded bg-black/30 px-1.5 py-0.5">npm run update-history</code> once, then restart the development server. The updater downloads season-by-season NBA player data and builds the Historic Mode database.</p></div>}
            <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              <AnimatePresence>{displayed.map((p,index) => { const active=selected.some(s=>s.id===p.id); const unavailable=!active && (p.price>remaining || selected.length>=5 || !canStillBuildValidRoster([...selected, p])); return <motion.article layout initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:.95}} transition={{delay:Math.min(index*.015,.25)}} key={p.id} className={`group relative overflow-hidden rounded-2xl border transition duration-300 ${active?'border-blue-400 bg-blue-500/10 shadow-[0_0_35px_rgba(59,130,246,.22)]':'border-white/10 bg-slate-900/60 hover:-translate-y-1 hover:border-white/25 hover:bg-slate-900/90'}`}>
                <div className="relative h-44 overflow-hidden bg-gradient-to-b from-slate-700 to-slate-950"><PlayerImage player={p}/><div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950 to-transparent"/><div className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/75 backdrop-blur"><Logo player={p}/></div><div title={positionBreakdownText(p)} className="absolute right-3 top-3 rounded-full border border-white/10 bg-slate-950/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">{positionText(p)}</div><div className="absolute bottom-3 left-4 right-4 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{p.teamAbbreviation}{p.season ? ` · ${p.season}` : ''}</p><h3 className="max-w-[155px] text-lg font-black leading-tight">{p.name}</h3></div><div className="rounded-xl bg-emerald-400 px-3 py-2 text-lg font-black text-emerald-950">${p.price}</div></div></div>
                <div className="p-4"><div className="mb-4 grid grid-cols-5 divide-x divide-white/10 rounded-xl bg-black/20 py-3 text-center"><div><p className="text-[9px] font-bold text-slate-500">PTS</p><p className="font-black">{p.points.toFixed(1)}</p></div><div><p className="text-[9px] font-bold text-slate-500">REB</p><p className="font-black">{p.rebounds.toFixed(1)}</p></div><div><p className="text-[9px] font-bold text-slate-500">AST</p><p className="font-black">{p.assists.toFixed(1)}</p></div><div><p className="text-[9px] font-bold text-slate-500">STL</p><p className="font-black">{p.steals.toFixed(1)}</p></div><div><p className="text-[9px] font-bold text-slate-500">BLK</p><p className="font-black">{p.blocks.toFixed(1)}</p></div></div><button onClick={()=>selectPlayer(p)} disabled={unavailable} className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black transition ${active?'bg-blue-500 text-white hover:bg-blue-400':unavailable?'cursor-not-allowed bg-white/5 text-slate-600':'bg-white text-slate-950 hover:bg-blue-100'}`}>{active?<><Check size={17}/>Selected</>:<>Select Player<ChevronRight size={17}/></>}</button></div>
              </motion.article>})}</AnimatePresence>
            </motion.div>
          </div>

          <aside className="xl:sticky xl:top-24 xl:self-start"><div className="glass overflow-hidden rounded-3xl shadow-2xl"><div className="border-b border-white/10 bg-gradient-to-r from-blue-500/15 to-rose-500/10 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-400">Your roster</p><h3 className="text-2xl font-black">Starting Five</h3></div><Users className="text-slate-500"/></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-black/20 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Remaining</p><motion.p key={remaining} initial={{scale:1.15}} animate={{scale:1}} className="text-2xl font-black text-emerald-400">${remaining}</motion.p></div><div className="rounded-xl bg-black/20 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Spent</p><p className="text-2xl font-black">${spent}</p></div></div></div>
                <div className="p-5"><div className="mb-5 grid grid-cols-3 gap-2"><div className={`rounded-xl border p-2 text-center ${guardCount === 2?'border-emerald-400/30 bg-emerald-400/10':'border-white/10 bg-white/5'}`}><p className="text-[9px] font-bold text-slate-500">GUARDS</p><p className="font-black">{guardCount}/2</p></div><div className={`rounded-xl border p-2 text-center ${forwardCount === 2?'border-emerald-400/30 bg-emerald-400/10':'border-white/10 bg-white/5'}`}><p className="text-[9px] font-bold text-slate-500">FORWARDS</p><p className="font-black">{forwardCount}/2</p></div><div className={`rounded-xl border p-2 text-center ${centerCount === 1?'border-emerald-400/30 bg-emerald-400/10':'border-white/10 bg-white/5'}`}><p className="text-[9px] font-bold text-slate-500">CENTER</p><p className="font-black">{centerCount}/1</p></div></div>
                  <div className="space-y-2"><AnimatePresence mode="popLayout">{selected.map(p=><motion.div layout initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:20}} key={p.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-2.5"><div className="h-12 w-12 overflow-hidden rounded-lg bg-slate-800"><PlayerImage player={p}/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{p.name}</p><p className="text-xs text-slate-500">{positionText(p)} · {p.teamAbbreviation}{p.season ? ` · ${p.season}` : ''} · ${p.price}</p></div><button onClick={()=>selectPlayer(p)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400" aria-label={`Remove ${p.name}`}><X size={16}/></button></motion.div>)}</AnimatePresence>{Array.from({length:5-selected.length}).map((_,i)=><div key={i} className="flex h-[69px] items-center justify-center rounded-xl border border-dashed border-white/10 text-xs font-semibold text-slate-700">Empty roster slot</div>)}</div>
                  <button disabled={!validRoster} onClick={submitLineup} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-rose-500 py-4 font-black shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-40"><Gauge size={18}/>Analyze My Team</button>
                  <div className="mt-3 grid grid-cols-2 gap-2"><button disabled={!selected.length} onClick={saveLineup} className="rounded-xl border border-white/10 py-2.5 text-xs font-bold hover:bg-white/5 disabled:opacity-30"><Crown className="mr-1 inline" size={14}/>Save lineup</button><button disabled={!selected.length} onClick={shareLineup} className="rounded-xl border border-white/10 py-2.5 text-xs font-bold hover:bg-white/5 disabled:opacity-30"><Share2 className="mr-1 inline" size={14}/>Share</button></div>
                </div></div></aside>
        </div>
      </main>

      <AnimatePresence>{report && <motion.div className="fixed inset-0 z-[70] overflow-y-auto bg-[#02040d]/95 p-4 backdrop-blur-xl md:p-8" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
        <motion.div initial={{opacity:0,y:30,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:20,scale:.98}} className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">
          <div className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(244,63,94,.28),transparent_32%),radial-gradient(circle_at_top_left,_rgba(59,130,246,.28),transparent_34%)] p-6 md:p-10">
            <p className="text-xs font-black uppercase tracking-[.28em] text-blue-400">Front office report</p>
            <h2 className="mt-2 text-3xl font-black md:text-5xl">{isIdeal ? 'Congratulations!' : 'Team Analysis'}</h2>
            <p className="mt-2 text-slate-400">{isIdeal ? 'You found the ideal lineup for this player pool.' : mode === 'unlimited' && !revealIdeal ? 'Keep trying with this pool or give up to reveal the model-optimal lineup.' : 'See how your lineup compares with the model-optimal roster.'}</p>
            <div className="mt-8 grid gap-4 md:grid-cols-[1.2fr_2fr]"><div className="flex items-center gap-5 rounded-2xl border border-white/10 bg-white/5 p-5"><motion.div initial={{rotate:-12,scale:.8}} animate={{rotate:0,scale:1}} className="grid h-28 w-28 place-items-center rounded-full border-8 border-blue-500/70 bg-slate-950 text-center"><div><p className="text-4xl font-black">{report.overall}</p><p className="text-[10px] font-bold text-slate-500">OVERALL</p></div></motion.div><div><p className="text-sm text-slate-400">Letter grade</p><p className="text-6xl font-black text-gradient">{report.grade}</p></div></div><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[[report.projectedWins,'Projected Wins'],[report.offensiveRating,'Off. Rating'],[report.defensiveRating,'Def. Rating'],[`${report.netRating>0?'+':''}${report.netRating}`,'Net Rating']].map(([v,l])=><div key={l} className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-2xl font-black md:text-3xl">{v}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{l}</p></div>)}</div></div>
          </div>
          <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1.25fr_.75fr]">
            <div><h3 className="mb-4 text-xl font-black">Category Grades</h3><div className="space-y-4">{Object.entries(report.categories).map(([name,score],i)=><motion.div initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{delay:i*.07}} key={name}><div className="mb-1 flex items-center justify-between text-sm"><span className="font-semibold">{name}</span><span className="font-black">{score} · {grade(score)}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/5"><motion.div initial={{width:0}} animate={{width:`${score}%`}} transition={{duration:.7,delay:i*.06}} className="h-full rounded-full bg-gradient-to-r from-blue-500 to-rose-500"/></div></motion.div>)}</div>
              <h3 className="mb-3 mt-8 text-lg font-black">Your lineup</h3><div className="grid gap-3 sm:grid-cols-5">{submittedLineup.map(p=><div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-2 text-center"><div className="mx-auto h-16 w-16 overflow-hidden rounded-lg"><PlayerImage player={p}/></div><p className="mt-2 truncate text-xs font-bold">{p.name}</p><p className="text-[10px] text-slate-500">{positionText(p)} · ${p.price}</p></div>)}</div>
              {revealIdeal && idealLineup.length === 5 && <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Ideal lineup</p><h3 className="text-xl font-black">Best roster for this pool</h3></div>{idealReport && <p className="text-sm font-bold text-amber-200">{idealReport.overall} OVR · {idealReport.projectedWins} wins</p>}</div><div className="mt-4 grid gap-3 sm:grid-cols-5">{idealLineup.map(p=><div key={p.id} className="rounded-xl border border-amber-300/15 bg-black/20 p-2 text-center"><div className="mx-auto h-16 w-16 overflow-hidden rounded-lg"><PlayerImage player={p}/></div><p className="mt-2 truncate text-xs font-bold">{p.name}</p><p className="text-[10px] text-slate-500">{positionText(p)} · ${p.price}</p></div>)}</div></div>}
            </div>
            <div className="space-y-5"><div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-5"><h3 className="mb-3 flex items-center gap-2 font-black text-emerald-300"><Shield size={18}/>Strengths</h3><ul className="space-y-3 text-sm text-slate-300">{report.strengths.map(item=><li key={item} className="flex gap-2"><Check className="mt-0.5 shrink-0 text-emerald-400" size={15}/>{item}</li>)}</ul></div><div className="rounded-2xl border border-rose-400/15 bg-rose-400/5 p-5"><h3 className="mb-3 font-black text-rose-300">Weaknesses</h3><ul className="space-y-3 text-sm text-slate-300">{report.weaknesses.map(item=><li key={item} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400"/>{item}</li>)}</ul></div>
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
