import type { ReactNode } from 'react'
import styles from './Panel.module.css'

export function Panel({ title, children, wide = false }: { title?: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={[styles.panel, wide && styles.wide].filter(Boolean).join(' ')}>
      {title && <h2 className={styles.title}>{title}</h2>}
      <div className={styles.body}>{children}</div>
    </section>
  )
}
