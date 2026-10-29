import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Layout from '../../src/components/Layout'
import { useThemeContext } from '../../src/ThemeContext'
import { useAuth } from '../../src/auth/AuthContext'

vi.mock('../../src/ThemeContext', () => ({
  useThemeContext: vi.fn(),
}))

vi.mock('../../src/auth/AuthContext', () => ({
  useAuth: vi.fn(),
}))

describe('Layout', () => {
  const mockToggleColorMode = vi.fn()
  const mockLogout = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useThemeContext).mockReturnValue({
      mode: 'light',
      toggleColorMode: mockToggleColorMode,
    })
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      login: vi.fn(),
      logout: mockLogout,
    })
  })

  const renderLayout = (initialPath = '/') => {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<div data-testid="outlet">SubscriptionsPage</div>} />
            <Route path="domains" element={<div data-testid="outlet">DomainsPage</div>} />
            <Route path="tunnels" element={<div data-testid="outlet">TunnelsPage</div>} />
            <Route path="settings" element={<div data-testid="outlet">SettingsPage</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
  }

  it('должен рендериться без ошибок', () => {
    renderLayout()
    expect(screen.getByTestId('outlet')).toBeInTheDocument()
  })

  it('должен отображать Header', () => {
    renderLayout()
    expect(screen.getByText('3DP-MANAGER')).toBeInTheDocument()
  })

  it('должен отображать навигационное меню', () => {
    renderLayout()
    expect(screen.getByText('Подписки')).toBeInTheDocument()
    expect(screen.getByText('Домены')).toBeInTheDocument()
    expect(screen.getByText('Relay серверы')).toBeInTheDocument()
    expect(screen.getByText('Настройки')).toBeInTheDocument()
  })

  it('должен выделять активный пункт меню для главной страницы', () => {
    renderLayout('/')
    const subscriptionsItem = screen.getByText('Подписки').closest('.Mui-selected')
    expect(subscriptionsItem).toBeInTheDocument()
  })

  it('должен выделять активный пункт меню для страницы доменов', () => {
    renderLayout('/domains')
    const domainsItem = screen.getByText('Домены').closest('.Mui-selected')
    expect(domainsItem).toBeInTheDocument()
  })

  it('должен выделять активный пункт меню для страницы туннелей', () => {
    renderLayout('/tunnels')
    const tunnelsItem = screen.getByText('Relay серверы').closest('.Mui-selected')
    expect(tunnelsItem).toBeInTheDocument()
  })

  it('должен выделять активный пункт меню для страницы настроек', () => {
    renderLayout('/settings')
    const settingsItem = screen.getByText('Настройки').closest('.Mui-selected')
    expect(settingsItem).toBeInTheDocument()
  })

  it('должен переходить на главную при клике на "Подписки"', () => {
    renderLayout('/domains')
    const subscriptionsLink = screen.getByText('Подписки')
    fireEvent.click(subscriptionsLink)
    expect(screen.getByText('SubscriptionsPage')).toBeInTheDocument()
  })

  it('должен переходить на страницу доменов при клике на "Домены"', () => {
    renderLayout('/')
    const domainsLink = screen.getByText('Домены')
    fireEvent.click(domainsLink)
    expect(screen.getByText('DomainsPage')).toBeInTheDocument()
  })

  it('должен переходить на страницу туннелей при клике на "Relay серверы"', () => {
    renderLayout('/')
    const tunnelsLink = screen.getByText('Relay серверы')
    fireEvent.click(tunnelsLink)
    expect(screen.getByText('TunnelsPage')).toBeInTheDocument()
  })

  it('должен переходить на страницу настроек при клике на "Настройки"', () => {
    renderLayout('/')
    const settingsLink = screen.getByText('Настройки')
    fireEvent.click(settingsLink)
    expect(screen.getByText('SettingsPage')).toBeInTheDocument()
  })

  it('должен отображать Footer', () => {
    renderLayout()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('должен иметь правильную структуру с main и Toolbar', () => {
    renderLayout()
    const main = screen.getByTestId('outlet').closest('main')
    expect(main).toBeInTheDocument()
  })

  it('должен иметь правильные иконки для пунктов меню', () => {
    renderLayout()
    expect(screen.getByTestId('icon-People')).toBeInTheDocument()
    expect(screen.getByTestId('icon-Dns')).toBeInTheDocument()
    expect(screen.getByTestId('icon-SwapHoriz')).toBeInTheDocument()
    expect(screen.getByTestId('icon-Settings')).toBeInTheDocument()
  })
})
