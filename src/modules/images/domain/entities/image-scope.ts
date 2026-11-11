import { InvalidImageScopeError } from '../errors/invalid-image-scope.error.js';

/**
 * The kinds of owner an image can belong to (spec 102, decision 4): the scope `strategic-game:<id>` groups the images
 * of the chronicle of a campaign, so they can be listed (`q=scope==…`) and deleted together with the campaign.
 */
export const IMAGE_SCOPE_KINDS = ['strategic-game'] as const;

export type ImageScopeKind = (typeof IMAGE_SCOPE_KINDS)[number];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The id each kind of scope accepts. */
const ID_PATTERNS: Record<ImageScopeKind, RegExp> = {
  'strategic-game': UUID_PATTERN,
};

/** The scope of an image, `<kind>:<id>`: an InvalidImageScopeError for anything else, an empty one included. */
export function parseImageScope(value: string | undefined | null): string {
  if (typeof value !== 'string' || value.length === 0) throw new InvalidImageScopeError(value);
  const separator = value.indexOf(':');
  if (separator < 0) throw new InvalidImageScopeError(value);
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (!(IMAGE_SCOPE_KINDS as readonly string[]).includes(kind)) throw new InvalidImageScopeError(value);
  if (!ID_PATTERNS[kind as ImageScopeKind].test(id)) throw new InvalidImageScopeError(value);
  return value;
}
