import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import SubscriptionsPage from './pages/SubscriptionsPage';
import SettingsPage from './pages/SettingsPage';
import DomainsPage from './pages/DomainsPage';
import LoginPage from './pages/LoginPage';
import { ThemeProvider } from './ThemeContext';
import { AuthProvider } from './auth/AuthContext';
import RequireAuth from './auth/RequireAuth';
import NotFoundPage from './pages/NotFoundPage';
import { AxiosInterceptor } from './auth/AxiosInterceptor';
import PublicRoute from './auth/PublicRoute';
import TunnelsPage from './pages/TunnelsPage';
import NodesPage from './pages/NodesPage';
import TaskNotification from './components/TaskNotification';
import JournalPage from './pages/JournalPage';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
        <AxiosInterceptor />
        <TaskNotification />
          <Routes>
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            <Route path="/" element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }>
              <Route index element={<SubscriptionsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="domains" element={<DomainsPage />} />
              <Route path="nodes" element={<NodesPage />} />
              <Route path="journal" element={<JournalPage />} />
              <Route path="tunnels" element={<TunnelsPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
