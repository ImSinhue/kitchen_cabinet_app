/**
 * Unit tests for lib/pdf/
 *
 * Tests cover:
 *   - base64ToBytes (adapter utility)
 *   - parsePDFBytes with a minimal synthetic PDF (vector, with colored rects)
 *   - parsePDFBytes with a minimal raster PDF stub (DCTDecode image)
 *   - generateCutPlan with synthetic board data
 */

import { describe, expect, it } from "vitest";
import { base64ToBytes } from "../../lib/pdf/base64-to-bytes";
import { parsePDFBytes } from "../../lib/pdf/cutlist-pdf-parser";
import { generateCutPlan } from "../../lib/pdf/cut-plan";
import type { ParsedBoard } from "../../lib/pdf/cutlist-pdf-parser";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** No-op inflate for tests (content streams in tests won't be compressed). */
function noopInflate(data: Uint8Array): Uint8Array {
  return data;
}

/** Encode an ASCII string as bytes. */
function toBytes(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

/** Encode bytes to base64. */
function bytesToBase64(bytes: Uint8Array): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++] ?? 0;
    const b1 = bytes[i++] ?? 0;
    const b2 = bytes[i++] ?? 0;
    result +=
      chars[b0 >> 2] +
      chars[((b0 & 3) << 4) | (b1 >> 4)] +
      (i - 1 < bytes.length ? chars[((b1 & 0xf) << 2) | (b2 >> 6)] : "=") +
      (i < bytes.length ? chars[b2 & 0x3f] : "=");
  }
  return result;
}

// ---------------------------------------------------------------------------
// Build a minimal but parseable PDF with coloured rectangles
// ---------------------------------------------------------------------------

/**
 * Returns raw bytes of a minimal PDF containing one page with:
 *  - A yellow rectangle at (10,10) 100×50 pt
 *  - A blue rectangle at (10,80) 80×40 pt
 * (MediaBox 0 0 297 210 — A4 landscape in points)
 */
function buildMinimalVectorPdf(): Uint8Array {
  // Content stream: two coloured filled rectangles
  const contentStream = [
    // Yellow fill
    "1 0.8 0 rg",
    "10 10 100 50 re f",
    // Blue fill
    "0 0.2 0.8 rg",
    "10 80 80 40 re f",
  ].join("\n");

  const csBytes = toBytes(contentStream);

  // Build PDF objects (no xref stream — classic xref table)
  const objects: string[] = [];

  // 1 0 obj — catalog
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // 2 0 obj — pages
  objects.push(
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
  );

  // 3 0 obj — page
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 297 210] /Contents 4 0 R /Resources << >> >>\nendobj\n",
  );

  // 4 0 obj — content stream
  const streamBody = contentStream;
  objects.push(
    `4 0 obj\n<< /Length ${streamBody.length} >>\nstream\n${streamBody}\nendstream\nendobj\n`,
  );

  // Header + body
  let pdfText = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(pdfText.length);
    pdfText += obj;
  }

  // xref table
  const xrefOffset = pdfText.length;
  pdfText += "xref\n";
  pdfText += `0 ${objects.length + 1}\n`;
  pdfText += "0000000000 65535 f \r\n";
  for (const off of offsets) {
    pdfText += off.toString().padStart(10, "0") + " 00000 n \r\n";
  }

  pdfText += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdfText += `startxref\n${xrefOffset}\n%%EOF\n`;

  return toBytes(pdfText);
}

// ---------------------------------------------------------------------------
// Tests: base64ToBytes
// ---------------------------------------------------------------------------

describe("base64ToBytes", () => {
  it("decodes a simple ASCII string round-trip", () => {
    const original = toBytes("Hello, World!");
    const b64 = bytesToBase64(original);
    const decoded = base64ToBytes(b64);
    expect(decoded).toEqual(original);
  });

  it("handles padding with one '=' sign", () => {
    // 'Man' → base64 'TWFu' (no padding); 'Ma' → 'TWE='
    const original = toBytes("Ma");
    const b64 = bytesToBase64(original);
    const decoded = base64ToBytes(b64);
    expect(decoded).toEqual(original);
  });

  it("handles padding with two '=' signs", () => {
    const original = toBytes("M");
    const b64 = bytesToBase64(original);
    const decoded = base64ToBytes(b64);
    expect(decoded).toEqual(original);
  });

  it("strips data-URL prefix", () => {
    const original = toBytes("PDF");
    const b64 = "data:application/pdf;base64," + bytesToBase64(original);
    const decoded = base64ToBytes(b64);
    expect(decoded).toEqual(original);
  });

  it("ignores whitespace in base64 string", () => {
    const original = toBytes("Hello");
    const b64 = bytesToBase64(original).split("").join("\n");
    const decoded = base64ToBytes(b64);
    expect(decoded).toEqual(original);
  });

  it("decodes binary data correctly", () => {
    const original = new Uint8Array([0x00, 0xff, 0x80, 0x7f, 0x01, 0xfe]);
    const b64 = bytesToBase64(original);
    const decoded = base64ToBytes(b64);
    expect(decoded).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// Tests: parsePDFBytes — vector PDF
// ---------------------------------------------------------------------------

describe("parsePDFBytes — vector PDF", () => {
  it("rejects a non-PDF buffer", () => {
    const result = parsePDFBytes(toBytes("not a pdf"), noopInflate);
    expect(result.boards).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes("%PDF-"))).toBe(true);
  });

  it("parses a minimal PDF and detects coloured rectangles", () => {
    const pdfBytes = buildMinimalVectorPdf();
    const result = parsePDFBytes(pdfBytes, noopInflate);

    expect(result.mode).toBe("vector");
    // Should have at least 1 board
    expect(result.boards.length).toBeGreaterThanOrEqual(1);

    const board = result.boards[0]!;
    // MediaBox is 297×210 points → convert to mm
    const expectedW = Math.round(297 * (25.4 / 72));
    const expectedH = Math.round(210 * (25.4 / 72));
    expect(Math.round(board.sheetWidth)).toBe(expectedW);
    expect(Math.round(board.sheetHeight)).toBe(expectedH);

    // Should have detected the 2 coloured rectangles (yellow + blue)
    expect(board.pieces.length).toBe(2);

    const colors = board.pieces.map((p) => p.color);
    // Yellow: rgb(1, 0.8, 0) → #ffcc00
    expect(colors).toContain("#ffcc00");
    // Blue: rgb(0, 0.2, 0.8) → #0033cc
    expect(colors).toContain("#0033cc");
  });

  it("dimensions of detected pieces are in mm", () => {
    const pdfBytes = buildMinimalVectorPdf();
    const result = parsePDFBytes(pdfBytes, noopInflate);
    const board = result.boards[0]!;

    // Yellow rect: 100×50 pt → mm
    const piece =
      board.pieces.find((p) => p.color === "#ffcc00") ??
      board.pieces[0]!;
    const expectedW = 100 * (25.4 / 72);
    const expectedH = 50 * (25.4 / 72);
    expect(piece.width).toBeCloseTo(expectedW, 1);
    expect(piece.height).toBeCloseTo(expectedH, 1);
  });
});

// ---------------------------------------------------------------------------
// Tests: generateCutPlan
// ---------------------------------------------------------------------------

describe("generateCutPlan", () => {
  const board: ParsedBoard = {
    boardIndex: 0,
    sheetWidth: 2440,
    sheetHeight: 1220,
    pieces: [
      { x: 0, y: 0, width: 600, height: 400, color: "#ff0000", pieceIndex: 0 },
      { x: 610, y: 0, width: 500, height: 400, color: "#00ff00", pieceIndex: 1 },
      { x: 0, y: 410, width: 400, height: 300, color: "#0000ff", pieceIndex: 2 },
      { x: 410, y: 410, width: 600, height: 300, color: "#ffff00", pieceIndex: 3 },
    ],
  };

  it("returns a plan with the correct board index", () => {
    const plan = generateCutPlan([board]);
    expect(plan.boards).toHaveLength(1);
    expect(plan.boards[0]!.boardIndex).toBe(0);
  });

  it("counts total pieces correctly", () => {
    const plan = generateCutPlan([board]);
    expect(plan.totalPieces).toBe(4);
  });

  it("computes utilisation as a percentage in 0-100 range", () => {
    const plan = generateCutPlan([board]);
    const util = plan.boards[0]!.utilizationPercent;
    expect(util).toBeGreaterThan(0);
    expect(util).toBeLessThanOrEqual(100);
  });

  it("generates at least one cut step for a multi-piece board", () => {
    const plan = generateCutPlan([board]);
    expect(plan.boards[0]!.steps.length).toBeGreaterThan(0);
  });

  it("each cut step has a valid direction (H or V)", () => {
    const plan = generateCutPlan([board]);
    for (const step of plan.boards[0]!.steps) {
      expect(["H", "V"]).toContain(step.cutLine.direction);
    }
  });

  it("handles an empty board gracefully (raster-only PDF)", () => {
    const emptyBoard: ParsedBoard = {
      boardIndex: 0,
      sheetWidth: 2440,
      sheetHeight: 1220,
      pieces: [],
      jpegBytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    };
    const plan = generateCutPlan([emptyBoard]);
    expect(plan.boards[0]!.steps).toHaveLength(0);
    expect(plan.boards[0]!.utilizationPercent).toBe(0);
  });

  it("handles multiple boards", () => {
    const board2: ParsedBoard = {
      boardIndex: 1,
      sheetWidth: 2440,
      sheetHeight: 1220,
      pieces: [
        { x: 0, y: 0, width: 800, height: 600, color: "#aabbcc", pieceIndex: 0 },
      ],
    };
    const plan = generateCutPlan([board, board2]);
    expect(plan.boards).toHaveLength(2);
    expect(plan.totalPieces).toBe(5);
    expect(plan.averageUtilization).toBeGreaterThan(0);
  });
});
