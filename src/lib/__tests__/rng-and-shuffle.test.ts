import { describe, it, expect } from 'vitest'
import { mulberry32, stringToSeed, createDeck, shuffleDeckWithRng } from '../simulation-core'

describe('RNG and shuffle determinism', () => {
  it('mulberry32 produces deterministic sequence for same seed', () => {
    const a1 = mulberry32(123456789)
    const a2 = mulberry32(123456789)
    const seq1 = Array.from({ length: 10 }, () => a1())
    const seq2 = Array.from({ length: 10 }, () => a2())
    expect(seq1).toEqual(seq2)
  })

  it('stringToSeed is stable and reproducible', () => {
    const s = 'test-seed-αβγ'
    const s1 = stringToSeed(s)
    const s2 = stringToSeed(s)
    expect(s1).toBe(s2)
  })

  it('shuffleDeckWithRng is deterministic given the same RNG', () => {
    const deck = createDeck()
    const seed = 424242
    const rngA = mulberry32(seed)
    const rngB = mulberry32(seed)
    const shuffledA = shuffleDeckWithRng(deck, rngA)
    const shuffledB = shuffleDeckWithRng(deck, rngB)
    expect(shuffledA).toEqual(shuffledB)
    // basic sanity: length and uniqueness
    expect(shuffledA).toHaveLength(52)
    const uniq = new Set(shuffledA.map(c => `${c.suit}:${c.rank}`))
    expect(uniq.size).toBe(52)
  })
})
