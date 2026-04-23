/**
 * exportDashboardPdf
 *
 * Captures every element with [data-pdf-section] on the page in DOM order,
 * then stitches them into a single A4-landscape PDF using jsPDF.
 *
 * Uses html-to-image (instead of html2canvas) which supports modern CSS
 * color functions like oklch() and lab() used by Tailwind v4.
 */

export interface PdfExportOptions {
  title?: string
  filename?: string
  /** Extra metadata rows printed in the page header */
  metadata?: Record<string, string>
  /** If provided, generates a tabular report at the end of the PDF. Keys are column headers, values are mapped cell values. */
  reportData?: Record<string, any>[]
}

export async function exportDashboardPdf(options: PdfExportOptions = {}) {
  const {
    title = "Governance Dashboard",
    filename = `Governance_Dashboard_${new Date().toISOString().split("T")[0]}.pdf`,
    metadata = {},
    reportData,
  } = options

  // Dynamic imports so heavy libs only load when needed
  const [htmlToImageModule, jsPDFModule, autoTableModule] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
    import("jspdf-autotable"),
  ])
  const { toPng } = htmlToImageModule
  const { jsPDF } = jsPDFModule
  const autoTable = autoTableModule.default || (autoTableModule as any).autoTable || autoTableModule

  // A4 landscape in mm
  const PAGE_W = 297
  const PAGE_H = 210
  const MARGIN = 10
  const HEADER_H = 14   // mm reserved for title row
  const FOOTER_H = 10   // mm reserved for footer info row
  const CONTENT_W = PAGE_W - MARGIN * 2
  const CONTENT_H = PAGE_H - MARGIN * 2 - HEADER_H - FOOTER_H

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

  // ── helper: draw branded page header ────────────────────────────────────────
  const drawHeader = () => {
    pdf.setFontSize(11)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(0, 70, 171)   // #0046ab
    pdf.text(title, MARGIN, MARGIN + 5)

    pdf.setDrawColor(220, 220, 220)
    pdf.line(MARGIN, MARGIN + 8, PAGE_W - MARGIN, MARGIN + 8)
  }

  // ── helper: draw footer with metadata info ───────────────────────────────────
  const drawFooter = (pageNum: number, totalPages: number) => {
    const footerY = PAGE_H - MARGIN - 3

    pdf.setDrawColor(220, 220, 220)
    pdf.line(MARGIN, footerY - 4, PAGE_W - MARGIN, footerY - 4)

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7.5)
    pdf.setTextColor(120, 120, 120)

    const metaEntries = Object.entries(metadata)
    const infoStr = [
      ...metaEntries.map(([k, v]) => `${k}: ${v}`),
      `Generated: ${new Date().toLocaleString()}`,
      `Page ${pageNum} of ${totalPages}`,
    ].join("   |   ")

    pdf.text(infoStr, PAGE_W - MARGIN, footerY, { align: "right" })
  }

  // ── collect sections ─────────────────────────────────────────────────────────
  const sections = Array.from(
    document.querySelectorAll<HTMLElement>("[data-pdf-section]")
  )

  if (sections.length === 0) {
    alert("No PDF sections found on the page.")
    return
  }

  // ── capture each section as a PNG data URL ───────────────────────────────────
  const images: { dataUrl: string; nativeW: number; nativeH: number }[] = []

  for (const el of sections) {
    // Temporarily remove overflow restrictions so full content is captured
    const origOverflow  = el.style.overflow
    const origMaxHeight = el.style.maxHeight
    const origHeight    = el.style.height
    el.style.overflow  = "visible"
    el.style.maxHeight = "none"
    el.style.height    = "auto"

    // Also expand inner scrollable containers
    const scrollables = el.querySelectorAll<HTMLElement>("*")
    const origStyles: { el: HTMLElement; overflow: string; maxHeight: string; height: string }[] = []
    scrollables.forEach(child => {
      const cs = window.getComputedStyle(child)
      if (cs.overflow === "auto" || cs.overflow === "scroll" ||
          cs.overflowY === "auto" || cs.overflowY === "scroll") {
        origStyles.push({ el: child, overflow: child.style.overflow, maxHeight: child.style.maxHeight, height: child.style.height })
        child.style.overflow  = "visible"
        child.style.maxHeight = "none"
        child.style.height    = "auto"
      }
    })

    let dataUrl: string
    try {
      dataUrl = await toPng(el, {
        quality: 1,
        pixelRatio: 2,    // 2× supersampling for crisp text
        backgroundColor: "#ffffff",
        skipFonts: false,
        // Give html-to-image enough time for fonts to load
        fetchRequestInit: { cache: "force-cache" },
      })
    } catch (err) {
      console.warn("html-to-image failed for a section, skipping:", err)
      // Restore styles before moving on
      el.style.overflow  = origOverflow
      el.style.maxHeight = origMaxHeight
      el.style.height    = origHeight
      origStyles.forEach(s => {
        s.el.style.overflow  = s.overflow
        s.el.style.maxHeight = s.maxHeight
        s.el.style.height    = s.height
      })
      continue
    }

    // Restore styles
    el.style.overflow  = origOverflow
    el.style.maxHeight = origMaxHeight
    el.style.height    = origHeight
    origStyles.forEach(s => {
      s.el.style.overflow  = s.overflow
      s.el.style.maxHeight = s.maxHeight
      s.el.style.height    = s.height
    })

    // Read actual pixel dimensions from the PNG via an Image element
    const img = new Image()
    await new Promise<void>(resolve => {
      img.onload = () => resolve()
      img.src = dataUrl
    })

    images.push({ dataUrl, nativeW: img.naturalWidth / 2, nativeH: img.naturalHeight / 2 })
  }

  if (images.length === 0) {
    alert("No sections could be captured. Please try again.")
    return
  }

  // ── layout: pack images across pages ────────────────────────────────────────
  type PageItem = {
    dataUrl: string
    x: number; y: number; w: number; h: number
  }
  const pages: PageItem[][] = []
  let currentPage: PageItem[] = []
  let cursorY = 0

  for (const { dataUrl, nativeW, nativeH } of images) {
    // Scale to fill CONTENT_W, preserving aspect ratio
    const scaledW = CONTENT_W
    const scaledH = (nativeH / nativeW) * scaledW

    if (scaledH > CONTENT_H) {
      // Section taller than a page → give it its own page, fit to height
      if (currentPage.length > 0) { pages.push(currentPage); currentPage = []; cursorY = 0 }
      const fitH = CONTENT_H
      const fitW = (nativeW / nativeH) * fitH
      pages.push([{
        dataUrl,
        x: MARGIN + (CONTENT_W - fitW) / 2,
        y: MARGIN + HEADER_H,
        w: fitW,
        h: fitH,
      }])
      continue
    }

    if (cursorY + scaledH > CONTENT_H) {
      // Doesn't fit on current page → flush and start new page
      pages.push(currentPage)
      currentPage = []
      cursorY = 0
    }

    currentPage.push({
      dataUrl,
      x: MARGIN,
      y: MARGIN + HEADER_H + cursorY,
      w: scaledW,
      h: scaledH,
    })
    cursorY += scaledH + 4   // 4 mm gap between sections
  }

  if (currentPage.length > 0) pages.push(currentPage)

  // ── render pages into PDF ───────────────────────────────────────────────────
  const totalPages = pages.length

  pages.forEach((items, pageIdx) => {
    if (pageIdx > 0) pdf.addPage()
    drawHeader()
    drawFooter(pageIdx + 1, totalPages)

    items.forEach(({ dataUrl, x, y, w, h }) => {
      pdf.addImage(dataUrl, "PNG", x, y, w, h, undefined, "FAST")
    })
  })

  // ── append standard data report if provided ─────────────────────────────────
  if (reportData && reportData.length > 0) {
    // 1. Filter out columns (keys) that have no data across all rows
    const allKeys = Object.keys(reportData[0])
    const activeKeys = allKeys.filter(key => {
      return reportData.some(row => {
        const val = row[key]
        return val !== null && val !== undefined && val !== "" && val !== "—"
      })
    })

    if (activeKeys.length > 0) {
      pdf.addPage()
      
      const tableHeaders = activeKeys
      const tableRows = reportData.map(row => activeKeys.map(key => row[key] ?? "—"))
      
      let tablePageNum = totalPages + 1

      // Use autoTable to render the grid
      autoTable(pdf, {
        head: [tableHeaders],
        body: tableRows,
        startY: MARGIN + HEADER_H,
        margin: { top: MARGIN + HEADER_H, bottom: MARGIN + FOOTER_H, left: MARGIN, right: MARGIN },
        styles: { fontSize: 7, textColor: [60,60,60], cellPadding: 2 },
        headStyles: { fillColor: [0, 70, 171], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        didDrawPage: (data: any) => {
          drawHeader()
          // Passing arbitrary large total for now to let user know it's an appendix
          drawFooter(tablePageNum, totalPages + data.pageCount) 
          tablePageNum++
        }
      })
    }
  }

  pdf.save(filename)
}
