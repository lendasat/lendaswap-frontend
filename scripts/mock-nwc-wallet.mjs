#!/usr/bin/env node

/**
 * Mock NWC (Nostr Wallet Connect) wallet for testing.
 *
 * Simulates a Lightning wallet that responds to NWC requests:
 * - get_info: returns mock node info
 * - get_balance: returns a configurable fake balance
 * - pay_invoice: returns a fake preimage (doesn't actually pay)
 * - make_invoice: returns a fake BOLT11 invoice
 *
 * Usage:
 *   node scripts/mock-nwc-wallet.mjs [--balance 250000] [--relay wss://relay.damus.io]
 *
 * Prints the NWC connection URI to paste into LendaSwap.
 */

import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";

// Resolve nostr-tools from the pnpm store
const _require = createRequire(import.meta.url);
const nostrToolsPath = new URL(
  "../node_modules/.pnpm/nostr-tools@2.23.1_typescript@5.7.3/node_modules/nostr-tools",
  import.meta.url,
).pathname;

const { generateSecretKey, getPublicKey, finalizeEvent } = await import(
  `file://${nostrToolsPath}/lib/esm/pure.js`
);
const nip04 = await import(`file://${nostrToolsPath}/lib/esm/nip04.js`);

// --- Args ---
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const BALANCE_SATS = Number(getArg("balance", "250000"));
const RELAY_URL = getArg("relay", "wss://relay.damus.io");

// --- Keys ---
const walletSk = generateSecretKey();
const walletPk = getPublicKey(walletSk);
const appSk = generateSecretKey();
const appPk = getPublicKey(appSk);
const appSecretHex = Buffer.from(appSk).toString("hex");

const nwcUri = `nostr+walletconnect://${walletPk}?relay=${encodeURIComponent(RELAY_URL)}&secret=${appSecretHex}`;

console.log("\n┌─────────────────────────────────────────┐");
console.log("│         Mock NWC Wallet Started          │");
console.log("├─────────────────────────────────────────┤");
console.log(`│  Balance: ${BALANCE_SATS.toLocaleString().padEnd(29)}│`);
console.log(`│  Relay:   ${RELAY_URL.slice(0, 29).padEnd(29)}│`);
console.log("└─────────────────────────────────────────┘");
console.log("\nConnection URI (paste into LendaSwap):\n");
console.log(nwcUri);
console.log("\nWaiting for requests...\n");

// --- Relay connection via WebSocket ---
// Use the built-in WebSocket (Node 22+) or fallback
const WebSocket = globalThis.WebSocket ?? (await import("ws")).default;

let ws;
let reconnectTimer;

function connect() {
  ws = new WebSocket(RELAY_URL);

  ws.onopen = () => {
    console.log(`✓ Connected to ${RELAY_URL}`);

    // Subscribe to NWC requests (kind 23194) addressed to our wallet pubkey
    const subId = randomBytes(8).toString("hex");
    const sub = JSON.stringify([
      "REQ",
      subId,
      {
        kinds: [23194],
        "#p": [walletPk],
        since: Math.floor(Date.now() / 1000) - 10,
      },
    ]);
    ws.send(sub);
  };

  ws.onmessage = async (msg) => {
    try {
      const data = JSON.parse(msg.data);
      if (data[0] !== "EVENT") return;

      const event = data[2];
      if (event.kind !== 23194) return;

      // Verify it's from our app
      if (event.pubkey !== appPk) {
        console.log(
          `  ⊘ Ignoring request from unknown pubkey ${event.pubkey.slice(0, 12)}...`,
        );
        return;
      }

      // Decrypt the request
      const decrypted = await nip04.decrypt(walletSk, appPk, event.content);
      const request = JSON.parse(decrypted);
      console.log(`  ← ${request.method}`, request.params || "");

      // Handle the request
      const result = handleRequest(request);
      console.log(
        `  → ${request.method}:`,
        JSON.stringify(result).slice(0, 120),
      );

      // Build response
      const responseContent = JSON.stringify({
        result_type: request.method,
        result,
      });

      // Encrypt and publish response
      const encrypted = await nip04.encrypt(walletSk, appPk, responseContent);
      const responseEvent = finalizeEvent(
        {
          kind: 23195,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ["p", appPk],
            ["e", event.id],
          ],
          content: encrypted,
        },
        walletSk,
      );

      ws.send(JSON.stringify(["EVENT", responseEvent]));
    } catch (err) {
      console.error("  ✗ Error handling message:", err.message);
    }
  };

  ws.onclose = () => {
    console.log("  ⚠ Relay disconnected, reconnecting in 3s...");
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 3000);
  };

  ws.onerror = (err) => {
    console.error("  ✗ WebSocket error:", err.message || err);
  };
}

function handleRequest(request) {
  switch (request.method) {
    case "get_info":
      return {
        alias: "Mock NWC Wallet",
        color: "#ff9900",
        pubkey: walletPk,
        network: "signet",
        block_height: 200000,
        block_hash: "0".repeat(64),
        methods: ["pay_invoice", "get_balance", "make_invoice", "get_info"],
      };

    case "get_balance":
      return {
        balance: BALANCE_SATS * 1000, // NWC uses msats
      };

    case "pay_invoice": {
      const preimage = randomBytes(32).toString("hex");
      console.log(
        `  💸 Mock-paid invoice (preimage: ${preimage.slice(0, 16)}...)`,
      );
      return { preimage };
    }

    case "make_invoice": {
      const amountMsats = request.params?.amount || 100000000;
      const amountSats = Math.floor(amountMsats / 1000);
      // Generate a fake but realistic-looking BOLT11 invoice
      const fakeInvoice = generateFakeBolt11(amountSats);
      console.log(`  🧾 Generated mock invoice for ${amountSats} sats`);
      return {
        type: "incoming",
        invoice: fakeInvoice,
        description: request.params?.description || "LendaSwap",
        description_hash: "",
        preimage: "",
        payment_hash: randomBytes(32).toString("hex"),
        amount: amountMsats,
        fees_paid: 0,
        created_at: Math.floor(Date.now() / 1000),
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };
    }

    default:
      console.log(`  ⚠ Unknown method: ${request.method}`);
      return {
        error: {
          code: "NOT_IMPLEMENTED",
          message: `Method ${request.method} not supported by mock wallet`,
        },
      };
  }
}

/**
 * Generate a fake BOLT11 invoice string.
 * This won't be decodable by a real decoder, but it looks realistic enough
 * for UI testing. The lendaswap AddressInput will try to decode it,
 * so we make it start with lnbc/lntbs and be the right length.
 */
function generateFakeBolt11(amountSats) {
  // For testing, generate a signet (tbs) invoice-like string
  const amountPart =
    amountSats >= 1000000
      ? `${amountSats / 100000000}` // BTC
      : `${amountSats / 1000}m`; // mBTC
  const randomPart = randomBytes(100).toString("hex");
  return `lntbs${amountPart}1p${randomPart}`;
}

// Start
connect();

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down mock wallet...");
  ws?.close();
  clearTimeout(reconnectTimer);
  process.exit(0);
});
