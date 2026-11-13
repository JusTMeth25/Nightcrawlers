import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { bindLocaleToOptions } from './ui/i18n/locale'
import { useOptions } from './ui/store/options'
import { useSession } from './ui/store/session'

// t(), the data texts, <html lang> and Accept-Language follow the language chosen in the options.
bindLocaleToOptions(useOptions)

// Restore the session from the HttpOnly refresh cookie before the router renders (spinner meanwhile).
void useSession.getState().bootstrap()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
