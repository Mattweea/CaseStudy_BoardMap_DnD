import { useEffect, useState } from 'react';

export function useAnimatedPresence(isOpen: boolean, exitDurationMs: number) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);

      const frameId = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });

      return () => window.cancelAnimationFrame(frameId);
    }

    setIsVisible(false);

    const timeoutId = window.setTimeout(() => {
      setShouldRender(false);
    }, exitDurationMs);

    return () => window.clearTimeout(timeoutId);
  }, [exitDurationMs, isOpen]);

  return { shouldRender, isVisible };
}
