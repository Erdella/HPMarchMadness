/**
 * Route table.
 *
 * Public:    /login, /auth/landing
 * Authed:    /, /draft, /leaderboard
 * Admin:     /admin
 *
 * The Layout shell is mounted at the root, so every page renders inside the
 * same header/footer chrome.
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { AuthProvider } from './lib/auth';
import { ConfigGate, ConfigProvider } from './lib/config';
import { YearProvider } from './lib/year';
import { Admin } from './pages/Admin';
import { AuthLanding } from './pages/AuthLanding';
import { Draft } from './pages/Draft';
import { Home } from './pages/Home';
import { Leaderboard } from './pages/Leaderboard';
import { Login } from './pages/Login';
import { Stats } from './pages/Stats';

export function App() {
  return (
    <ConfigProvider>
      <ConfigGate>
        <AuthProvider>
          <YearProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/auth/landing" element={<AuthLanding />} />

                <Route
                  path="/"
                  element={
                    <RequireAuth>
                      <Home />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/draft"
                  element={
                    <RequireAuth>
                      <Draft />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/leaderboard"
                  element={
                    <RequireAuth>
                      <Leaderboard />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/stats"
                  element={
                    <RequireAuth>
                      <Stats />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireAuth adminOnly>
                      <Admin />
                    </RequireAuth>
                  }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
          </YearProvider>
        </AuthProvider>
      </ConfigGate>
    </ConfigProvider>
  );
}
