import { HttpError, secret, sha256, equalHex, limitedText, response, rpc, db, q, adminIdentity, rateLimit } from './http.ts';
import { amountCOP, uuid } from './validation.mjs';
import { VerificationError, queryDetail, numericReference } from './epayco-detail.mjs';
export const BUILD = 'bn-confirmation-native-1';
const isRecord = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function parseParams(params) {
  for (const name of new Set(params.keys())) {
    if (params.getAll(name).length !== 1) throw new VerificationError('DUPLICATE_PARAMETER', 400);
  }
  return Object.fromEntries(params);
}
async function incomingData(req) {
  if (req.method === 'GET') return parseParams(new URL(req.url).searchParams);
  const raw = await limitedText(req, 65536);
  if (req.headers.get('content-type')?.includes('application/json')) {
    try { const obj = JSON.parse(raw); if (!isRecord(obj)) throw Error(); return obj; }
    catch { throw new VerificationError('INVALID_JSON', 400); }
  }
  return parseParams(new URLSearchParams(raw));
}
function match(a, b, code) { if (a !== b) throw new VerificationError(code, 400); }
function applyArgs(d) {
  return { p_invoice: d.invoice, p_ref: d.reference, p_transaction: d.transaction,
    p_amount: d.amount, p_currency: d.currency, p_test: d.isTest, p_status: d.status };
}
function testOnly(d) {
  if (d.isTest !== true || d.currency !== 'COP' || !d.invoice.startsWith('BN26TEST-')) {
    throw new VerificationError('NOT_A_TEST_PAYMENT', 400);
  }
}
export function createHandler(overrides = {}) {
  const deps = { secret, sha256, equalHex, rpc, db, adminIdentity, rateLimit, queryDetail, ...overrides };
  return async req => {
    if (req.method === 'GET' && new URL(req.url).search === '?health=1') return response({ service: 'bn2026-webhook', build: BUILD });
    if (!['POST', 'GET'].includes(req.method)) return response({ error: 'Method not allowed' }, 405);
    try {
      const data = await incomingData(req);
      if (data.action === 'reconcile') {
        if (req.method !== 'POST') throw new VerificationError('METHOD_NOT_ALLOWED', 405);
        const admin = await deps.adminIdentity(req);
        if (deps.secret('BN_PAYMENTS_MODE') !== 'test') throw new VerificationError('TEST_MODE_REQUIRED');
        if (!uuid(data.reservationId)) throw new VerificationError('INVALID_RESERVATION', 400);
        const ref = numericReference(data.reference);
        await deps.rateLimit('reconcile:' + admin.id, 6, 60);
        const rows = await deps.db('bn_reservations?select=id,event_id,invoice,amount,status&id=eq.' + q(data.reservationId));
        if (rows.length !== 1) throw new VerificationError('RESERVATION_NOT_FOUND', 404);
        const r = rows[0];
        const events = await deps.db('bn_events?select=environment&id=eq.' + q(r.event_id));
        if (events[0]?.environment !== 'test') throw new VerificationError('NOT_A_TEST_RESERVATION', 403);
        const d = await deps.queryDetail(ref, deps.secret);
        testOnly(d);
        match(d.invoice, r.invoice, 'RESERVATION_INVOICE_MISMATCH');
        match(d.amount, r.amount, 'RESERVATION_AMOUNT_MISMATCH');
        const result = await deps.rpc('bn_apply_payment', applyArgs(d));
        return response({ received: true, mode: 'test', reference: d.reference, providerStatus: d.status,
          status: result.status ?? (result.review ? 'review' : 'verification_pending'), build: BUILD });
      }
      if (typeof data.x_ref_payco !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(data.x_ref_payco) ||
          typeof data.x_signature !== 'string' || !/^[a-f0-9]{64}$/i.test(data.x_signature) ||
          typeof data.x_transaction_id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(data.x_transaction_id) ||
          typeof data.x_currency_code !== 'string' || typeof data.x_amount !== 'string') {
        throw new VerificationError('INVALID_NOTIFICATION', 400);
      }
      const merchant = deps.secret('EPAYCO_P_CUST_ID_CLIENTE');
      const signature = await deps.sha256([merchant, deps.secret('EPAYCO_P_KEY'), data.x_ref_payco,
        data.x_transaction_id, data.x_amount, data.x_currency_code].join('^'));
      if (!deps.equalHex(signature, data.x_signature)) throw new VerificationError('INVALID_SIGNATURE', 401);
      if (deps.secret('BN_PAYMENTS_MODE') !== 'test') throw new VerificationError('TEST_MODE_REQUIRED');
      const d = await deps.queryDetail(data.x_ref_payco, deps.secret);
      match(d.transaction, data.x_transaction_id, 'TRANSACTION_MISMATCH');
      match(d.currency, data.x_currency_code.toUpperCase(), 'CURRENCY_MISMATCH');
      let callbackAmount;
      try { callbackAmount = amountCOP(data.x_amount); } catch { throw new VerificationError('INVALID_AMOUNT', 400); }
      match(d.amount, callbackAmount, 'AMOUNT_MISMATCH');
      if (!d.invoice.startsWith('BN26TEST-')) return response({ ignored: true, build: BUILD });
      testOnly(d);
      const result = await deps.rpc('bn_apply_payment', applyArgs(d));
      return response({ received: true, ...result, build: BUILD });
    } catch (err) {
      const status = err instanceof VerificationError ? err.status : err instanceof HttpError ? err.status : 503;
      const code = err instanceof VerificationError ? err.code : 'VERIFICATION_NOT_COMPLETED';
      return response({ error: code, build: BUILD }, status);
    }
  };
}
