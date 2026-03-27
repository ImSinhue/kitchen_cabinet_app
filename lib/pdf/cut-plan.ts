/**
 * Cut Plan Generator
 *
 * Given a set of parsed boards (with coloured piece rectangles),
 * generates a step-by-step guillotine cut sequence.
 *
 * Algorithm: for each board, iteratively find the best guillotine cut
 * (either horizontal or vertical) that separates the remaining waste
 * from a completed group of pieces, until all pieces are isolated.
 */

import type { CutPiece, ParsedBoard } from "./cutlist-pdf-parser";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single straight cut line within a board. */
export interface CutLine {
  /** "H" = horizontal (across the board width), "V" = vertical */
  direction: "H" | "V";
  /** Position in mm from left (V) or from bottom (H) */
  position: number;
  /** Start of the cut in the perpendicular axis (mm) */
  rangeStart: number;
  /** End of the cut in the perpendicular axis (mm) */
  rangeEnd: number;
}

/** One step in the cut sequence for a board. */
export interface CutStep {
  /** Which board (0-based index) */
  boardIndex: number;
  /** Step number within this board (0-based) */
  stepIndex: number;
  /** The cut to make at this step */
  cutLine: CutLine;
  /** All pieces that become fully separated/accessible after this cut */
  piecesCompleted: number[]; // pieceIndex values
  /** Human-readable description */
  description: string;
}

export interface BoardCutPlan {
  boardIndex: number;
  sheetWidth: number;
  sheetHeight: number;
  pieces: CutPiece[];
  steps: CutStep[];
  /** 0–100 % utilisation */
  utilizationPercent: number;
}

export interface CutPlan {
  boards: BoardCutPlan[];
  /** Total pieces across all boards */
  totalPieces: number;
  /** Average utilisation across boards */
  averageUtilization: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roundMm(v: number): number {
  return Math.round(v * 10) / 10;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  pieceIndex: number;
}

/** Check if two numbers are close enough to be considered equal (saw kerf). */
function near(a: number, b: number, tol = 2): boolean {
  return Math.abs(a - b) < tol;
}

/**
 * Find candidate guillotine cut positions for a set of rectangles within
 * the given bounding region.
 */
function candidateCuts(
  rects: Rect[],
  regionX: number,
  regionY: number,
  regionW: number,
  regionH: number,
): CutLine[] {
  const cuts: CutLine[] = [];

  // Vertical cuts: try right edges of each piece
  const vPositions = new Set<number>();
  for (const r of rects) {
    const right = r.x + r.w;
    if (right > regionX + 1 && right < regionX + regionW - 1) {
      vPositions.add(roundMm(right));
    }
  }
  for (const pos of vPositions) {
    cuts.push({
      direction: "V",
      position: pos,
      rangeStart: regionY,
      rangeEnd: regionY + regionH,
    });
  }

  // Horizontal cuts: try top edges of each piece
  const hPositions = new Set<number>();
  for (const r of rects) {
    const top = r.y + r.h;
    if (top > regionY + 1 && top < regionY + regionH - 1) {
      hPositions.add(roundMm(top));
    }
  }
  for (const pos of hPositions) {
    cuts.push({
      direction: "H",
      position: pos,
      rangeStart: regionX,
      rangeEnd: regionX + regionW,
    });
  }

  return cuts;
}

/**
 * Split rects into those on the "low" side of a cut and those on the "high" side.
 * A rect that spans the cut is placed in both sides (it needs the cut to fully free it).
 */
function splitByCut(
  rects: Rect[],
  cut: CutLine,
): { low: Rect[]; high: Rect[] } {
  const low: Rect[] = [];
  const high: Rect[] = [];

  for (const r of rects) {
    if (cut.direction === "V") {
      const midX = r.x + r.w / 2;
      if (midX <= cut.position) low.push(r);
      else high.push(r);
    } else {
      const midY = r.y + r.h / 2;
      if (midY <= cut.position) low.push(r);
      else high.push(r);
    }
  }

  return { low, high };
}

/** Count how many pieces are isolated (i.e. no other rect overlaps their bounding box). */
function countIsolated(rects: Rect[], allRects: Rect[]): number {
  let count = 0;
  for (const r of rects) {
    const overlapping = allRects.filter(
      (o) =>
        o.pieceIndex !== r.pieceIndex &&
        o.x < r.x + r.w &&
        o.x + o.w > r.x &&
        o.y < r.y + r.h &&
        o.y + o.h > r.y,
    );
    if (overlapping.length === 0) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Guillotine cut sequencer
// ---------------------------------------------------------------------------

function buildCutSteps(
  board: ParsedBoard,
  boardIndex: number,
): CutStep[] {
  const steps: CutStep[] = [];

  if (board.pieces.length === 0) return steps;

  const rects: Rect[] = board.pieces.map((p) => ({
    x: p.x,
    y: p.y,
    w: p.width,
    h: p.height,
    pieceIndex: p.pieceIndex,
  }));

  // Sort rects left→right, bottom→top for a deterministic order
  const sortedRects = [...rects].sort((a, b) =>
    near(a.x, b.x) ? a.y - b.y : a.x - b.x,
  );

  // We'll process all pieces; each cut isolates one or more pieces
  const remaining = new Set(sortedRects.map((r) => r.pieceIndex));
  const processed = new Set<number>();

  let stepIndex = 0;
  const maxIterations = sortedRects.length * 4;
  let iterations = 0;

  while (remaining.size > 0 && iterations++ < maxIterations) {
    const currentRects = sortedRects.filter((r) => remaining.has(r.pieceIndex));

    const candidates = candidateCuts(
      currentRects,
      0,
      0,
      board.sheetWidth,
      board.sheetHeight,
    );

    if (candidates.length === 0) {
      // No more cuts available — remaining pieces are already separated
      for (const r of currentRects) {
        if (!processed.has(r.pieceIndex)) {
          processed.add(r.pieceIndex);
          remaining.delete(r.pieceIndex);
        }
      }
      break;
    }

    // Pick the cut that isolates the most pieces on the smaller side
    let bestCut = candidates[0]!;
    let bestScore = -1;
    let bestCompleted: number[] = [];

    for (const cut of candidates) {
      const { low, high } = splitByCut(currentRects, cut);
      // Prefer cuts that isolate more pieces in either partition
      const lowIsolated = low.filter((r) =>
        !splitByCut(low, cut).low.some((o) => o.pieceIndex !== r.pieceIndex),
      );
      const highIsolated = high.filter((r) =>
        !splitByCut(high, cut).high.some((o) => o.pieceIndex !== r.pieceIndex),
      );
      const isolated = [
        ...low.filter((r) => {
          // piece is isolated if no other piece is in the low partition
          return low.length === 1 || !low.some((o) => o.pieceIndex !== r.pieceIndex &&
            o.x < r.x + r.w && o.x + o.w > r.x &&
            o.y < r.y + r.h && o.y + o.h > r.y);
        }),
        ...high.filter((r) => {
          return high.length === 1 || !high.some((o) => o.pieceIndex !== r.pieceIndex &&
            o.x < r.x + r.w && o.x + o.w > r.x &&
            o.y < r.y + r.h && o.y + o.h > r.y);
        }),
      ];
      const score = isolated.length + lowIsolated.length + highIsolated.length;
      if (score > bestScore) {
        bestScore = score;
        bestCut = cut;
        bestCompleted = isolated.map((r) => r.pieceIndex);
      }
    }

    // Remove duplicates from bestCompleted
    const uniqueCompleted = [...new Set(bestCompleted)].filter(
      (idx) => !processed.has(idx),
    );

    const pos = roundMm(bestCut.position);
    const description =
      bestCut.direction === "V"
        ? `Corte vertical a ${pos} mm desde la izquierda`
        : `Corte horizontal a ${pos} mm desde abajo`;

    steps.push({
      boardIndex,
      stepIndex: stepIndex++,
      cutLine: bestCut,
      piecesCompleted: uniqueCompleted,
      description,
    });

    for (const idx of uniqueCompleted) {
      processed.add(idx);
      remaining.delete(idx);
    }

    // Safety: if no pieces completed, force-complete the first remaining
    if (uniqueCompleted.length === 0 && remaining.size > 0) {
      const first = [...remaining][0]!;
      processed.add(first);
      remaining.delete(first);
    }
  }

  return steps;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a step-by-step guillotine cut plan from parsed boards.
 */
export function generateCutPlan(
  boards: ParsedBoard[],
  sawKerfMm = 3.2,
): CutPlan {
  const boardPlans: BoardCutPlan[] = [];
  let totalPieces = 0;
  let totalUtilization = 0;

  for (const board of boards) {
    const steps = buildCutSteps(board, board.boardIndex);

    const sheetArea = board.sheetWidth * board.sheetHeight;
    const usedArea = board.pieces.reduce(
      (sum, p) => sum + p.width * p.height,
      0,
    );
    const utilizationPercent =
      sheetArea > 0 ? Math.min(100, (usedArea / sheetArea) * 100) : 0;

    boardPlans.push({
      boardIndex: board.boardIndex,
      sheetWidth: board.sheetWidth,
      sheetHeight: board.sheetHeight,
      pieces: board.pieces,
      steps,
      utilizationPercent: roundMm(utilizationPercent),
    });

    totalPieces += board.pieces.length;
    totalUtilization += utilizationPercent;
  }

  const averageUtilization =
    boardPlans.length > 0
      ? roundMm(totalUtilization / boardPlans.length)
      : 0;

  // suppress unused variable warning for sawKerfMm — it's exposed for future use
  void sawKerfMm;

  return { boards: boardPlans, totalPieces, averageUtilization };
}
