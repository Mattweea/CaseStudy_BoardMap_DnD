import { useState } from 'react';

interface AuthScreenProps {
  error: string | null;
  isLoading: boolean;
  onLogin: (username: string, password: string) => void;
}

export function AuthScreen({ error, isLoading, onLogin }: AuthScreenProps) {
  const [username, setUsername] = useState('master');
  const [password, setPassword] = useState('master123');

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Multiplayer Access</p>
        <h1>Repository battle map</h1>
        <p className="auth-copy">
          Accedi con un profilo `master` oppure `adventurer` per entrare nella sessione condivisa.
        </p>

        <div className="auth-demo-grid">
          <article className="auth-demo-card">
            <strong>Master demo</strong>
            <span>`master` / `master123`</span>
          </article>
          <article className="auth-demo-card">
            <strong>Adventurer demo</strong>
            <span>`aria` / `adventurer123`</span>
          </article>
        </div>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            onLogin(username, password);
          }}
        >
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
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

          {error ? <p className="auth-error">{error}</p> : null}

          <button type="submit" className="primary-button" disabled={isLoading}>
            {isLoading ? 'Connessione in corso...' : 'Entra nella sessione'}
          </button>
        </form>
      </section>
    </div>
  );
}
