import type { ReactNode } from 'react'
import { Icon, type IconName } from '../components/Icon'
import styles from '../shell/page.module.css'

/** A titled page with an empty state, for sections of the shell that aren't built yet. */
export function PlaceholderPage({
  title,
  subtitle,
  icon,
  emptyTitle,
  children,
}: {
  title: string
  subtitle: string
  icon: IconName
  emptyTitle: string
  children: ReactNode
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </header>
      <div className={styles.empty}>
        <span className={styles.cardIcon}>
          <Icon name={icon} />
        </span>
        <p className={styles.emptyTitle}>{emptyTitle}</p>
        <p className={styles.emptyText}>{children}</p>
      </div>
    </div>
  )
}
