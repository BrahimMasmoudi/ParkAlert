import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import type { CardBrand } from '~/composables/useCardValidation'
import type { Fine } from '~/stores/fines'

export type ReceiptLocale = 'en' | 'fr'
export type ReceiptSummaryState = 'idle' | 'loading' | 'ready' | 'missing' | 'error'

export interface FineReceiptSummary {
  cardholderName: string
  cardBrand: CardBrand
  cardLast4: string
}

export interface ReceiptCopyBlock {
  title: string
  issuedBy: string
  paidBadge: string
  paymentReference: string
  fineReference: string
  fineId: string
  plateNumber: string
  issuedAt: string
  paidAt: string
  paymentChannel: string
  simulatedChannel: string
  notes: string
  totalPaid: string
  cardSectionTitle: string
  cardholder: string
  cardNetwork: string
  cardLast4: string
  simulatedFooter: string
}

export interface ReceiptFieldRow {
  key: string
  label: string
  value: string
  isolateAuto?: boolean
}

export interface ReceiptCardSummaryView {
  cardholderName: string
  cardBrand: CardBrand
  cardBrandLabel: string
  cardLast4: string
}

export interface FineReceiptViewModel {
  locale: ReceiptLocale
  copy: ReceiptCopyBlock
  statusLabel: string
  paymentReference: string
  fineReference: string
  fineId: string
  plateNumber: string
  issuedAtFormatted: string
  paidAtFormatted: string
  amountFormatted: string
  paymentProviderLabel: string
  notes?: string
  rows: ReceiptFieldRow[]
  cardSummary?: ReceiptCardSummaryView
}

export interface CanvasSnippetResult {
  dataUrl: string
  width: number
  height: number
}

export type CanvasSnippetAdapter = (
  text: string,
  options?: { maxWidthPx?: number; fontSizePx?: number; fontFamily?: string },
) => Promise<CanvasSnippetResult | null> | CanvasSnippetResult | null

export interface PdfCreatedDocLike {
  getBlob?: () => Promise<Blob>
  download?: (filename?: string) => Promise<void> | void
}

export interface PdfMakeLike {
  createPdf: (docDefinition: TDocumentDefinitions) => PdfCreatedDocLike
  addVirtualFileSystem?: (vfs: Record<string, string>) => void
}

export class ReceiptPdfRenderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReceiptPdfRenderError'
  }
}

const CARD_BRAND_LABELS: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
}

// Strip BiDi formatting characters (LRM, RLM, ALM, embeddings, overrides, isolates).
const BIDI_CHAR_RE = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g
const STRONG_RTL_CHAR_RE = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/

const ARABIC_CANVAS_FONT_FAMILY = '"Noto Sans Arabic", "Segoe UI", Tahoma, Arial, sans-serif'

const RECEIPT_COPY: Record<ReceiptLocale, ReceiptCopyBlock> = {
  en: {
    title: 'Official Fine Payment Receipt',
    issuedBy: 'ParkAlert Municipal Parking Enforcement',
    paidBadge: 'PAID',
    paymentReference: 'Payment Reference',
    fineReference: 'Fine Reference',
    fineId: 'Fine ID',
    plateNumber: 'Vehicle Plate',
    issuedAt: 'Issued Date (UTC)',
    paidAt: 'Payment Date (UTC)',
    paymentChannel: 'Payment Channel',
    simulatedChannel: 'Simulated Card Payment',
    notes: 'Violation Notes',
    totalPaid: 'Total Paid',
    cardSectionTitle: 'Payment Method Summary',
    cardholder: 'Cardholder Name',
    cardNetwork: 'Card Network',
    cardLast4: 'Card Ending In',
    simulatedFooter: 'Issued electronically by ParkAlert. Simulated payment record for development and audit verification.',
  },
  fr: {
    title: 'Reçu Officiel de Paiement d\'Amende',
    issuedBy: 'ParkAlert — Contrôle du Stationnement',
    paidBadge: 'PAYÉE',
    paymentReference: 'Référence de Paiement',
    fineReference: 'Réf. Amende',
    fineId: 'Identifiant d\'Amende',
    plateNumber: 'Plaque d\'Immatriculation',
    issuedAt: 'Date d\'Émission (UTC)',
    paidAt: 'Date de Paiement (UTC)',
    paymentChannel: 'Canal de Paiement',
    simulatedChannel: 'Paiement par Carte Simulé',
    notes: 'Motif de l\'Infraction',
    totalPaid: 'Total Payé',
    cardSectionTitle: 'Détails du Moyen de Paiement',
    cardholder: 'Nom du Titulaire',
    cardNetwork: 'Réseau de Carte',
    cardLast4: 'Carte se terminant par',
    simulatedFooter: 'Émis électroniquement par ParkAlert. Paiement simulé à des fins de développement et de vérification.',
  },
}

export function resolveReceiptLocale(appLocale: string): ReceiptLocale {
  return appLocale === 'fr' ? 'fr' : 'en'
}

export function buildReceiptCopy(receiptLocale: ReceiptLocale): ReceiptCopyBlock {
  return { ...RECEIPT_COPY[receiptLocale] }
}

function stripControlsAndCollapseWhitespace(value: unknown): string {
  if (typeof value !== 'string') return ''
  const withoutBidi = value.replace(BIDI_CHAR_RE, '')
  let withoutControls = ''
  for (let i = 0; i < withoutBidi.length; i++) {
    const code = withoutBidi.charCodeAt(i)
    const isC0Control = code <= 0x1f
    const isC1Control = code >= 0x7f && code <= 0x9f
    if (!isC0Control && !isC1Control) {
      withoutControls += withoutBidi[i]
    }
  }
  return withoutControls.replace(/\s+/g, ' ').trim()
}

export function sanitizeReceiptText(value: unknown): string {
  const cleaned = stripControlsAndCollapseWhitespace(value)
  return cleaned.length > 0 ? cleaned : '—'
}

export function isPdfVectorSafeText(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    const isAsciiPrintable = code >= 0x20 && code <= 0x7e
    const isLatin1Printable = code >= 0xa0 && code <= 0xff
    const isSafePunctuation = code === 0x2014 || code === 0x2022 // Em dash '—' and bullet '•'
    if (!isAsciiPrintable && !isLatin1Printable && !isSafePunctuation) {
      return false
    }
  }
  return true
}

export function detectTextDirection(value: string): 'rtl' | 'ltr' {
  return STRONG_RTL_CHAR_RE.test(value) ? 'rtl' : 'ltr'
}

export function formatUtcReceiptTimestamp(timestampMs: unknown): string {
  if (typeof timestampMs !== 'number' || !Number.isFinite(timestampMs)) {
    return '—'
  }
  const date = new Date(timestampMs)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`
}

export function formatReceiptAmount(amount: unknown): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return '—'
  }
  return `TND ${amount.toFixed(2)}`
}

export function buildReceiptViewModel(
  fine: Fine,
  receiptSummary: FineReceiptSummary | null,
  appLocale: string,
): FineReceiptViewModel {
  const locale = resolveReceiptLocale(appLocale)
  const copy = buildReceiptCopy(locale)

  const fineId = sanitizeReceiptText(fine.id)
  const fineReference = fineId === '—' ? '—' : `#${fineId.slice(-6).toUpperCase()}`
  const paymentReference = sanitizeReceiptText(fine.paymentReference)
  const plateNumber = sanitizeReceiptText(fine.plateNumber)
  const issuedAtFormatted = formatUtcReceiptTimestamp(fine.issuedAt)
  const paidAtFormatted = formatUtcReceiptTimestamp(fine.paidAt)
  const amountFormatted = formatReceiptAmount(fine.amount)
  const paymentProviderLabel = fine.paymentProvider === 'simulated'
    ? copy.simulatedChannel
    : sanitizeReceiptText(fine.paymentProvider)

  const cleanedNotes = stripControlsAndCollapseWhitespace(fine.notes)
  const notes = cleanedNotes.length > 0 ? cleanedNotes : undefined

  const rows: ReceiptFieldRow[] = [
    { key: 'fineReference', label: copy.fineReference, value: fineReference },
    { key: 'fineId', label: copy.fineId, value: fineId },
    { key: 'plateNumber', label: copy.plateNumber, value: plateNumber },
    { key: 'issuedAt', label: copy.issuedAt, value: issuedAtFormatted },
    { key: 'paidAt', label: copy.paidAt, value: paidAtFormatted },
    { key: 'paymentChannel', label: copy.paymentChannel, value: paymentProviderLabel },
  ]

  if (notes) {
    rows.push({
      key: 'notes',
      label: copy.notes,
      value: notes,
      isolateAuto: true,
    })
  }

  let cardSummary: ReceiptCardSummaryView | undefined
  if (receiptSummary) {
    cardSummary = {
      cardholderName: sanitizeReceiptText(receiptSummary.cardholderName),
      cardBrand: receiptSummary.cardBrand,
      cardBrandLabel: CARD_BRAND_LABELS[receiptSummary.cardBrand] ?? sanitizeReceiptText(receiptSummary.cardBrand),
      cardLast4: sanitizeReceiptText(receiptSummary.cardLast4),
    }
  }

  return {
    locale,
    copy,
    statusLabel: copy.paidBadge,
    paymentReference,
    fineReference,
    fineId,
    plateNumber,
    issuedAtFormatted,
    paidAtFormatted,
    amountFormatted,
    paymentProviderLabel,
    notes,
    rows,
    cardSummary,
  }
}

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidthPx: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['—']

  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidthPx) {
      currentLine = candidate
      continue
    }

    if (currentLine) {
      lines.push(currentLine)
      currentLine = ''
    }

    if (ctx.measureText(word).width <= maxWidthPx) {
      currentLine = word
      continue
    }

    // Break an oversized unbroken token across characters so it fits the table cell.
    let chunk = ''
    for (const char of word) {
      const nextChunk = chunk + char
      if (chunk && ctx.measureText(nextChunk).width > maxWidthPx) {
        lines.push(chunk)
        chunk = char
      } else {
        chunk = nextChunk
      }
    }
    if (chunk) {
      currentLine = chunk
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines.length > 0 ? lines : ['—']
}

export async function renderTextSnippetPng(
  text: string,
  adapter?: CanvasSnippetAdapter,
): Promise<CanvasSnippetResult | null> {
  if (adapter) {
    return await adapter(text, {
      maxWidthPx: 280,
      fontSizePx: 11,
      fontFamily: ARABIC_CANVAS_FONT_FAMILY,
    })
  }

  if (typeof document === 'undefined') {
    return null
  }

  const maxWidthPx = 280
  const fontSizePx = 11
  const lineHeightPx = 16
  const paddingX = 2
  const paddingY = 2
  const fontSpec = `600 ${fontSizePx}px ${ARABIC_CANVAS_FONT_FAMILY}`

  try {
    await document.fonts?.load?.(fontSpec, text)
    await document.fonts?.ready
  } catch {
    // Proceed cleanly with available fonts if web-font loading fails offline.
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return null
  }

  ctx.font = fontSpec
  const direction = detectTextDirection(text)
  ctx.direction = direction

  const lines = wrapCanvasLines(ctx, text, maxWidthPx - paddingX * 2)
  let measuredMaxWidth = 0
  for (const line of lines) {
    measuredMaxWidth = Math.max(measuredMaxWidth, Math.ceil(ctx.measureText(line).width))
  }

  const logicalWidth = Math.min(maxWidthPx, Math.max(40, measuredMaxWidth + paddingX * 2))
  const logicalHeight = lines.length * lineHeightPx + paddingY * 2
  const dpr = Math.min(Math.max(window.devicePixelRatio || 2, 2), 3)

  canvas.width = Math.ceil(logicalWidth * dpr)
  canvas.height = Math.ceil(logicalHeight * dpr)

  const scaledCtx = canvas.getContext('2d')
  if (!scaledCtx) {
    return null
  }

  scaledCtx.scale(dpr, dpr)
  scaledCtx.fillStyle = '#ffffff'
  scaledCtx.fillRect(0, 0, logicalWidth, logicalHeight)

  scaledCtx.font = fontSpec
  scaledCtx.fillStyle = '#0f172a'
  scaledCtx.textBaseline = 'middle'
  scaledCtx.direction = direction
  scaledCtx.textAlign = direction === 'rtl' ? 'right' : 'left'

  const drawX = direction === 'rtl' ? logicalWidth - paddingX : paddingX
  lines.forEach((line, index) => {
    const drawY = paddingY + index * lineHeightPx + lineHeightPx / 2
    scaledCtx.fillText(line, drawX, drawY)
  })

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: logicalWidth,
    height: logicalHeight,
  }
}

async function renderPdfCellValue(
  value: string,
  canvasAdapter?: CanvasSnippetAdapter,
  options?: { bold?: boolean },
): Promise<TableCell> {
  if (isPdfVectorSafeText(value)) {
    return {
      text: value,
      fontSize: 10,
      bold: options?.bold ?? false,
      color: '#0f172a',
      alignment: 'right',
    }
  }

  const snippet = await renderTextSnippetPng(value, canvasAdapter)
  if (!snippet) {
    throw new ReceiptPdfRenderError('Failed to render non-WinAnsi receipt text on Canvas.')
  }

  return {
    image: snippet.dataUrl,
    width: Math.min(snippet.width, 280),
    alignment: 'right',
  }
}

export async function buildReceiptDocDefinition(
  viewModel: FineReceiptViewModel,
  canvasAdapter?: CanvasSnippetAdapter,
): Promise<TDocumentDefinitions> {
  const { copy } = viewModel

  const rowCells: TableCell[][] = []
  for (const row of viewModel.rows) {
    const valueCell = await renderPdfCellValue(row.value, canvasAdapter, {
      bold: row.key === 'plateNumber',
    })
    rowCells.push([
      {
        text: row.label,
        fontSize: 10,
        color: '#475569',
      },
      valueCell,
    ])
  }

  const content: Content[] = [
    {
      columns: [
        {
          stack: [
            { text: 'ParkAlert', fontSize: 22, bold: true, color: '#0f172a' },
            { text: copy.title, fontSize: 12, bold: true, color: '#047857', margin: [0, 2, 0, 0] },
            { text: copy.issuedBy, fontSize: 9, color: '#475569', margin: [0, 2, 0, 0] },
          ],
          width: '*',
        },
        {
          table: {
            body: [[
              {
                text: viewModel.statusLabel,
                bold: true,
                fontSize: 10,
                color: '#065f46',
                fillColor: '#d1fae5',
                margin: [8, 4, 8, 4],
              },
            ]],
          },
          layout: 'noBorders',
          width: 'auto',
        },
      ],
      margin: [0, 0, 0, 14],
    },
    {
      table: {
        widths: ['*', 'auto'],
        body: [[
          {
            stack: [
              { text: copy.paymentReference.toUpperCase(), fontSize: 8, bold: true, color: '#475569' },
              { text: viewModel.paymentReference, fontSize: 12, bold: true, color: '#0f172a', margin: [0, 3, 0, 0] },
            ],
            margin: [10, 8, 10, 8],
          },
          {
            stack: [
              { text: copy.totalPaid.toUpperCase(), fontSize: 8, bold: true, color: '#475569', alignment: 'right' },
              { text: viewModel.amountFormatted, fontSize: 16, bold: true, color: '#0f172a', alignment: 'right', margin: [0, 2, 0, 0] },
            ],
            margin: [10, 8, 10, 8],
          },
        ]],
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => '#cbd5e1',
        vLineColor: () => '#cbd5e1',
        fillColor: () => '#f8fafc',
      },
      margin: [0, 0, 0, 14],
    },
    {
      table: {
        widths: ['40%', '60%'],
        body: rowCells,
      },
      layout: {
        hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 1 : 0.5),
        vLineWidth: () => 0,
        hLineColor: () => '#e2e8f0',
        paddingTop: () => 7,
        paddingBottom: () => 7,
      },
      margin: [0, 0, 0, 16],
    },
  ]

  if (viewModel.cardSummary) {
    const cardholderCell = await renderPdfCellValue(
      viewModel.cardSummary.cardholderName,
      canvasAdapter,
      { bold: true },
    )

    content.push({
      text: copy.cardSectionTitle.toUpperCase(),
      fontSize: 9,
      bold: true,
      color: '#475569',
      margin: [0, 0, 0, 6],
    })

    content.push({
      table: {
        widths: ['40%', '60%'],
        body: [
          [
            { text: copy.cardholder, fontSize: 10, color: '#475569' },
            cardholderCell,
          ],
          [
            { text: copy.cardNetwork, fontSize: 10, color: '#475569' },
            { text: viewModel.cardSummary.cardBrandLabel, fontSize: 10, bold: true, color: '#0f172a', alignment: 'right' },
          ],
          [
            { text: copy.cardLast4, fontSize: 10, color: '#475569' },
            { text: `•••• ${viewModel.cardSummary.cardLast4}`, fontSize: 10, bold: true, color: '#0f172a', alignment: 'right' },
          ],
        ],
      },
      layout: {
        hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 1 : 0.5),
        vLineWidth: () => 0,
        hLineColor: () => '#e2e8f0',
        paddingTop: () => 6,
        paddingBottom: () => 6,
      },
      margin: [0, 0, 0, 18],
    })
  }

  content.push({
    text: copy.simulatedFooter,
    fontSize: 8,
    italics: true,
    color: '#64748b',
    alignment: 'center',
    margin: [0, 8, 0, 0],
  })

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    info: {
      title: `ParkAlert ${viewModel.paymentReference}`,
      author: 'ParkAlert',
      subject: copy.title,
    },
    content,
  }
}

export function sanitizeFilenameSegment(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, '')
  return cleaned.length > 0 ? cleaned : 'receipt'
}

export function resolvePdfMakeExport(mod: unknown): PdfMakeLike {
  let current: unknown = mod
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    const candidate = current as Partial<PdfMakeLike> & { default?: unknown }
    if (typeof candidate.createPdf === 'function') {
      return candidate as PdfMakeLike
    }
    if (candidate.default === undefined) {
      break
    }
    current = candidate.default
  }
  throw new ReceiptPdfRenderError('Failed to resolve pdfMake.createPdf from module export.')
}

function extractCleanVfsEntries(candidate: Record<string, unknown>): Record<string, string> | null {
  const cleaned: Record<string, string> = {}
  let count = 0
  for (const [key, value] of Object.entries(candidate)) {
    if (typeof value === 'string' && /\.(?:ttf|otf|woff2?)$/i.test(key)) {
      cleaned[key] = value
      count++
    }
  }
  return count > 0 ? cleaned : null
}

export function resolveVfsExport(mod: unknown): Record<string, string> | null {
  let current: unknown = mod
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    const record = current as Record<string, unknown>
    const directFonts = extractCleanVfsEntries(record)
    if (directFonts) {
      return directFonts
    }
    const nestedPdfMake = record.pdfMake
    if (nestedPdfMake && typeof nestedPdfMake === 'object') {
      const nestedVfs = (nestedPdfMake as { vfs?: unknown }).vfs
      if (nestedVfs && typeof nestedVfs === 'object') {
        const nestedFonts = extractCleanVfsEntries(nestedVfs as Record<string, unknown>)
        if (nestedFonts) {
          return nestedFonts
        }
      }
    }
    if (record.default === undefined) {
      break
    }
    current = record.default
  }
  return null
}

export async function loadPdfMake(): Promise<PdfMakeLike> {
  const [pdfMakeModule, vfsModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ])

  const pdfMake = resolvePdfMakeExport(pdfMakeModule)
  const vfs = resolveVfsExport(vfsModule)

  if (vfs && typeof pdfMake.addVirtualFileSystem === 'function') {
    pdfMake.addVirtualFileSystem(vfs)
  }

  return pdfMake
}

export async function downloadReceiptPdf(
  pdfMake: PdfMakeLike,
  viewModel: FineReceiptViewModel,
  filename?: string,
  canvasAdapter?: CanvasSnippetAdapter,
): Promise<void> {
  const docDefinition = await buildReceiptDocDefinition(viewModel, canvasAdapter)
  const resolvedFilename = filename ?? `parkalert-receipt-${sanitizeFilenameSegment(viewModel.paymentReference)}.pdf`
  const createdDoc = pdfMake.createPdf(docDefinition)

  if (typeof createdDoc.download === 'function') {
    await createdDoc.download(resolvedFilename)
    return
  }

  if (typeof createdDoc.getBlob === 'function' && typeof document !== 'undefined' && typeof URL?.createObjectURL === 'function') {
    const blob = await createdDoc.getBlob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = resolvedFilename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return
  }

  throw new ReceiptPdfRenderError('PDF download handler unavailable.')
}
