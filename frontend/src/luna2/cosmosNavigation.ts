// A bounded in-memory view position. No personal text or browser storage.
export type CosmosChapter='essence'|'strengths'|'growth'|'relationships'|'direction'|'discoveries'|'astrology';
export type CosmosView='overview'|'chart'|'discoveries'|'journey';
type Position={scrollTop:number;chapter:CosmosChapter|null;expandedDiscovery:string|null;view:CosmosView;scroll:Partial<Record<CosmosView,number>>;journeyVisible:number};
const positions=new Map<string,Position>();
export function cosmosPosition(scope:string){
 let value=positions.get(scope);if(!value){value={scrollTop:0,chapter:null,expandedDiscovery:null,view:'overview',scroll:{},journeyVisible:8};positions.set(scope,value);while(positions.size>3)positions.delete(positions.keys().next().value!);}return value;
}
