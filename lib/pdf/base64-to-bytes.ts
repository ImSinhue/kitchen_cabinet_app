/**
 * base64ToBytes — pure utility, no RN/Expo dependencies.
 *
 * Decodes a base64 string to a Uint8Array without using `atob`, `Buffer`,
 * or any `latin1` encoding — works in both Hermes/JSC (React Native) and
 * Node.js (tests / server).
 */

/**
 * Decode a base64 string to a Uint8Array.
 *
 * @param base64 - Plain base64 or `data:<mime>;base64,<data>` string.
 */
export function base64ToBytes(base64: string): Uint8Array {
  // Strip data-URL prefix if present (e.g. "data:application/pdf;base64,")
  const cleaned = base64.replace(/^data:[^;]+;base64,/, "");
  const str = cleaned.replace(/[\r\n\s]/g, "");

  const CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  // Pre-build lookup table for performance on large files
  const lookup = new Uint8Array(256).fill(255);
  for (let i = 0; i < CHARS.length; i++) lookup[CHARS.charCodeAt(i)] = i;
  lookup[0x3d] = 0; // '=' is used as padding — treat as 0

  const len = str.length;

  // Calculate exact output length accounting for padding
  let outputLen = Math.floor((len / 4) * 3);
  if (str[len - 1] === "=") outputLen--;
  if (str[len - 2] === "=") outputLen--;

  const output = new Uint8Array(outputLen);
  let outIdx = 0;

  for (let i = 0; i < len; i += 4) {
    const e1 = lookup[str.charCodeAt(i)] ?? 0;
    const e2 = lookup[str.charCodeAt(i + 1)] ?? 0;
    const e3 = lookup[str.charCodeAt(i + 2)] ?? 0;
    const e4 = lookup[str.charCodeAt(i + 3)] ?? 0;

    const chr1 = (e1 << 2) | (e2 >> 4);
    const chr2 = ((e2 & 0x0f) << 4) | (e3 >> 2);
    const chr3 = ((e3 & 0x03) << 6) | e4;

    output[outIdx++] = chr1;
    if (str[i + 2] !== "=") output[outIdx++] = chr2;
    if (str[i + 3] !== "=") output[outIdx++] = chr3;
  }

  return output;
}
