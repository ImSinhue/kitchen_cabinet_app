/**
 * CutList PDF Parser
 *
 * Pure-TypeScript parser for CutList Optimizer PDFs.
 * Supports:
 *   - Vector PDFs: extracts colored rectangles from PDF content streams
 *     (operators: re/f/S, rg/RG/k/K/g/G/cs/CS/scn/SCN)
 *   - Raster PDFs: extracts DCTDecode (JPEG) image XObjects for display
 *
 * No Node.js-specific APIs used — works in React Native / Expo (Hermes).
 *
 * @param bytes   - Raw PDF bytes (Uint8Array)
 * @param inflate - FlateDecode decompressor (e.g. pako.inflate)
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CutPiece {
  /** X position in mm (lower-left origin) */
  x: number;
  /** Y position in mm (lower-left origin) */
  y: number;
  /** Width in mm */
  width: number;
  /** Height in mm */
  height: number;
  /** CSS-style hex colour string, e.g. "#a8d8a8" */
  color: string;
  /** Optional label extracted from PDF text (Tj/TJ operators) */
  label?: string;
  /** Original piece index within its board */
  pieceIndex: number;
}

export interface ParsedBoard {
  /** Board index (0-based) */
  boardIndex: number;
  /** Board width in mm */
  sheetWidth: number;
  /** Board height in mm */
  sheetHeight: number;
  /** Pieces placed on this board */
  pieces: CutPiece[];
  /**
   * When the PDF is purely raster, this contains the raw JPEG bytes
   * so the UI can display them directly.
   */
  jpegBytes?: Uint8Array;
}

export interface ParseResult {
  boards: ParsedBoard[];
  /** "vector" if graphic operators were found, "raster" otherwise */
  mode: "vector" | "raster";
  /** Human-readable warning messages */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Decode a sequence of bytes to an ASCII/Latin string (byte values 0-255). */
function bytesToAscii(bytes: Uint8Array, start = 0, end?: number): string {
  const slice = bytes.subarray(start, end);
  let s = "";
  for (let i = 0; i < slice.length; i++) {
    s += String.fromCharCode(slice[i]!);
  }
  return s;
}

/** Encode an ASCII string to bytes. */
function asciiToBytes(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

/** Search for a byte pattern inside a Uint8Array. Returns index or -1. */
function indexOfBytes(
  haystack: Uint8Array,
  needle: Uint8Array,
  fromIndex = 0,
): number {
  outer: for (let i = fromIndex; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/** Read an integer from a byte array (ASCII digits, possibly preceded by whitespace). */
function readInt(
  bytes: Uint8Array,
  pos: number,
): { value: number; end: number } {
  while (pos < bytes.length && isWhitespace(bytes[pos]!)) pos++;
  let sign = 1;
  if (bytes[pos] === 0x2d) {
    sign = -1;
    pos++;
  }
  let value = 0;
  while (pos < bytes.length && bytes[pos]! >= 0x30 && bytes[pos]! <= 0x39) {
    value = value * 10 + (bytes[pos]! - 0x30);
    pos++;
  }
  return { value: value * sign, end: pos };
}

function isWhitespace(b: number): boolean {
  return b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d || b === 0x0c;
}

/** Convert 72 dpi PDF points to millimetres. */
function ptToMm(pt: number): number {
  return pt * (25.4 / 72);
}

// ---------------------------------------------------------------------------
// PDF tokeniser / object reader
// ---------------------------------------------------------------------------

type PdfToken =
  | { type: "integer"; value: number }
  | { type: "real"; value: number }
  | { type: "name"; value: string }
  | { type: "string"; value: string }
  | { type: "op"; value: string }
  | { type: "arrayStart" }
  | { type: "arrayEnd" }
  | { type: "dictStart" }
  | { type: "dictEnd" }
  | { type: "eof" };

class PdfTokeniser {
  private pos: number;

  constructor(
    private bytes: Uint8Array,
    startPos = 0,
  ) {
    this.pos = startPos;
  }

  get position(): number {
    return this.pos;
  }

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.bytes.length) {
      const b = this.bytes[this.pos]!;
      if (isWhitespace(b)) {
        this.pos++;
      } else if (b === 0x25) {
        // '%' comment
        while (this.pos < this.bytes.length && this.bytes[this.pos] !== 0x0a) {
          this.pos++;
        }
      } else {
        break;
      }
    }
  }

  next(): PdfToken {
    this.skipWhitespaceAndComments();
    if (this.pos >= this.bytes.length) return { type: "eof" };

    const b = this.bytes[this.pos]!;

    // '<<'
    if (b === 0x3c && this.bytes[this.pos + 1] === 0x3c) {
      this.pos += 2;
      return { type: "dictStart" };
    }
    // '>>'
    if (b === 0x3e && this.bytes[this.pos + 1] === 0x3e) {
      this.pos += 2;
      return { type: "dictEnd" };
    }
    // '['
    if (b === 0x5b) {
      this.pos++;
      return { type: "arrayStart" };
    }
    // ']'
    if (b === 0x5d) {
      this.pos++;
      return { type: "arrayEnd" };
    }
    // '/' — name
    if (b === 0x2f) {
      return this.readName();
    }
    // '(' — literal string
    if (b === 0x28) {
      return this.readLiteralString();
    }
    // '<' — hex string (single '<')
    if (b === 0x3c) {
      return this.readHexString();
    }
    // number or signed number
    if (
      b === 0x2b ||
      b === 0x2d ||
      (b >= 0x30 && b <= 0x39) ||
      b === 0x2e
    ) {
      return this.readNumber();
    }
    // keyword / operator
    return this.readKeyword();
  }

  private readName(): PdfToken {
    this.pos++; // skip '/'
    let name = "";
    while (this.pos < this.bytes.length) {
      const b = this.bytes[this.pos]!;
      if (isWhitespace(b) || b === 0x2f || b === 0x3c || b === 0x3e || b === 0x5b || b === 0x5d || b === 0x28 || b === 0x29) break;
      if (b === 0x23) {
        // '#xx' hex escape
        const hi = this.bytes[this.pos + 1]!;
        const lo = this.bytes[this.pos + 2]!;
        name += String.fromCharCode(parseInt(String.fromCharCode(hi, lo), 16));
        this.pos += 3;
      } else {
        name += String.fromCharCode(b);
        this.pos++;
      }
    }
    return { type: "name", value: name };
  }

  private readLiteralString(): PdfToken {
    this.pos++; // skip '('
    let str = "";
    let depth = 1;
    while (this.pos < this.bytes.length && depth > 0) {
      const b = this.bytes[this.pos]!;
      if (b === 0x5c) {
        // backslash escape
        this.pos++;
        const esc = this.bytes[this.pos]!;
        if (esc === 0x6e) str += "\n";
        else if (esc === 0x72) str += "\r";
        else if (esc === 0x74) str += "\t";
        else str += String.fromCharCode(esc);
        this.pos++;
      } else if (b === 0x28) {
        depth++;
        str += "(";
        this.pos++;
      } else if (b === 0x29) {
        depth--;
        if (depth > 0) str += ")";
        this.pos++;
      } else {
        str += String.fromCharCode(b);
        this.pos++;
      }
    }
    return { type: "string", value: str };
  }

  private readHexString(): PdfToken {
    this.pos++; // skip '<'
    let hex = "";
    while (this.pos < this.bytes.length && this.bytes[this.pos] !== 0x3e) {
      const b = this.bytes[this.pos]!;
      if (!isWhitespace(b)) hex += String.fromCharCode(b);
      this.pos++;
    }
    this.pos++; // skip '>'
    let str = "";
    for (let i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    }
    return { type: "string", value: str };
  }

  private readNumber(): PdfToken {
    let s = "";
    if (this.bytes[this.pos] === 0x2b || this.bytes[this.pos] === 0x2d) {
      s += String.fromCharCode(this.bytes[this.pos]!);
      this.pos++;
    }
    let hasDot = false;
    while (this.pos < this.bytes.length) {
      const b = this.bytes[this.pos]!;
      if (b >= 0x30 && b <= 0x39) {
        s += String.fromCharCode(b);
        this.pos++;
      } else if (b === 0x2e && !hasDot) {
        hasDot = true;
        s += ".";
        this.pos++;
      } else {
        break;
      }
    }
    const v = parseFloat(s);
    if (hasDot) return { type: "real", value: v };
    return { type: "integer", value: Math.trunc(v) };
  }

  private readKeyword(): PdfToken {
    let kw = "";
    while (this.pos < this.bytes.length) {
      const b = this.bytes[this.pos]!;
      if (isWhitespace(b) || b === 0x2f || b === 0x3c || b === 0x3e || b === 0x5b || b === 0x5d || b === 0x28 || b === 0x29) break;
      kw += String.fromCharCode(b);
      this.pos++;
    }
    return { type: "op", value: kw };
  }
}

// ---------------------------------------------------------------------------
// PDF dictionary parser (returns plain object)
// ---------------------------------------------------------------------------

type PdfDict = Record<string, PdfValue>;
type PdfValue =
  | number
  | string
  | boolean
  | null
  | PdfValue[]
  | PdfDict
  | { type: "ref"; gen: number; obj: number };

function parseDict(tokeniser: PdfTokeniser): PdfDict {
  const dict: PdfDict = {};
  for (;;) {
    const key = tokeniser.next();
    if (key.type === "eof" || key.type === "dictEnd") break;
    if (key.type !== "name") continue; // unexpected, skip
    dict[key.value] = parseValue(tokeniser);
  }
  return dict;
}

function parseArray(tokeniser: PdfTokeniser): PdfValue[] {
  const arr: PdfValue[] = [];
  for (;;) {
    const t = tokeniser.next();
    if (t.type === "eof" || t.type === "arrayEnd") break;
    if (t.type === "dictStart") {
      arr.push(parseDict(tokeniser));
    } else if (t.type === "arrayStart") {
      arr.push(parseArray(tokeniser));
    } else if (t.type === "integer" || t.type === "real") {
      arr.push(t.value);
    } else if (t.type === "name") {
      arr.push(t.value);
    } else if (t.type === "string") {
      arr.push(t.value);
    } else if (t.type === "op") {
      if (t.value === "true") arr.push(true);
      else if (t.value === "false") arr.push(false);
      else if (t.value === "null") arr.push(null);
      else arr.push(t.value);
    }
  }
  return arr;
}

function parseValue(tokeniser: PdfTokeniser): PdfValue {
  const t = tokeniser.next();
  if (t.type === "dictStart") return parseDict(tokeniser);
  if (t.type === "arrayStart") return parseArray(tokeniser);
  if (t.type === "integer" || t.type === "real") return t.value;
  if (t.type === "name") return t.value;
  if (t.type === "string") return t.value;
  if (t.type === "op") {
    if (t.value === "true") return true;
    if (t.value === "false") return false;
    if (t.value === "null") return null;
    return t.value;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cross-reference table / object locator
// ---------------------------------------------------------------------------

interface XRefEntry {
  offset: number;
  gen: number;
  inUse: boolean;
}

function findStartXref(bytes: Uint8Array): number {
  // Search backwards from the last 1024 bytes (or full file if smaller)
  const searchFrom = Math.max(0, bytes.length - 1024);
  const needle = asciiToBytes("startxref");

  // Scan backwards
  for (let i = bytes.length - needle.length - 1; i >= searchFrom; i--) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) { match = false; break; }
    }
    if (match) {
      let pos = i + needle.length;
      while (pos < bytes.length && isWhitespace(bytes[pos]!)) pos++;
      return readInt(bytes, pos).value;
    }
  }
  return 0;
}

function parseXRefTable(
  bytes: Uint8Array,
  offset: number,
): { entries: Map<number, XRefEntry>; trailer: PdfDict } {
  const entries = new Map<number, XRefEntry>();
  let pos = offset;

  // Skip 'xref' keyword and any trailing whitespace/newlines
  while (pos < bytes.length && !isWhitespace(bytes[pos]!)) pos++;
  while (pos < bytes.length && isWhitespace(bytes[pos]!)) pos++;

  while (pos < bytes.length) {
    // Peek at current line to detect 'trailer' keyword
    const lineStart = pos;
    const peek = bytesToAscii(bytes, pos, pos + 7);
    if (peek.startsWith("trailer")) {
      pos += 7;
      break;
    }

    // Read subsection header: "firstObjNum count"
    const r1 = readInt(bytes, pos);
    if (r1.end === pos) {
      // No integer found — skip line to avoid infinite loop
      while (pos < bytes.length && bytes[pos] !== 0x0a) pos++;
      if (pos < bytes.length) pos++;
      continue;
    }
    pos = r1.end;
    while (pos < bytes.length && bytes[pos] === 0x20) pos++; // skip spaces only

    const r2 = readInt(bytes, pos);
    if (r2.end === pos) {
      while (pos < bytes.length && bytes[pos] !== 0x0a) pos++;
      if (pos < bytes.length) pos++;
      continue;
    }
    pos = r2.end;
    // Skip to next line
    while (pos < bytes.length && (bytes[pos] === 0x0d || bytes[pos] === 0x0a || bytes[pos] === 0x20)) pos++;

    const firstObj = r1.value;
    const count = r2.value;

    // Read 'count' entries, each exactly 20 bytes in spec but we read line-by-line for robustness
    for (let i = 0; i < count && pos < bytes.length; i++) {
      // Find end of this entry line (handle \r\n, \n, \r)
      let lineEnd = pos;
      while (lineEnd < bytes.length && bytes[lineEnd] !== 0x0a && bytes[lineEnd] !== 0x0d) lineEnd++;

      const entryStr = bytesToAscii(bytes, pos, lineEnd).trim();
      // Advance past the line (including CR/LF)
      pos = lineEnd;
      while (pos < bytes.length && (bytes[pos] === 0x0d || bytes[pos] === 0x0a)) pos++;

      const parts = entryStr.split(/\s+/);
      if (parts.length < 3) continue;
      const entryOffset = parseInt(parts[0] ?? "0", 10);
      const gen = parseInt(parts[1] ?? "0", 10);
      const inUse = (parts[2] ?? "f") === "n";
      entries.set(firstObj + i, { offset: entryOffset, gen, inUse });
    }

    // Safety guard: if pos hasn't advanced at all from lineStart, skip a byte
    if (pos === lineStart) pos++;
  }

  // Parse trailer dict
  while (pos < bytes.length && isWhitespace(bytes[pos]!)) pos++;
  const t = new PdfTokeniser(bytes, pos);
  const tok = t.next();
  let trailer: PdfDict = {};
  if (tok.type === "dictStart") {
    trailer = parseDict(t);
  }

  return { entries, trailer };
}

function parseXRefStream(
  bytes: Uint8Array,
  offset: number,
  inflate: (data: Uint8Array) => Uint8Array,
): { entries: Map<number, XRefEntry>; trailer: PdfDict } {
  const entries = new Map<number, XRefEntry>();
  const obj = readIndirectObject(bytes, offset, inflate);
  if (!obj || typeof obj !== "object" || !("dict" in obj)) {
    return { entries, trailer: {} };
  }
  const trailer = (obj as { dict: PdfDict }).dict;
  const data = (obj as { stream?: Uint8Array }).stream;
  if (!data) return { entries, trailer };

  const w = trailer["W"] as number[] | undefined;
  if (!w || w.length < 3) return { entries, trailer };
  const [w0, w1, w2] = w as [number, number, number];
  const index = trailer["Index"] as number[] | undefined;
  const size = trailer["Size"] as number | undefined;

  const subsections: Array<[number, number]> = [];
  if (index && index.length >= 2) {
    for (let i = 0; i < index.length; i += 2) {
      subsections.push([index[i]!, index[i + 1]!]);
    }
  } else {
    subsections.push([0, size ?? 0]);
  }

  const entrySize = w0 + w1 + w2;
  let dataPos = 0;

  for (const [first, count] of subsections) {
    for (let i = 0; i < count; i++) {
      const readField = (width: number): number => {
        let val = 0;
        for (let b = 0; b < width; b++) {
          val = (val << 8) | (data[dataPos++] ?? 0);
        }
        return val;
      };
      const type = w0 === 0 ? 1 : readField(w0);
      const f1 = readField(w1);
      const _f2 = readField(w2);
      if (type === 1) {
        entries.set(first + i, { offset: f1, gen: _f2, inUse: true });
      } else if (type === 2) {
        // compressed object — store with negative offset as signal
        entries.set(first + i, { offset: -(f1 + 1), gen: 0, inUse: true });
      }
    }
  }

  return { entries, trailer };
}

// ---------------------------------------------------------------------------
// Indirect object reader
// ---------------------------------------------------------------------------

interface PdfObject {
  dict: PdfDict;
  stream?: Uint8Array;
}

function readIndirectObject(
  bytes: Uint8Array,
  offset: number,
  inflate: (data: Uint8Array) => Uint8Array,
): PdfObject | null {
  const t = new PdfTokeniser(bytes, offset);
  // Skip "N G obj" header
  const n1 = t.next();
  if (n1.type === "eof") return null;
  const n2 = t.next();
  if (n2.type === "eof") return null;
  const kw = t.next();
  if (kw.type !== "op" || kw.value !== "obj") {
    // Maybe we're already past the header (direct parse)
    // Try interpreting n1 as start of dict
    if (n1.type === "dictStart") {
      const dict = parseDict(new PdfTokeniser(bytes, offset));
      return { dict };
    }
    return null;
  }
  const val = t.next();
  if (val.type !== "dictStart") return null;
  const dict = parseDict(t);

  // Check for 'stream' keyword
  const afterDict = t.position;
  const peek = bytesToAscii(bytes, afterDict, afterDict + 10)
    .trimStart()
    .slice(0, 6);
  if (!peek.startsWith("stream")) return { dict };

  // Skip 'stream\r\n' or 'stream\n'
  let streamStart = afterDict;
  while (streamStart < bytes.length && bytes[streamStart] !== 0x73) streamStart++;
  streamStart += 6; // skip 'stream'
  if (bytes[streamStart] === 0x0d) streamStart++;
  if (bytes[streamStart] === 0x0a) streamStart++;

  const length = dict["Length"];
  const streamLen =
    typeof length === "number"
      ? length
      : bytes.length - streamStart;

  let rawStream = bytes.subarray(streamStart, streamStart + streamLen);

  // Decompress if needed
  const filter = dict["Filter"];
  if (filter === "FlateDecode" || filter === "Fl") {
    try {
      rawStream = inflate(rawStream);
    } catch {
      // leave raw
    }
  } else if (Array.isArray(filter)) {
    for (const f of filter) {
      if (f === "FlateDecode" || f === "Fl") {
        try {
          rawStream = inflate(rawStream);
        } catch {
          // leave raw
        }
      }
    }
  }

  return { dict, stream: rawStream };
}

// ---------------------------------------------------------------------------
// Content-stream graphic operator parser
// ---------------------------------------------------------------------------

/** Component type for colour state */
type ColourComponents = number[];

interface GraphicsState {
  fillColor: ColourComponents;
  fillColorSpace: string;
  strokeColor: ColourComponents;
  strokeColorSpace: string;
  ctmA: number;
  ctmB: number;
  ctmC: number;
  ctmD: number;
  ctmE: number;
  ctmF: number;
}

function defaultGraphicsState(): GraphicsState {
  return {
    fillColor: [0],
    fillColorSpace: "DeviceGray",
    strokeColor: [0],
    strokeColorSpace: "DeviceGray",
    ctmA: 1, ctmB: 0, ctmC: 0, ctmD: 1, ctmE: 0, ctmF: 0,
  };
}

function colourToHex(components: ColourComponents, colorSpace: string): string {
  let r = 0, g = 0, b = 0;
  if (colorSpace === "DeviceGray" || components.length === 1) {
    const v = Math.round((components[0] ?? 0) * 255);
    r = g = b = v;
  } else if (colorSpace === "DeviceCMYK" || components.length === 4) {
    const c = components[0] ?? 0;
    const m = components[1] ?? 0;
    const y = components[2] ?? 0;
    const k = components[3] ?? 0;
    r = Math.round(255 * (1 - c) * (1 - k));
    g = Math.round(255 * (1 - m) * (1 - k));
    b = Math.round(255 * (1 - y) * (1 - k));
  } else {
    r = Math.round((components[0] ?? 0) * 255);
    g = Math.round((components[1] ?? 0) * 255);
    b = Math.round((components[2] ?? 0) * 255);
  }
  return (
    "#" +
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  );
}

function isNearWhiteOrBlack(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r + g + b) / 3;
  return brightness > 230 || brightness < 25;
}

interface RectOp {
  x: number;
  y: number;
  w: number;
  h: number;
  fillColor: string;
}

function parseContentStream(contentBytes: Uint8Array): {
  rects: RectOp[];
  texts: Array<{ x: number; y: number; text: string }>;
} {
  const t = new PdfTokeniser(contentBytes);
  const rects: RectOp[] = [];
  const texts: Array<{ x: number; y: number; text: string }> = [];
  const stack: PdfValue[] = [];
  const gsStack: GraphicsState[] = [];
  let gs = defaultGraphicsState();
  let inText = false;
  let textX = 0;
  let textY = 0;

  for (;;) {
    const tok = t.next();
    if (tok.type === "eof") break;

    if (tok.type === "integer" || tok.type === "real") {
      stack.push(tok.value);
      continue;
    }
    if (tok.type === "name") {
      stack.push(tok.value);
      continue;
    }
    if (tok.type === "string") {
      stack.push(tok.value);
      continue;
    }
    if (tok.type === "arrayStart") {
      // collect array on stack as a single element
      const arr = parseArray(t);
      stack.push(arr);
      continue;
    }
    if (tok.type === "dictStart") {
      parseDict(t); // skip
      continue;
    }

    if (tok.type !== "op") continue;
    const op = tok.value;

    // -- graphics state --
    if (op === "q") {
      gsStack.push({ ...gs });
      stack.length = 0;
      continue;
    }
    if (op === "Q") {
      if (gsStack.length > 0) gs = gsStack.pop()!;
      stack.length = 0;
      continue;
    }
    if (op === "cm") {
      if (stack.length >= 6) {
        const [a, b, c, d, e, f] = stack.slice(-6) as number[];
        gs.ctmA = a!; gs.ctmB = b!; gs.ctmC = c!;
        gs.ctmD = d!; gs.ctmE = e!; gs.ctmF = f!;
      }
      stack.length = 0;
      continue;
    }

    // -- colour operators --
    if (op === "g") {
      gs.fillColor = [stack[0] as number ?? 0];
      gs.fillColorSpace = "DeviceGray";
      stack.length = 0;
      continue;
    }
    if (op === "G") {
      gs.strokeColor = [stack[0] as number ?? 0];
      gs.strokeColorSpace = "DeviceGray";
      stack.length = 0;
      continue;
    }
    if (op === "rg") {
      gs.fillColor = stack.slice(-3) as number[];
      gs.fillColorSpace = "DeviceRGB";
      stack.length = 0;
      continue;
    }
    if (op === "RG") {
      gs.strokeColor = stack.slice(-3) as number[];
      gs.strokeColorSpace = "DeviceRGB";
      stack.length = 0;
      continue;
    }
    if (op === "k") {
      gs.fillColor = stack.slice(-4) as number[];
      gs.fillColorSpace = "DeviceCMYK";
      stack.length = 0;
      continue;
    }
    if (op === "K") {
      gs.strokeColor = stack.slice(-4) as number[];
      gs.strokeColorSpace = "DeviceCMYK";
      stack.length = 0;
      continue;
    }
    if (op === "cs") {
      gs.fillColorSpace = (stack[stack.length - 1] as string) ?? "DeviceGray";
      stack.length = 0;
      continue;
    }
    if (op === "CS") {
      gs.strokeColorSpace =
        (stack[stack.length - 1] as string) ?? "DeviceGray";
      stack.length = 0;
      continue;
    }
    if (op === "sc" || op === "scn") {
      gs.fillColor = stack.slice() as number[];
      stack.length = 0;
      continue;
    }
    if (op === "SC" || op === "SCN") {
      gs.strokeColor = stack.slice() as number[];
      stack.length = 0;
      continue;
    }

    // -- path operators --
    if (op === "re") {
      // x y w h re
      if (stack.length >= 4) {
        const args = stack.slice(-4) as number[];
        const [rx, ry, rw, rh] = args;
        const fillHex = colourToHex(gs.fillColor, gs.fillColorSpace);
        rects.push({
          x: rx!,
          y: ry!,
          w: rw!,
          h: rh!,
          fillColor: fillHex,
        });
      }
      stack.length = 0;
      continue;
    }

    // After 'f' or 'F' (fill), 'S' (stroke), 'B' (fill+stroke), 'n' (no-paint):
    // rects already captured with colour at time of 're', so nothing extra to do.
    if (op === "f" || op === "F" || op === "f*" || op === "S" || op === "s" || op === "B" || op === "b" || op === "n") {
      stack.length = 0;
      continue;
    }

    // -- text operators --
    if (op === "BT") { inText = true; stack.length = 0; continue; }
    if (op === "ET") { inText = false; stack.length = 0; continue; }
    if (inText && (op === "Td" || op === "TD" || op === "Tm")) {
      if (stack.length >= 2) {
        const arr = stack.slice(-6) as number[];
        if (op === "Tm") {
          textX = arr[4] ?? 0;
          textY = arr[5] ?? 0;
        } else {
          textX += (arr[0] ?? 0);
          textY += (arr[1] ?? 0);
        }
      }
      stack.length = 0;
      continue;
    }
    if (inText && (op === "Tj" || op === "TJ" || op === "'")) {
      const raw = stack[stack.length - 1];
      let text = "";
      if (typeof raw === "string") {
        text = raw;
      } else if (Array.isArray(raw)) {
        text = raw.filter((v) => typeof v === "string").join("");
      }
      if (text.trim()) {
        texts.push({ x: textX, y: textY, text: text.trim() });
      }
      stack.length = 0;
      continue;
    }

    stack.length = 0;
  }

  return { rects, texts };
}

// ---------------------------------------------------------------------------
// Page MediaBox reader
// ---------------------------------------------------------------------------

function getMediaBox(
  pageDict: PdfDict,
  allObjects: Map<number, PdfObject>,
): [number, number, number, number] {
  const mb = pageDict["MediaBox"];
  if (Array.isArray(mb) && mb.length >= 4) {
    return [
      mb[0] as number,
      mb[1] as number,
      mb[2] as number,
      mb[3] as number,
    ];
  }
  // Try parent
  const parent = pageDict["Parent"];
  if (parent && typeof parent === "object" && "obj" in parent) {
    const parentObj = allObjects.get((parent as { obj: number }).obj);
    if (parentObj) return getMediaBox(parentObj.dict, allObjects);
  }
  return [0, 0, 595, 842]; // A4 fallback
}

// ---------------------------------------------------------------------------
// DCTDecode (JPEG) image extractor
// ---------------------------------------------------------------------------

function extractJpegStreams(
  bytes: Uint8Array,
  allObjects: Map<number, PdfObject>,
): Uint8Array[] {
  const jpegs: Uint8Array[] = [];

  for (const [, obj] of allObjects) {
    if (!obj.stream) continue;
    const dict = obj.dict;
    const subtype = dict["Subtype"];
    const filter = dict["Filter"];
    if (subtype === "Image" && filter === "DCTDecode") {
      jpegs.push(obj.stream);
    }
  }

  // Fallback: scan raw bytes for JPEG markers (FF D8 FF)
  if (jpegs.length === 0) {
    let i = 0;
    while (i < bytes.length - 3) {
      if (
        bytes[i] === 0xff &&
        bytes[i + 1] === 0xd8 &&
        bytes[i + 2] === 0xff
      ) {
        // find end of JPEG (FF D9)
        let end = i + 2;
        while (end < bytes.length - 1) {
          if (bytes[end] === 0xff && bytes[end + 1] === 0xd9) {
            end += 2;
            break;
          }
          end++;
        }
        jpegs.push(bytes.subarray(i, end));
        i = end;
      } else {
        i++;
      }
    }
  }

  return jpegs;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Parse a PDF from raw bytes.
 *
 * @param bytes   Raw PDF content as Uint8Array
 * @param inflate FlateDecode decompressor (pass pako.inflate)
 */
export function parsePDFBytes(
  bytes: Uint8Array,
  inflate: (data: Uint8Array) => Uint8Array,
): ParseResult {
  const warnings: string[] = [];

  // ── 1. Validate header ──────────────────────────────────────────────────
  const header = bytesToAscii(bytes, 0, 8);
  if (!header.startsWith("%PDF-")) {
    return {
      boards: [],
      mode: "vector",
      warnings: ["File does not appear to be a valid PDF (missing %PDF- header)"],
    };
  }

  // ── 2. Parse cross-reference table ──────────────────────────────────────
  const startXref = findStartXref(bytes);
  let xrefEntries: Map<number, XRefEntry>;
  let trailer: PdfDict;

  try {
    // Is it a regular xref table or an xref stream?
    const xrefPeek = bytesToAscii(bytes, startXref, startXref + 4);
    if (xrefPeek.startsWith("xref")) {
      const result = parseXRefTable(bytes, startXref);
      xrefEntries = result.entries;
      trailer = result.trailer;
    } else {
      const result = parseXRefStream(bytes, startXref, inflate);
      xrefEntries = result.entries;
      trailer = result.trailer;
    }
  } catch (e) {
    warnings.push(`XRef parse error: ${String(e)}`);
    xrefEntries = new Map();
    trailer = {};
  }

  // ── 3. Load all in-use objects ───────────────────────────────────────────
  const allObjects = new Map<number, PdfObject>();
  for (const [objNum, entry] of xrefEntries) {
    if (!entry.inUse || entry.offset < 0) continue;
    try {
      const obj = readIndirectObject(bytes, entry.offset, inflate);
      if (obj) allObjects.set(objNum, obj);
    } catch {
      // skip bad objects
    }
  }

  // ── 4. Find page tree ────────────────────────────────────────────────────
  const rootRef = trailer["Root"];
  const rootObjNum =
    rootRef && typeof rootRef === "object" && "obj" in rootRef
      ? (rootRef as { obj: number }).obj
      : 0;
  const catalog = allObjects.get(rootObjNum);

  const pageObjNums: number[] = [];
  if (catalog) {
    collectPageRefs(catalog.dict, allObjects, pageObjNums);
  }

  if (pageObjNums.length === 0) {
    // Fallback: scan all objects for /Type /Page
    for (const [n, obj] of allObjects) {
      if (obj.dict["Type"] === "Page") pageObjNums.push(n);
    }
  }

  // ── 5. Process each page ─────────────────────────────────────────────────
  const boards: ParsedBoard[] = [];
  let vectorBoardIndex = 0;

  for (const pageNum of pageObjNums) {
    const pageObj = allObjects.get(pageNum);
    if (!pageObj) continue;
    const pageDict = pageObj.dict;
    const [, , pageW, pageH] = getMediaBox(pageDict, allObjects);
    const sheetWidthMm = ptToMm(pageW);
    const sheetHeightMm = ptToMm(pageH);

    // Collect content streams
    const contentStreams: Uint8Array[] = [];
    const contentsRef = pageDict["Contents"];
    collectContentStreams(contentsRef, allObjects, contentStreams);

    // Concatenate content streams
    let totalLen = 0;
    for (const s of contentStreams) totalLen += s.length + 1;
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const s of contentStreams) {
      combined.set(s, offset);
      offset += s.length;
      combined[offset++] = 0x20; // space separator
    }

    // Parse graphic operators
    const { rects, texts } = parseContentStream(combined);

    // Filter out white/black rectangles (borders, background)
    const coloredRects = rects.filter(
      (r) =>
        Math.abs(r.w) > 0.5 &&
        Math.abs(r.h) > 0.5 &&
        !isNearWhiteOrBlack(r.fillColor),
    );

    if (coloredRects.length > 0) {
      // Build a map from approximate rect position to text labels
      const pieces: CutPiece[] = coloredRects.map((rect, idx) => {
        const xMm = ptToMm(rect.x);
        const yMm = ptToMm(rect.y);
        const wMm = ptToMm(Math.abs(rect.w));
        const hMm = ptToMm(Math.abs(rect.h));

        // Find nearest text label
        let label: string | undefined;
        let bestDist = Infinity;
        for (const t of texts) {
          const cx = xMm + wMm / 2;
          const cy = yMm + hMm / 2;
          const tx = ptToMm(t.x);
          const ty = ptToMm(t.y);
          const d = Math.sqrt((tx - cx) ** 2 + (ty - cy) ** 2);
          if (d < bestDist && d < Math.max(wMm, hMm)) {
            bestDist = d;
            label = t.text;
          }
        }

        return {
          x: xMm,
          y: yMm,
          width: wMm,
          height: hMm,
          color: rect.fillColor,
          label,
          pieceIndex: idx,
        };
      });

      boards.push({
        boardIndex: vectorBoardIndex++,
        sheetWidth: sheetWidthMm,
        sheetHeight: sheetHeightMm,
        pieces,
      });
    } else {
      // No vector content — try to find a raster JPEG on this page
      const xObjects = (pageDict["Resources"] as PdfDict | undefined)?.XObject as PdfDict | undefined;
      const pageImages: Uint8Array[] = [];

      if (xObjects) {
        for (const key of Object.keys(xObjects)) {
          const ref = xObjects[key];
          if (ref && typeof ref === "object" && "obj" in ref) {
            const imgObj = allObjects.get((ref as { obj: number }).obj);
            if (
              imgObj?.stream &&
              (imgObj.dict["Filter"] === "DCTDecode" ||
                imgObj.dict["Subtype"] === "Image")
            ) {
              pageImages.push(imgObj.stream);
            }
          }
        }
      }

      if (pageImages.length > 0) {
        boards.push({
          boardIndex: vectorBoardIndex++,
          sheetWidth: sheetWidthMm,
          sheetHeight: sheetHeightMm,
          pieces: [],
          jpegBytes: pageImages[0],
        });
      } else {
        warnings.push(`Page ${pageNum}: no colored rectangles or images found`);
      }
    }
  }

  // ── 6. Determine mode ────────────────────────────────────────────────────
  const hasVector = boards.some((b) => b.pieces.length > 0);
  const hasRaster = boards.some((b) => b.jpegBytes !== undefined);

  if (!hasVector && !hasRaster) {
    // Last resort: raw JPEG scan
    const jpegs = extractJpegStreams(bytes, allObjects);
    if (jpegs.length > 0) {
      boards.push({
        boardIndex: 0,
        sheetWidth: ptToMm(595),
        sheetHeight: ptToMm(842),
        pieces: [],
        jpegBytes: jpegs[0],
      });
    } else {
      warnings.push(
        "No boards detected. The PDF may be encrypted or use an unsupported format.",
      );
    }
  }

  return {
    boards,
    mode: hasVector ? "vector" : "raster",
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Helpers for page-tree traversal and content collection
// ---------------------------------------------------------------------------

function collectPageRefs(
  nodeDict: PdfDict,
  allObjects: Map<number, PdfObject>,
  result: number[],
): void {
  const type = nodeDict["Type"];
  if (type === "Page") return; // leaf — caller handles
  const kids = nodeDict["Kids"];
  if (!Array.isArray(kids)) return;
  for (const kid of kids) {
    if (kid && typeof kid === "object" && "obj" in kid) {
      const kidObj = allObjects.get((kid as { obj: number }).obj);
      if (!kidObj) continue;
      if (kidObj.dict["Type"] === "Page") {
        result.push((kid as { obj: number }).obj);
      } else {
        collectPageRefs(kidObj.dict, allObjects, result);
      }
    }
  }
}

function collectContentStreams(
  ref: PdfValue,
  allObjects: Map<number, PdfObject>,
  result: Uint8Array[],
): void {
  if (!ref) return;
  if (typeof ref === "object" && "obj" in ref) {
    const obj = allObjects.get((ref as { obj: number }).obj);
    if (obj?.stream) result.push(obj.stream);
  } else if (Array.isArray(ref)) {
    for (const item of ref) {
      collectContentStreams(item, allObjects, result);
    }
  }
}
