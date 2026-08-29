(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SkyHeightToken = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_TOKEN_LENGTH = 16384;
  const SUPPORTED_VERSIONS = new Set([8, 9]);
  const PACKED_V2_VERSIONS = new Set([2]);
  const PACKED_V3_VERSIONS = new Set([4]);
  const KNOWN_PACKED_ENVELOPES = new Set([0x01, 0x02, 0x03]);
  const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  function fail(code) { const error = new Error(code); error.code = code; throw error; }

  function decodeBase64Url(token) {
    if (typeof token !== "string" || token.length === 0) fail("EMPTY_TOKEN");
    if (token.length > MAX_TOKEN_LENGTH) fail("INVALID_BASE64");
    let normalized = "";
    for (const char of token) {
      if (char === "-") normalized += "+";
      else if (char === "_" || char === "~") normalized += "/";
      else if (char === "=" || BASE64.includes(char)) normalized += char;
      else fail("INVALID_BASE64");
    }
    const firstPadding = normalized.indexOf("=");
    if (firstPadding !== -1) {
      if (firstPadding < normalized.length - 2) fail("INVALID_BASE64");
      for (let i = firstPadding; i < normalized.length; i++) if (normalized[i] !== "=") fail("INVALID_BASE64");
      const paddingLength = normalized.length - firstPadding;
      if (normalized.length % 4 !== 0 || (paddingLength === 1 && firstPadding % 4 !== 3) || (paddingLength === 2 && firstPadding % 4 !== 2)) fail("INVALID_BASE64");
      normalized = normalized.slice(0, firstPadding);
    }
    if (normalized.length % 4 === 1) fail("INVALID_BASE64");
    const output = [];
    for (let i = 0; i < normalized.length; i += 4) {
      const remaining = Math.min(4, normalized.length - i); let value = 0;
      for (let j = 0; j < 4; j++) { value <<= 6; if (j < remaining) { const digit = BASE64.indexOf(normalized[i + j]); if (digit < 0) fail("INVALID_BASE64"); value |= digit; } }
      output.push((value >>> 16) & 0xff); if (remaining > 2) output.push((value >>> 8) & 0xff); if (remaining > 3) output.push(value & 0xff);
    }
    return Uint8Array.from(output);
  }

  function isWhitespace(byte) { return byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d; }
  function skipWhitespace(bytes, index) { while (index < bytes.length && isWhitespace(bytes[index])) index++; return index; }
  function previousNonWhitespace(bytes, index) { index--; while (index >= 0 && isWhitespace(bytes[index])) index--; return index; }

  function readNumber(bytes, index, integerOnly) {
    const start = index; if (bytes[index] === 0x2d) index++;
    const integerStart = index; while (bytes[index] >= 0x30 && bytes[index] <= 0x39) index++; if (index === integerStart) return null;
    if (!integerOnly && bytes[index] === 0x2e) { index++; const fractionStart = index; while (bytes[index] >= 0x30 && bytes[index] <= 0x39) index++; if (index === fractionStart) return null; }
    if (!integerOnly && (bytes[index] === 0x65 || bytes[index] === 0x45)) { index++; if (bytes[index] === 0x2b || bytes[index] === 0x2d) index++; const exponentStart = index; while (bytes[index] >= 0x30 && bytes[index] <= 0x39) index++; if (index === exponentStart) return null; }
    let text = ""; for (let i = start; i < index; i++) text += String.fromCharCode(bytes[i]); const value = Number(text); return Number.isFinite(value) ? {value, index} : null;
  }

  function readField(bytes, index, name, integerOnly) {
    index = skipWhitespace(bytes, index); if (bytes[index++] !== 0x2c) return null; index = skipWhitespace(bytes, index); if (bytes[index++] !== 0x22) return null; if (bytes[index++] !== name.charCodeAt(0)) return null;
    if (!integerOnly && bytes[index] === 0x0f && bytes[index + 1] === 0x00 && bytes[index + 2] === 0xf0 && bytes[index + 3] === 0x15) { index = skipWhitespace(bytes, index + 4); const fraction = readNumber(bytes, index, true); if (!fraction) return null; const digits = fraction.index - index; return {value: fraction.value / (10 ** digits), index: fraction.index}; }
    if (bytes[index++] !== 0x22) return null; index = skipWhitespace(bytes, index); if (bytes[index++] !== 0x3a) return null; index = skipWhitespace(bytes, index); return readNumber(bytes, index, integerOnly);
  }

  function hasSupportedEnvelope(bytes) { if (bytes.length >= 3 && bytes[0] === 0xf1 && bytes[1] > 0x00) return true; return bytes[skipWhitespace(bytes, 0)] === 0x7b; }
  function isPackedV2Envelope(bytes) { return bytes.length >= 3 && bytes[0] === 0xf1 && bytes[1] === 0x02; }
  function isPackedV3Envelope(bytes) { return bytes.length >= 3 && bytes[0] === 0xf1 && bytes[1] === 0x03; }

  function hasHeightPrefix(bytes, start, allowCompressedKey) {
    const before = previousNonWhitespace(bytes, start); if (before >= 0 && bytes[before] === 0x3a) return true;
    if (!allowCompressedKey || start < 3) return false; const a = bytes[start - 3], b = bytes[start - 2], c = bytes[start - 1];
    return (a === 0x00 && b === 0xf0 && c === 0x26) || (a === 0xeb && b === 0x00 && c === 0xd0);
  }

  function parseCandidate(bytes, start, allowCompressedKey) {
    if (!hasHeightPrefix(bytes, start, allowCompressedKey)) return null;
    const height = readNumber(bytes, start, false); if (!height) return null; const scale = readField(bytes, height.index, "s", false); if (!scale) return null; const version = readField(bytes, scale.index, "v", true); if (!version) return null; const avatar = readField(bytes, version.index, "a", true); if (!avatar) return null; const energy = readField(bytes, avatar.index, "e", true); if (!energy) return null; const role = readField(bytes, energy.index, "r", true); if (!role) return null;
    const end = skipWhitespace(bytes, role.index); if (bytes[end] !== 0x7d) return null;
    return {height: height.value, scale: scale.value, version: version.value, avatar: avatar.value, energy: energy.value, role: role.value};
  }

  function parsePackedV2Candidate(bytes, start) {
    if (start < 2 || bytes[start - 2] !== 0xf1 || bytes[start - 1] !== 0x08) return null;
    const height = readNumber(bytes, start, false); if (!height) return null; const scale = readField(bytes, height.index, "s", false); if (!scale) return null; const version = readField(bytes, scale.index, "v", true); if (!version) return null;
    let index = skipWhitespace(bytes, version.index); if (bytes[index++] !== 0x2c || bytes[index++] !== 0x22 || bytes[index++] !== 0x61) return null; if (bytes[index++] !== 0x0c || bytes[index++] !== 0x00 || bytes[index++] !== 0xe0) return null; if (bytes[index++] !== 0x65 || bytes[index++] !== 0x22 || bytes[index++] !== 0x3a) return null;
    const energy = readNumber(bytes, skipWhitespace(bytes, index), true); if (!energy) return null; const role = readField(bytes, energy.index, "r", true); if (!role) return null; const end = skipWhitespace(bytes, role.index); if (bytes[end] !== 0x7d || skipWhitespace(bytes, end + 1) !== bytes.length) return null;
    return {height: height.value, scale: scale.value, version: version.value, avatar: 0, energy: energy.value, role: role.value};
  }

  function parsePackedV3Candidate(bytes, start) {
    if (!hasHeightPrefix(bytes, start, false)) return null; const height = readNumber(bytes, start, false); if (!height) return null; const scale = readField(bytes, height.index, "s", false); if (!scale) return null; const version = readField(bytes, scale.index, "v", true); if (!version) return null;
    let index = skipWhitespace(bytes, version.index); if (bytes[index++] !== 0x2c || bytes[index++] !== 0x22 || bytes[index++] !== 0x61) return null; if (bytes[index++] !== 0x0c || bytes[index++] !== 0x00 || bytes[index++] !== 0xf0 || bytes[index++] !== 0x00) return null; if (bytes[index++] !== 0x65 || bytes[index++] !== 0x22 || bytes[index++] !== 0x3a) return null;
    const encodedScale = readNumber(bytes, skipWhitespace(bytes, index), true); if (!encodedScale || encodedScale.value > 1000000000) return null; const role = readField(bytes, encodedScale.index, "r", true); if (!role) return null; const end = skipWhitespace(bytes, role.index); if (bytes[end] !== 0x7d || skipWhitespace(bytes, end + 1) !== bytes.length) return null;
    return {height: height.value, scale: encodedScale.value / 1000000000, scaleRaw: encodedScale.value, version: version.value, avatar: 0, energy: 0, role: role.value};
  }

  function validateCandidate(candidate, supportedVersions) {
    if (candidate.height < -2 || candidate.height > 2) return "INVALID_HEIGHT"; if (candidate.scale < 0 || candidate.scale > 1) return "INVALID_SCALE"; if (!supportedVersions.has(candidate.version)) return "UNSUPPORTED_VERSION";
    for (const key of ["avatar", "energy", "role"]) if (!Number.isSafeInteger(candidate[key]) || candidate[key] < 0) return "UNSUPPORTED_FORMAT"; return "";
  }

  function bytesToLatin1(bytes, start, end) { let text = ""; for (let i = start; i < end; i++) text += String.fromCharCode(bytes[i]); return text; }
  function findLastHeightBeforeScale(bytes, scaleIndex) { const text = bytesToLatin1(bytes, 0, scaleIndex); const matches = text.matchAll(/-?\d+\.\d+(?:[eE][-+]?\d+)?/g); let height = null; for (const match of matches) { const value = Number(match[0]); if (Number.isFinite(value) && value >= -2 && value <= 2) height = value; } return height; }
  function findScaleAfterAnchor(bytes, start) { const text = bytesToLatin1(bytes, start, Math.min(bytes.length, start + 80)); const matches = text.matchAll(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g); for (const match of matches) { const raw = match[0], value = Number(raw); if (!Number.isFinite(value)) continue; if (raw.includes(".") || /e/i.test(raw)) { if (value >= 0 && value <= 1) return value; continue; } if (/^\d{7,9}$/.test(raw)) { const scaled = value / 1000000000; if (scaled >= 0 && scaled <= 1) return scaled; } } return null; }

  function parseTolerantPackedV1Candidate(bytes) {
    if (skipWhitespace(bytes, bytes.length - 1) !== bytes.length - 1 || bytes[bytes.length - 1] !== 0x7d) return null;
    for (let i = 0; i < bytes.length - 1; i++) { if (bytes[i] !== 0x22 || bytes[i + 1] !== 0x73) continue; const height = findLastHeightBeforeScale(bytes, i); const scale = findScaleAfterAnchor(bytes, i + 2); if (height === null || scale === null) continue; return {height, scale, format: "tolerant-f1"}; }
    return null;
  }

  function hasAsciiField(bytes, start, end, field) { return bytesToLatin1(bytes, Math.max(0, start), Math.min(bytes.length, end)).includes(`\"${field}\"`); }
  function findLocalHeightBeforeScale(bytes, scaleIndex) {
    const start = Math.max(0, scaleIndex - 120), text = bytesToLatin1(bytes, start, scaleIndex), matches = text.matchAll(/-?\d+\.\d+(?:[eE][-+]?\d+)?/g); let result = null;
    for (const match of matches) { const value = Number(match[0]); if (!Number.isFinite(value) || value < -2 || value > 2) continue; result = {value, index: start + match.index}; }
    return result;
  }

  function parseFuturePackedCandidate(bytes) {
    if (bytes.length < 4 || bytes[0] !== 0xf1 || KNOWN_PACKED_ENVELOPES.has(bytes[1])) return null; const last = previousNonWhitespace(bytes, bytes.length); if (last < 0 || bytes[last] !== 0x7d) return null;
    const candidates = [];
    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] !== 0x22 || bytes[i + 1] !== 0x73) continue; const height = findLocalHeightBeforeScale(bytes, i), scale = findScaleAfterAnchor(bytes, i + 2); if (!height || scale === null) continue;
      let score = 6; const distance = i - height.index; if (distance <= 48) score += 2; if (hasAsciiField(bytes, i, i + 120, "v")) score += 2; if (hasAsciiField(bytes, i, i + 160, "r")) score += 1; if (last - i <= 220) score += 1; if (score < 10) continue;
      candidates.push({height: height.value, scale, format: "heuristic-future-f1", confidence: score});
    }
    const unique = []; for (const candidate of candidates) if (!unique.some(item => item.height === candidate.height && item.scale === candidate.scale)) unique.push(candidate);
    if (unique.length > 1) fail("AMBIGUOUS_FORMAT"); return unique[0] || null;
  }

  function parseBytes(bytes) {
    if (!(bytes instanceof Uint8Array) || !hasSupportedEnvelope(bytes)) fail("UNSUPPORTED_FORMAT");
    const packedV2 = isPackedV2Envelope(bytes), packedV3 = isPackedV3Envelope(bytes), packedV1 = bytes.length >= 3 && bytes[0] === 0xf1 && bytes[1] === 0x01, futurePacked = bytes.length >= 3 && bytes[0] === 0xf1 && !KNOWN_PACKED_ENVELOPES.has(bytes[1]); const candidates = [];
    if (!futurePacked) for (let i = 0; i < bytes.length; i++) { const byte = bytes[i]; if (byte !== 0x2d && (byte < 0x30 || byte > 0x39)) continue; const candidate = packedV2 ? parsePackedV2Candidate(bytes, i) : packedV3 ? parsePackedV3Candidate(bytes, i) : parseCandidate(bytes, i, packedV1); if (candidate) candidates.push(candidate); }
    if (candidates.length > 1) fail("AMBIGUOUS_FORMAT");
    if (candidates.length === 0) { const fallback = packedV1 ? parseTolerantPackedV1Candidate(bytes) : futurePacked ? parseFuturePackedCandidate(bytes) : null; if (!fallback) fail("UNSUPPORTED_FORMAT"); return fallback; }
    const supportedVersions = packedV2 ? PACKED_V2_VERSIONS : packedV3 ? PACKED_V3_VERSIONS : SUPPORTED_VERSIONS; const error = validateCandidate(candidates[0], supportedVersions); if (error) fail(error); return candidates[0];
  }

  function parseToken(token) { return parseBytes(decodeBase64Url(token)); }
  function bytesToPrintable(bytes, limit) { let result = ""; const length = Math.min(bytes.length, limit || bytes.length); for (let i = 0; i < length; i++) result += bytes[i] >= 0x20 && bytes[i] <= 0x7e ? String.fromCharCode(bytes[i]) : "·"; return result; }
  return {decodeBase64Url, parseBytes, parseToken, bytesToPrintable};
});