/** A future catalog version must never accidentally enable recurring billing.
 * Resolve only terms which were explicitly reviewed when invoices were issued. */
export function invoiceIsRecurring(product:string,catalogVersion:string){
 if(product!=='premium_month')return false;
 if(catalogVersion==='luna-3.0-proposed'||catalogVersion==='luna-3.4')return true;
 if(catalogVersion==='luna-4.3'||catalogVersion==='luna-4.0-completion-v1')return false;
 throw new Error('unreviewed_invoice_renewal_terms');
}
