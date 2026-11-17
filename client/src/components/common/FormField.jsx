const baseInput = 'auth-input mt-2';

export function FormField({ id, label, type = 'text', value, onChange, onBlur, error, compact = false, ...props }) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label className={`block font-medium text-[#1F1F1F] ${compact ? 'text-[13px]' : 'text-sm'}`} htmlFor={id}>{label}</label>
      <input
        {...props}
        id={id}
        name={id}
        type={type}
        className={`${compact ? 'auth-input auth-input-compact mt-1' : baseInput} ${error ? 'border-[#B42318] focus:border-[#B42318]' : ''}`}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error && <p className="mt-1 text-xs text-[#B42318]" id={errorId} role="alert">{error}</p>}
    </div>
  );
}
