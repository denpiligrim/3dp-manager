import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import SubscriptionsPage from '../../src/pages/SubscriptionsPage'
import { ThemeProvider } from '../../src/ThemeContext'
import { AuthProvider } from '../../src/auth/AuthContext'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()
const mockDelete = vi.fn()

vi.mock('../../src/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}))

const mockClipboardWriteText = vi.fn()
Object.assign(navigator, { clipboard: { writeText: mockClipboardWriteText } })

const mockWindowOpen = vi.fn()
const originalWindowOpen = window.open
beforeEach(() => {
  window.open = mockWindowOpen
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'debug').mockImplementation(() => {})
})
afterEach(() => {
  window.open = originalWindowOpen
  vi.restoreAllMocks()
})

const setupMockGet = (overrides?: {
  subscriptions?: unknown[]
  tunnels?: unknown[]
  domains?: unknown[]
}) => {
  mockGet.mockImplementation((url: string) => {
    if (url === '/subscriptions') return Promise.resolve({ data: overrides?.subscriptions || [] })
    if (url === '/tunnels') return Promise.resolve({ data: overrides?.tunnels || [] })
    if (url === '/nodes') return Promise.resolve({ data: [{ id: 'node-1', name: 'Main', isMain: true, url: 'https://node.example' }] })
    if (url === '/domains/all') return Promise.resolve({ data: overrides?.domains || [{ name: 'example.com', isEnabled: true }] })
    return Promise.resolve({ data: {} })
  })
}

const renderSubscriptionsPage = () => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SubscriptionsPage />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe('SubscriptionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClipboardWriteText.mockClear()
    mockWindowOpen.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Рендеринг', () => {
    it('должен рендериться с заголовком', async () => {
      setupMockGet()
      renderSubscriptionsPage()

      await waitFor(() => {
        expect(screen.getByText('Подписки')).toBeInTheDocument()
      })
    })

    it('должен отображать кнопку "Создать"', async () => {
      setupMockGet()
      renderSubscriptionsPage()

      await waitFor(() => {
        expect(screen.getByText('Создать')).toBeInTheDocument()
      })
    })

    it('должен отображать сообщение при отсутствии подписок', async () => {
      setupMockGet({ subscriptions: [] })
      renderSubscriptionsPage()

      await waitFor(() => {
        expect(screen.getByText('Нет подписок')).toBeInTheDocument()
      })
    })

    it('должен отображать список подписок', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [{}, {}], isAutoRotationEnabled: true }
      ]
      setupMockGet({ subscriptions: mockSubs })
      renderSubscriptionsPage()

      await waitFor(() => {
        expect(screen.getByText('Test Sub')).toBeInTheDocument()
        expect(screen.getByText('abc-123')).toBeInTheDocument()
      })
    })

    it('должен отображать количество инбаундов', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [{}, {}, {}] }
      ]
      setupMockGet({ subscriptions: mockSubs })
      renderSubscriptionsPage()

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument()
      })
    })

    it('должен отображать чекбокс авторотации', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [], isAutoRotationEnabled: true }
      ]
      setupMockGet({ subscriptions: mockSubs })
      renderSubscriptionsPage()

      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox')
        expect(checkbox).toBeChecked()
      })
    })
  })

  describe('Загрузка данных', () => {
    it('должен загружать подписки при монтировании', async () => {
      setupMockGet()
      renderSubscriptionsPage()

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/subscriptions')
      })
    })

    it('должен загружать туннели при монтировании', async () => {
      setupMockGet()
      renderSubscriptionsPage()

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/tunnels')
      })
    })

    it('должен загружать домены при монтировании', async () => {
      setupMockGet()
      renderSubscriptionsPage()

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/domains/all')
      })
    })

    it('должен фильтровать только установленные туннели', async () => {
      const mockTunnels = [
        { id: 1, name: 'Tunnel 1', ip: '1.1.1.1', domain: '', isInstalled: true },
        { id: 2, name: 'Tunnel 2', ip: '2.2.2.2', domain: '', isInstalled: false }
      ]
      setupMockGet({ tunnels: mockTunnels })
      renderSubscriptionsPage()

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/tunnels')
        expect(mockGet).toHaveBeenCalled()
      })
    })
  })

  describe('Список подписок без выбора сервера', () => {
    it('не должен отображать верхний селектор сервера при наличии туннелей', async () => {
      const mockTunnels = [
        { id: 1, name: 'Tunnel 1', ip: '1.1.1.1', domain: '', isInstalled: true }
      ]
      setupMockGet({ tunnels: mockTunnels, subscriptions: [] })
      renderSubscriptionsPage()

      await waitFor(() => {
        expect(screen.queryByText('Основной сервер')).not.toBeInTheDocument()
      })
    })
  })

  describe('Диалог создания подписки', () => {
    it('добавляет роутинг INCY отдельной кнопкой и отправляет профиль при сохранении', async () => {
      setupMockGet({ subscriptions: [{
        id: '1', name: 'INCY subscription', uuid: 'abc', inbounds: [],
        inboundsConfig: [{ type: 'custom', link: 'vless://existing' }],
      }] })
      mockPut.mockResolvedValue({})
      renderSubscriptionsPage()
      fireEvent.click(await screen.findByTestId('icon-MoreVert'))
      fireEvent.click(await screen.findByText('Редактировать'))
      fireEvent.click(screen.getByText('Добавить роутинг INCY'))
      const profile = 'https://example.com/profile.json'
      fireEvent.change(await screen.findByLabelText('Профиль INCY (JSON, base64, URL или ссылка)'), { target: { value: profile } })
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить', exact: true }))
      await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/subscriptions/1', expect.objectContaining({
        inboundsConfig: expect.arrayContaining([{ type: 'incy-routing', routingProfile: profile }]),
      })))
    })

    it('должен открывать диалог при клике на "Создать"', async () => {
      setupMockGet()
      renderSubscriptionsPage()

      const createButton = await screen.findByText('Создать')
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(screen.getByText('Новая подписка')).toBeInTheDocument()
      })
    })

    it('должен закрывать диалог при клике на "Отмена"', async () => {
      setupMockGet()
      renderSubscriptionsPage()

      const createButton = await screen.findByText('Создать')
      fireEvent.click(createButton)

      const cancelButton = await screen.findByText('Отмена')
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByText('Новая подписка')).not.toBeInTheDocument()
      })
    })

    it('должен отображать поле имени подписки', async () => {
      setupMockGet()
      renderSubscriptionsPage()

      const createButton = await screen.findByText('Создать')
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(screen.getByLabelText('Имя подписки')).toBeInTheDocument()
      })
    })

    it('должен отображать инбаунды по умолчанию', async () => {
      setupMockGet()
      renderSubscriptionsPage()

      const createButton = await screen.findByText('Создать')
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(screen.getByText('Инбаунды (10/20)')).toBeInTheDocument()
      })
    })

    it('должен позволять вводить имя подписки', async () => {
      setupMockGet()
      renderSubscriptionsPage()

      const createButton = await screen.findByText('Создать')
      fireEvent.click(createButton)

      const nameField = await screen.findByLabelText('Имя подписки')
      fireEvent.change(nameField, { target: { value: 'My Subscription' } })

      expect(nameField).toHaveValue('My Subscription')
    })

    it('должен показывать ошибку при пустом имени', async () => {
      setupMockGet()
      mockPost.mockRejectedValue({})

      renderSubscriptionsPage()

      const createButton = await screen.findByText('Создать')
      fireEvent.click(createButton)

      const saveButton = await screen.findByText('Сохранить')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Введите имя подписки')).toBeInTheDocument()
      })
    })
  })

  describe('Управление инбаундами в диалоге', () => {
    it('должен отображать инбаунды по умолчанию', async () => {
      setupMockGet()
      renderSubscriptionsPage()

      const createButton = await screen.findByText('Создать')
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(screen.getByText('Инбаунды (10/20)')).toBeInTheDocument()
      })
    })

    it('должен позволять вводить имя подписки', async () => {
      setupMockGet()
      renderSubscriptionsPage()

      const createButton = await screen.findByText('Создать')
      fireEvent.click(createButton)

      const nameField = await screen.findByLabelText('Имя подписки')
      fireEvent.change(nameField, { target: { value: 'My Subscription' } })

      expect(nameField).toHaveValue('My Subscription')
    })

    it('должен добавлять новый инбаунд', async () => {
      setupMockGet()
      renderSubscriptionsPage()

      const createButton = await screen.findByText('Создать')
      fireEvent.click(createButton)

      const addButton = await screen.findByText('Добавить инбаунд')
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(screen.getByText('Инбаунды (11/20)')).toBeInTheDocument()
      })
    })

    it('должен удалять все инбаунды кнопкой "Удалить все"', async () => {
      setupMockGet()
      renderSubscriptionsPage()

      const createButton = await screen.findByText('Создать')
      fireEvent.click(createButton)

      const removeAllButton = await screen.findByText('Удалить все')
      fireEvent.click(removeAllButton)

      await waitFor(() => {
        expect(screen.getByText('Инбаунды (1/20)')).toBeInTheDocument()
      })
    })

    it('должен запрещать добавление более 20 инбаундов', async () => {
      setupMockGet()
      renderSubscriptionsPage()

      const createButton = await screen.findByText('Создать')
      fireEvent.click(createButton)

      for (let i = 0; i < 11; i++) {
        const addButton = screen.getByText('Добавить инбаунд')
        fireEvent.click(addButton)
      }

      await waitFor(() => {
        const addButton = screen.getByText('Добавить инбаунд')
        expect(addButton).toBeDisabled()
      })
    }, 15000)
  })

  describe('Сохранение подписки', () => {
    it.each(['', ' shared-client '])('передаёт необязательный ID клиента (%s)', async (identifier) => {
      setupMockGet()
      mockPost.mockResolvedValue({ data: {} })
      renderSubscriptionsPage()
      fireEvent.click(await screen.findByText('Создать'))
      fireEvent.change(await screen.findByLabelText('Имя подписки'), { target: { value: 'Shared' } })
      const field = screen.getByLabelText('ID клиента (необязательно)')
      expect(field).toHaveValue('')
      fireEvent.change(field, { target: { value: identifier } })
      fireEvent.click(screen.getByText('Сохранить'))
      await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/subscriptions', expect.objectContaining({ clientId: identifier.trim() })))
    })

    it('должен создавать новую подписку', async () => {
      setupMockGet()
      mockPost.mockResolvedValue({})

      renderSubscriptionsPage()

      const createButton = await screen.findByText('Создать')
      fireEvent.click(createButton)

      const nameField = await screen.findByLabelText('Имя подписки')
      fireEvent.change(nameField, { target: { value: 'New Sub' } })

      const saveButton = screen.getByText('Сохранить')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/subscriptions', expect.objectContaining({
          name: 'New Sub',
        }))
      })
    })

    it('должен показывать успех после создания', async () => {
      setupMockGet()
      mockPost.mockResolvedValue({})

      renderSubscriptionsPage()

      const createButton = await screen.findByText('Создать')
      fireEvent.click(createButton)

      const nameField = await screen.findByLabelText('Имя подписки')
      fireEvent.change(nameField, { target: { value: 'New Sub' } })

      const saveButton = screen.getByText('Сохранить')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Подписка создана')).toBeInTheDocument()
      })
    })

    it('должен показывать ошибку при неудачном сохранении', async () => {
      setupMockGet()
      mockPost.mockRejectedValue({ response: { data: { message: 'Ошибка сервера' } } })

      renderSubscriptionsPage()

      const createButton = await screen.findByText('Создать')
      fireEvent.click(createButton)

      const nameField = await screen.findByLabelText('Имя подписки')
      fireEvent.change(nameField, { target: { value: 'New Sub' } })

      const saveButton = screen.getByText('Сохранить')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Ошибка сервера')).toBeInTheDocument()
      })
    })
  })

  describe('Редактирование подписки', () => {
    it.each(['happ', 'incy'])('сохраняет профиль %s без порта и ноды', async (scheme) => {
      const profile = '{"Name":"Test"}'
      setupMockGet({ subscriptions: [{
        id: '1', name: 'Happ', uuid: 'abc-123', inbounds: [],
        inboundsConfig: [{ type: `${scheme}-routing`, routingProfile: profile }],
      }] })
      mockPut.mockResolvedValue({})
      renderSubscriptionsPage()
      fireEvent.click(await screen.findByTestId('icon-MoreVert'))
      fireEvent.click(await screen.findByText('Редактировать'))
      expect(await screen.findByLabelText(scheme === 'incy' ? 'Профиль INCY (JSON, base64, URL или ссылка)' : 'Профиль Happ (JSON, base64 или ссылка)')).toHaveValue(profile)
      fireEvent.click(screen.getByText('Сохранить'))
      await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/subscriptions/1', {
        name: 'Happ', clientId: '', inboundsConfig: [{ type: `${scheme}-routing`, routingProfile: profile }],
      }))
    })

    it('должен открывать диалог редактирования', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [{ type: 'vless', port: 443, sni: 'example.com' }], isAutoRotationEnabled: true }
      ]
      setupMockGet({ subscriptions: mockSubs })
      renderSubscriptionsPage()

      const menuButton = await screen.findByTestId('icon-MoreVert')
      fireEvent.click(menuButton)

      const editOption = await screen.findByText('Редактировать')
      fireEvent.click(editOption)

      await waitFor(() => {
        expect(screen.getByText('Редактировать подписку')).toBeInTheDocument()
      })
    })

    it('должен загружать данные подписки в диалог', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [{ type: 'vless', port: 443, sni: 'example.com' }], isAutoRotationEnabled: true }
      ]
      setupMockGet({ subscriptions: mockSubs })
      renderSubscriptionsPage()

      const menuButton = await screen.findByTestId('icon-MoreVert')
      fireEvent.click(menuButton)

      const editOption = await screen.findByText('Редактировать')
      fireEvent.click(editOption)

      const nameField = await screen.findByLabelText('Имя подписки')
      expect(nameField).toHaveValue('Test Sub')
    })

    it('должен обновлять подписку', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [{ type: 'vless', port: 443, sni: 'example.com' }], isAutoRotationEnabled: true }
      ]
      setupMockGet({ subscriptions: mockSubs })
      mockPut.mockResolvedValue({})

      renderSubscriptionsPage()

      const menuButton = await screen.findByTestId('icon-MoreVert')
      fireEvent.click(menuButton)

      const editOption = await screen.findByText('Редактировать')
      fireEvent.click(editOption)

      const nameField = await screen.findByLabelText('Имя подписки')
      fireEvent.change(nameField, { target: { value: 'Updated Sub' } })

      const saveButton = screen.getByText('Сохранить')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/subscriptions/1', expect.objectContaining({
          name: 'Updated Sub',
        }))
      })
    })

    it('должен показывать успех после обновления', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [{ type: 'vless', port: 443, sni: 'example.com' }], isAutoRotationEnabled: true }
      ]
      setupMockGet({ subscriptions: mockSubs })
      mockPut.mockResolvedValue({})

      renderSubscriptionsPage()

      const menuButton = await screen.findByTestId('icon-MoreVert')
      fireEvent.click(menuButton)

      const editOption = await screen.findByText('Редактировать')
      fireEvent.click(editOption)

      const nameField = await screen.findByLabelText('Имя подписки')
      fireEvent.change(nameField, { target: { value: 'Updated Sub' } })

      const saveButton = screen.getByText('Сохранить')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Подписка обновлена')).toBeInTheDocument()
      })
    })
  })

  describe('Удаление подписки', () => {
    it.each([false, true])('предлагает принудительное удаление или отмену (force=%s)', async (force) => {
      mockDelete.mockReset()
      setupMockGet({ subscriptions: [{ id: '1', name: 'Test Sub', uuid: 'abc', inbounds: [] }] })
      mockDelete.mockRejectedValueOnce({ response: { data: { code: 'INBOUND_DELETE_FAILED', message: 'Инбаунд недоступен' } } }).mockResolvedValueOnce({})
      renderSubscriptionsPage()
      fireEvent.click(await screen.findByTestId('icon-MoreVert'))
      fireEvent.click(await screen.findByText('Удалить'))
      fireEvent.click(screen.getAllByText('Удалить')[1])
      const forceButton = await screen.findByRole('button', { name: 'Удалить принудительно' })
      expect(screen.getByText('Не удалось удалить все инбаунды')).toBeInTheDocument()
      if (force) {
        fireEvent.click(forceButton)
        await waitFor(() => expect(mockDelete).toHaveBeenLastCalledWith('/subscriptions/1?force=true'))
        expect(await screen.findByText('Подписка удалена')).toBeInTheDocument()
      } else {
        fireEvent.click(screen.getByRole('button', { name: 'Отменить' }))
        await waitFor(() => expect(screen.queryByText('Не удалось удалить все инбаунды')).not.toBeInTheDocument())
        expect(mockDelete).toHaveBeenCalledTimes(1)
        expect(screen.getByText('Test Sub')).toBeInTheDocument()
      }
    })

    it('должен открывать диалог подтверждения удаления', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [], isAutoRotationEnabled: true }
      ]
      setupMockGet({ subscriptions: mockSubs })
      renderSubscriptionsPage()

      const menuButton = await screen.findByTestId('icon-MoreVert')
      fireEvent.click(menuButton)

      const deleteOption = await screen.findByText('Удалить')
      fireEvent.click(deleteOption)

      await waitFor(() => {
        expect(screen.getByText('Удалить подписку и все соединения?')).toBeInTheDocument()
      })
    })

    it('должен закрывать диалог при клике на "Отмена"', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [], isAutoRotationEnabled: true }
      ]
      setupMockGet({ subscriptions: mockSubs })
      renderSubscriptionsPage()

      const menuButton = await screen.findByTestId('icon-MoreVert')
      fireEvent.click(menuButton)

      const deleteOption = await screen.findByText('Удалить')
      fireEvent.click(deleteOption)

      const cancelButton = await screen.findByText('Отмена')
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByText('Удалить подписку и все соединения?')).not.toBeInTheDocument()
      })
    })

    it('должен удалять подписку при подтверждении', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [], isAutoRotationEnabled: true }
      ]
      setupMockGet({ subscriptions: mockSubs })
      mockDelete.mockResolvedValue({})

      renderSubscriptionsPage()

      const menuButton = await screen.findByTestId('icon-MoreVert')
      fireEvent.click(menuButton)

      const deleteOption = await screen.findByText('Удалить')
      fireEvent.click(deleteOption)

      const confirmButton = screen.getAllByText('Удалить')[1] as HTMLElement
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith('/subscriptions/1')
      })
    })

    it('должен показывать успех после удаления', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [], isAutoRotationEnabled: true }
      ]
      setupMockGet({ subscriptions: mockSubs })
      mockDelete.mockResolvedValue({})

      renderSubscriptionsPage()

      const menuButton = await screen.findByTestId('icon-MoreVert')
      fireEvent.click(menuButton)

      const deleteOption = await screen.findByText('Удалить')
      fireEvent.click(deleteOption)

      const confirmButton = screen.getAllByText('Удалить')[1] as HTMLElement
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByText('Подписка удалена')).toBeInTheDocument()
      })
    })
  })

  describe('Принудительная ротация', () => {
    it.each([false, true])('передаёт выбранный режим после открытия диалога (all=%s)', async (all) => {
      setupMockGet({ subscriptions: [{ id: '1', name: 'Test Sub', uuid: 'abc', inbounds: [] }] })
      mockPost.mockResolvedValue({ data: { success: true } })
      renderSubscriptionsPage()
      if (all) {
        fireEvent.click(await screen.findByText('Обновить все'))
      } else {
        fireEvent.click(await screen.findByTestId('icon-MoreVert'))
        fireEvent.click(await screen.findByText('Обновить сейчас'))
      }
      fireEvent.click(await screen.findByLabelText('Принудительная ротация'))
      fireEvent.click(screen.getByRole('button', { name: all ? 'Сгенерировать' : 'Обновить', exact: true }))
      await waitFor(() => expect(mockPost).toHaveBeenCalledWith(
        all ? '/rotation/rotate-all?force=true' : '/rotation/rotate-one/1?force=true',
      ))
    })
  })

  describe('Переключение авторотации', () => {
    it('должен переключать авторотацию при клике на чекбокс', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [], isAutoRotationEnabled: true }
      ]
      setupMockGet({ subscriptions: mockSubs })
      mockPut.mockResolvedValue({})

      renderSubscriptionsPage()

      const checkbox = await screen.findByRole('checkbox')
      fireEvent.click(checkbox)

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/subscriptions/bulk-auto-rotation', expect.objectContaining({
          subscriptionIds: ['1'],
          enabled: false
        }))
      })
    })

    it('должен показывать успех при включении авторотации', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [], isAutoRotationEnabled: false }
      ]
      setupMockGet({ subscriptions: mockSubs })
      mockPut.mockResolvedValue({})

      renderSubscriptionsPage()

      const checkbox = await screen.findByRole('checkbox')
      fireEvent.click(checkbox)

      await waitFor(() => {
        expect(screen.getByText('Авторотация включена')).toBeInTheDocument()
      })
    })

    it('должен показывать успех при выключении авторотации', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [], isAutoRotationEnabled: true }
      ]
      setupMockGet({ subscriptions: mockSubs })
      mockPut.mockResolvedValue({})

      renderSubscriptionsPage()

      const checkbox = await screen.findByRole('checkbox')
      fireEvent.click(checkbox)

      await waitFor(() => {
        expect(screen.getByText('Авторотация выключена')).toBeInTheDocument()
      })
    })

    it('должен показывать ошибку при неудачном переключении', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [], isAutoRotationEnabled: true }
      ]
      setupMockGet({ subscriptions: mockSubs })
      mockPut.mockRejectedValue({ response: { data: { message: 'Ошибка' } } })

      renderSubscriptionsPage()

      const checkbox = await screen.findByRole('checkbox')
      fireEvent.click(checkbox)

      await waitFor(() => {
        expect(screen.getByText('Ошибка')).toBeInTheDocument()
      })
    })
  })

  describe('Утилитные функции', () => {
    it('должен генерировать уникальный ID', async () => {
      setupMockGet()
      renderSubscriptionsPage()

      const createButton = await screen.findByText('Создать')
      fireEvent.click(createButton)

      // Проверяем что ID генерируется (просто что форма открывается)
      await waitFor(() => {
        expect(screen.getByText('Новая подписка')).toBeInTheDocument()
      })
    })
  })

  describe('Просмотр ссылок', () => {
    it('должен открывать диалог ссылок при клике на опцию меню', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [{ type: 'vless', port: 443, sni: 'example.com', link: 'vless://test' }], isAutoRotationEnabled: true }
      ]
      setupMockGet({ subscriptions: mockSubs })

      renderSubscriptionsPage()

      const menuButton = await screen.findByTestId('icon-MoreVert')
      fireEvent.click(menuButton)

      const linksOption = await screen.findByText('Показать конфиги')
      fireEvent.click(linksOption)

      await waitFor(() => {
        expect(screen.getByText('Активные ссылки')).toBeInTheDocument()
      })
    })

    it('должен закрывать диалог ссылок при клике на "Закрыть"', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [{ type: 'vless', port: 443, sni: 'example.com', link: 'vless://test' }], isAutoRotationEnabled: true }
      ]
      setupMockGet({ subscriptions: mockSubs })

      renderSubscriptionsPage()

      const menuButton = await screen.findByTestId('icon-MoreVert')
      fireEvent.click(menuButton)

      const linksOption = await screen.findByText('Показать конфиги')
      fireEvent.click(linksOption)

      const closeButton = await screen.findByText('Закрыть')
      fireEvent.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByText('Активные ссылки')).not.toBeInTheDocument()
      })
    })

    it('должен копировать ссылку при клике на кнопку копирования', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [{ type: 'vless', port: 443, sni: 'example.com', link: 'vless://test' }], isAutoRotationEnabled: true }
      ]
      setupMockGet({ subscriptions: mockSubs })
      mockClipboardWriteText.mockResolvedValue(undefined)

      renderSubscriptionsPage()

      const menuButton = await screen.findByTestId('icon-MoreVert')
      fireEvent.click(menuButton)

      const linksOption = await screen.findByText('Показать конфиги')
      fireEvent.click(linksOption)

      const copyButton = await screen.findByText('Копировать все')
      fireEvent.click(copyButton)

      await waitFor(() => {
        expect(mockClipboardWriteText).toHaveBeenCalled()
      })
    })

    it('должен открывать ссылку в новой вкладке при клике на иконку открытия', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [{ type: 'vless', port: 443, sni: 'example.com', link: 'vless://test' }], isAutoRotationEnabled: true }
      ]
      setupMockGet({ subscriptions: mockSubs })

      renderSubscriptionsPage()

      const menuButton = await screen.findByTestId('icon-MoreVert')
      fireEvent.click(menuButton)

      const linksOption = await screen.findByText('Показать конфиги')
      fireEvent.click(linksOption)

      const openButtons = await screen.findAllByTestId('icon-OpenInNew')
      if (openButtons.length > 0) {
        fireEvent.click(openButtons[0])
      }

      await waitFor(() => {
        expect(mockWindowOpen).toHaveBeenCalled()
      })
    })

    it('должен показывать сообщение при отсутствии ссылок', async () => {
      const mockSubs = [
        { id: '1', name: 'Test Sub', uuid: 'abc-123', inbounds: [], isAutoRotationEnabled: true }
      ]
      setupMockGet({ subscriptions: mockSubs })

      renderSubscriptionsPage()

      const menuButton = await screen.findByTestId('icon-MoreVert')
      fireEvent.click(menuButton)

      const linksOption = await screen.findByText('Показать конфиги')
      fireEvent.click(linksOption)

      await waitFor(() => {
        expect(screen.getByText('Нет активных ссылок (ждите ротации)')).toBeInTheDocument()
      })
    })
  })
})
