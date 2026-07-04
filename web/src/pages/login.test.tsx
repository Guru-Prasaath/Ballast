import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }))
vi.mock('@/lib/api-client', () => ({
  apiClient: { post: postMock },
  setAccessToken: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

import { LoginPage } from './login'
import { AuthProvider } from '@/app/auth-provider'

const fakeSession = {
  user: { id: 'u1', orgId: 'o1', email: 'ada@northwind.dev', name: 'Ada', role: 'owner' },
  org: { id: 'o1', name: 'Northwind', slug: 'northwind' },
  tokens: { accessToken: 'a', refreshToken: 'r', expiresAt: '2099-01-01T00:00:00Z' },
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    postMock.mockReset()
    localStorage.clear()
  })

  it('posts credentials to the auth endpoint on submit', async () => {
    postMock.mockResolvedValue(fakeSession)
    renderLogin()

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/auth/login', {
        email: 'ada@northwind.dev',
        password: 'demo1234',
      }),
    )
  })

  it('surfaces an error when sign-in fails', async () => {
    postMock.mockRejectedValue(new Error('nope'))
    renderLogin()

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/could not sign in/i)).toBeInTheDocument()
  })
})
