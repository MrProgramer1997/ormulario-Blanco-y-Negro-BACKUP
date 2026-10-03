import { request as httpsRequest } from 'node:https';
import { Buffer } from 'node:buffer';
import { amountCOP, testFlag, paymentStatus } from './validation.mjs';

export class VerificationError extends Error {
  constructor(code, status = 503) { super(code); this.code = code; this.status = status; }
}
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function scalar(v) {
  return typeof v === 'string' ? v.trim() : (typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
}
function required(v, code) { const s = scalar(v); if (!s || s.length > 256) throw new VerificationError(code); return s; }
function match(a, b, code) { if (a !== b) throw new VerificationError(code, 400); }
export function numericReference(v) {
  const s = scalar(v);
  if (!/^[1-9][0-9]{0,13}$/.test(s)) throw new VerificationError('INVALID_REFERENCE', 400);
  return s;
}
function statusOf(v) {
  const s = required(v, 'PROVIDER_STATUS_MISSING');
  return paymentStatus(s);
}
export function normalizeDetail(payload, expectedReference, expectedMerchant) {
  if (!record(payload) || payload.success !== true) throw new VerificationError('PROVIDER_QUERY_NOT_SUCCESSFUL');
  const d = payload.data;
  if (!record(d) || !record(d.log)) throw new VerificationError('PROVIDER_DETAIL_INCOMPLETE');
  const log = d.log;
  const ref = required(d.referencePayco, 'PROVIDER_REFERENCE_MISSING');
  match(ref, numericReference(expectedReference), 'REFERENCE_MISMATCH');
  match(required(log.x_ref_payco, 'PROVIDER_REFERENCE_MISSING'), ref, 'REFERENCE_MISMATCH');
  const merchant = required(log.x_cust_id_cliente, 'PROVIDER_MERCHANT_MISSING');
  match(merchant, String(expectedMerchant).trim(), 'MERCHANT_MISMATCH');
  const transaction = required(log.x_transaction_id, 'PROVIDER_TRANSACTION_MISSING');
  const invoice = required(d.bill, 'PROVIDER_INVOICE_MISSING');
  const logInvoice = scalar(log.x_id_invoice) || scalar(log.x_id_factura);
  match(required(logInvoice, 'PROVIDER_INVOICE_MISSING'), invoice, 'INVOICE_MISMATCH');
  for (const name of ['x_id_invoice', 'x_id_factura']) {
    if (scalar(log[name])) match(scalar(log[name]), invoice, 'INVOICE_MISMATCH');
  }
  let amount, logAmount, isTest, logTest;
  try { amount = amountCOP(d.amount); logAmount = amountCOP(log.x_amount); }
  catch { throw new VerificationError('PROVIDER_AMOUNT_INVALID'); }
  match(amount, logAmount, 'AMOUNT_MISMATCH');
  const currency = required(d.currency, 'PROVIDER_CURRENCY_MISSING').toUpperCase();
  match(required(log.x_currency_code, 'PROVIDER_CURRENCY_MISSING').toUpperCase(), currency, 'CURRENCY_MISMATCH');
  try { isTest = testFlag(d.test); logTest = testFlag(log.x_test_request); }
  catch { throw new VerificationError('PROVIDER_ENVIRONMENT_MISSING'); }
  match(isTest, logTest, 'ENVIRONMENT_MISMATCH');
  const status = statusOf(d.status);
  const logStatus = statusOf(log.x_response ?? log.x_respuesta);
  if (status !== logStatus) throw new VerificationError('PROVIDER_STATE_INCONSISTENT');
  return { reference: ref, merchant, transaction, invoice, amount, currency, isTest, status };
}
export function apifyJson(path, method, body, authorization, requestImpl = httpsRequest) {
  if (!['/login', '/transaction/detail'].includes(path)) throw new VerificationError('PROVIDER_ROUTE_NOT_ALLOWED');
  if ((path === '/login' && method !== 'POST') || (path === '/transaction/detail' && method !== 'GET')) {
    throw new VerificationError('PROVIDER_METHOD_NOT_ALLOWED');
  }
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    let settled = false;
    let req;
    const finish = (err, value) => {
      if (settled) return;
      settled = true; clearTimeout(deadline);
      err ? reject(err) : resolve(value);
    };
    const deadline = setTimeout(() => {
      finish(new VerificationError('PROVIDER_TIMEOUT'));
      req?.destroy();
    }, 9000);
    try {
      req = requestImpl({
        hostname: 'apify.epayco.co', port: 443, path, method,
        rejectUnauthorized: true, agent: false,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json',
          Authorization: authorization, ...(data ? { 'Content-Length': data.length } : {}) },
      }, res => {
        const code = res.statusCode ?? 0;
        if (code < 200 || code >= 300) {
          res.resume();
          finish(new VerificationError(code === 401 || code === 403 ? 'PROVIDER_AUTH_OR_PERMISSION' : 'PROVIDER_HTTP_ERROR'));
          return;
        }
        let bytes = 0; const chunks = [];
        res.on('data', chunk => {
          const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          bytes += part.length;
          if (bytes > 1048576) {
            finish(new VerificationError('PROVIDER_RESPONSE_TOO_LARGE')); req.destroy(); return;
          }
          chunks.push(part);
        });
        res.on('error', () => finish(new VerificationError('PROVIDER_READ_FAILED')));
        res.on('aborted', () => finish(new VerificationError('PROVIDER_READ_FAILED')));
        res.on('end', () => {
          try { finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
          catch { finish(new VerificationError('PROVIDER_JSON_INVALID')); }
        });
      });
      req.on('error', () => finish(new VerificationError('PROVIDER_NETWORK_ERROR')));
      req.end(data);
    } catch { finish(new VerificationError('PROVIDER_TRANSPORT_ERROR')); }
  });
}
export async function queryDetail(reference, secret, transport = apifyJson) {
  const ref = numericReference(reference);
  const credentials = Buffer.from(secret('EPAYCO_PUBLIC_KEY') + ':' + secret('EPAYCO_PRIVATE_KEY')).toString('base64');
  const auth = await transport('/login', 'POST', undefined, 'Basic ' + credentials);
  if (!record(auth) || typeof auth.token !== 'string' || auth.token.length < 20 || /[\r\n]/.test(auth.token)) {
    throw new VerificationError('PROVIDER_LOGIN_INVALID');
  }
  const detail = await transport('/transaction/detail', 'GET', { filter: { referencePayco: Number(ref) } }, 'Bearer ' + auth.token);
  return normalizeDetail(detail, ref, secret('EPAYCO_P_CUST_ID_CLIENTE'));
}
