import { createBrowserRouter, RouterProvider } from 'react-router'
import { Spinner } from './ui/components/Spinner'
import { BootstrapError } from './ui/layout/BootstrapError'
import { routes } from './ui/routes'
import { useOptions } from './ui/store/options'
import { useSession } from './ui/store/session'

const router = createBrowserRouter(routes)

/**
 * Waits for the session bootstrap (refresh cookie) before showing the router.
 * A language change remounts the router subtree (same location) so every text is re-read;
 * the pause menu disables the language selector, so a run is never remounted.
 */
export default function App() {
  const status = useSession((s) => s.status)
  const bootstrapFailed = useSession((s) => s.bootstrapFailed)
  const locale = useOptions((s) => s.options.locale)
  if (status === 'unknown') return bootstrapFailed ? <BootstrapError /> : <Spinner fullscreen />
  return <RouterProvider key={locale} router={router} />
}
