import { clamp01 } from './format'
import styles from './Hud.module.css'

export interface BarProps {
  label: string
  /** 0..1 fill */
  value01: number
  /** accessible numbers (defaults to percent) */
  now?: number
  max?: number
  text?: string
  className?: string
  hideLabel?: boolean
}

/** Progress bar. The fill width is set through CSSOM (transform), from game numbers only. */
export function Bar({ label, value01, now, max, text, className, hideLabel = false }: BarProps) {
  const v = clamp01(value01)
  return (
    <div className={[styles.bar, className].filter(Boolean).join(' ')}>
      <span className={hideLabel ? 'visually-hidden' : styles.barLabel}>{label}</span>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max ?? 100}
        aria-valuenow={now ?? Math.round(v * 100)}
        aria-valuetext={text}
      >
        <div className={styles.fill} style={{ transform: `scaleX(${v})` }} />
        {text && (
          <span className={styles.barText} aria-hidden="true">
            {text}
          </span>
        )}
      </div>
    </div>
  )
}
