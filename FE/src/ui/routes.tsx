import type { RouteObject } from 'react-router'
import { t } from './i18n/it'
import { AppShell, RequireAuth } from './layout/AppShell'
import ForgotPasswordScreen from './screens/auth/ForgotPasswordScreen'
import LoginScreen from './screens/auth/LoginScreen'
import RegisterScreen from './screens/auth/RegisterScreen'
import ResetPasswordScreen from './screens/auth/ResetPasswordScreen'
import VerifyEmailScreen from './screens/auth/VerifyEmailScreen'
import PlaceholderScreen from './screens/PlaceholderScreen'
import TitleScreen from './screens/TitleScreen'

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <TitleScreen /> },
      { path: '/login', element: <LoginScreen /> },
      { path: '/register', element: <RegisterScreen /> },
      { path: '/verify-email', element: <VerifyEmailScreen /> },
      { path: '/forgot-password', element: <ForgotPasswordScreen /> },
      { path: '/reset-password', element: <ResetPasswordScreen /> },
      { path: '/select', element: <PlaceholderScreen title={t('screen.select')} /> },
      { path: '/play', element: <PlaceholderScreen title={t('screen.play')} /> },
      { path: '/game-over', element: <PlaceholderScreen title={t('screen.gameOver')} /> },
      { path: '/codex', element: <PlaceholderScreen title={t('screen.codex')} /> },
      { path: '/options', element: <PlaceholderScreen title={t('screen.options')} /> },
      { path: '/privacy', element: <PlaceholderScreen title={t('screen.privacy')} /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/ripperdoc', element: <PlaceholderScreen title={t('screen.ripperdoc')} /> },
          { path: '/account', element: <PlaceholderScreen title={t('screen.account')} /> },
        ],
      },
      { path: '*', element: <PlaceholderScreen title={t('app.notFound')} /> },
    ],
  },
]
