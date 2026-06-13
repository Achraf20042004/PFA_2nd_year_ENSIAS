export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 ' +
    'focus:outline-none focus:ring-2 focus:ring-offset-2 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]'

  const variants = {
    primary:
      'bg-primary text-white hover:bg-primary-dark focus:ring-primary shadow-sm hover:shadow-md',
    secondary:
      'bg-primary-light text-primary-dark hover:bg-primary/20 focus:ring-primary',
    outline:
      'border-2 border-slate-200 text-slate-700 hover:border-primary/40 hover:bg-primary-light focus:ring-primary/30',
    danger:
      'bg-red-500 text-white hover:bg-red-600 focus:ring-red-400 shadow-sm',
    ghost:
      'text-slate-600 hover:bg-slate-100 focus:ring-slate-200',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3.5 text-base gap-2',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
