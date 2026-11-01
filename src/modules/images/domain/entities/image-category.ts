export const IMAGE_CATEGORIES = [
  'actions',
  'avatars',
  'backgrounds',
  'cultures',
  'doc',
  'generic',
  'icons',
  'items',
  'npcs',
  'photos',
  'professions',
  'races',
  'user-data',
] as const;

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];
