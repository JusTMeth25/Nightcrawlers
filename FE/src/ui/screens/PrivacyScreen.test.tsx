import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import PrivacyScreen from './PrivacyScreen'

function renderPrivacy() {
  render(<RouterProvider router={createMemoryRouter([{ path: '/privacy', element: <PrivacyScreen /> }], { initialEntries: ['/privacy'] })} />)
}

describe('PrivacyScreen', () => {
  it('names the processors, the stored user agent, the backups and the hosting', () => {
    renderPrivacy()
    expect(screen.getByText(/Brevo \(Sendinblue SAS, UE\)/)).toBeInTheDocument()
    expect(screen.getByText(/user agent del browser/)).toBeInTheDocument()
    expect(screen.getByText(/backup giornalieri del database conservati per 7 giorni/)).toBeInTheDocument()
    expect(screen.getByText(/Oracle Cloud \(regione UE\)/)).toBeInTheDocument()
  })

  it('states the retention of IP hashes, security logs and login/email tokens', () => {
    renderPrivacy()
    expect(screen.getByText(/IP è salvato solo come hash con salt.*l’hash viene cancellato dopo 90 giorni/)).toBeInTheDocument()
    expect(screen.getByText(/log di sicurezza degli account eliminati vengono cancellate dopo 365 giorni/)).toBeInTheDocument()
    expect(screen.getByText(/token di accesso.*token email.*scaduti o già usati vengono cancellati ogni giorno/)).toBeInTheDocument()
  })

  it('shows the privacy contact (VITE_PRIVACY_EMAIL or the default address)', () => {
    renderPrivacy()
    const email = import.meta.env.VITE_PRIVACY_EMAIL || 'privacy@nightcrawlers.duckdns.org'
    expect(screen.getByText(`Per richieste sulla privacy scrivi a: ${email}`)).toBeInTheDocument()
  })
})
