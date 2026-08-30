interface AppHeaderProps {
  compact?: boolean
  action?: React.ReactNode
}

export function AppHeader({ compact = false, action }: AppHeaderProps) {
  return (
    <header className={`app-header ${compact ? 'app-header--compact' : ''}`}>
      <div className="brand" aria-label="Number Bond Garden">
        <span className="brand__mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="brand__name">Number Bond Garden</span>
      </div>
      {action}
    </header>
  )
}
