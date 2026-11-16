import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImageCompressionError, useImageCompression } from '~/composables/useImageCompression'

describe('useImageCompression', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects SVG and non-image MIME types before decoding', async () => {
    const { compressImage } = useImageCompression()
    const svg = new File(['<svg></svg>'], 'evil.svg', { type: 'image/svg+xml' })
    const pdf = new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' })

    await expect(compressImage(svg)).rejects.toMatchObject({ code: 'UNSUPPORTED_TYPE' })
    await expect(compressImage(pdf)).rejects.toBeInstanceOf(ImageCompressionError)
  })

  it('throws DECODE_FAILED when createImageBitmap fails on undecodable formats', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('Unsupported')))
    const { compressImage } = useImageCompression()
    const file = new File([new Uint8Array(100)], 'photo.jpg', { type: 'image/jpeg' })

    await expect(compressImage(file)).rejects.toMatchObject({ code: 'DECODE_FAILED' })
  })

  it('unconditionally re-encodes small JPEG files to strip EXIF and outputs image/jpeg', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 800, height: 600, close }))
    const toBlob = vi.fn((cb: (b: Blob | null) => void) => cb(new Blob([new Uint8Array(200_000)], { type: 'image/jpeg' })))
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue({
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
        toBlob,
      }),
    })

    const { compressImage } = useImageCompression()
    const smallPng = new File([new Uint8Array(100_000)], 'small.png', { type: 'image/png' })
    const out = await compressImage(smallPng)

    expect(out.type).toBe('image/jpeg')
    expect(out.name).toBe('small.jpg')
    expect(toBlob).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('throws SIZE_EXCEEDED if compressed output remains >= 1.5 MB', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 4000, height: 3000, close }))
    const toBlob = vi.fn((cb: (b: Blob | null) => void) => cb(new Blob([new Uint8Array(1_600_000)], { type: 'image/jpeg' })))
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue({
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
        toBlob,
      }),
    })

    const { compressImage } = useImageCompression()
    const bigJpg = new File([new Uint8Array(5_000_000)], 'big.jpg', { type: 'image/jpeg' })

    await expect(compressImage(bigJpg)).rejects.toMatchObject({ code: 'SIZE_EXCEEDED' })
    expect(close).toHaveBeenCalledTimes(1)
  })
})
