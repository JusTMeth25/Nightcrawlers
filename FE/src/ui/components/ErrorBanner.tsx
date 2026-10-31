import type { ReactNode } from 'react'
import styles from './ErrorBanner.module.css'

/** Error (role=alert) or info (role=status) message. */
export function ErrorBanner({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={[styles.banner, tone === 'info' && styles.info].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  )
}
