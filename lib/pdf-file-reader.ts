/**
 * PDF File Reader — Expo / Android file-system adapter
 *
 * Reads a PDF from the device file system using expo-file-system,
 * decompresses FlateDecode streams with pako, and delegates parsing
 * to the pure parsePDFBytes() function in cutlist-pdf-parser.ts.
 */

import * as FileSystem from "expo-file-system";
import { inflate } from "pako";
import { parsePDFBytes } from "./cutlist-pdf-parser";

export type { ParseResult, ParsedBoard, CutPiece } from "./cutlist-pdf-parser";

/**
 * Parse a PDF file on the device and return boards with pieces.
 *
 * @param uri - File URI returned by expo-document-picker (or expo-file-system).
 */
export async function parsePDFFile(uri: string) {
  // Read the file as Base64
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: "base64",
  });

  // Decode Base64 → Uint8Array
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return parsePDFBytes(bytes, inflate);
}
