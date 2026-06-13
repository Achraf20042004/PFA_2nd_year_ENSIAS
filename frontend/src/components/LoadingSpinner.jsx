export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeClass = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-10 w-10 border-[3px]',
  }[size] ?? 'h-6 w-6 border-2'

  return (
    <div
      className={`${sizeClass} animate-spin rounded-full border-primary-light border-t-primary ${className}`}
    />
  )
}
