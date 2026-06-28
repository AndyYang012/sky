(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SkyQrProcessing = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_SCAN_EDGE = 2200;
  const MAX_SCAN_PIXELS = 3_000_000;

  function luminance(red, green, blue) {
    return Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
  }

  function grayscaleHistogram(rgba) {
    const histogram = new Uint32Array(256);
    for (let i = 0; i < rgba.length; i += 4) {
      histogram[luminance(rgba[i], rgba[i + 1], rgba[i + 2])]++;
    }
    return histogram;
  }

  function percentileFromHistogram(histogram, pixelCount, percentile) {
    const target = Math.max(1, Math.ceil(pixelCount * percentile));
    let seen = 0;
    for (let value = 0; value < histogram.length; value++) {
      seen += histogram[value];
      if (seen >= target) return value;
    }
    return 255;
  }

  function normalizeContrast(rgba) {
    const output = new Uint8ClampedArray(rgba.length);
    const pixelCount = Math.floor(rgba.length / 4);
    const histogram = grayscaleHistogram(rgba);
    const low = percentileFromHistogram(histogram, pixelCount, 0.03);
    const high = percentileFromHistogram(histogram, pixelCount, 0.97);
    const range = Math.max(24, high - low);

    for (let i = 0; i < rgba.length; i += 4) {
      const gray = luminance(rgba[i], rgba[i + 1], rgba[i + 2]);
      const adjusted = Math.max(0, Math.min(255, Math.round((gray - low) * 255 / range)));
      output[i] = adjusted;
      output[i + 1] = adjusted;
      output[i + 2] = adjusted;
      output[i + 3] = rgba[i + 3];
    }
    return output;
  }

  function otsuThreshold(histogram, pixelCount) {
    let weightedTotal = 0;
    for (let value = 0; value < histogram.length; value++) {
      weightedTotal += value * histogram[value];
    }

    let backgroundCount = 0;
    let backgroundWeight = 0;
    let bestThreshold = 127;
    let bestVariance = -1;
    for (let value = 0; value < histogram.length; value++) {
      backgroundCount += histogram[value];
      if (backgroundCount === 0) continue;
      const foregroundCount = pixelCount - backgroundCount;
      if (foregroundCount === 0) break;

      backgroundWeight += value * histogram[value];
      const backgroundMean = backgroundWeight / backgroundCount;
      const foregroundMean = (weightedTotal - backgroundWeight) / foregroundCount;
      const difference = backgroundMean - foregroundMean;
      const variance = backgroundCount * foregroundCount * difference * difference;
      if (variance > bestVariance) {
        bestVariance = variance;
        bestThreshold = value;
      }
    }
    return bestThreshold;
  }

  function binarizeOtsu(rgba) {
    const output = new Uint8ClampedArray(rgba.length);
    const pixelCount = Math.floor(rgba.length / 4);
    const histogram = grayscaleHistogram(rgba);
    const threshold = otsuThreshold(histogram, pixelCount);

    for (let i = 0; i < rgba.length; i += 4) {
      const value = luminance(rgba[i], rgba[i + 1], rgba[i + 2]) > threshold ? 255 : 0;
      output[i] = value;
      output[i + 1] = value;
      output[i + 2] = value;
      output[i + 3] = rgba[i + 3];
    }
    return output;
  }

  function dimensionsForLongEdge(width, height, requestedLongEdge) {
    const sourceLongEdge = Math.max(width, height);
    let scale = requestedLongEdge / sourceLongEdge;
    let targetWidth = Math.max(1, Math.round(width * scale));
    let targetHeight = Math.max(1, Math.round(height * scale));
    const pixels = targetWidth * targetHeight;
    if (pixels > MAX_SCAN_PIXELS) {
      scale *= Math.sqrt(MAX_SCAN_PIXELS / pixels);
      targetWidth = Math.max(1, Math.round(width * scale));
      targetHeight = Math.max(1, Math.round(height * scale));
    }
    return {width: targetWidth, height: targetHeight};
  }

  function scanDimensions(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [];
    const sourceLongEdge = Math.max(width, height);
    const requestedEdges = [
      Math.min(sourceLongEdge, MAX_SCAN_EDGE),
      Math.min(sourceLongEdge, 1440),
      Math.min(sourceLongEdge, 900)
    ];
    if (sourceLongEdge < 900) requestedEdges.unshift(Math.min(1200, Math.round(sourceLongEdge * 1.75)));

    const unique = new Map();
    for (const edge of requestedEdges) {
      const dimensions = dimensionsForLongEdge(width, height, edge);
      unique.set(`${dimensions.width}x${dimensions.height}`, dimensions);
    }
    return Array.from(unique.values());
  }

  return {normalizeContrast, binarizeOtsu, scanDimensions};
});
