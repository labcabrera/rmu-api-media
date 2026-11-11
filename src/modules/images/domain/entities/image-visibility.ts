/**
 * Who may see an image (spec 057, decision 8). Every image is public for now: `friends` and `private` are reserved
 * for a later spec, which will serve them through signed URLs instead of as static files.
 */
export const IMAGE_VISIBILITIES = ['public', 'friends', 'private'] as const;

export type ImageVisibility = (typeof IMAGE_VISIBILITIES)[number];

/** The visibilities a client may set today. */
export const SUPPORTED_IMAGE_VISIBILITIES: readonly ImageVisibility[] = ['public'];

export const DEFAULT_IMAGE_VISIBILITY: ImageVisibility = 'public';
