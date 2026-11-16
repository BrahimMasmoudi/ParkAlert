import { describe, expect, it, vi } from 'vitest'

vi.mock('vue', () => ({
  ref: (v: any) => ({ value: v }),
  computed: (fn: () => any) => ({ get value() { return fn() } }),
}))
vi.mock('pinia', () => ({
  defineStore: (_id: string, setup: () => any) => setup,
}))
vi.mock('vuefire', () => ({
  useCollection: () => ({ data: { value: [] }, pending: { value: false } }),
  useFirestore: () => ({}),
  useCurrentUser: () => ({ value: null }),
}))

const { normalizeReportFromFirestore } = await import('~/stores/reports')

describe('normalizeReportFromFirestore', () => {
  it('maps legacy photoUrl into a context slot and keeps optional timestamps undefined when absent', () => {
    const report = normalizeReportFromFirestore('rep-legacy', {
      agentId: 'agent-1',
      plateNumber: 'AB-123-CD',
      photoUrl: 'https://example.com/old.jpg',
      status: 'pending',
      timestamp: { seconds: 1700000000 },
    })

    expect(report.photos).toEqual([{ path: 'https://example.com/old.jpg', slot: 'context' }])
    expect(report.plateCorrectedAt).toBeUndefined()
    expect(report.resolvedAt).toBeUndefined()
    expect(report.timestamp).toBe(1700000000 * 1000)
  })

  it('prefers photos array over legacy photoUrl when present', () => {
    const report = normalizeReportFromFirestore('rep-new', {
      agentId: 'agent-1',
      plateNumber: 'AB-123-CD',
      photos: [
        { path: 'reports/agent-1/ctx.jpg', slot: 'context' },
        { path: 'reports/agent-1/plt.jpg', slot: 'plate' },
      ],
      status: 'resolved',
      resolutionReason: 'Blurry plate',
      resolvedAt: { seconds: 1700000500 },
      timestamp: { seconds: 1700000000 },
    })

    expect(report.photos).toHaveLength(2)
    expect(report.resolvedAt).toBe(1700000500 * 1000)
    expect(report.resolutionReason).toBe('Blurry plate')
  })
})
