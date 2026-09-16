import type { CharacterSheetData, CharacterSheetPatchOperation } from '../../types/character-sheet';
import { SheetField, SheetPanel } from './SheetPrimitives';

export function StoryTab({ data, portraitUrl, patch, onPortrait }: { data: CharacterSheetData; portraitUrl: string | null; patch: (operation: CharacterSheetPatchOperation) => void; onPortrait: (file: File) => void }) {
  const set = (path: string) => (value: string) => patch({ op: 'set', path, value });
  return <div className="character-sheet-page story-page">
    <header className="sheet-identity story-identity"><SheetField label="Nome del personaggio" value={data.story.name} onChange={set('story.name')} className="sheet-identity__name" /><div className="sheet-identity__facts">{([['age', 'Età'], ['height', 'Altezza'], ['weight', 'Peso'], ['eyes', 'Occhi'], ['skin', 'Pelle'], ['hair', 'Capelli']] as const).map(([key, label]) => <SheetField key={key} label={label} value={data.story[key]} onChange={set(`story.${key}`)} />)}</div></header>
    <div className="story-page__grid">
      <SheetPanel title="Aspetto del personaggio" className="story-appearance"><div className="portrait-control">{portraitUrl ? <img src={portraitUrl} alt="Ritratto del personaggio" /> : <div className="portrait-placeholder" aria-hidden="true">Ritratto</div>}<label className="portrait-upload"><span>Sostituisci ritratto</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) onPortrait(file); event.target.value = ''; }} /></label><small>JPEG, PNG o WebP · massimo 5 MB</small></div><SheetField label="Aspetto" value={data.story.appearance} onChange={set('story.appearance')} multiline /></SheetPanel>
      <SheetPanel title="Alleati e organizzazioni" className="story-allies"><SheetField label="Alleati e organizzazioni" value={data.story.alliesOrganizations} onChange={set('story.alliesOrganizations')} multiline /><SheetField label="Nome della fazione" value={data.story.factionName} onChange={set('story.factionName')} /></SheetPanel>
      <SheetPanel title="Storia del personaggio" className="story-backstory"><SheetField label="Storia" value={data.story.backstory} onChange={set('story.backstory')} multiline /></SheetPanel>
      <div className="story-page__right"><SheetPanel title="Privilegi aggiuntivi"><SheetField label="Privilegi aggiuntivi" value={data.story.additionalFeatures} onChange={set('story.additionalFeatures')} multiline /></SheetPanel><SheetPanel title="Tesori"><SheetField label="Tesori" value={data.story.treasure} onChange={set('story.treasure')} multiline /></SheetPanel></div>
    </div>
  </div>;
}
