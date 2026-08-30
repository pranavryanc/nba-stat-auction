import { useState } from 'react';
import type { Player } from '../types';

export function PlayerImage({ player }: { player: Player }) {
  const [failed, setFailed] = useState(false);

  return failed ? (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 text-3xl font-black text-slate-300">
      {player.name
        .split(' ')
        .map((name) => name[0])
        .slice(0, 2)
        .join('')}
    </div>
  ) : (
    <img
      src={player.photo}
      alt={player.name}
      onError={() => setFailed(true)}
      className="h-full w-full object-cover object-top"
      loading="lazy"
    />
  );
}

export function TeamLogo({ player }: { player: Player }) {
  const [failed, setFailed] = useState(false);

  return failed ? (
    <span className="text-[10px] font-black">{player.teamAbbreviation}</span>
  ) : (
    <img
      src={player.teamLogo}
      alt={player.team}
      onError={() => setFailed(true)}
      className="h-8 w-8 object-contain"
    />
  );
}
