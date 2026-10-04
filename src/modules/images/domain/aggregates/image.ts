import { randomUUID } from 'crypto';
import { BaseAggregateRoot } from 'src/modules/shared/domain/aggregates/base-aggregate';
import type { ImageProps } from './image-props';

export class Image extends BaseAggregateRoot<ImageProps> {
  public category: ImageProps['category'];
  public storageKey: string;
  public url: string;
  public contentType: string;
  public sizeBytes: number;
  public width: number | undefined;
  public height: number | undefined;
  public originalFilename: string | undefined;
  public altText: string | undefined;
  public metadata: Record<string, string> | undefined;
  public verified: boolean;
  public owner: string;
  public createdAt: Date;
  public updatedAt: Date | undefined;

  private constructor(props: ImageProps) {
    super(props.id);
    this.category = props.category;
    this.storageKey = props.storageKey;
    this.url = props.url;
    this.contentType = props.contentType;
    this.sizeBytes = props.sizeBytes;
    this.width = props.width;
    this.height = props.height;
    this.originalFilename = props.originalFilename;
    this.altText = props.altText;
    this.metadata = props.metadata;
    this.verified = props.verified;
    this.owner = props.owner;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<ImageProps, 'id' | 'createdAt' | 'updatedAt'>) {
    return new Image({
      ...props,
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: undefined,
    });
  }

  static fromProps(props: ImageProps) {
    return new Image(props);
  }

  getProps(): ImageProps {
    return {
      id: this.id,
      category: this.category,
      storageKey: this.storageKey,
      url: this.url,
      contentType: this.contentType,
      sizeBytes: this.sizeBytes,
      width: this.width,
      height: this.height,
      originalFilename: this.originalFilename,
      altText: this.altText,
      metadata: this.metadata,
      owner: this.owner,
      verified: this.verified,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  updateMetadata(props: Pick<Partial<ImageProps>, 'category' | 'altText' | 'metadata'>) {
    if (props.category !== undefined) this.category = props.category;
    if (props.altText !== undefined) this.altText = props.altText;
    if (props.metadata !== undefined) this.metadata = props.metadata;
    this.updatedAt = new Date();
  }

  markVerified() {
    this.verified = true;
    this.updatedAt = new Date();
  }

  updateContent(
    props: Pick<ImageProps, 'storageKey' | 'url' | 'contentType' | 'sizeBytes'> &
      Pick<Partial<ImageProps>, 'width' | 'height' | 'originalFilename'>,
  ) {
    this.storageKey = props.storageKey;
    this.url = props.url;
    this.contentType = props.contentType;
    this.sizeBytes = props.sizeBytes;
    this.width = props.width;
    this.height = props.height;
    if (props.originalFilename !== undefined) this.originalFilename = props.originalFilename;
    this.updatedAt = new Date();
  }
}
