import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const apiSource = readFileSync(resolve(process.cwd(), 'src/api.ts'), 'utf8');

test('local calendar dates do not use UTC ISO truncation', () => {
  const helper = appSource.slice(appSource.indexOf('function todayLocalDate()'), appSource.indexOf('function optimisticWellnessSummary'));
  assert.match(helper, /getFullYear\(\)/);
  assert.match(helper, /getMonth\(\) \+ 1/);
  assert.match(helper, /getDate\(\)/);
  assert.doesNotMatch(helper, /toISOString\(\)/);
});

test('daily check-in is user initiated and reuses the saved mood record', () => {
  assert.match(appSource, /const \[showCheckin, setShowCheckin\] = useState\(false\)/);
  assert.match(appSource, /onCheckinDetails=\{\(\) => setShowCheckin\(true\)\}/);
  assert.match(appSource, /hideMood=\{Boolean\(wellness\?\.todayCheckin\)\}/);
  assert.match(appSource, /local_date: todayLocalDate\(\)/);
});

test('unverified entitlement cannot expose purchase entry points', () => {
  assert.match(appSource, /if \(!accessVerified\) \{[\s\S]*?Plans will appear after your current access is confirmed/);
  assert.match(appSource, /\{accessVerified && <button onClick=\{onSubscription\}/);
});

test('payment flow validates invoice links and releases the CTA after Telegram stops responding', () => {
  assert.match(apiSource, /isValidTelegramInvoiceUrl/);
  assert.match(apiSource, /invoice_url/);
  assert.match(apiSource, /invoice_link/);
  assert.match(apiSource, /payload\.slug/);
  assert.match(appSource, /openTelegramInvoiceWithTimeout/);
  assert.match(appSource, /15_000/);
  assert.match(appSource, /90_000/);
  assert.match(appSource, /paymentOperationRef\.current/);
});

test('payment instrumentation traces the complete Telegram invoice lifecycle', () => {
  for (const stage of [
    'button_clicked',
    'request_started',
    'response_received',
    'invoice_object',
    'openInvoice_called',
    'openInvoice_callback',
    'success',
    'cancelled',
    'failed'
  ]) {
    assert.match(appSource, new RegExp(stage));
  }
  assert.match(appSource, /originalError: error/);
  assert.match(appSource, /WebApp\.openInvoice\(url, callback\)/);
});

test('paid payments refresh access, profile, Moon Seeds, and recent payments', () => {
  assert.match(appSource, /getRecentSuccessfulPayments/);
  assert.match(appSource, /refreshAccessAndPayments/);
  assert.match(appSource, /status === 'paid'/);
});

test('premium copy names account access restoration without App Store language', () => {
  assert.match(appSource, /restore: 'Restore Access'/);
  assert.match(appSource, /restore: 'Восстановить доступ'/);
  assert.doesNotMatch(appSource, /Restore purchases/);
  assert.doesNotMatch(appSource, /Восстановить покупки/);
});

test('production diagnostics and authenticated client telemetry are wired without initData leakage', () => {
  assert.match(apiSource, /getBackendVersion/);
  assert.match(apiSource, /\/api\/client-events/);
  assert.match(appSource, /ProductionDiagnostics/);
  assert.match(appSource, /frontendBuildMetadata/);
  assert.match(appSource, /apiDebugConfig\.apiBaseUrl/);
  assert.match(appSource, /setBackendVersion\(await getBackendVersion\(initData\)\)/);
  assert.match(resolve(process.cwd(), 'src/runtime-diagnostics.ts') ? readFileSync(resolve(process.cwd(), 'src/runtime-diagnostics.ts'), 'utf8') : '', /sendClientEvent/);
  assert.doesNotMatch(appSource, /sendClientEvent\([^\n]*initData/);
});

test('invoice opens automatically after the tariff tap and exposes fallback only after an open failure', () => {
  const buyPlanSource = appSource.slice(appSource.indexOf('const buyPlan = async'), appSource.indexOf('const openFallbackInvoice = async'));
  assert.match(buyPlanSource, /createInvoiceLink\(plan/);
  assert.match(buyPlanSource, /await openTelegramInvoiceWithTimeout/);
  assert.doesNotMatch(buyPlanSource, /setFallbackInvoice\(\{ plan, invoiceLink: invoice\.invoiceLink/);
  assert.match(buyPlanSource, /preparedInvoice && invoiceOpenAttempted/);
  assert.match(appSource, /fallbackInvoice/);
  assert.match(appSource, /openFallbackInvoice/);
  assert.match(appSource, /Open payment/);
  assert.match(appSource, /invokedAfterNetworkAwait: !userGesture/);
  assert.match(appSource, /directUserGesture: userGesture/);
});

test('Monthly and Lifetime plan CTAs both enter the same direct invoice pipeline', () => {
  const pricingSource = appSource.slice(appSource.indexOf('function PricingPage'), appSource.indexOf('function PlanCard'));
  assert.match(pricingSource, /onBuy\('monthly'\)/);
  assert.match(pricingSource, /onBuy\('lifetime'\)/);
  assert.match(pricingSource, /plans\.monthly\.amountStars/);
  assert.match(pricingSource, /plans\.lifetime\.amountStars/);
  assert.match(apiSource, /getPlans/);
});

test('all Telegram invoice callback statuses restore the primary CTA and paid refreshes account data', () => {
  for (const status of ['paid', 'cancelled', 'failed', 'pending']) {
    assert.match(appSource, new RegExp(`status === '${status}'`));
  }
  assert.match(appSource, /setOpeningPlan\(null\)/);
  assert.match(appSource, /paymentOperationRef\.current = false/);
  assert.match(appSource, /refreshAccessAndPayments\(invoice\.requestId\)/);
});

test('invoice URLs and slugs are never rendered by the Premium page', () => {
  const pricingSource = appSource.slice(appSource.indexOf('function PricingPage'), appSource.indexOf('function PlanCard'));
  assert.doesNotMatch(pricingSource, /\{fallbackInvoice\.invoiceLink\}/);
  assert.doesNotMatch(pricingSource, />\s*\{?[^<]*(invoice_url|invoice_link|slug)[^<]*</i);
});
