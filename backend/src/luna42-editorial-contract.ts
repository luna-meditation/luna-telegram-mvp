export type EditorialKind='breathwork'|'tarot'|'astrology'|'garden'|'achievement'|'share'|'bot';
export type EditorialLocalized={en:string;ru:string};
export type EditorialCue={url:string;sha256:string;durationSeconds:number;text?:string};
export type EditorialPhaseKind='inhale'|'inhale_top'|'hold'|'exhale'|'pause';
export type EditorialBody={title:EditorialLocalized;description:EditorialLocalized;image?:string;guide?:EditorialLocalized;phases?:Array<{kind:EditorialPhaseKind;seconds:number}>;ambientAudio?:string;voiceCues?:Record<'en'|'ru',Record<EditorialPhaseKind,EditorialCue>>;upright?:EditorialLocalized;reversed?:EditorialLocalized};
export type EditorialEntry={kind:EditorialKind;key:string;body:EditorialBody;version?:number};
