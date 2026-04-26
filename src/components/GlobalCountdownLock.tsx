import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

const DURATION_MS = 72 * 60 * 60 * 1000;
const COUNTDOWN_START_KEY = "global_countdown_started_at";

const formatRemaining = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const GlobalCountdownLock = () => {
  const location = useLocation();
  const [now, setNow] = useState(() => Date.now());
  const [startedAt, setStartedAt] = useState<number | null>(() => {
    const savedStart = window.localStorage.getItem(COUNTDOWN_START_KEY);
    return savedStart ? Number(savedStart) : null;
  });
  const remaining = startedAt ? startedAt + DURATION_MS - now : DURATION_MS;
  const isLocked = remaining <= 0;

  useEffect(() => {
    if (!startedAt && location.pathname.includes("/admin")) {
      const firstAdminOpenTime = Date.now();
      window.localStorage.setItem(COUNTDOWN_START_KEY, String(firstAdminOpenTime));
      setStartedAt(firstAdminOpenTime);
      setNow(firstAdminOpenTime);
    }
  }, [location.pathname, startedAt]);

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