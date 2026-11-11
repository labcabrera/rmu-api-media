export const IMAGE_CATEGORIES = [
  'actions',
  'armor',
  'avatars',
  'backgrounds',
  'chronicle',
  'cultures',
  'doc',
  'generic',
  'icons',
  'items',
  'npcs',
  'photos',
  'professions',
  'races',
  'spells',
  'weapons',
  'user-data',
] as const;

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];
