export type ImageCompressionErrorCode =
  | 'UNSUPPORTED_TYPE'
  | 'DECODE_FAILED'
  | 'SIZE_EXCEEDED'
  | 'ENCODE_FAILED'

export class ImageCompressionError extends Error {
  constructor(
    public readonly code: ImageCompressionErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ImageCompressionError'
  }
}

const ACCEPTED_INPUT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const TARGET_BYTE_BUDGET = 800 * 1024
const HARD_STORAGE_LIMIT_BYTES = 1572864 // 1.5 MB

const COMPRESSION_STEPS: Array<{ maxDimension: number; quality: number }> = [
  { maxDimension: 1600, quality: 0.8 },
  { maxDimension: 1600, quality: 0.65 },
  { maxDimension: 1600, quality: 0.5 },
  { maxDimension: 1280, quality: 0.65 },
  { maxDimension: 1280, quality: 0.5 },
]

function encodeCanvasToJpeg(
  bitmap: ImageBitmap,
  maxDimension: number,
  quality: number,
): Promise<Blob> {
  const longestSide = Math.max(bitmap.width, bitmap.height)
  const scale = longestSide > maxDimension ? maxDimension / longestSide : 1
  const targetWidth = Math.max(1, Math.round(bitmap.width * scale))
  const targetHeight = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new ImageCompressionError('ENCODE_FAILED', 'Canvas 2D context is unavailable')
  }

  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new ImageCompressionError('ENCODE_FAILED', 'Failed to encode JPEG image'))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      quality,
    )
  })
}

export const useImageCompression = () => {
  /**
   * Unconditionally decodes and re-encodes accepted raster images to JPEG,
   * stripping EXIF metadata and stepping dimensions/quality to stay under 1.5 MB.
   */
  async function compressImage(file: File): Promise<File> {
    if (!ACCEPTED_INPUT_TYPES.has(file.type)) {
      throw new ImageCompressionError(
        'UNSUPPORTED_TYPE',
        'Please select a JPEG, PNG, or WebP photo.',
      )
    }

    let bitmap: ImageBitmap
    try {
      bitmap = await createImageBitmap(file)
    }
    catch {
      throw new ImageCompressionError(
        'DECODE_FAILED',
        'Unable to decode this photo. Please capture or select a JPEG, PNG, or WebP image.',
      )
    }

    try {
      let latestBlob: Blob | null = null
      for (const step of COMPRESSION_STEPS) {
        latestBlob = await encodeCanvasToJpeg(bitmap, step.maxDimension, step.quality)
        if (latestBlob.size <= TARGET_BYTE_BUDGET) {
          break
        }
      }

      if (!latestBlob) {
        throw new ImageCompressionError('ENCODE_FAILED', 'Failed to compress photo.')
      }

      if (latestBlob.size >= HARD_STORAGE_LIMIT_BYTES) {
        throw new ImageCompressionError(
          'SIZE_EXCEEDED',
          'Photo remains larger than 1.5 MB after compression. Retake closer or with simpler framing.',
        )
      }

      const baseName = file.name.replace(/\.[^.]+$/, '') || 'evidence'
      return new File([latestBlob], `${baseName}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      })
    }
    finally {
      bitmap.close()
    }
  }

  return {
    compressImage,
  }
}
