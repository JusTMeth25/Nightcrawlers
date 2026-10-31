import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'
import styles from './NeonButton.module.css'

type Variant = 'default' | 'primary' | 'danger'

function classes(variant: Variant, block: boolean, extra?: string) {
  return [styles.button, variant !== 'default' && styles[variant], block && styles.block, extra].filter(Boolean).join(' ')
}

export interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  block?: boolean
}

/** Menu button, navigable with the gamepad (data-nav). */
export function NeonButton({ variant = 'default', block = false, className, type = 'button', ...rest }: NeonButtonProps) {
  return <button data-nav type={type} className={classes(variant, block, className)} {...rest} />
}

export interface NeonLinkProps extends LinkProps {
  variant?: Variant
  block?: boolean
}

/** Same look as NeonButton for navigation links. */
export function NeonLink({ variant = 'default', block = false, className, ...rest }: NeonLinkProps) {
  return <Link data-nav className={classes(variant, block, className)} {...rest} />
}
