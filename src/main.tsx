import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

const selectableInputTypes = new Set(['text', 'search', 'email', 'password', 'tel', 'url']);

document.addEventListener('focusin', (event) => {
  const target = event.target;
  if (target instanceof HTMLTextAreaElement) {
    if (!target.disabled && !target.readOnly) target.select();
  } else if (target instanceof HTMLInputElement) {
    if (!target.disabled && !target.readOnly && selectableInputTypes.has(target.type)) target.select();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
