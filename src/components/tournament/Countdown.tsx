'use client';
import type {
  TimerRound
} from '@/lib/tournament/types';
import {
  useEffect,
  useState
} from 'react';
export default function Countdown({
  round,
  offset = 0
}: {
  round: TimerRound | null;offset ? : number
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!round?.started_at)
    return <span>{round?.planned_start ? new Date(round.planned_start).toLocaleTimeString('en-GB',{timeZone:'Africa/Algiers',hour:'2-digit',minute:'2-digit'})+' · Algiers':'Awaiting start'}</span>;
  if (round.status === 'closed') return <span>Round closed</span>;
  const seconds = Math.max(0, Math.ceil((Date.parse(round.started_at) + round.duration_minutes * 60000 - now -
    offset) / 1000));
  return <span aria-label={`${Math.floor(seconds/60)} minutes ${seconds%60} seconds remaining`}>{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</span>;
}
