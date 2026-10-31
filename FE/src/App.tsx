import { createBrowserRouter, RouterProvider } from 'react-router'
import { Spinner } from './ui/components/Spinner'
import { BootstrapError } from './ui/layout/BootstrapError'
import { routes } from './ui/routes'
import { useSession } from './ui/store/session'

const router = createBrowserRouter(routes)

/** Waits for the session bootstrap (refresh cookie) before showing the router. */
export default function App() {
  const status = useSession((s) => s.status)
  const bootstrapFailed = useSession((s) => s.bootstrapFailed)
  if (status === 'unknown') return bootstrapFailed ? <BootstrapError /> : <Spinner fullscreen />
  return <RouterProvider router={router} />
}
