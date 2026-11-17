export function Avatar({ src, name = 'WolfLink member', size = 'size-10', className = '' }) {
  return <span className={`grid ${size} shrink-0 place-items-center overflow-hidden rounded-full bg-[#E8EFE9] text-[#1B4332] ${className}`}>
    {src ? <img className="size-full object-cover" src={src} alt={`${name}'s profile`} /> : <svg aria-label={`${name} avatar`} role="img" viewBox="0 0 24 24" fill="none" className="size-1/2" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="3.5" /><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" strokeLinecap="round" /></svg>}
  </span>;
}
