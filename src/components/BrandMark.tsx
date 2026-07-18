export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={`brand__mark${className ? ` ${className}` : ''}`}
      src="/app-icon.svg"
    />
  )
}
