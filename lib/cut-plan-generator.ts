/**
 * Cut Plan Generator
 *
 * Takes parsed boards (from cutlist-pdf-parser) and produces an ordered,
 * step-by-step cutting sequence for each board.
 *
 * Sorting strategy: pieces are ordered left-to-right, top-to-bottom
 * (in PDF coordinates, bottom-up, so we sort by descending Y then ascending X).
 * This mirrors a typical guillotine-cut workflow.
 */

import type { ParsedBoard, CutPiece } from "./cutlist-pdf-parser";

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface CutStep {
  /** 1-based global step number across all boards */
  stepNumber: number;
  /** 0-based index into the boards array */
  boardIndex: number;
  boardId: string;
  /** 1-based step number within this board */
  boardStepNumber: number;
  piece: CutPiece;
  /** Human-readable cutting instruction */
  instruction: string;
}

export interface BoardPlan {
  board: ParsedBoard;
  steps: CutStep[];
}

export interface CutPlan {
  boards: ParsedBoard[];
  boardPlans: BoardPlan[];
  allSteps: CutStep[];
  totalPieces: number;
  totalBoards: number;
}

// ─── Generator ───────────────────────────────────────────────────────────────

/**
 * Generate a step-by-step cutting plan from parsed boards.
 *
 * @param boards - Boards returned by parsePDF()
 * @returns CutPlan with ordered steps per board and globally
 */
export function generateCutPlan(boards: ParsedBoard[]): CutPlan {
  let globalStep = 1;
  const boardPlans: BoardPlan[] = [];
  const allSteps: CutStep[] = [];

  for (let boardIndex = 0; boardIndex < boards.length; boardIndex++) {
    const board = boards[boardIndex];

    // Sort pieces: rows first (top of board first = highest Y in PDF coords),
    // then left-to-right (ascending X).
    const sorted = sortPiecesForCutting(board.pieces, board);

    const steps: CutStep[] = sorted.map((piece, localIdx) => {
      const instruction = buildInstruction(piece, board, localIdx + 1, sorted.length);
      const step: CutStep = {
        stepNumber: globalStep++,
        boardIndex,
        boardId: board.id,
        boardStepNumber: localIdx + 1,
        piece,
        instruction,
      };
      return step;
    });

    allSteps.push(...steps);
    boardPlans.push({ board, steps });
  }

  return {
    boards,
    boardPlans,
    allSteps,
    totalPieces: allSteps.length,
    totalBoards: boards.length,
  };
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

/**
 * Sort pieces for a guillotine-cut workflow:
 * 1. Group pieces into "rows" by their Y centre (similar Y → same row).
 * 2. Within each row, order by ascending X (left to right).
 * 3. Rows are ordered from top to bottom.
 *
 * In PDF coordinates Y grows upward, so "top" = higher Y value.
 */
export function sortPiecesForCutting(
  pieces: CutPiece[],
  board: ParsedBoard
): CutPiece[] {
  if (pieces.length === 0) return [];

  // Determine row tolerance: ~half the average piece height
  const avgH =
    pieces.reduce((s, p) => s + p.height, 0) / pieces.length;
  const rowTolerance = avgH * 0.6;

  // Sort all pieces by Y-centre descending (top row first), then X ascending
  const withCentre = pieces.map((p) => ({
    piece: p,
    cx: p.x + p.width / 2,
    cy: p.y + p.height / 2,
  }));

  withCentre.sort((a, b) => {
    // Compare rows: if Y centres differ by more than tolerance, they're different rows
    const yDiff = b.cy - a.cy; // descending Y = top first
    if (Math.abs(yDiff) > rowTolerance) return yDiff;
    // Same row: sort by ascending X
    return a.cx - b.cx;
  });

  return withCentre.map((w) => w.piece);
}

// ─── Instruction Builder ──────────────────────────────────────────────────────

/**
 * Build a human-readable cutting instruction for a single piece.
 *
 * If the piece has a text label from the PDF (which often contains the actual
 * mm dimensions), use that.  Otherwise, show the PDF-unit dimensions and note
 * that they are approximate.
 */
function buildInstruction(
  piece: CutPiece,
  board: ParsedBoard,
  stepInBoard: number,
  totalInBoard: number
): string {
  const label = piece.label?.trim();

  // Determine position description relative to the board
  const relX = piece.x - board.x;
  const relY = piece.y - board.y;
  const side = relX < board.width / 2 ? "izquierda" : "derecha";
  const verticalPosition = relY + piece.height > board.height / 2 ? "inferior" : "superior";

  const position = `zona ${verticalPosition}-${side}`;

  if (label) {
    return `Paso ${stepInBoard}/${totalInBoard}: Cortar pieza "${label}" — ${position}.`;
  }

  // Dimensions in PDF units (approximate)
  const w = Math.round(piece.width);
  const h = Math.round(piece.height);
  return `Paso ${stepInBoard}/${totalInBoard}: Cortar pieza ${w}×${h} unidades — ${position}.`;
}

// ─── Summary Utilities ────────────────────────────────────────────────────────

export interface CutSummary {
  totalBoards: number;
  totalPieces: number;
  cutPieces: number;
  remainingPieces: number;
  /** Average utilisation across all boards (0-100) */
  averageUtilizationPercent: number;
  /** Total waste percentage (100 - avg utilisation) */
  wastePercent: number;
  /** Per-board breakdown */
  perBoard: {
    boardId: string;
    pageNumber: number;
    totalPieces: number;
    cutPieces: number;
    utilizationPercent: number;
  }[];
}

/**
 * Compute a summary from the current state of boards (respecting isCut flags).
 */
export function computeSummary(boards: ParsedBoard[]): CutSummary {
  let totalPieces = 0;
  let cutPieces = 0;
  let totalUtilization = 0;

  const perBoard = boards.map((b) => {
    const cut = b.pieces.filter((p) => p.isCut).length;
    totalPieces += b.pieces.length;
    cutPieces += cut;
    totalUtilization += b.utilizationPercent;
    return {
      boardId: b.id,
      pageNumber: b.pageNumber,
      totalPieces: b.pieces.length,
      cutPieces: cut,
      utilizationPercent: b.utilizationPercent,
    };
  });

  const avgUtil =
    boards.length > 0
      ? Math.round((totalUtilization / boards.length) * 10) / 10
      : 0;

  return {
    totalBoards: boards.length,
    totalPieces,
    cutPieces,
    remainingPieces: totalPieces - cutPieces,
    averageUtilizationPercent: avgUtil,
    wastePercent: Math.round((100 - avgUtil) * 10) / 10,
    perBoard,
  };
}
