export function ActivityNav({
  active,
  onBonds,
  onCounting,
}: {
  active: 'bonds' | 'counting'
  onBonds?: () => void
  onCounting?: () => void
}) {
  return (
    <nav className="activity-nav" aria-label="Learning activity">
      <button
        type="button"
        aria-current={active === 'bonds' ? 'page' : undefined}
        onClick={onBonds}
      >
        <span aria-hidden="true">◉</span> Number bonds
      </button>
      <button
        type="button"
        aria-current={active === 'counting' ? 'page' : undefined}
        onClick={onCounting}
      >
        <span aria-hidden="true">↗</span> Hop & Count{' '}
        <span className="activity-nav__new">NEW</span>
      </button>
    </nav>
  )
}
