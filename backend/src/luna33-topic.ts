/** Only an explicit independent practice request detaches an old artefact. */
export function independentPracticeTopic(message:string):'meditation'|'wellbeing'|null{
 if(/\b(?:tarot|card|chart|compatibility|mercury|venus)\b|(?:таро|расклад|карт[ауы]|совместим|меркур|венер)/i.test(message))return null;
 if(/\b(?:(?:recommend|suggest|find|start|play|open).{0,35}meditation|meditation for sleep|can(?:not|'t) sleep|help me sleep|start breathing|breathing practice|breathwork)\b|(?:подбери.{0,30}медитац|посоветуй.{0,30}медитац|включи.{0,30}медитац|не могу уснуть|помоги уснуть|дыхательн(?:ая|ую) практик|начать дыхание)/i.test(message))return /breath|дых/i.test(message)?'wellbeing':'meditation';
 return null;
}

export function astrologyWorkflowIntent(message:string,hasAttachment:boolean):'natal'|'compatibility'|null{
 const choose=/\b(?:check|calculate|compare|explore|show|start)\b|(?:проверь|рассчита|сравни|посмотр|покажи|хочу (?:проверить|сравнить|узнать))/i.test(message);
 if(/compatibility|совместим/i.test(message)&&(choose||/^(?:compatibility|совместимость)\s+(?:with|с)\s/i.test(message.trim())))return 'compatibility';
 if(!hasAttachment&&/natal chart|birth chart|натальн.{0,12}карт/i.test(message)&&/explain|show|open|explore|объясни|покажи|открой|посмотр/i.test(message))return 'natal';
 return null;
}
