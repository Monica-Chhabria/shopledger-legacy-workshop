'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function orderWith(item, totals, coupon) {
  return {
    id: 42,
    date: '01/02/2025',
    customer: 'In-memory customer',
    status: 'completed',
    coupon: coupon || '',
    items: [item],
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice GST breakdown and total match the amount billed for an HSN-rated order', function () {
  var item = {
    id: 1,
    name: 'Rice',
    sku: 'GRN-001',
    hsn: '1006',
    price: 640,
    qty: 1
  };
  var billed = pricing.computeTotals([item], '');
  var invoiceFigures = invoice.computeInvoiceFigures(orderWith(item, billed, ''));

  assert.equal(invoiceFigures.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(invoiceFigures.rows[0].lineTax, billed.lines[0].tax);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice uses the HSN slab used to calculate the billed GST', function () {
  var item = {
    id: 1,
    name: 'Rice',
    sku: 'GRN-001',
    hsn: '1006',
    price: 640,
    qty: 1
  };
  var billed = pricing.computeTotals([item], '');
  var order = orderWith(item, billed, '');
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.tax, 32);
  assert.equal(billed.total, 672);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, 32);
  assert.equal(invoiceFigures.cgst, 16);
  assert.equal(invoiceFigures.sgst, 16);
  assert.equal(invoiceFigures.total, 672);
});

test('invoice uses the same capped coupon discount and post-discount GST as the billed order', function () {
  var item = {
    id: 1,
    name: 'Rice',
    sku: 'GRN-001',
    hsn: '1006',
    price: 2000,
    qty: 1
  };
  var billed = pricing.computeTotals([item], 'WELCOME');
  var order = orderWith(item, billed, 'WELCOME');
  var invoiceFigures = invoice.computeInvoiceFigures(order);
  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(billed.discount, 100);
  assert.equal(billed.tax, 95);
  assert.equal(billed.total, 1995);
  assert.equal(invoiceFigures.tax, 95);
  assert.equal(invoiceFigures.discount, 100);
  assert.equal(invoiceFigures.total, 1995);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
