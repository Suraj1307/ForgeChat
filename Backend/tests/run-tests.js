import assert from "node:assert/strict";

import { normalizeIncomingAttachment } from "../utils/attachments.js";
import { normalizeRole, sanitizeMessagesForModel } from "../utils/openai.js";
import createRateLimit from "../utils/rateLimit.js";

const tests = [];

const test = (name, fn) => {
  tests.push({ name, fn });
};

const createResponse = () => ({
  statusCode: 200,
  headers: {},
  body: null,
  setHeader(name, value) {
    this.headers[name] = value;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

test("text attachments are stored without raw binary fields", async () => {
  const result = await normalizeIncomingAttachment({
    kind: "text",
    name: "notes.js",
    mimeType: "text/javascript",
    textContent: "console.log('hi')",
    size: 18,
  });

  assert.equal(result.processingAttachment.kind, "text");
  assert.equal(result.storedAttachment.textContent, "console.log('hi')");
  assert.equal(result.storedAttachment.fileData, undefined);
});

test("pdf attachments keep raw data only for processing", async () => {
  const result = await normalizeIncomingAttachment({
    kind: "pdf",
    name: "spec.pdf",
    mimeType: "application/pdf",
    fileData: "abc123",
    size: 200,
  });

  assert.equal(result.processingAttachment.fileData, "abc123");
  assert.equal(result.storedAttachment.fileData, undefined);
  assert.equal(result.storedAttachment.name, "spec.pdf");
});

test("image attachments store metadata without base64 preview", async () => {
  const result = await normalizeIncomingAttachment({
    kind: "image",
    name: "diagram.png",
    mimeType: "image/png",
    previewUrl: "data:image/png;base64,abc123",
    size: 150,
  });

  assert.equal(result.processingAttachment.previewUrl, "data:image/png;base64,abc123");
  assert.equal(result.storedAttachment.previewUrl, undefined);
  assert.match(result.storedAttachment.textContent, /Image attachment uploaded/);
});

test("unsupported attachment types are rejected", async () => {
  await assert.rejects(
    () =>
      normalizeIncomingAttachment({
        kind: "exe",
        name: "bad.exe",
        size: 10,
      }),
    /Unsupported attachment type/
  );
});

test("rate limiter allows requests up to the limit", () => {
  const limiter = createRateLimit({
    keyPrefix: "test-allow",
    maxRequests: 2,
    windowMs: 1000,
    message: "Too many requests",
  });

  const req = { headers: {}, ip: "127.0.0.1" };
  const res = createResponse();
  let nextCalls = 0;

  limiter(req, res, () => {
    nextCalls += 1;
  });

  limiter(req, res, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 2);
  assert.equal(res.statusCode, 200);
});

test("rate limiter blocks requests over the limit", () => {
  const limiter = createRateLimit({
    keyPrefix: "test-block",
    maxRequests: 1,
    windowMs: 1000,
    message: "Slow down",
  });

  const req = { headers: {}, ip: "127.0.0.2" };
  const res = createResponse();

  limiter(req, res, () => {});
  limiter(req, res, () => {});

  assert.equal(res.statusCode, 429);
  assert.equal(res.body.error, "Slow down");
  assert.ok(Number(res.headers["Retry-After"]) >= 1);
});

test("legacy and empty roles are normalized before sending to OpenAI", () => {
  assert.equal(normalizeRole("gpt"), "assistant");
  assert.equal(normalizeRole("system"), "developer");
  assert.equal(normalizeRole(""), "user");

  const messages = sanitizeMessagesForModel([
    { role: "gpt", content: "Old assistant reply" },
    { role: "", content: "User question from old thread" },
    { role: "assistant", content: "   " },
  ]);

  assert.deepEqual(messages, [
    {
      role: "assistant",
      content: [{ type: "output_text", text: "Old assistant reply" }],
    },
    {
      role: "user",
      content: [{ type: "input_text", text: "User question from old thread" }],
    },
  ]);
});

let failures = 0;

for (const currentTest of tests) {
  try {
    await currentTest.fn();
    console.log(`PASS ${currentTest.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${currentTest.name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`All ${tests.length} tests passed.`);
}
