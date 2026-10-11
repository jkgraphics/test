// Self-contained printable HTML receipt (works offline once downloaded; "Print → Save as PDF").
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function money(minor, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

export function renderReceipt({ company, branch, table, bill, title = 'Receipt' }) {
  const m = (v) => money(v, company.currency);
  const rows = bill.lines.map((l) => `
    <tr><td>${esc(l.name)}${l.options.length ? `<div class="opt">${l.options.map((o) => esc(o.name)).join(', ')}</div>` : ''}</td>
    <td class="r">${l.qty}</td><td class="r">${m(l.unit_price)}</td><td class="r">${m(l.line_total)}</td></tr>`).join('');
  const pays = bill.payments.filter((p) => p.status === 'paid' || p.status === 'refunded').map((p) => `
    <tr><td colspan="3">${esc(p.method.toUpperCase())}${p.provider_mode === 'test' ? ' (TEST MODE)' : ''}${p.reference ? ` · ${esc(p.reference)}` : ''}</td><td class="r">${m(p.amount)}</td></tr>
    ${p.refunded_amount ? `<tr><td colspan="3">Refunded</td><td class="r">-${m(p.refunded_amount)}</td></tr>` : ''}`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} #${esc(bill.bill_no)} – ${esc(company.name)}</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px;margin:24px auto;padding:0 16px;color:#222;background:#fff}
h1{font-size:20px;margin:0}.muted{color:#666;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:14px}
td,th{padding:6px 0;border-bottom:1px dashed #ddd;vertical-align:top}th{text-align:left;font-size:12px;color:#666}.r{text-align:right}
.opt{font-size:12px;color:#777}.tot td{font-weight:700;font-size:16px;border-bottom:2px solid #222}.center{text-align:center}
@media print{button{display:none}}
</style></head><body>
<div class="center"><h1>${esc(company.name)}</h1><div class="muted">${esc(branch.name)}${branch.address ? ` · ${esc(branch.address)}` : ''}</div>
<div class="muted">${esc(title)} #${esc(bill.bill_no)} · Table ${esc(table.number)} · ${esc(new Date().toLocaleString('en-IN'))}</div></div>
<table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<table>
<tr><td colspan="3">Subtotal</td><td class="r">${m(bill.subtotal)}</td></tr>
${bill.discount ? `<tr><td colspan="3">Discount${bill.discount_reason ? ` (${esc(bill.discount_reason)})` : ''}</td><td class="r">-${m(bill.discount)}</td></tr>` : ''}
${bill.service_charge ? `<tr><td colspan="3">Service charge (${bill.service_charge_pct}%)</td><td class="r">${m(bill.service_charge)}</td></tr>` : ''}
${bill.taxes.map((t) => `<tr><td colspan="3">${esc(t.name)} (${t.rate}%)</td><td class="r">${m(t.amount)}</td></tr>`).join('')}
<tr class="tot"><td colspan="3">Total</td><td class="r">${m(bill.total)}</td></tr>
${pays}
<tr><td colspan="3"><b>Balance due</b></td><td class="r"><b>${m(bill.outstanding)}</b></td></tr>
</table>
<p class="center muted">Thank you for dining with us!</p>
<p class="center"><button onclick="window.print()">Print / Save as PDF</button></p>
</body></html>`;
}
