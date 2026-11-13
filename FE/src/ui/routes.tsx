import type { RouteObject } from 'react-router'
import { AppShell, RequireAuth } from './layout/AppShell'
import ForgotPasswordScreen from './screens/auth/ForgotPasswordScreen'
import LoginScreen from './screens/auth/LoginScreen'
import RegisterScreen from './screens/auth/RegisterScreen'
import ResetPasswordScreen from './screens/auth/ResetPasswordScreen'
import VerifyEmailScreen from './screens/auth/VerifyEmailScreen'
import AccountScreen from './screens/AccountScreen'
import CharacterSelectScreen from './screens/CharacterSelectScreen'
import CodexScreen from './screens/CodexScreen'
import GameOverScreen from './screens/GameOverScreen'
import PlaceholderScreen from './screens/PlaceholderScreen'
import OptionsScreen from './screens/OptionsScreen'
import PlayScreen from './screens/PlayScreen'
import PrivacyScreen from './screens/PrivacyScreen'
import RipperdocScreen from './screens/RipperdocScreen'
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
      { path: '/codex', element: <CodexScreen /> },
      { path: '/options', element: <OptionsScreen /> },
      { path: '/privacy', element: <PrivacyScreen /> },
      // guests see the Ripperdoc disabled with an invite to register (spec 2.11)
      { path: '/ripperdoc', element: <RipperdocScreen /> },
      {
        element: <RequireAuth />,
        children: [{ path: '/account', element: <AccountScreen /> }],
      },
      { path: '*', element: <PlaceholderScreen titleKey="app.notFound" /> },
    ],
  },
]
