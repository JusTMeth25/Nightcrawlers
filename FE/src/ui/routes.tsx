import type { RouteObject } from 'react-router'
import { t } from './i18n/it'
import { AppShell, RequireAuth } from './layout/AppShell'
import ForgotPasswordScreen from './screens/auth/ForgotPasswordScreen'
import LoginScreen from './screens/auth/LoginScreen'
import RegisterScreen from './screens/auth/RegisterScreen'
import ResetPasswordScreen from './screens/auth/ResetPasswordScreen'
import VerifyEmailScreen from './screens/auth/VerifyEmailScreen'
import CharacterSelectScreen from './screens/CharacterSelectScreen'
import GameOverScreen from './screens/GameOverScreen'
import PlaceholderScreen from './screens/PlaceholderScreen'
import PlayScreen from './screens/PlayScreen'
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
      { path: '/select', element: <CharacterSelectScreen /> },
      { path: '/play', element: <PlayScreen /> },
      { path: '/game-over', element: <GameOverScreen /> },
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
