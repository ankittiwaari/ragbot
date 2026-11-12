import { useEffect, useId, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { clearSession, useSession } from '../auth/session'
import { Icon, type IconName } from '../components/Icon'
import styles from './AppShell.module.css'

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/chat', label: 'Chat', icon: 'chat' },
  { to: '/documents', label: 'Documents', icon: 'file' },
]

/** The signed-in frame: sidebar nav + user menu, with routed pages in the main area. */
export function AppShell() {
  // RequireAuth guarantees a session; the fallback only covers the frame between clear and redirect.
  const user = useSession()?.user
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()
  const navId = useId()
  const mainRef = useRef<HTMLElement>(null)

  // Move focus to the new page on navigation so screen readers start there.
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true })
  }, [location.pathname])

  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  const name = user ? `${user.first_name} ${user.last_name}`.trim() : ''
  const initials = user ? (user.first_name[0] ?? '') + (user.last_name[0] ?? '') : ''

  return (
    <div className={styles.shell} data-nav-open={navOpen || undefined}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>

      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={navOpen}
          aria-controls={navId}
          onClick={() => setNavOpen((o) => !o)}
        >
          <Icon name={navOpen ? 'close' : 'menu'} />
        </button>
        <Brand />
      </header>

      <div className={styles.backdrop} onClick={() => setNavOpen(false)} aria-hidden="true" />

      <aside id={navId} className={styles.sidebar}>
        <div className={styles.sidebarHead}>
          <Brand />
        </div>

        <nav className={styles.nav} aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) => [styles.navLink, isActive && styles.active].filter(Boolean).join(' ')}
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {user && (
          <div className={styles.account}>
            <span className={styles.avatar} aria-hidden="true">
              {initials.toUpperCase()}
            </span>
            <div className={styles.who}>
              <span className={styles.name}>{name}</span>
              <span className={styles.email}>{user.email}</span>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Log out"
              title="Log out"
              onClick={clearSession}
            >
              <Icon name="logout" />
            </button>
          </div>
        )}
      </aside>

      <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

function Brand() {
  return (
    <span className={styles.brand}>
      <span className={styles.mark} aria-hidden="true" />
      rag-bot
    </span>
  )
}
