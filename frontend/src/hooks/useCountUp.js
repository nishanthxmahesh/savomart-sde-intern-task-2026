import { useEffect, useState } from 'react';

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export function useCountUp(target, durationMs = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (typeof target !== 'number' || target <= 0) {
      setValue(target || 0);
      return;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      setValue(Math.round(target * easeOutCubic(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}
