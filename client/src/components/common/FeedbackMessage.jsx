const styles = {
  error: 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]',
  success: 'border-[#CFE3D5] bg-[#E8EFE9] text-[#1B4332]',
  info: 'border-[#E9DBA6] bg-[#FFF8DF] text-[#755B06]',
};

export function FeedbackMessage({ kind = 'error', children, className = '' }) {
  if (!children) return null;
  return <p className={`rounded-lg border px-3 py-2.5 text-sm ${styles[kind] || styles.info} ${className}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</p>;
}
