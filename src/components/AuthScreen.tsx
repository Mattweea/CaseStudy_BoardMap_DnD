import { useState } from 'react';
import { CHARACTER_PROFILES } from '../constants/characters';

interface AuthScreenProps {
  error: string | null;
  isLoading: boolean;
  onLogin: (username: string, password: string) => void;
}

export function AuthScreen({ error, isLoading, onLogin }: AuthScreenProps) {
  const [username, setUsername] = useState('master');
  const [password, setPassword] = useState('master123');
  const [isAccessPanelOpen, setIsAccessPanelOpen] = useState(false);
  const selectedProfile =
    CHARACTER_PROFILES.find((profile) => profile.username === username) ?? CHARACTER_PROFILES[0];

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <header className="auth-header">
          <p className="eyebrow">Multiplayer Access</p>
          <h1>Discesa Nell&apos;Averno</h1>
        </header>

        <div className="auth-profile-grid">
          {CHARACTER_PROFILES.map((profile) => {
            const isSelected = profile.username === selectedProfile.username;

            return (
              <button
                key={profile.id}
                type="button"
                className={`auth-profile-card ${isSelected ? 'auth-profile-card--selected' : ''}`}
                onClick={() => {
                  setUsername(profile.username);
                  setPassword(`${profile.username}123`);
                }}
              >
                <img src={profile.imageUrl} alt="" aria-hidden="true" className="auth-profile-card__image" />
                <span className="auth-profile-card__meta">
                  <strong>{profile.displayName}</strong>
                  <span>{profile.role === 'master' ? 'Master' : 'Avventuriero'}</span>
                </span>
              </button>
            );
          })}
        </div>

        <section className={`auth-access ${isAccessPanelOpen ? 'auth-access--open' : ''}`}>
          <button
            type="button"
            className="auth-access__toggle"
            aria-expanded={isAccessPanelOpen}
            onClick={() => setIsAccessPanelOpen((current) => !current)}
          >
            <span>Accedi Con Credenziali</span>
            <span className="auth-access__chevron" aria-hidden="true">
              {isAccessPanelOpen ? '−' : '+'}
            </span>
          </button>

          {isAccessPanelOpen ? (
            <div className="auth-access__body">
              <div className="auth-access__inner">
                <form
                  className="auth-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onLogin(username, password);
                  }}
                >
                  <label className="auth-field">
                    <span>Profilo Selezionato</span>
                    <input value={selectedProfile.displayName} readOnly autoComplete="username" />
                  </label>

                  <label className="auth-field">
                    <span>Password</span>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                    />
                  </label>

                  {selectedProfile.role === 'adventurer' ? (
                    <div className="auth-profile-details">
                      <span>Iniziativa {selectedProfile.initiativeModifier >= 0 ? `+${selectedProfile.initiativeModifier}` : selectedProfile.initiativeModifier}</span>
                      <span>Movimento {selectedProfile.movement ?? 'N/D'}</span>
                      <span>{selectedProfile.darkvision ?? 'Nessuna Scurovisione'}</span>
                    </div>
                  ) : null}
                </form>
              </div>
            </div>
          ) : null}
        </section>

        {error ? <p className="auth-error">{error}</p> : null}

        <button
          type="button"
          className="primary-button auth-submit"
          disabled={isLoading}
          onClick={() => onLogin(username, password)}
        >
          {isLoading ? 'Connessione In Corso...' : "Partecipa All'Avventura"}
        </button>
      </section>
    </div>
  );
}
