import { Link } from 'react-router'
import { useSession } from '../auth/session'
import { Icon, type IconName } from '../components/Icon'
import styles from '../shell/page.module.css'

const NEXT_STEPS: { to: string; icon: IconName; title: string; text: string }[] = [
  {
    to: '/documents',
    icon: 'file',
    title: 'Add documents',
    text: 'Upload the files you want answers from. They become the bot’s knowledge base.',
  },
  {
    to: '/chat',
    icon: 'chat',
    title: 'Ask a question',
    text: 'Chat with your documents and get answers that cite where they came from.',
  },
]

export function HomePage() {
  const firstName = useSession()?.user.first_name

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Welcome{firstName ? `, ${firstName}` : ''}</h1>
        <p className={styles.subtitle}>Here’s how to get started.</p>
      </header>

      <div className={styles.grid}>
        {NEXT_STEPS.map((step) => (
          <Link key={step.to} to={step.to} className={styles.card}>
            <span className={styles.cardIcon}>
              <Icon name={step.icon} />
            </span>
            <span className={styles.cardTitle}>
              {step.title}
              <Icon name="arrow" width={16} height={16} />
            </span>
            <span className={styles.cardText}>{step.text}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
