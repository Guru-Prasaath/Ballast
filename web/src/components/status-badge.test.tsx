import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge, WorkerStatusBadge } from './status-badge'

describe('StatusBadge', () => {
  it('renders the human label for each job status', () => {
    render(<StatusBadge status="dead" />)
    expect(screen.getByText('Dead-letter')).toBeInTheDocument()
  })

  it('animates the dot only while running', () => {
    const { container, rerender } = render(<StatusBadge status="running" />)
    expect(container.querySelector('.animate-pulse-dot')).not.toBeNull()

    rerender(<StatusBadge status="completed" />)
    expect(container.querySelector('.animate-pulse-dot')).toBeNull()
  })
})

describe('WorkerStatusBadge', () => {
  it('labels a draining worker', () => {
    render(<WorkerStatusBadge status="draining" />)
    expect(screen.getByText('Draining')).toBeInTheDocument()
  })
})
