import { useEffect, useState } from 'react';
import type { GameMode } from '../types';

export const formatCountdown = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export function useDailyClock(resetsAt: string, mode: GameMode, onDailyReset: () => void) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!resetsAt) {
      setTimeLeft(0);
      return;
    }

    let resetTriggered = false;
    const update = () => {
      const milliseconds = Math.max(0, new Date(resetsAt).getTime() - Date.now());
      setTimeLeft(milliseconds);
      if (mode === 'daily' && milliseconds === 0 && !resetTriggered) {
        resetTriggered = true;
        onDailyReset();
      }
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [resetsAt, mode, onDailyReset]);

  return {
    timeLeft,
    countdown: formatCountdown(timeLeft),
  };
}
