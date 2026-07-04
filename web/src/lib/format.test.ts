import { describe, expect, it } from 'vitest'
import { duration, prettyJson } from './format'

describe('duration', () => {
  it('formats sub-second values in milliseconds', () => {
    expect(duration(820)).toBe('820ms')
    expect(duration(0)).toBe('0ms')
  })

  it('formats seconds with one decimal', () => {
    expect(duration(3400)).toBe('3.4s')
    expect(duration(1000)).toBe('1.0s')
  })

  it('formats minutes and seconds past a minute', () => {
    expect(duration(72_000)).toBe('1m 12s')
    expect(duration(600_000)).toBe('10m 0s')
  })
})

describe('prettyJson', () => {
  it('indents nested objects', () => {
    expect(prettyJson({ a: 1, b: { c: 2 } })).toBe(
      '{\n  "a": 1,\n  "b": {\n    "c": 2\n  }\n}',
    )
  })
})
