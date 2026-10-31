/** Where an image comes from (spec 057): the rmu-mfe-assets manifest (`base`) or an upload to this API (`user`). */
export const IMAGE_SOURCES = ['base', 'user'] as const;

export type ImageSource = (typeof IMAGE_SOURCES)[number];
