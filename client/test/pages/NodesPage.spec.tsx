import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import NodesPage from '../../src/pages/NodesPage'

const { remove } = vi.hoisted(() => ({ remove: vi.fn() }))
vi.mock('../../src/features/nodes/api', () => ({
  nodesApi: {
    list: vi.fn().mockResolvedValue([{ id: 'offline', name: 'Offline node', authType: 'token', isMain: true }]),
    remove,
  },
}))
vi.mock('../../src/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: [] }) } }))

describe('Node deletion', () => {
  beforeEach(() => {
    remove.mockReset().mockResolvedValue({ success: true })
  })

  it('sends force only after explicit selection and resets it on cancel', async () => {
    render(<NodesPage />)
    fireEvent.click(await screen.findByTestId('icon-Delete'))
    expect(screen.getByText('Это последняя нода. При её удалении будут удалены все подписки и их подключения.')).toBeInTheDocument()
    fireEvent.click(await screen.findByLabelText('Принудительное удаление ноды'))
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Отмена'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    fireEvent.click(screen.getByTestId('icon-Delete'))
    const force = await screen.findByLabelText('Принудительное удаление ноды')
    expect(force).not.toBeChecked()
    fireEvent.click(force)
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Удалить'))
    await waitFor(() => expect(remove).toHaveBeenCalledWith('offline', true))
  })
})
