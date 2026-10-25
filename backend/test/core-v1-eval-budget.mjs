import assert from 'node:assert/strict';
// Micro-USD, conservative before dispatch. A reservation survives unknown outcomes.
export function evaluationCeiling(body){
 assert.ok(['gpt-5-mini','gpt-5-mini-2025-08-07'].includes(body.model));assert.equal(body.store,false);assert.equal(body.service_tier,'default');assert.ok(Number.isSafeInteger(body.max_output_tokens)&&body.max_output_tokens>0&&body.max_output_tokens<=2600);
 return Math.ceil((Buffer.byteLength(JSON.stringify(body),'utf8')+1024)*.25+body.max_output_tokens*2);
}
export class EvaluationBudget{
 constructor(limit=2000000,maxAttempts=80){assert.ok(limit>0&&limit<=2000000);assert.ok(maxAttempts>0&&maxAttempts<=80);this.limit=limit;this.maxAttempts=maxAttempts;this.attempts=0;this.spent=0;this.held=0;}
 reserve(body){const ceiling=evaluationCeiling(body);assert.ok(this.attempts<this.maxAttempts,'evaluation_attempt_cap');assert.ok(this.spent+this.held+ceiling<=this.limit,'evaluation_cost_cap');this.attempts++;this.held+=ceiling;return{ceiling,settled:false};}
 settle(reservation,usage){
  assert.equal(reservation.settled,false,'evaluation_already_settled');
  const input=usage?.input_tokens,output=usage?.output_tokens,cached=usage?.input_tokens_details?.cached_tokens??0;
  if(![input,output,cached].every(value=>Number.isSafeInteger(value)&&value>=0)||cached>input)return null;
  const cost=Math.ceil((input-cached)*.25+cached*.025+output*2);assert.ok(cost<=reservation.ceiling,'evaluation_usage_exceeds_ceiling');
  reservation.settled=true;this.held-=reservation.ceiling;this.spent+=cost;return cost;
 }
 snapshot(){return{approvedLimitMicrousd:this.limit,maxAttempts:this.maxAttempts,attempts:this.attempts,spentMicrousd:this.spent,heldMicrousd:this.held,conservativeTotalMicrousd:this.spent+this.held};}
}
