export function LoadingState({ children = 'Loading…', className = '' }) {
  return <div className={`text-sm text-[#68726E] ${className}`} role="status" aria-live="polite">{children}</div>;
}
