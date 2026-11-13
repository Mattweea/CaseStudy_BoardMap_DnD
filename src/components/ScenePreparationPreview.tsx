import type { ReactNode } from 'react';
export function ScenePreparationPreview({ children }: { children: ReactNode }) {
  return <div className="scene-wizard__map" aria-label="Anteprima comune della scena">{children}</div>;
}
