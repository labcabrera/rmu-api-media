export const IMAGE_CATEGORIES = ['generic', 'race', 'item', 'user', 'avatars'] as const;

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];
