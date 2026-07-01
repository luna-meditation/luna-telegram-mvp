export type AccessLevel = 'free' | 'premium';

export type Practice = {
  id: string;
  title: string;
  type: string;
  description: string;
  duration: string;
  access_level: AccessLevel;
  audio_url: string;
  cover_image_url: string;
};

export const samplePractices: Practice[] = [
  {
    id: 'calm-reset',
    title: '5-Minute Calm Reset',
    type: 'Meditation + Breathwork',
    description: 'A gentle reset to soften tension and return to your breath.',
    duration: '5 min',
    access_level: 'free',
    // TODO: Upload final Luna audio file and replace this placeholder URL.
    audio_url: 'https://example.com/audio/luna-calm-reset.mp3',
    cover_image_url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'sleep-deeply',
    title: 'Sleep Deeply Tonight',
    type: 'Sleep Meditation',
    description: 'A cinematic wind-down for deeper rest and a quieter mind.',
    duration: '18 min',
    access_level: 'premium',
    // TODO: Upload final Luna audio file and replace this placeholder URL.
    audio_url: 'https://example.com/audio/luna-sleep-deeply.mp3',
    cover_image_url: 'https://images.unsplash.com/photo-1511295742362-92c96b1cf484?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'anxiety-breathing',
    title: '4-7-8 Breathing for Anxiety',
    type: 'Breathing Practice',
    description: 'A paced breathing session for moments of anxiety and overwhelm.',
    duration: '8 min',
    access_level: 'premium',
    // TODO: Upload final Luna audio file and replace this placeholder URL.
    audio_url: 'https://example.com/audio/luna-478-anxiety.mp3',
    cover_image_url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'morning-energy',
    title: 'Morning Energy Reset',
    type: 'Morning Practice',
    description: 'Start with warmth, clarity, and gentle momentum.',
    duration: '10 min',
    access_level: 'premium',
    // TODO: Upload final Luna audio file and replace this placeholder URL.
    audio_url: 'https://example.com/audio/luna-morning-energy.mp3',
    cover_image_url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'focus-work',
    title: 'Focus Before Work',
    type: 'Focus Practice',
    description: 'Settle your attention before a deep work session.',
    duration: '7 min',
    access_level: 'premium',
    // TODO: Upload final Luna audio file and replace this placeholder URL.
    audio_url: 'https://example.com/audio/luna-focus-before-work.mp3',
    cover_image_url: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'confidence-builder',
    title: 'Confidence Builder',
    type: 'Guided Meditation',
    description: 'A steady, encouraging practice for grounded confidence.',
    duration: '12 min',
    access_level: 'premium',
    // TODO: Upload final Luna audio file and replace this placeholder URL.
    audio_url: 'https://example.com/audio/luna-confidence-builder.mp3',
    cover_image_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'emotional-balance',
    title: 'Emotional Balance Reset',
    type: 'Meditation',
    description: 'A soft practice for processing feelings without being swept away.',
    duration: '14 min',
    access_level: 'premium',
    // TODO: Upload final Luna audio file and replace this placeholder URL.
    audio_url: 'https://example.com/audio/luna-emotional-balance.mp3',
    cover_image_url: 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=1200&q=80'
  }
];
