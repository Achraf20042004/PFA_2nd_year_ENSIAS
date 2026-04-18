export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-sm p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
