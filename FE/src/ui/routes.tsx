import type { RouteObject } from 'react-router'
import { t } from './i18n/it'
import { AppShell, RequireAuth } from './layout/AppShell'
import PlaceholderScreen from './screens/PlaceholderScreen'
import TitleScreen from './screens/TitleScreen'

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <TitleScreen /> },
      { path: '/login', element: <PlaceholderScreen title={t('login.title')} /> },
      { path: '/register', element: <PlaceholderScreen title={t('register.title')} /> },
      { path: '/verify-email', element: <PlaceholderScreen title={t('verify.title')} /> },
      { path: '/forgot-password', element: <PlaceholderScreen title={t('forgot.title')} /> },
      { path: '/reset-password', element: <PlaceholderScreen title={t('reset.title')} /> },
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
