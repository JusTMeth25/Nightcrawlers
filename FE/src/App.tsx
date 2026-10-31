import { createBrowserRouter, RouterProvider } from 'react-router'
import { Spinner } from './ui/components/Spinner'
import { routes } from './ui/routes'
import { useSession } from './ui/store/session'

const router = createBrowserRouter(routes)

/** Waits for the session bootstrap (refresh cookie) before showing the router. */
export default function App() {
  const status = useSession((s) => s.status)
  if (status === 'unknown') return <Spinner fullscreen />
  return <RouterProvider router={router} />
}
