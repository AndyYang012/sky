"use strict";

const assert = require("node:assert/strict");
const parser = require("../height-token-parser.js");

function encode(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function futureToken(payload, envelope = 0x04) {
  return encode(Buffer.concat([
    Buffer.from([0xf1, envelope, 0x7b]),
    Buffer.from(payload, "latin1")
  ]));
}

const result = parser.parseToken(futureToken('noise:-0.875,"s":0.024710773,"v":10,"a":0,"e":590,"r":0}'));
assert.equal(result.height, -0.875);
assert.equal(result.scale, 0.024710773);
assert.equal(result.format, "heuristic-future-f1");
assert.ok(result.confidence >= 10);

// A future envelope still needs strong structural anchors; random numeric data
// must not be accepted merely because the values happen to be in range.
assert.throws(
  () => parser.parseToken(futureToken('noise:-0.5,other:0.02}')),
  error => error && error.code === "UNSUPPORTED_FORMAT"
);

// Multiple plausible height/scale groups are rejected rather than guessed.
assert.throws(
  () => parser.parseToken(futureToken('x:0.5,"s":0.1,"v":10,"r":0},junk,y:-0.5,"s":0.2,"v":10,"r":0}')),
  error => error && error.code === "AMBIGUOUS_FORMAT"
);

console.log("future height token fallback tests passed");
