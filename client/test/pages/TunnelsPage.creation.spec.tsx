import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import TunnelsPage from '../../src/pages/TunnelsPage'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../../src/api', () => ({ default: { get, post } }))

describe('Relay installation after creation', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    get.mockImplementation((url: string) => Promise.resolve({ data: url === '/nodes'
      ? [{ id: 'main', name: 'Main', isMain: true }]
      : [] }))
    post.mockResolvedValue({ data: { id: 42 } })
  })

  const createRelay = async () => {
    render(<TunnelsPage />)
    await waitFor(() => expect(get).toHaveBeenCalledWith('/nodes'))
    fireEvent.click(screen.getByRole('button', { name: /Добавить/ }))
    fireEvent.change(await screen.findByLabelText(/^Название/), { target: { value: 'Relay' } })
    fireEvent.change(screen.getByLabelText(/^IP или домен relay сервера/), { target: { value: '192.0.2.1' } })
    fireEvent.change(screen.getByLabelText(/^SSH пароль/), { target: { value: 'test-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  }

  it.each([false, true])('offers installation and waits for confirmation (install=%s)', async (install) => {
    await createRelay()
    expect(await screen.findByText('Relay сервер добавлен. Установить скрипт перенаправления сейчас?')).toBeInTheDocument()
    expect(post).toHaveBeenCalledTimes(1)
    const dialog = screen.getAllByRole('dialog').find((item) => item.textContent?.includes('Установить скрипт'))!
    fireEvent.click(within(dialog).getByRole('button', { name: install ? 'Установить' : 'Отмена' }))
    if (install) {
      await waitFor(() => expect(post).toHaveBeenCalledWith('/tunnels/42/install'))
      expect(await screen.findByText('Перенаправление установлено')).toBeInTheDocument()
    } else {
      await waitFor(() => expect(screen.queryByText('Relay сервер добавлен. Установить скрипт перенаправления сейчас?')).not.toBeInTheDocument())
      expect(post).toHaveBeenCalledTimes(1)
    }
  })

  it('does not offer installation if creation fails', async () => {
    post.mockRejectedValueOnce({ response: { data: { message: 'Ошибка добавления' } } })
    await createRelay()
    expect(await screen.findByText('Ошибка добавления')).toBeInTheDocument()
    expect(screen.queryByText('Relay сервер добавлен. Установить скрипт перенаправления сейчас?')).not.toBeInTheDocument()
    expect(post).toHaveBeenCalledTimes(1)
  })
})
