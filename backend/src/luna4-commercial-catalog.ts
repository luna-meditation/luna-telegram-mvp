import {luna4EconomySchema,luna4EconomyVersion} from './luna4-economy-policy.js';
import {luna43CommercialCatalog,parseLuna43Catalog} from './luna43-commerce-policy.js';
/** Compatibility VIEW of the same authoritative catalog, never another pricing
 * store. Existing surfaces can render while term-specific benefits stay explicit. */
export function materializeLuna4Catalog(value:unknown){
 const c=luna4EconomySchema.parse(value),b=luna43CommercialCatalog;
 return{...b,version:c.version,free:{...b.free,dailyCard:0},
  weekly:{stars:c.premiumStars.weekly,days:7,recurring:false as const},
  premium:{...b.premium,monthlyStars:c.premiumStars.monthly,ordinaryAiRepliesPerBillingMonth:c.premiumAllowances.monthly.standard,threeCardReadings:c.premiumAllowances.monthly.three,fiveCardReadings:0,compatibilityReports:0,renewalSeeds:0},
  annual:{...b.annual,stars:c.premiumStars.annual},lifetime:{...b.lifetime,stars:c.premiumStars.lifetime},
  seeds:{single:c.products.single,three:c.products.three,five:c.products.five,compatibility:c.products.compatibility},packages:c.packages,
  seedProducts:{aiMessages:{...c.products.aiMessages,enabled:true},deepAnalysis:{seeds:c.products.deep,enabled:true}},
  newEconomy:c};
}
export function parseCurrentCommercialCatalog(value:unknown){return(value as {version?:unknown}|null)?.version===luna4EconomyVersion?materializeLuna4Catalog(value):parseLuna43Catalog(value);}
