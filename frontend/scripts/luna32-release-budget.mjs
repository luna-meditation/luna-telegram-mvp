import assert from 'node:assert/strict';
// Owner approval on 2026-10-16 supersedes the earlier total-October $30 rule.
// A prospective allowance is not evidence that historical provider spend was zero.
export function verifyLuna32ReleaseBudget(review,now=Date.now()){
 assert.equal(review.monthlyBudgetUsd,100);assert.equal(review.budgetMonth,new Date(now).toISOString().slice(0,7));
 assert.equal(review.budgetBaselineVerified,true);
 assert.ok(Number.isFinite(review.legacySpendBaselineUsd)&&review.legacySpendBaselineUsd>=0);
 assert.ok(Number.isFinite(Date.parse(review.baselineCutoffAt)));
 assert.ok(Date.parse(review.baselineCutoffAt)<=now&&now-Date.parse(review.baselineCutoffAt)<86400000,'Refresh the budget cutoff before release');
 if(review.budgetBaselineEvidence==='owner_verified_provider_usage')assert.equal(review.budgetScope,'total_calendar_month');
 else{
  assert.equal(review.budgetBaselineEvidence,'owner_approved_release_budget');
  assert.equal(review.budgetScope,'from_release_then_calendar_month');
  assert.equal(review.ownerApprovedProspectiveBudget,true);
  assert.equal(review.legacySpendBaselineUsd,0,'Zero here means no pre-release costs in the prospective allowance, NOT zero historical spend');
  assert.equal(review.newProductionLedgerVerifiedEmpty,true);
  assert.equal(review.generationDisabledDuringCutover,true);
 }
 assert.equal(review.budgetHandoverVerified,true);assert.equal(review.legacyInFlightReconciled,true);assert.equal(review.baselineIncludesCutoverCost,true);
}
