import { useEffect, useState } from 'react';

function browserHasBeenActivated() {
  try {
    return navigator.userActivation?.hasBeenActive === true;
  } catch {
    return false;
  }
}

export function usePageActivation() {
  const [hasUserActivated, setHasUserActivated] = useState(browserHasBeenActivated);

  useEffect(() => {
    if (hasUserActivated) return undefined;

    const activate = (event: Event) => {
      if (!event.isTrusted) return;
      setHasUserActivated(true);
    };
    window.addEventListener('pointerdown', activate, { capture: true });
    window.addEventListener('keydown', activate, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', activate, { capture: true });
      window.removeEventListener('keydown', activate, { capture: true });
    };
  }, [hasUserActivated]);

  return hasUserActivated;
}
