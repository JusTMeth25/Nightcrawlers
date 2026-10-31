import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useSession } from './ui/store/session'

// Restore the session from the HttpOnly refresh cookie before the router renders (spinner meanwhile).
void useSession.getState().bootstrap()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
