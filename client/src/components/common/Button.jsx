const variants = {
  primary: 'bg-[#1B4332] text-white hover:bg-[#0F2D1F]',
  gold: 'bg-[#D4AF37] text-[#061F17] hover:bg-[#c49c26]',
  secondary: 'border border-[#1B4332]/20 text-[#1B4332] hover:bg-[#E8EFE9]',
  ghost: 'text-[#1B4332] hover:bg-[#E8EFE9]',
};

export function Button({ variant = 'primary', loading = false, disabled = false, className = '', type = 'button', children, ...props }) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4332] disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant] || variants.primary} ${className}`}
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}
