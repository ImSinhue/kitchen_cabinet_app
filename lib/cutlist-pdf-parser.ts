/**
 * CutList PDF Parser — pure parsing logic (no Expo / native deps)
 *
 * Parses PDF content streams exported from CutList Optimizer and extracts:
 * - Boards (large rectangles representing plywood sheets)
 * - Pieces (smaller colored rectangles within each board)
 * - Text labels (dimensions/IDs printed on pieces)
 *
 * Entry point for raw bytes: parsePDFBytes(bytes: Uint8Array, inflate?)
 * For on-device file loading, use parsePDFFile() from lib/pdf-file-reader.ts.
 */

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface CutPiece {
  /** Unique identifier within a board */
  id: string;
  /** Text label extracted from PDF (may contain dimensions like "450 x 300") */
  label?: string;
  /** Position X in PDF coordinate units */
  x: number;
  /** Position Y in PDF coordinate units (origin at bottom-left) */
  y: number;
  /** Width in PDF coordinate units */
  width: number;
  /** Height in PDF coordinate units */
  height: number;
  /** CSS hex colour string e.g. "#e6553a" */
  color: string;
  /** Runtime state: has this piece been marked as cut? */
  isCut: boolean;
}

export interface ParsedBoard {
  /** Unique identifier */
  id: string;
  /** 1-based page number in the PDF */
  pageNumber: number;
  /** Board bounding-box in PDF units */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Pieces found inside this board */
  pieces: CutPiece[];
  /** Percentage of board area covered by pieces (0-100) */
  utilizationPercent: number;
}

export interface ParseResult {
  boards: ParsedBoard[];
  /** Localised error message, present only on failure */
  error?: string;
}

// ─── Internal Types ───────────────────────────────────────────────────────────

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

interface RawRect {
  x: number;
  y: number;
  w: number;
  h: number;
  fillColor: RGBColor | null;
  strokeColor: RGBColor | null;
}

interface TextItem {
  text: string;
  x: number;
  y: number;
}

interface ContentParseResult {
  rects: RawRect[];
  texts: TextItem[];
}

interface PDFStream {
  data: Uint8Array;
  filter: string | null;
}

/** Graphics state used inside parseContentStream */
interface GraphicsState {
  fillColor: RGBColor;
  strokeColor: RGBColor;
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

/**
 * Parse raw PDF bytes and return boards with pieces.
 *
 * @param bytes   - Raw PDF file bytes (Uint8Array).
 * @param inflate - Optional zlib inflate function (e.g. pako.inflate).
 *                  When provided, FlateDecode streams are decompressed.
 *                  When omitted, compressed streams are skipped.
 */
export function parsePDFBytes(
  bytes: Uint8Array,
  inflate?: (data: Uint8Array) => Uint8Array
): ParseResult {
  try {
    const streams = extractPDFStreams(bytes);

    if (streams.length === 0) {
      return {
        boards: [],
        error: "No se encontraron flujos de contenido en el PDF.",
      };
    }

    const allBoards: ParsedBoard[] = [];
    let boardCounter = 0;

    for (let streamIdx = 0; streamIdx < streams.length; streamIdx++) {
      const stream = streams[streamIdx];
      let streamText: string;
      try {
        let data = stream.data;
        if (stream.filter === "FlateDecode" && inflate) {
          data = inflate(data);
        } else if (stream.filter === "FlateDecode" && !inflate) {
          continue; // can't decompress without inflate function
        }
        streamText = bytesToLatin1(data);
      } catch {
        continue;
      }

      const { rects, texts } = parseContentStream(streamText);
      if (rects.length < 2) continue;

      const pageBoards = identifyBoardsAndPieces(
        rects,
        texts,
        streamIdx + 1,
        boardCounter
      );
      if (pageBoards.length > 0) {
        boardCounter += pageBoards.length;
        allBoards.push(...pageBoards);
      }
    }

    if (allBoards.length === 0) {
      return {
        boards: [],
        error:
          "No se detectaron tableros ni piezas. Asegúrese de usar un PDF de CutList Optimizer con layout vectorial.",
      };
    }

    return { boards: allBoards };
  } catch (err) {
    return {
      boards: [],
      error: `Error al analizar el PDF: ${String(err)}`,
    };
  }
}

// ─── Byte Utilities ───────────────────────────────────────────────────────────

function bytesToLatin1(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("latin1").decode(bytes);
  }
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i]);
  }
  return s;
}

// ─── Stream Extraction ────────────────────────────────────────────────────────

/**
 * Find all stream…endstream segments in a PDF byte array.
 * Reads the preceding dictionary to detect /Filter and /Length.
 */
function extractPDFStreams(bytes: Uint8Array): PDFStream[] {
  const latin1 = bytesToLatin1(bytes);
  const result: PDFStream[] = [];
  let pos = 0;

  while (pos < latin1.length) {
    const idx1 = latin1.indexOf("\nstream\r\n", pos);
    const idx2 = latin1.indexOf("\nstream\n", pos);

    if (idx1 === -1 && idx2 === -1) break;

    let streamKeyEnd: number;
    let dataStart: number;

    if (idx1 !== -1 && (idx2 === -1 || idx1 <= idx2)) {
      streamKeyEnd = idx1 + 1;
      dataStart = idx1 + 9; // '\nstream\r\n' = 9 chars
    } else {
      streamKeyEnd = idx2 + 1;
      dataStart = idx2 + 8; // '\nstream\n' = 8 chars
    }

    // Find the dictionary preceding this stream keyword
    const lastDictOpen = latin1.lastIndexOf("<<", streamKeyEnd);
    const dictText =
      lastDictOpen !== -1 ? latin1.slice(lastDictOpen, streamKeyEnd) : "";

    // Extract /Filter (single value)
    const filterMatch = dictText.match(/\/Filter\s*\/(\w+)/);
    const filter = filterMatch ? filterMatch[1] : null;

    // Extract /Length (direct integer only, not indirect reference)
    const lengthMatch = dictText.match(/\/Length\s+(\d+)\b(?!\s*\d+\s+R)/);
    const length = lengthMatch ? parseInt(lengthMatch[1], 10) : -1;

    // Find end of stream
    let dataEnd: number;
    if (length > 0 && dataStart + length < latin1.length) {
      dataEnd = dataStart + length;
    } else {
      const endIdx = latin1.indexOf("endstream", dataStart);
      if (endIdx === -1) break;
      dataEnd = latin1[endIdx - 2] === "\r" ? endIdx - 2 : endIdx - 1;
      if (dataEnd <= dataStart) dataEnd = endIdx;
    }

    const data = bytes.slice(dataStart, dataEnd);
    if (data.length > 50) {
      result.push({ data, filter });
    }

    pos = dataStart + Math.max(data.length, 1);
  }

  return result;
}

// ─── Content Stream Parser ────────────────────────────────────────────────────

/**
 * Parse PDF drawing operators from a decoded content stream.
 * Returns all rectangle drawings and text items found.
 */
export function parseContentStream(streamText: string): ContentParseResult {
  const tokens = tokenize(streamText);
  const rects: RawRect[] = [];
  const texts: TextItem[] = [];

  const operandStack: (string | number)[] = [];
  let currentPath: { x: number; y: number; w: number; h: number }[] = [];

  const gsStack: GraphicsState[] = [
    {
      fillColor: { r: 0, g: 0, b: 0 },
      strokeColor: { r: 0, g: 0, b: 0 },
    },
  ];

  let inTextBlock = false;
  let textX = 0;
  let textY = 0;
  let textLineX = 0;
  let textLineY = 0;

  const gs = () => gsStack[gsStack.length - 1];
  const popNum = () => Number(operandStack.pop() ?? 0);
  const popStr = () => String(operandStack.pop() ?? "");

  for (const token of tokens) {
    // ── Text block delimiters ────────────────────────────────────────────
    if (token === "BT") {
      inTextBlock = true;
      textX = 0;
      textY = 0;
      textLineX = 0;
      textLineY = 0;
      operandStack.length = 0;
      continue;
    }
    if (token === "ET") {
      inTextBlock = false;
      operandStack.length = 0;
      continue;
    }

    if (inTextBlock) {
      switch (token) {
        case "Td":
        case "TD": {
          const dy = popNum();
          const dx = popNum();
          textLineX += dx;
          textLineY += dy;
          textX = textLineX;
          textY = textLineY;
          break;
        }
        case "Tm": {
          // a b c d e f Tm  (6 numbers)
          const f = popNum();
          const e = popNum();
          popNum(); // d
          popNum(); // c
          popNum(); // b
          popNum(); // a
          textX = e;
          textY = f;
          textLineX = e;
          textLineY = f;
          break;
        }
        case "T*": {
          textY -= 12; // approximate line height
          break;
        }
        case "Tj": {
          const decoded = decodePDFString(popStr());
          if (decoded.trim()) {
            texts.push({ text: decoded.trim(), x: textX, y: textY });
          }
          break;
        }
        case "TJ": {
          const parts: string[] = [];
          while (operandStack.length > 0) {
            const top = operandStack[operandStack.length - 1];
            if (typeof top === "string" && top.startsWith("(")) {
              parts.unshift(decodePDFString(String(operandStack.pop())));
            } else if (typeof top === "number") {
              operandStack.pop(); // kerning offset
            } else {
              break;
            }
          }
          const combined = parts.join("").trim();
          if (combined) {
            texts.push({ text: combined, x: textX, y: textY });
          }
          break;
        }
        case "'":
        case '"': {
          const raw = popStr();
          if (token === '"') {
            popNum();
            popNum();
          }
          textY -= 12;
          const decoded = decodePDFString(raw);
          if (decoded.trim()) {
            texts.push({ text: decoded.trim(), x: textX, y: textY });
          }
          break;
        }
        default:
          pushOperand(token, operandStack);
          break;
      }
      continue;
    }

    // ── Graphics state & path operators ─────────────────────────────────
    switch (token) {
      case "q":
        gsStack.push({
          fillColor: { ...gs().fillColor },
          strokeColor: { ...gs().strokeColor },
        });
        break;

      case "Q":
        if (gsStack.length > 1) gsStack.pop();
        break;

      case "rg": {
        const b = popNum();
        const g2 = popNum();
        const r = popNum();
        gs().fillColor = { r, g: g2, b };
        break;
      }
      case "RG": {
        const b = popNum();
        const g2 = popNum();
        const r = popNum();
        gs().strokeColor = { r, g: g2, b };
        break;
      }
      case "g": {
        const gray = popNum();
        gs().fillColor = { r: gray, g: gray, b: gray };
        break;
      }
      case "G": {
        const gray = popNum();
        gs().strokeColor = { r: gray, g: gray, b: gray };
        break;
      }
      case "k": {
        const k2 = popNum();
        const y2 = popNum();
        const m = popNum();
        const c = popNum();
        gs().fillColor = cmykToRgb(c, m, y2, k2);
        break;
      }
      case "K": {
        const k2 = popNum();
        const y2 = popNum();
        const m = popNum();
        const c = popNum();
        gs().strokeColor = cmykToRgb(c, m, y2, k2);
        break;
      }
      case "cs":
      case "CS":
        operandStack.pop();
        break;

      case "sc":
      case "scn": {
        if (operandStack.length >= 3) {
          const b = popNum();
          const g2 = popNum();
          const r = popNum();
          gs().fillColor = { r, g: g2, b };
        }
        break;
      }
      case "SC":
      case "SCN": {
        if (operandStack.length >= 3) {
          const b = popNum();
          const g2 = popNum();
          const r = popNum();
          gs().strokeColor = { r, g: g2, b };
        }
        break;
      }

      case "re": {
        const h = popNum();
        const w = popNum();
        const y2 = popNum();
        const x = popNum();
        currentPath.push({ x, y: y2, w, h });
        break;
      }
      case "m":
      case "l": {
        // moveto / lineto: consume x, y
        popNum();
        popNum();
        break;
      }
      case "c": {
        // Bézier curve: 3 control points × 2 coordinates = 6 values
        for (let i = 0; i < 6; i++) popNum();
        break;
      }
      case "v":
      case "y": {
        // Bézier with one implicit control point: 2 control points × 2 = 4 values
        for (let i = 0; i < 4; i++) popNum();
        break;
      }

      case "f":
      case "f*": {
        for (const r of currentPath) {
          if (r.w > 1 && r.h > 1) {
            rects.push({ x: r.x, y: r.y, w: r.w, h: r.h, fillColor: { ...gs().fillColor }, strokeColor: null });
          }
        }
        currentPath = [];
        break;
      }
      case "S": {
        for (const r of currentPath) {
          if (r.w > 1 && r.h > 1) {
            rects.push({ x: r.x, y: r.y, w: r.w, h: r.h, fillColor: null, strokeColor: { ...gs().strokeColor } });
          }
        }
        currentPath = [];
        break;
      }
      case "B":
      case "B*": {
        for (const r of currentPath) {
          if (r.w > 1 && r.h > 1) {
            rects.push({ x: r.x, y: r.y, w: r.w, h: r.h, fillColor: { ...gs().fillColor }, strokeColor: { ...gs().strokeColor } });
          }
        }
        currentPath = [];
        break;
      }
      case "n":
      case "W":
      case "W*":
        currentPath = [];
        break;

      case "cm":
        // Transformation matrix: 6 values (a b c d e f)
        for (let i = 0; i < 6; i++) popNum();
        break;

      default:
        pushOperand(token, operandStack);
        break;
    }
  }

  return { rects, texts };
}

// ─── PDF Tokeniser ────────────────────────────────────────────────────────────

/**
 * Tokenise a PDF content stream into atomic tokens.
 */
export function tokenize(stream: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = stream.length;

  while (i < len) {
    const ch = stream[i];

    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n" || ch === "\f") {
      i++;
      continue;
    }

    if (ch === "%") {
      while (i < len && stream[i] !== "\n" && stream[i] !== "\r") i++;
      continue;
    }

    if (ch === "(") {
      let j = i + 1;
      let depth = 1;
      while (j < len && depth > 0) {
        if (stream[j] === "\\" && j + 1 < len) {
          j += 2;
        } else {
          if (stream[j] === "(") depth++;
          else if (stream[j] === ")") depth--;
          j++;
        }
      }
      tokens.push(stream.slice(i, j));
      i = j;
      continue;
    }

    if (ch === "<") {
      if (stream[i + 1] === "<") {
        tokens.push("<<");
        i += 2;
      } else {
        let j = i + 1;
        while (j < len && stream[j] !== ">") j++;
        tokens.push(stream.slice(i, j + 1));
        i = j + 1;
      }
      continue;
    }

    if (ch === ">" && stream[i + 1] === ">") {
      tokens.push(">>");
      i += 2;
      continue;
    }

    if (ch === "[" || ch === "]") {
      tokens.push(ch);
      i++;
      continue;
    }

    if (ch === "/") {
      let j = i + 1;
      while (j < len && !/[\s/<>\[\]{}()]/.test(stream[j])) j++;
      tokens.push(stream.slice(i, j));
      i = j;
      continue;
    }

    let j = i;
    while (j < len && !/[\s/<>\[\]{}()%]/.test(stream[j])) j++;
    if (j > i) {
      tokens.push(stream.slice(i, j));
      i = j;
    } else {
      i++;
    }
  }

  return tokens;
}

// ─── Board / Piece Detection ──────────────────────────────────────────────────

function identifyBoardsAndPieces(
  rects: RawRect[],
  texts: TextItem[],
  pageNumber: number,
  boardCounterStart: number
): ParsedBoard[] {
  const filled = rects.filter((r) => r.fillColor !== null && r.w > 5 && r.h > 5);
  if (filled.length === 0) return [];

  const sorted = [...filled].sort((a, b) => b.w * b.h - a.w * a.h);

  const boards: ParsedBoard[] = [];
  const usedAsBoard = new Set<number>();
  const usedAsPiece = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (usedAsPiece.has(i)) continue;
    const candidate = sorted[i];

    const inside: number[] = [];
    for (let j = 0; j < sorted.length; j++) {
      if (i === j || usedAsBoard.has(j)) continue;
      const r = sorted[j];
      if (
        r.x >= candidate.x - 1 &&
        r.y >= candidate.y - 1 &&
        r.x + r.w <= candidate.x + candidate.w + 1 &&
        r.y + r.h <= candidate.y + candidate.h + 1 &&
        r.w * r.h < candidate.w * candidate.h * 0.95
      ) {
        inside.push(j);
      }
    }

    if (inside.length >= 1) {
      usedAsBoard.add(i);
      inside.forEach((j) => usedAsPiece.add(j));

      const pieces: CutPiece[] = inside.map((j, idx) => {
        const pr = sorted[j];
        const color = pr.fillColor ? rgbToHex(pr.fillColor) : "#888888";
        return {
          id: `p${boards.length + boardCounterStart}_${idx + 1}`,
          label: findNearestText(pr, texts) ?? undefined,
          x: pr.x,
          y: pr.y,
          width: pr.w,
          height: pr.h,
          color,
          isCut: false,
        };
      });

      const piecesArea = pieces.reduce((s, p) => s + p.width * p.height, 0);
      const boardArea = candidate.w * candidate.h;
      const utilization = boardArea > 0 ? Math.min(100, (piecesArea / boardArea) * 100) : 0;

      boards.push({
        id: `board${boards.length + boardCounterStart + 1}`,
        pageNumber,
        x: candidate.x,
        y: candidate.y,
        width: candidate.w,
        height: candidate.h,
        pieces,
        utilizationPercent: Math.round(utilization * 10) / 10,
      });
    }
  }

  // Fallback when containment detection fails
  if (boards.length === 0 && sorted.length >= 2) {
    const board = sorted[0];
    const pieces: CutPiece[] = sorted.slice(1).map((pr, idx) => ({
      id: `p${boardCounterStart}_${idx + 1}`,
      label: findNearestText(pr, texts) ?? undefined,
      x: pr.x,
      y: pr.y,
      width: pr.w,
      height: pr.h,
      color: pr.fillColor ? rgbToHex(pr.fillColor) : "#888888",
      isCut: false,
    }));

    const piecesArea = pieces.reduce((s, p) => s + p.width * p.height, 0);
    const boardArea = board.w * board.h;
    const utilization = boardArea > 0 ? Math.min(100, (piecesArea / boardArea) * 100) : 0;

    boards.push({
      id: `board${boardCounterStart + 1}`,
      pageNumber,
      x: board.x,
      y: board.y,
      width: board.w,
      height: board.h,
      pieces,
      utilizationPercent: Math.round(utilization * 10) / 10,
    });
  }

  return boards;
}

function findNearestText(
  rect: { x: number; y: number; w: number; h: number },
  texts: TextItem[]
): string | null {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const maxDist = Math.max(rect.w, rect.h) * 1.5;

  let best: TextItem | null = null;
  let bestDist = Infinity;

  for (const t of texts) {
    if (!/\d/.test(t.text)) continue;
    const dx = t.x - cx;
    const dy = t.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < maxDist && dist < bestDist) {
      bestDist = dist;
      best = t;
    }
  }

  return best ? best.text : null;
}

// ─── Colour Helpers ───────────────────────────────────────────────────────────

function rgbToHex(c: RGBColor): string {
  const clamp = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, "0");
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}

function cmykToRgb(c: number, m: number, y: number, k: number): RGBColor {
  return {
    r: (1 - c) * (1 - k),
    g: (1 - m) * (1 - k),
    b: (1 - y) * (1 - k),
  };
}

/** Decode a PDF literal string token "(…)" to plain text */
function decodePDFString(token: string): string {
  if (!token.startsWith("(")) return token;
  const inner = token.slice(1, -1);
  let result = "";
  let i = 0;
  while (i < inner.length) {
    if (inner[i] === "\\" && i + 1 < inner.length) {
      const esc = inner[i + 1];
      const escMap: Record<string, string> = {
        n: "\n", r: "\r", t: "\t", b: "\b", f: "\f",
        "(": "(", ")": ")", "\\": "\\",
      };
      if (esc in escMap) {
        result += escMap[esc];
        i += 2;
      } else if (/[0-7]/.test(esc)) {
        let oct = "";
        for (let digitIdx = 0; digitIdx < 3 && i + 1 + digitIdx < inner.length && /[0-7]/.test(inner[i + 1 + digitIdx]); digitIdx++) {
          oct += inner[i + 1 + digitIdx];
        }
        result += String.fromCharCode(parseInt(oct, 8));
        i += 1 + oct.length;
      } else {
        result += esc;
        i += 2;
      }
    } else {
      result += inner[i];
      i++;
    }
  }
  return result;
}

/** Push numeric/string/name operands onto the operand stack */
function pushOperand(token: string, stack: (string | number)[]): void {
  if (token === "") return;
  const num = Number(token);
  if (!isNaN(num)) {
    stack.push(num);
  } else if (token.startsWith("(") || token.startsWith("<")) {
    stack.push(token);
  } else if (token.startsWith("/")) {
    stack.push(token);
  }
}
