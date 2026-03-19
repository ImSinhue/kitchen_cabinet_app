/**
 * Unit tests for cutlist-pdf-parser.ts
 *
 * Tests the pure parsing logic (tokenizer, content stream parser, board/piece
 * identification) without requiring the Expo FileSystem APIs.
 */

import { describe, it, expect } from "vitest";
import {
  tokenize,
  parseContentStream,
} from "../lib/cutlist-pdf-parser";

// ─── tokenize ─────────────────────────────────────────────────────────────────

describe("tokenize", () => {
  it("tokenises numbers and operators", () => {
    const tokens = tokenize("100 200 300 150 re f");
    expect(tokens).toEqual(["100", "200", "300", "150", "re", "f"]);
  });

  it("tokenises decimal numbers", () => {
    const tokens = tokenize("0.914 0.647 0.451 rg");
    expect(tokens).toEqual(["0.914", "0.647", "0.451", "rg"]);
  });

  it("tokenises literal strings", () => {
    const tokens = tokenize("(Hello World) Tj");
    expect(tokens).toEqual(["(Hello World)", "Tj"]);
  });

  it("handles escaped characters inside literal strings", () => {
    const tokens = tokenize("(Line\\nBreak) Tj");
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toBe("(Line\\nBreak)");
  });

  it("handles nested parentheses in literal strings", () => {
    const tokens = tokenize("(450 (aprox)) Tj");
    expect(tokens).toEqual(["(450 (aprox))", "Tj"]);
  });

  it("skips comments", () => {
    const tokens = tokenize("q % save state\n1 0 0 rg");
    expect(tokens).toEqual(["q", "1", "0", "0", "rg"]);
  });

  it("handles names with /", () => {
    const tokens = tokenize("/FlateDecode /Filter");
    expect(tokens).toEqual(["/FlateDecode", "/Filter"]);
  });

  it("handles hex strings", () => {
    const tokens = tokenize("<48656C6C6F> Tj");
    expect(tokens).toEqual(["<48656C6C6F>", "Tj"]);
  });

  it("handles empty input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   \n\t  ")).toEqual([]);
  });
});

// ─── parseContentStream — rectangle extraction ────────────────────────────────

describe("parseContentStream – rectangles", () => {
  it("extracts a single filled rectangle with colour", () => {
    const stream = "0.9 0.2 0.1 rg 100 200 300 150 re f";
    const { rects } = parseContentStream(stream);
    expect(rects).toHaveLength(1);
    const r = rects[0];
    expect(r.x).toBe(100);
    expect(r.y).toBe(200);
    expect(r.w).toBe(300);
    expect(r.h).toBe(150);
    expect(r.fillColor).toMatchObject({ r: 0.9, g: 0.2, b: 0.1 });
    expect(r.strokeColor).toBeNull();
  });

  it("extracts multiple rectangles in different colours", () => {
    const stream = [
      "q",
      "0.8 0.1 0.1 rg",
      "10 10 100 50 re f",
      "Q",
      "q",
      "0.1 0.8 0.1 rg",
      "10 70 100 50 re f",
      "Q",
    ].join("\n");
    const { rects } = parseContentStream(stream);
    expect(rects).toHaveLength(2);
    expect(rects[0].fillColor?.r).toBeCloseTo(0.8);
    expect(rects[1].fillColor?.g).toBeCloseTo(0.8);
  });

  it("handles graphics state save/restore (q/Q)", () => {
    const stream = [
      "0.5 0.5 0.5 rg",
      "q",
      "0.9 0.0 0.0 rg",
      "10 10 50 50 re f",
      "Q",
      "20 20 60 60 re f", // should use outer grey colour
    ].join("\n");
    const { rects } = parseContentStream(stream);
    expect(rects).toHaveLength(2);
    expect(rects[0].fillColor?.r).toBeCloseTo(0.9);
    expect(rects[1].fillColor?.r).toBeCloseTo(0.5);
    expect(rects[1].fillColor?.g).toBeCloseTo(0.5);
  });

  it("extracts stroked rectangles (S operator)", () => {
    const stream = "0 0 1 RG 50 50 100 80 re S";
    const { rects } = parseContentStream(stream);
    expect(rects).toHaveLength(1);
    expect(rects[0].strokeColor).toMatchObject({ r: 0, g: 0, b: 1 });
    expect(rects[0].fillColor).toBeNull();
  });

  it("extracts filled+stroked rectangles (B operator)", () => {
    const stream = "1 0 0 rg 0 0 1 RG 30 30 120 60 re B";
    const { rects } = parseContentStream(stream);
    expect(rects).toHaveLength(1);
    expect(rects[0].fillColor).toMatchObject({ r: 1, g: 0, b: 0 });
    expect(rects[0].strokeColor).toMatchObject({ r: 0, g: 0, b: 1 });
  });

  it("handles multiple re operators before a single f (same path)", () => {
    const stream = "0.5 0.0 0.5 rg 10 10 50 50 re 70 10 50 50 re f";
    const { rects } = parseContentStream(stream);
    expect(rects).toHaveLength(2);
    expect(rects[0].fillColor?.r).toBeCloseTo(0.5);
    expect(rects[1].fillColor?.r).toBeCloseTo(0.5);
  });

  it("clears path on n (no-op paint)", () => {
    const stream = "0.5 0.0 0.5 rg 10 10 50 50 re n 20 20 30 30 re f";
    const { rects } = parseContentStream(stream);
    // Only the second rect should be kept (the first was cleared by n)
    expect(rects).toHaveLength(1);
    expect(rects[0].x).toBe(20);
  });

  it("converts grayscale fill (g operator)", () => {
    const stream = "0.75 g 40 40 80 40 re f";
    const { rects } = parseContentStream(stream);
    expect(rects).toHaveLength(1);
    expect(rects[0].fillColor).toMatchObject({ r: 0.75, g: 0.75, b: 0.75 });
  });

  it("ignores rectangles with zero area", () => {
    const stream = "1 0 0 rg 10 10 0 0 re f 20 20 50 50 re f";
    const { rects } = parseContentStream(stream);
    expect(rects).toHaveLength(1);
    expect(rects[0].x).toBe(20);
  });
});

// ─── parseContentStream — text extraction ────────────────────────────────────

describe("parseContentStream – text", () => {
  it("extracts text from simple Tj blocks", () => {
    const stream = [
      "BT",
      "100 200 Td",
      "(450 x 300) Tj",
      "ET",
    ].join("\n");
    const { texts } = parseContentStream(stream);
    expect(texts).toHaveLength(1);
    expect(texts[0].text).toBe("450 x 300");
    expect(texts[0].x).toBe(100);
    expect(texts[0].y).toBe(200);
  });

  it("handles Tm (text matrix) for position", () => {
    const stream = [
      "BT",
      "1 0 0 1 55 320 Tm",
      "(Pieza A) Tj",
      "ET",
    ].join("\n");
    const { texts } = parseContentStream(stream);
    expect(texts).toHaveLength(1);
    expect(texts[0].text).toBe("Pieza A");
    expect(texts[0].x).toBe(55);
    expect(texts[0].y).toBe(320);
  });

  it("ignores whitespace-only text", () => {
    const stream = "BT 100 100 Td (   ) Tj ET";
    const { texts } = parseContentStream(stream);
    expect(texts).toHaveLength(0);
  });

  it("extracts multiple text items from multiple BT blocks", () => {
    const stream = [
      "BT 50 100 Td (Pared) Tj ET",
      "BT 150 100 Td (Base) Tj ET",
    ].join("\n");
    const { texts } = parseContentStream(stream);
    expect(texts).toHaveLength(2);
    expect(texts[0].text).toBe("Pared");
    expect(texts[1].text).toBe("Base");
  });

  it("does not confuse text operators with graphics operators", () => {
    const stream = [
      "0.8 0.2 0.1 rg",
      "100 200 300 150 re f",
      "BT",
      "120 260 Td",
      "(300 x 150) Tj",
      "ET",
    ].join("\n");
    const { rects, texts } = parseContentStream(stream);
    expect(rects).toHaveLength(1);
    expect(texts).toHaveLength(1);
  });
});
