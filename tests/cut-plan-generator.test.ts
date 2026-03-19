/**
 * Unit tests for cut-plan-generator.ts
 */

import { describe, it, expect } from "vitest";
import {
  generateCutPlan,
  sortPiecesForCutting,
  computeSummary,
} from "../lib/cut-plan-generator";
import type { ParsedBoard, CutPiece } from "../lib/cutlist-pdf-parser";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePiece(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color = "#ff0000",
  label?: string,
  isCut = false
): CutPiece {
  return { id, x, y, width: w, height: h, color, label, isCut };
}

function makeBoard(
  id: string,
  pieces: CutPiece[],
  boardW = 1000,
  boardH = 600
): ParsedBoard {
  const piecesArea = pieces.reduce((s, p) => s + p.width * p.height, 0);
  const utilizationPercent =
    Math.round(((piecesArea / (boardW * boardH)) * 100) * 10) / 10;
  return {
    id,
    pageNumber: 1,
    x: 0,
    y: 0,
    width: boardW,
    height: boardH,
    pieces,
    utilizationPercent,
  };
}

// ─── sortPiecesForCutting ────────────────────────────────────────────────────

describe("sortPiecesForCutting", () => {
  it("returns empty array for no pieces", () => {
    const board = makeBoard("b1", []);
    expect(sortPiecesForCutting([], board)).toEqual([]);
  });

  it("sorts a single piece as-is", () => {
    const p = makePiece("p1", 10, 10, 100, 50);
    const board = makeBoard("b1", [p]);
    expect(sortPiecesForCutting([p], board)).toEqual([p]);
  });

  it("sorts pieces top-to-bottom (higher Y = top of board comes first)", () => {
    // In PDF coords, Y grows upward, so higher Y = closer to top of board
    const topPiece = makePiece("top", 0, 400, 100, 80);   // top of board
    const botPiece = makePiece("bot", 0, 50, 100, 80);    // bottom of board
    const board = makeBoard("b1", [topPiece, botPiece]);
    const sorted = sortPiecesForCutting([botPiece, topPiece], board);
    expect(sorted[0].id).toBe("top");
    expect(sorted[1].id).toBe("bot");
  });

  it("sorts pieces left-to-right within same row", () => {
    const left = makePiece("left", 10, 100, 80, 60);
    const right = makePiece("right", 200, 100, 80, 60);
    const board = makeBoard("b1", [left, right]);
    const sorted = sortPiecesForCutting([right, left], board);
    expect(sorted[0].id).toBe("left");
    expect(sorted[1].id).toBe("right");
  });

  it("handles multiple rows correctly", () => {
    // Row 1 (top): Y centres ~450, Row 2 (bottom): Y centres ~50
    const topLeft = makePiece("tl", 0, 420, 100, 60);    // centre Y ≈ 450
    const topRight = makePiece("tr", 120, 420, 100, 60);  // centre Y ≈ 450
    const botLeft = makePiece("bl", 0, 20, 100, 60);     // centre Y ≈ 50
    const botRight = makePiece("br", 120, 20, 100, 60);   // centre Y ≈ 50
    const board = makeBoard("b1", [topLeft, topRight, botLeft, botRight]);
    const sorted = sortPiecesForCutting(
      [botRight, topLeft, botLeft, topRight],
      board
    );
    expect(sorted[0].id).toBe("tl");
    expect(sorted[1].id).toBe("tr");
    expect(sorted[2].id).toBe("bl");
    expect(sorted[3].id).toBe("br");
  });
});

// ─── generateCutPlan ────────────────────────────────────────────────────────

describe("generateCutPlan", () => {
  it("returns empty plan for no boards", () => {
    const plan = generateCutPlan([]);
    expect(plan.totalBoards).toBe(0);
    expect(plan.totalPieces).toBe(0);
    expect(plan.allSteps).toHaveLength(0);
    expect(plan.boardPlans).toHaveLength(0);
  });

  it("produces correct step count for one board with two pieces", () => {
    const pieces = [
      makePiece("p1", 0, 100, 100, 80),
      makePiece("p2", 110, 100, 100, 80),
    ];
    const board = makeBoard("b1", pieces);
    const plan = generateCutPlan([board]);

    expect(plan.totalBoards).toBe(1);
    expect(plan.totalPieces).toBe(2);
    expect(plan.allSteps).toHaveLength(2);
    expect(plan.boardPlans[0].steps).toHaveLength(2);
  });

  it("assigns global step numbers sequentially across boards", () => {
    const b1 = makeBoard("b1", [
      makePiece("p1", 0, 0, 100, 50),
      makePiece("p2", 110, 0, 100, 50),
    ]);
    const b2 = makeBoard("b2", [
      makePiece("p3", 0, 0, 80, 60),
    ]);
    const plan = generateCutPlan([b1, b2]);

    expect(plan.allSteps[0].stepNumber).toBe(1);
    expect(plan.allSteps[1].stepNumber).toBe(2);
    expect(plan.allSteps[2].stepNumber).toBe(3);
  });

  it("assigns correct boardStepNumber (1-based within each board)", () => {
    const pieces = [
      makePiece("a", 0, 0, 50, 50),
      makePiece("b", 60, 0, 50, 50),
      makePiece("c", 120, 0, 50, 50),
    ];
    const board = makeBoard("b1", pieces);
    const plan = generateCutPlan([board]);
    const steps = plan.boardPlans[0].steps;
    expect(steps[0].boardStepNumber).toBe(1);
    expect(steps[1].boardStepNumber).toBe(2);
    expect(steps[2].boardStepNumber).toBe(3);
  });

  it("includes board index and boardId in each step", () => {
    const b1 = makeBoard("b1", [makePiece("p1", 0, 0, 50, 50)]);
    const b2 = makeBoard("b2", [makePiece("p2", 0, 0, 50, 50)]);
    const plan = generateCutPlan([b1, b2]);

    expect(plan.allSteps[0].boardIndex).toBe(0);
    expect(plan.allSteps[0].boardId).toBe("b1");
    expect(plan.allSteps[1].boardIndex).toBe(1);
    expect(plan.allSteps[1].boardId).toBe("b2");
  });

  it("uses label in instruction when piece has a label", () => {
    const piece = makePiece("p1", 0, 0, 100, 50, "#ff0", "450 x 300");
    const board = makeBoard("b1", [piece]);
    const plan = generateCutPlan([board]);
    expect(plan.allSteps[0].instruction).toContain("450 x 300");
  });

  it("falls back to dimensions in instruction when no label", () => {
    const piece = makePiece("p1", 300, 250, 200, 150);
    const board = makeBoard("b1", [piece]);
    const plan = generateCutPlan([board]);
    expect(plan.allSteps[0].instruction).toContain("200");
    expect(plan.allSteps[0].instruction).toContain("150");
  });
});

// ─── computeSummary ──────────────────────────────────────────────────────────

describe("computeSummary", () => {
  it("returns zeroed summary for no boards", () => {
    const s = computeSummary([]);
    expect(s.totalBoards).toBe(0);
    expect(s.totalPieces).toBe(0);
    expect(s.cutPieces).toBe(0);
    expect(s.averageUtilizationPercent).toBe(0);
  });

  it("counts cut pieces correctly", () => {
    const pieces: CutPiece[] = [
      { ...makePiece("p1", 0, 0, 50, 50), isCut: true },
      { ...makePiece("p2", 60, 0, 50, 50), isCut: false },
      { ...makePiece("p3", 120, 0, 50, 50), isCut: true },
    ];
    const board = makeBoard("b1", pieces);
    const s = computeSummary([board]);
    expect(s.cutPieces).toBe(2);
    expect(s.remainingPieces).toBe(1);
    expect(s.totalPieces).toBe(3);
  });

  it("calculates waste as 100 - utilisation", () => {
    const pieces = [makePiece("p1", 0, 0, 500, 300)]; // 150000 / 600000 = 25%
    const board = makeBoard("b1", pieces, 1000, 600);
    const s = computeSummary([board]);
    expect(s.averageUtilizationPercent).toBeCloseTo(25, 0);
    expect(s.wastePercent).toBeCloseTo(75, 0);
  });

  it("averages utilisation across boards", () => {
    const p1 = [makePiece("p1", 0, 0, 500, 600)]; // 50%
    const p2 = [makePiece("p2", 0, 0, 1000, 600)]; // 100%
    const b1 = makeBoard("b1", p1, 1000, 600);
    const b2 = makeBoard("b2", p2, 1000, 600);
    const s = computeSummary([b1, b2]);
    // average of 50 and 100 = 75
    expect(s.averageUtilizationPercent).toBeCloseTo(75, 0);
  });

  it("perBoard array has one entry per board", () => {
    const boards = [
      makeBoard("b1", [makePiece("p1", 0, 0, 50, 50)]),
      makeBoard("b2", [makePiece("p2", 0, 0, 50, 50)]),
    ];
    const s = computeSummary(boards);
    expect(s.perBoard).toHaveLength(2);
    expect(s.perBoard[0].boardId).toBe("b1");
    expect(s.perBoard[1].boardId).toBe("b2");
  });
});
