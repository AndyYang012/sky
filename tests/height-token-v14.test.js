"use strict";

const assert = require("node:assert/strict");
const parser = require("../height-token-parser.js");

// Minimal reproduction of the f1 01 / v14 Sky Mirror screenshot. Retain
// its field layout and packed marker without publishing the player's QR.
function token({height = 1.8937697, scale = 0.058539994, version = 14} = {}) {
  return Buffer.concat([
    Buffer.from([0xf1, 0x01]),
    Buffer.from('{"b":[]', "ascii"),
    Buffer.from([0x1b, 0x00, 0xf0, 0x2a]),
    Buffer.from(`":${height},"s":${scale},"v":${version},"a":0,"e":44171,"r":0}`, "ascii")
  ]).toString("base64url");
}

assert.deepEqual(parser.parseToken(token()), {
  height: 1.8937697,
  scale: 0.058539994,
  version: 14,
  avatar: 0,
  energy: 44171,
  role: 0
});

for (const [options, code] of [
  [{height: 2.01}, "INVALID_HEIGHT"],
  [{scale: 1.01}, "INVALID_SCALE"],
  [{scale: -0.01}, "INVALID_SCALE"],
  [{version: 15}, "UNSUPPORTED_VERSION"]
]) {
  assert.throws(() => parser.parseToken(token(options)), error => error.code === code);
}

assert.throws(
  () => parser.parseToken(token().slice(0, -8)),
  error => error.code === "UNSUPPORTED_FORMAT"
);

console.log("Sky Mirror version 14 token tests passed");
