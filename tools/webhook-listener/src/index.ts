import express from "express";
import crypto from "node:crypto";

const PORT = Number(process.env.PORT ?? 4500);
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  throw new Error("WEBHOOK_SECRET env var is required");
}

const app = express();

// Capture the raw body — HMAC must be computed over the exact bytes sent
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody: Buffer }).rawBody = buf;
    },
  }),
);

app.get("/", (req, res) => {
  return res.status(200).json({"message": "Webhook server is live."})
})

app.post("/webhooks/transfer", (req, res) => {
  const signature = req.header("x-webhook-signature");
  const rawBody = (req as express.Request & { rawBody: Buffer }).rawBody;

  if (!signature) {
    console.warn("[webhook] rejected: missing X-Webhook-Signature header");
    return res.status(400).json({ error: "missing signature" });
  }

  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const receivedHex = signature.startsWith("sha256=")
    ? signature.slice("sha256=".length)
    : signature;

  const received = Buffer.from(receivedHex, "hex");
  const expectedBuf = Buffer.from(expected, "hex");

  const isValid =
    received.length === expectedBuf.length &&
    crypto.timingSafeEqual(received, expectedBuf);

  if (!isValid) {
    console.warn("[webhook] rejected: signature mismatch", {
      received: signature,
      expected,
    });
    return res.status(401).json({ error: "invalid signature" });
  }

  const { transferId, status, amount, currency, timestamp } = req.body;
  console.log("[webhook] verified payload received", {
    transferId,
    status,
    amount,
    currency,
    timestamp,
  });

  res.status(200).json({ received: true });
});

app.listen(PORT, () => {
  console.log(
    `Webhook listener running at http://localhost:${PORT}/webhooks/transfer`,
  );
});
