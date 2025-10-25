// Thin wrapper that exposes simulation API for UI and re-exports core types.
export * from './simulation-core'
import { performSimulation, mulberry32, stringToSeed } from './simulation-core'
import type { PayoutConfig, SimulationSummary, RNG } from './simulation-core'

// simulateHands: main-thread wrapper that builds RNG and calls shared performSimulation
export async function simulateHands(
  numHands: number,
  payoutConfig: PayoutConfig,
  minThreeCardFlushRank: number,
  setProgress?: (progress: number) => void,
  randomSeed?: number | string
): Promise<SimulationSummary> {
  let rng: RNG
  if (typeof randomSeed !== 'undefined') {
    const seed = typeof randomSeed === 'number' ? (randomSeed >>> 0) : stringToSeed(String(randomSeed))
    rng = mulberry32(seed)
  } else if (typeof crypto !== 'undefined' && 'getRandomValues' in (crypto as any)) {
    rng = () => {
      const arr = new Uint32Array(1)
      ;(crypto as any).getRandomValues(arr)
      return arr[0] / 4294967296
    }
  } else {
    rng = Math.random
  }

  return performSimulation(numHands, payoutConfig, minThreeCardFlushRank, rng, setProgress)
}

// runSimulationInWorker: spawn the module worker and forward progress/done messages
export function runSimulationInWorker(
  numHands: number,
  payoutConfig: PayoutConfig,
  minThreeCardFlushRank: number,
  onProgress?: (progress: number) => void,
  randomSeed?: number | string
): Promise<SimulationSummary> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./simulation.worker', import.meta.url), { type: 'module' })

    worker.onmessage = (ev: MessageEvent) => {
      const data = ev.data
      if (!data) return
      if (data.type === 'progress') {
        if (onProgress) onProgress(data.progress)
      } else if (data.type === 'done') {
        worker.terminate()
        resolve({ results: data.results, handDistribution: data.handDistribution })
      } else if (data.type === 'error') {
        worker.terminate()
        reject(data.error)
      }
    }

    worker.onerror = (err) => {
      worker.terminate()
      reject(err)
    }

    worker.postMessage({ numHands, payoutConfig, minThreeCardFlushRank, randomSeed })
  })
}
