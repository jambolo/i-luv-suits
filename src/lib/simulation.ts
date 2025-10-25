// Thin wrapper that exposes simulation API for UI and re-exports core types.
export * from './simulation-core'
import { performSimulation, mulberry32, stringToSeed } from './simulation-core'
import type { PayoutConfig, SimulationSummary, RNG, SimulationResult, HandDistributionStats } from './simulation-core'

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

// Run the simulation using multiple workers in parallel and aggregate results.
export function runSimulationInWorkers(
  numHands: number,
  payoutConfig: PayoutConfig,
  minThreeCardFlushRank: number,
  onProgress?: (progress: number) => void,
  randomSeed?: number | string,
  workerCount?: number
): Promise<SimulationSummary> {
  return new Promise((resolve, reject) => {
    // Determine worker count
    const hw = typeof navigator !== 'undefined' && (navigator as any).hardwareConcurrency ? (navigator as any).hardwareConcurrency : 4
    const count = Math.max(1, Math.min(workerCount ?? hw, numHands))

    // Split hands among workers
    const base = Math.floor(numHands / count)
    const remainder = numHands % count
    const handsPerWorker: number[] = Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0))

    const workers: Worker[] = []
    const perWorkerProgress: number[] = Array(count).fill(0)
    const workerPromises: Promise<{ results: SimulationResult[]; handDistribution: HandDistributionStats }> [] = []

    // Helper to derive per-worker seed deterministically if a seed was provided
    const deriveSeed = (seed: string | number | undefined, idx: number) => {
      if (typeof seed === 'undefined') return undefined
      return stringToSeed(String(seed) + ':' + String(idx))
    }

    for (let i = 0; i < count; i++) {
      const hands = handsPerWorker[i]
      // spawn worker
      const w = new Worker(new URL('./simulation.worker', import.meta.url), { type: 'module' })
      workers.push(w)

      const p = new Promise<{ results: SimulationResult[]; handDistribution: HandDistributionStats }>((res, rej) => {
        w.onmessage = (ev: MessageEvent) => {
          const data = ev.data
          if (!data) return
          if (data.type === 'progress') {
            perWorkerProgress[i] = data.progress // 0-100 for that worker
            // compute global weighted progress
            const totalHands = numHands
            const weighted = perWorkerProgress.reduce((acc, prog, idx2) => acc + (prog / 100) * handsPerWorker[idx2], 0)
            const global = (weighted / totalHands) * 100
            if (onProgress) onProgress(global)
          } else if (data.type === 'done') {
            res({ results: data.results, handDistribution: data.handDistribution })
          } else if (data.type === 'error') {
            rej(new Error(data.message || data.error || 'Worker error'))
          }
        }
        w.onerror = (err) => {
          rej(err)
        }
      })

      workerPromises.push(p)

      const seedForWorker = deriveSeed(randomSeed, i)
      w.postMessage({ numHands: hands, payoutConfig, minThreeCardFlushRank, randomSeed: seedForWorker })
    }

    // When any worker fails, terminate all and reject
    let settled = false
    const terminateAll = () => workers.forEach(w => { try { w.terminate() } catch {} })

    Promise.all(workerPromises.map(p => p.catch(e => { throw e }))).then((parts) => {
      if (settled) return
      settled = true
      // aggregate results
      const totalsMap = new Map<string, { totalBet: number; totalWon: number; handsWon: number; handsLost: number }>()
      let totalHands = 0
      let totalAbove = 0
      let totalBelow = 0

      for (const part of parts) {
        for (const r of part.results) {
          const existing = totalsMap.get(r.betType) ?? { totalBet: 0, totalWon: 0, handsWon: 0, handsLost: 0 }
          existing.totalBet += r.totalBet
          existing.totalWon += r.totalWon
          existing.handsWon += r.handsWon
          existing.handsLost += r.handsLost
          totalsMap.set(r.betType, existing)
        }
        totalHands += part.handDistribution.totalHands
        totalAbove += part.handDistribution.aboveMinimum
        totalBelow += part.handDistribution.belowMinimum
      }

      const combinedResults: SimulationResult[] = []
      for (const [betType, data] of totalsMap.entries()) {
        const expectedReturn = data.totalBet > 0 ? ((data.totalWon - data.totalBet) / data.totalBet) * 100 : 0
        const winRate = (data.handsWon + data.handsLost) > 0 ? (data.handsWon / (data.handsWon + data.handsLost)) * 100 : 0
        combinedResults.push({ betType, totalBet: data.totalBet, totalWon: data.totalWon, expectedReturn, handsWon: data.handsWon, handsLost: data.handsLost, winRate })
      }

      const handDistribution: HandDistributionStats = {
        totalHands,
        aboveMinimum: totalAbove,
        belowMinimum: totalBelow,
        aboveMinimumPercentage: totalHands > 0 ? (totalAbove / totalHands) * 100 : 0,
        belowMinimumPercentage: totalHands > 0 ? (totalBelow / totalHands) * 100 : 0
      }

      terminateAll()
      resolve({ results: combinedResults, handDistribution })
    }).catch((err) => {
      if (settled) return
      settled = true
      terminateAll()
      reject(err)
    })
  })
}
