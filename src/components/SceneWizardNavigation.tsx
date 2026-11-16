export const SCENE_STEPS = ['Base', 'Pareti e ambiente', 'Luci e visuale', 'Encounter', 'Mostri e PNG', 'Riepilogo'] as const;
export function SceneWizardNavigation({ step, disabled, onSelect }: { step: number; disabled: boolean; onSelect: (step: number) => void }) {
  return <nav className="scene-wizard__navigation" aria-label="Passaggi di preparazione">
    <ol>{SCENE_STEPS.map((name, index) => <li key={name}>
      <button type="button" aria-current={step === index ? 'step' : undefined} disabled={disabled} onClick={() => onSelect(index)}>
        <span className="scene-wizard__step-number" aria-hidden="true">{index + 1}</span><span>{name}</span>
      </button>
    </li>)}</ol>
  </nav>;
}
