import type { TokenCondition } from '../types';
import { conditionLabel } from '../utils/tokens';

interface ConditionBadgeProps {
  condition: TokenCondition;
  showLabel?: boolean;
}

function ConditionIcon({ condition }: ConditionBadgeProps) {
  switch (condition) {
    case 'dead':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3c-4.4 0-8 3.3-8 7.4 0 2.6 1.4 4.9 3.5 6.2V20h2.2v-2h4.6v2h2.2v-3.4c2.1-1.3 3.5-3.6 3.5-6.2C20 6.3 16.4 3 12 3Zm-2.8 8.2a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm5.6 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6ZM9 14.8c.9-.6 2-.9 3-.9s2.1.3 3 .9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'prone':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 15h16M7 11l3 4 3-2 4 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'conditioned':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 9v3l2 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'inspired':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4l1.8 4.4 4.7.4-3.6 3 1.1 4.6-4-2.5-4 2.5 1.1-4.6-3.6-3 4.7-.4z" fill="currentColor" />
        </svg>
      );
    case 'broken':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 3L6 13h4l-1 8 9-12h-4l2-6z" fill="currentColor" />
        </svg>
      );
    case 'overturned':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 16l6-8 6 8H6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

export function ConditionBadge({ condition, showLabel = true }: ConditionBadgeProps) {
  return (
    <span className={`condition-badge condition-badge--${condition}`} title={conditionLabel(condition)}>
      <ConditionIcon condition={condition} />
      {showLabel ? <span>{conditionLabel(condition)}</span> : null}
    </span>
  );
}
