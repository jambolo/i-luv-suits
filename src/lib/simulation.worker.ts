import { performSimulation, mulberry32, stringToSeed } from './simulation-core'

self.onmessage = async function (e: MessageEvent) {
  const { numHands, payoutConfig, minThreeCardFlushRank, randomSeed } = e.data

  // Build RNG
  let rng
  if (typeof randomSeed !== 'undefined') {
    const seed = typeof randomSeed === 'number' ? (randomSeed >>> 0) : stringToSeed(String(randomSeed))
    rng = mulberry32(seed)
  } else if (typeof (self as any).crypto !== 'undefined' && 'getRandomValues' in (self as any).crypto) {
    rng = () => {
      const arr = new Uint32Array(1)
      ;(self as any).crypto.getRandomValues(arr)
      return arr[0] / 4294967296
    }
  } else {
    rng = Math.random
  }

  function progressCb(progress: number) {
    ;(self as any).postMessage({ type: 'progress', progress })
  }

  try {
    const summary = await performSimulation(numHands, payoutConfig, minThreeCardFlushRank, rng, progressCb)
    ;(self as any).postMessage({ type: 'done', results: summary.results, handDistribution: summary.handDistribution })
  } catch (err) {
    ;(self as any).postMessage({ type: 'error', message: String(err) })
  }
}
