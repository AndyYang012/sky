"use strict";

const assert = require("node:assert/strict");
const processing = require("../height-qr-processing.js");

const lowContrast = Uint8ClampedArray.from([
  100, 100, 100, 255,
  105, 105, 105, 255,
  110, 110, 110, 255,
  115, 115, 115, 255
]);
const normalized = processing.normalizeContrast(lowContrast);
assert.equal(normalized[0], 0);
assert.equal(normalized[12], 159);
assert.deepEqual([normalized[3], normalized[7], normalized[11], normalized[15]], [255, 255, 255, 255]);

const blackAndWhite = Uint8ClampedArray.from([
  10, 10, 10, 255,
  20, 20, 20, 255,
  230, 230, 230, 255,
  240, 240, 240, 255
]);
const binary = processing.binarizeOtsu(blackAndWhite);
assert.deepEqual(Array.from(binary), [
  0, 0, 0, 255,
  0, 0, 0, 255,
  255, 255, 255, 255,
  255, 255, 255, 255
]);

assert.deepEqual(processing.scanDimensions(4000, 2000), [
  {width: 2200, height: 1100},
  {width: 1440, height: 720},
  {width: 900, height: 450}
]);
assert.deepEqual(processing.scanDimensions(400, 200), [
  {width: 700, height: 350},
  {width: 400, height: 200}
]);
assert.deepEqual(processing.scanDimensions(0, 100), []);

console.log("height QR processing tests passed");
