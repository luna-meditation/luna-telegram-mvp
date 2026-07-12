export type LunaProductCapabilities = {
  canRenderMeditationCardInChat: boolean;
  canOpenPlayerFromCard: boolean;
  canStartPlaybackDirectly: boolean;
  hasLibraryTab: boolean;
  hasSupportPage: boolean;
  hasSettingsPage: boolean;
  hasAboutPage: boolean;
};

export const lunaProductCapabilities: LunaProductCapabilities = {
  canRenderMeditationCardInChat: true,
  canOpenPlayerFromCard: true,
  canStartPlaybackDirectly: false,
  hasLibraryTab: true,
  hasSupportPage: false,
  hasSettingsPage: false,
  hasAboutPage: false
};

export const productCapabilitiesPrompt = `Use only VERIFIED_PRODUCT_CAPABILITIES. Never invent navigation, Support, Settings, About, contact details, developer/admin names, playback state, or actions. The backend and frontend control product actions. Never claim that a card was rendered or playback started.`;
