/**
 * Smoke test for parseMyExpensesResponse.
 * Run: npx tsx scripts/test-mydata-parser.ts
 */

import { parseMyExpensesResponse } from "../src/lib/mydata/parser";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <expensesDoc>
    <mark>123456789012345</mark>
    <issuerVat>123456789</issuerVat>
    <issuerName>Test Supplier</issuerName>
    <issueDate>2026-01-15</issueDate>
    <totalAmount>100.50</totalAmount>
    <netAmount>82.56</netAmount>
    <vatAmount>17.94</vatAmount>
    <series>A</series>
    <aa>123</aa>
  </expensesDoc>
</Response>`;

function run(): void {
  const result = parseMyExpensesResponse(SAMPLE_XML);
  if (result.length === 0) {
    console.error("FAIL: Expected at least 1 expense, got 0");
    process.exit(1);
  }
  const first = result[0];
  if (first.mark !== "123456789012345") {
    console.error("FAIL: Expected mark 123456789012345, got", first.mark);
    process.exit(1);
  }
  if (first.issuerVat !== "123456789") {
    console.error("FAIL: Expected issuerVat 123456789, got", first.issuerVat);
    process.exit(1);
  }
  if (first.totalAmount !== 100.5) {
    console.error("FAIL: Expected totalAmount 100.5, got", first.totalAmount);
    process.exit(1);
  }
  console.log("OK: parseMyExpensesResponse smoke test passed");
}

run();
