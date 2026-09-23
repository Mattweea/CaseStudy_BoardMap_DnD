import { useState } from 'react';
import { CHARACTER_PROFILES, resolveCharacterPortrait } from '../constants/characters';

interface AuthScreenProps {
  error: string | null;
  isLoading: boolean;
  onLogin: (username: string, password: string) => void;
  portraitsByOwnerId: Record<string, string>;
}

export function AuthScreen({ error, isLoading, onLogin, portraitsByOwnerId }: AuthScreenProps) {
  const [username, setUsername] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const selectedProfile =
    CHARACTER_PROFILES.find((profile) => profile.username === username) ?? null;
  const displayedError = validationError ?? error;

  const submitLogin = () => {
    if (!password.trim()) {
      setValidationError('Inserisci la password per accedere al profilo selezionato.');
      return;
    }

    setValidationError(null);
    if (username) onLogin(username, password);
  };

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <header className="auth-header">
          <p className="eyebrow">Multiplayer Access</p>
          <h1>Discesa Nell&apos;Averno</h1>
        </header>

        <div className="auth-profile-grid">
          {CHARACTER_PROFILES.map((profile) => {
            const isSelected = profile.username === selectedProfile?.username;

            return (
              <button
                key={profile.id}
                type="button"
                className={`auth-profile-card ${isSelected ? 'auth-profile-card--selected' : ''}`}
                onClick={() => {
                  setUsername(profile.username);
                  setPassword('');
                  setValidationError(null);
                }}
                aria-pressed={isSelected}
              >
                <img
                  src={resolveCharacterPortrait(profile, portraitsByOwnerId[profile.id])}
                  alt=""
                  aria-hidden="true"
                  className="auth-profile-card__image"
                />
                <span className="auth-profile-card__meta">
                  <strong>@{profile.username}</strong>
                  <span>{profile.displayName} · {profile.role === 'master' ? 'Master' : 'Avventuriero'}</span>
                </span>
              </button>
            );
          })}
        </div>

        {selectedProfile ? (
          <section className="auth-access auth-access--open">
            <div className="auth-access__body">
              <div className="auth-access__inner">
                <form
                  className="auth-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitLogin();
                  }}
                >
                  <label className="auth-field">
                    <span>Username selezionato</span>
                    <input value={`@${selectedProfile.username}`} readOnly autoComplete="username" />
                  </label>

                  <label className="auth-field">
                    <span>Password</span>
                    <input
                      type="password"
                      value={password}
                      autoFocus
                      onChange={(event) => {
                        setPassword(event.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      autoComplete="current-password"
                      aria-invalid={Boolean(displayedError)}
                      aria-describedby={displayedError ? 'auth-login-error' : undefined}
                    />
                  </label>

                  <button type="submit" className="primary-button auth-submit" disabled={isLoading}>
                    {isLoading ? 'Connessione In Corso...' : "Partecipa All'Avventura"}
                  </button>

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
          </section>
        ) : null}

        {displayedError ? (
          <p id="auth-login-error" className="auth-error" role="alert" aria-live="assertive">
            {displayedError}
          </p>
        ) : null}

      </section>
    </div>
  );
}
