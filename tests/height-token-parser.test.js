"use strict";

const assert = require("node:assert/strict");
const parser = require("../height-token-parser.js");

const productionTokens = [
  {
    name: "packed h key",
    token: "8QF7ImIiOlsxOTAxMTgyOSwwAgDTIih5ZWxsb3dfcmVkLAsA0W1hZ2VudGEpIl0sInczAF05MTUxMDMAAygAUSxub25lLQAQaC0AlDEyNzY2MTk3Ni8AEC0bAPkAbXMiOls0MjY3NzU2Njc4HADpbiI6WzI4NTIyNjgxMDIbABBmUgCZNTMyMDkzOTkwGwAQaDcAlTQ2NTUyOTkzMZwAA5UAVl9jeWFumgAgZmMtAHo5NzYwODEzfgAQcH4AmjU3NDA5NTE0M2MAEXS1AFo4OTU3NJgA8ChoIjoxLjU1NzM3NTQsInMiOjAuMDI0NzEwNzczLCJ2Ijo4LCJhIjowLCJlIjo1OTAsInIiOjB9",
    height: 1.5573754
  },
  {
    name: "binary height key",
    token: "8QF7ImIiOlsxOTAxMTgyOSwwAgDTIih5ZWxsb3dfcmVkLAsA_AttYWdlbnRhKSJdLCJ3IjpbMjE5NDM0MTU0MjUAAyoAUSxub25lLwAQaGIAlDEyNzY2MTk3Ni8AEC0bAPkAbXMiOls0MjY3NzU2Njc4HAAQbmYAmTg1MjI2ODEwMhsAEGZSAJk1MzIwOTM5OTAbABBoNwCVNDY1NTI5OTMxnAADlQBWX2N5YW6aACBmYy0Aejk3NjA4MTN-ABBwfgCaNTc0MDk1MTQzYwARdLUAajg5NTc0MhoA8CciOjEuNTMyNjg5OCwicyI6MC4wMjQ3MTA3NzMsInYiOjgsImEiOjAsImUiOjU5MCwiciI6MH0",
    height: 1.5326898
  }
];

function encode(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function makeToken(payload, packed = false) {
  const bytes = Buffer.from(payload, "latin1");
  return encode(packed ? Buffer.concat([Buffer.from([0xf1, 0x01, 0xff, 0x00]), bytes]) : bytes);
}

function expectCode(token, code) {
  assert.throws(() => parser.parseToken(token), error => error && error.code === code);
}

for (const sample of productionTokens) {
  const result = parser.parseToken(sample.token);
  assert.equal(result.height, sample.height, sample.name);
  assert.equal(result.scale, 0.024710773, sample.name);
  assert.equal(result.version, 8, sample.name);
}

const legacyTokens = [
  makeToken('{"height":-1.25,"s":0.05,"v":8,"a":0,"e":590,"r":0}'),
  makeToken('{"any_name":2,"s":1,"v":8,"a":1,"e":0,"r":3}')
];
assert.deepEqual(
  legacyTokens.map(token => parser.parseToken(token).height),
  [-1.25, 2]
);

const packedTokens = [
  makeToken('{"x":"noise",\x80\x00"ignored":0.75,"s":0.1,"v":8,"a":2,"e":10,"r":1}', true),
  makeToken('{"x":-2,"s":0,"v":8,"a":0,"e":590,"r":0}', true)
];
assert.deepEqual(
  packedTokens.map(token => parser.parseToken(token).height),
  [0.75, -2]
);

expectCode("abc$", "INVALID_BASE64");
expectCode("YWJj=", "INVALID_BASE64");
expectCode(productionTokens[0].token.slice(0, -8), "UNSUPPORTED_FORMAT");
expectCode(makeToken('{"height":2.01,"s":0.1,"v":8,"a":0,"e":0,"r":0}'), "INVALID_HEIGHT");
expectCode(makeToken('{"height":1,"s":1.01,"v":8,"a":0,"e":0,"r":0}'), "INVALID_SCALE");
expectCode(makeToken('{"height":1,"s":0.1,"v":9,"a":0,"e":0,"r":0}'), "UNSUPPORTED_VERSION");
expectCode(makeToken('{"height":1,"s":0.1,"a":0,"v":8,"e":0,"r":0}'), "UNSUPPORTED_FORMAT");
expectCode(makeToken('{"note":"1,\\"s\\":0.1,\\"v\\":8,\\"a\\":0,\\"e\\":0,\\"r\\":0}"}'), "UNSUPPORTED_FORMAT");
expectCode(encode(Buffer.from('prefix:"height":1,"s":0.1,"v":8,"a":0,"e":0,"r":0}', "latin1")), "UNSUPPORTED_FORMAT");
expectCode(makeToken('{"x":{"h":1,"s":0.1,"v":8,"a":0,"e":0,"r":0},"y":{"h":-1,"s":0.2,"v":8,"a":0,"e":0,"r":0}}'), "AMBIGUOUS_FORMAT");
expectCode(makeToken('{"x":{"h":1,"s":0.1,"v":8,"a":0,"e":0,"r":0},"y":{"h":9,"s":0.2,"v":8,"a":0,"e":0,"r":0}}'), "AMBIGUOUS_FORMAT");

console.log("height token parser tests passed");
