import { useEffect, useState } from 'react';

/** Hora actual que se refresca cada `seconds` (línea "AHORA" del Gantt) */
export function useNow(seconds = 15) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), seconds * 1000);
    return () => clearInterval(t);
  }, [seconds]);
  return now;
}
