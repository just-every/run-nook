// The Nook mark: a rose arch (the nook) holding an ink hash, the channel sign, gently slanted.
export function NookMark({className}: {className?: string}) {
  return (
    <svg className={className} viewBox="0 0 40 44" aria-hidden="true" focusable="false">
      <path d="M2 42V20a18 18 0 0 1 36 0v22Z" fill="var(--brand-rose)" />
      <g fill="none" stroke="var(--brand-ink)" strokeWidth="3.4" strokeLinecap="round">
        <path d="M16.64 16.7L14.16 34.3" />
        <path d="M25.84 16.7L23.36 34.3" />
        <path d="M12.42 21.1L28.82 21.1" />
        <path d="M11.18 29.9L27.58 29.9" />
      </g>
    </svg>
  )
}
