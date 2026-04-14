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
  const selectedProfile =
    CHARACTER_PROFILES.find((profile) => profile.username === username) ?? CHARACTER_PROFILES[0];

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Multiplayer Access</p>
        <h1>Repository battle map</h1>
        <p className="auth-copy">
          Scegli chi stai giocando, poi entra con la password predefinita `nome+123`.
        </p>

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
                  <span className="auth-profile-card__password">{profile.username}123</span>
                </span>
              </button>
            );
          })}
        </div>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            onLogin(username, password);
          }}
        >
          <label>
            Profilo selezionato
            <input value={selectedProfile.displayName} readOnly autoComplete="username" />
          </label>

          <label>
            Password
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
              <span>Movimento {selectedProfile.movement ?? 'n/d'}</span>
              <span>{selectedProfile.darkvision ?? 'Nessuna scurovisione'}</span>
            </div>
          ) : null}

          {error ? <p className="auth-error">{error}</p> : null}

          <button type="submit" className="primary-button" disabled={isLoading}>
            {isLoading ? 'Connessione in corso...' : 'Entra nella sessione'}
          </button>
        </form>
      </section>
    </div>
  );
}
