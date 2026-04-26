import { useEffect, useMemo, useState } from "react";

const START_TIME = new Date("2026-04-26T21:38:39Z").getTime();
const DURATION_MS = 72 * 60 * 60 * 1000;
const END_TIME = START_TIME + DURATION_MS;

const formatRemaining = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const GlobalCountdownLock = () => {
  const [now, setNow] = useState(() => Date.now());
  const remaining = END_TIME - now;
  const isLocked = remaining <= 0;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const timerText = useMemo(() => formatRemaining(remaining), [remaining]);

  if (isLocked) {
    return <div className="fixed inset-0 z-[2147483647] bg-foreground" aria-hidden="true" />;
  }

  return (
    <div className="fixed bottom-3 left-1/2 z-[2147483646] -translate-x-1/2 rounded-full border border-border bg-card px-4 py-2 text-center text-sm font-bold text-card-foreground shadow-baby" dir="ltr">
      {timerText}
    </div>
  );
};

export default GlobalCountdownLock;