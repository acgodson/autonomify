const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const binString = Array.from(bytes, (b) => String.fromCodePoint(b)).join("");
  let result = "";
  let i = 0;

  while (i < binString.length) {
    const a = binString.charCodeAt(i++);
    const b = binString.charCodeAt(i++);
    const c = binString.charCodeAt(i++);
    const triplet = (a << 16) | ((b || 0) << 8) | (c || 0);

    result += BASE64_CHARS[(triplet >> 18) & 0x3f];
    result += BASE64_CHARS[(triplet >> 12) & 0x3f];
    result += isNaN(b) ? "=" : BASE64_CHARS[(triplet >> 6) & 0x3f];
    result += isNaN(c) ? "=" : BASE64_CHARS[triplet & 0x3f];
  }

  return result;
}

export function bytesToHex(bytes: Uint8Array | number[] | string): string {
  if (typeof bytes === "string") {
    if (bytes.startsWith("0x")) return bytes;
    if (bytes.includes(",")) {
      const arr = bytes.split(",").map((n) => parseInt(n.trim()));
      return "0x" + arr.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return bytes;
  }

  const arr = Array.isArray(bytes) ? bytes : Array.from(bytes);
  return "0x" + arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}
