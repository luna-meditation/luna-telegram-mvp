export type MilestoneSnapshot={rank:number;earned:string[]};
export function nextMilestone(previous:MilestoneSnapshot|null,current:MilestoneSnapshot){
 if(!previous)return null; // First observation is a baseline, not a migration party.
 if(current.rank>previous.rank)return {kind:'status' as const,id:String(current.rank)};
 const id=current.earned.find(id=>!previous.earned.includes(id));
 return id?{kind:'achievement' as const,id}:null;
}
