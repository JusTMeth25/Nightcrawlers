// Focus helpers for keyboard and gamepad menus. Navigable elements carry the data-nav attribute.

export type NavDirection = 'up' | 'down' | 'left' | 'right'

export function navigableElements(container: ParentNode): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-nav]')).filter(
    (el) => !el.matches(':disabled') && !el.closest('[hidden], [inert]'),
  )
}

/** Moves the focus to the previous/next [data-nav] element (DOM order, wrapping). */
export function moveFocus(container: ParentNode, direction: NavDirection): HTMLElement | null {
  const items = navigableElements(container)
  if (items.length === 0) return null
  const active = document.activeElement as HTMLElement | null
  const index = active ? items.indexOf(active) : -1
  let next: HTMLElement
  if (index < 0) next = items[0]
  else {
    const step = direction === 'down' || direction === 'right' ? 1 : -1
    next = items[(index + step + items.length) % items.length]
  }
  next.focus()
  return next
}

/** Left/right on a focused range input changes its value instead of moving the focus. */
export function adjustRange(el: Element | null, direction: NavDirection): boolean {
  if (!(el instanceof HTMLInputElement) || el.type !== 'range') return false
  if (direction !== 'left' && direction !== 'right') return false
  if (direction === 'right') el.stepUp()
  else el.stepDown()
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

/**
 * Left/right on a focused <select> picks the previous/next enabled option (wrapping): a gamepad
 * cannot open the native list, and A only clicks.
 */
export function adjustSelect(el: Element | null, direction: NavDirection): boolean {
  if (!(el instanceof HTMLSelectElement) || el.disabled) return false
  if (direction !== 'left' && direction !== 'right') return false
  const count = el.options.length
  if (count === 0) return true
  const step = direction === 'right' ? 1 : -1
  let index = el.selectedIndex
  for (let i = 0; i < count; i++) {
    index = (index + step + count) % count
    if (!el.options[index].disabled) break
  }
  if (index === el.selectedIndex) return true
  el.selectedIndex = index
  el.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

/** Focuses the first navigable element of the container, unless the focus is already inside. */
export function focusFirst(container: HTMLElement | null) {
  if (!container) return
  if (container.contains(document.activeElement)) return
  navigableElements(container)[0]?.focus()
}
