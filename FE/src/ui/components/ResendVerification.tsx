import { useState } from 'react'
import { api } from '../../api'
import { apiErrorText } from '../i18n/apiErrorText'
import { t } from '../i18n/it'
import { ErrorBanner } from './ErrorBanner'
import { NeonButton } from './NeonButton'

/** "Reinvia email di verifica" with its outcome (sent, rate limited, network...). */
export function ResendVerification({ variant = 'default' }: { variant?: 'default' | 'primary' }) {
  const [state, setState] = useState<{ busy: boolean; sent: boolean; error: string | null }>({
    busy: false,
    sent: false,
    error: null,
  })

  const onResend = async () => {
    if (state.busy) return
    setState({ busy: true, sent: false, error: null })
    try {
      await api.resendVerification()
      setState({ busy: false, sent: true, error: null })
    } catch (error) {
      setState({ busy: false, sent: false, error: apiErrorText(error) })
    }
  }

  return (
    <>
      <NeonButton variant={variant} onClick={onResend} disabled={state.busy}>
        {t('verify.resend')}
      </NeonButton>
      {state.sent && <ErrorBanner tone="info">{t('verify.resent')}</ErrorBanner>}
      {state.error && <ErrorBanner>{state.error}</ErrorBanner>}
    </>
  )
}
