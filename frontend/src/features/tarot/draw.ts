// Unbiased local selection. No quota, payment, reward, history or server mutations.
export type RandomWord = () => number;
const uint32Range=2**32;
const cryptoWord: RandomWord = () => {
 if(!globalThis.crypto?.getRandomValues)throw new Error('Secure randomness unavailable');
 return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
};
export function randomIndex(count:number, nextWord:RandomWord=cryptoWord):number {
 if(!Number.isSafeInteger(count) || count<1 || count>uint32Range)throw new RangeError('Invalid selection size');
 const limit=uint32Range-(uint32Range%count);
 for(let attempt=0;attempt<128;attempt++){
  const word=nextWord();
  if(!Number.isInteger(word)||word<0||word>=uint32Range)throw new RangeError('Invalid random word');
  if(word<limit)return word%count;
 }
 throw new Error('Randomness provider failed');
}
export function drawOneCard<T>(deck:readonly T[],nextWord?:RandomWord):{card:T;orientation:'upright'|'reversed'} {
 const card=deck[randomIndex(deck.length,nextWord)];
 const orientation=randomIndex(2,nextWord)===1?'reversed':'upright';
 return {card,orientation};
}

// Partial Fisher–Yates: each selectable slot is an unbiased sample of the full deck.
// Five distinct cards, not five independent Draw buttons.
export function prepareCardChoices<T>(deck:readonly T[],nextWord?:RandomWord):T[] {
 if(deck.length<5)throw new RangeError('At least five cards are required');
 const pool=[...deck];
 for(let slot=0;slot<5;slot++){
  const index=slot+randomIndex(pool.length-slot,nextWord);
  [pool[slot],pool[index]]=[pool[index],pool[slot]];
 }
 return pool.slice(0,5);
}
