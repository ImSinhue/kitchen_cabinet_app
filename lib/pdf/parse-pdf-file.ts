/**
 * PDF File Reader — Expo / Android file-system adapter
 *
 * Reads a PDF from the device file system using expo-file-system/legacy,
 * converts base64 to Uint8Array safely (no atob / no latin1 encoding),
 * and delegates parsing to parsePDFBytes().
 *
 * Handles content:// URIs produced by expo-document-picker on Android by
 * first copying the file to the app cache directory before reading.
 */

import * as FileSystem from "expo-file-system/legacy";
import { inflate } from "pako";
import { parsePDFBytes } from "./cutlist-pdf-parser";
import { base64ToBytes } from "./base64-to-bytes";

export type { ParseResult, ParsedBoard, CutPiece } from "./cutlist-pdf-parser";
export { base64ToBytes } from "./base64-to-bytes";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a PDF file on the device and return boards with pieces.
 *
 * @param uri - File URI returned by expo-document-picker (file:// or content://)
 */
export async function parsePDFFile(uri: string): Promise<ReturnType<typeof parsePDFBytes>> {
  let readableUri = uri;

  // Android content:// URIs cannot always be read directly by
  // FileSystem.readAsStringAsync — copy to cache first.
  if (uri.startsWith("content://")) {
    const filename = uri.split("/").pop() ?? "temp.pdf";
    const dest = `${FileSystem.cacheDirectory ?? ""}${filename}`;
    try {
      await FileSystem.copyAsync({ from: uri, to: dest });
      readableUri = dest;
    } catch (copyError) {
      console.warn(
        "[parsePDFFile] copyAsync failed, trying direct read:",
        copyError,
      );
      // Fall through and attempt direct read anyway
    }
  }

  let base64: string;
  try {
    base64 = await FileSystem.readAsStringAsync(readableUri, {
      encoding: (FileSystem.EncodingType?.Base64 ?? "base64") as "base64",
    });
  } catch (readError) {
    throw new Error(
      `[parsePDFFile] Failed to read file at "${readableUri}": ${String(readError)}`,
    );
  }

  if (!base64 || base64.length === 0) {
    throw new Error("[parsePDFFile] File is empty or could not be read.");
  }

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(base64);
  } catch (decodeError) {
    throw new Error(
      `[parsePDFFile] Base64 decode failed: ${String(decodeError)}`,
    );
  }

  return parsePDFBytes(bytes, inflate);
}
