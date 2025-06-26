import type { GraphQLClient, RequestOptions } from "graphql-request";
import { gql } from "graphql-tag";

export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends Record<string, unknown>> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"];
/** All built-in and custom scalars, mapped to their actual values */
export interface Scalars {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  DateTime: unknown;
  Dimension: unknown;
  HexColor: unknown;
  JSON: unknown;
  Quality: unknown;
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface Asset {
  __typename?: "Asset";
  contentType?: Maybe<Scalars["String"]>;
  contentfulMetadata: ContentfulMetadata;
  description?: Maybe<Scalars["String"]>;
  fileName?: Maybe<Scalars["String"]>;
  height?: Maybe<Scalars["Int"]>;
  linkedFrom?: Maybe<AssetLinkingCollections>;
  size?: Maybe<Scalars["Int"]>;
  sys: Sys;
  title?: Maybe<Scalars["String"]>;
  url?: Maybe<Scalars["String"]>;
  width?: Maybe<Scalars["Int"]>;
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface AssetContentTypeArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface AssetDescriptionArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface AssetFileNameArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface AssetHeightArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface AssetLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface AssetSizeArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface AssetTitleArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface AssetUrlArgs {
  locale?: InputMaybe<Scalars["String"]>;
  transform?: InputMaybe<ImageTransformOptions>;
}

/** Represents a binary file in a space. An asset can be any file type. */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type AssetWidthArgs = {
  locale?: InputMaybe<Scalars["String"]>;
};

export interface AssetCollection {
  __typename?: "AssetCollection";
  items: Maybe<Asset>[];
  limit: Scalars["Int"];
  skip: Scalars["Int"];
  total: Scalars["Int"];
}

export interface AssetFilter {
  AND?: InputMaybe<InputMaybe<AssetFilter>[]>;
  OR?: InputMaybe<InputMaybe<AssetFilter>[]>;
  contentType?: InputMaybe<Scalars["String"]>;
  contentType_contains?: InputMaybe<Scalars["String"]>;
  contentType_exists?: InputMaybe<Scalars["Boolean"]>;
  contentType_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  contentType_not?: InputMaybe<Scalars["String"]>;
  contentType_not_contains?: InputMaybe<Scalars["String"]>;
  contentType_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  description?: InputMaybe<Scalars["String"]>;
  description_contains?: InputMaybe<Scalars["String"]>;
  description_exists?: InputMaybe<Scalars["Boolean"]>;
  description_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  description_not?: InputMaybe<Scalars["String"]>;
  description_not_contains?: InputMaybe<Scalars["String"]>;
  description_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  fileName?: InputMaybe<Scalars["String"]>;
  fileName_contains?: InputMaybe<Scalars["String"]>;
  fileName_exists?: InputMaybe<Scalars["Boolean"]>;
  fileName_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  fileName_not?: InputMaybe<Scalars["String"]>;
  fileName_not_contains?: InputMaybe<Scalars["String"]>;
  fileName_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  height?: InputMaybe<Scalars["Int"]>;
  height_exists?: InputMaybe<Scalars["Boolean"]>;
  height_gt?: InputMaybe<Scalars["Int"]>;
  height_gte?: InputMaybe<Scalars["Int"]>;
  height_in?: InputMaybe<InputMaybe<Scalars["Int"]>[]>;
  height_lt?: InputMaybe<Scalars["Int"]>;
  height_lte?: InputMaybe<Scalars["Int"]>;
  height_not?: InputMaybe<Scalars["Int"]>;
  height_not_in?: InputMaybe<InputMaybe<Scalars["Int"]>[]>;
  size?: InputMaybe<Scalars["Int"]>;
  size_exists?: InputMaybe<Scalars["Boolean"]>;
  size_gt?: InputMaybe<Scalars["Int"]>;
  size_gte?: InputMaybe<Scalars["Int"]>;
  size_in?: InputMaybe<InputMaybe<Scalars["Int"]>[]>;
  size_lt?: InputMaybe<Scalars["Int"]>;
  size_lte?: InputMaybe<Scalars["Int"]>;
  size_not?: InputMaybe<Scalars["Int"]>;
  size_not_in?: InputMaybe<InputMaybe<Scalars["Int"]>[]>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]>;
  title_contains?: InputMaybe<Scalars["String"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]>;
  title_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  title_not?: InputMaybe<Scalars["String"]>;
  title_not_contains?: InputMaybe<Scalars["String"]>;
  title_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  url?: InputMaybe<Scalars["String"]>;
  url_contains?: InputMaybe<Scalars["String"]>;
  url_exists?: InputMaybe<Scalars["Boolean"]>;
  url_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  url_not?: InputMaybe<Scalars["String"]>;
  url_not_contains?: InputMaybe<Scalars["String"]>;
  url_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  width?: InputMaybe<Scalars["Int"]>;
  width_exists?: InputMaybe<Scalars["Boolean"]>;
  width_gt?: InputMaybe<Scalars["Int"]>;
  width_gte?: InputMaybe<Scalars["Int"]>;
  width_in?: InputMaybe<InputMaybe<Scalars["Int"]>[]>;
  width_lt?: InputMaybe<Scalars["Int"]>;
  width_lte?: InputMaybe<Scalars["Int"]>;
  width_not?: InputMaybe<Scalars["Int"]>;
  width_not_in?: InputMaybe<InputMaybe<Scalars["Int"]>[]>;
}

export interface AssetLinkingCollections {
  __typename?: "AssetLinkingCollections";
  componentAuthorCollection?: Maybe<ComponentAuthorCollection>;
  componentRichImageCollection?: Maybe<ComponentRichImageCollection>;
  componentSeoCollection?: Maybe<ComponentSeoCollection>;
  entryCollection?: Maybe<EntryCollection>;
  pageBlogPostCollection?: Maybe<PageBlogPostCollection>;
}

export interface AssetLinkingCollectionsComponentAuthorCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
}

export interface AssetLinkingCollectionsComponentRichImageCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
}

export interface AssetLinkingCollectionsComponentSeoCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
}

export interface AssetLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
}

export interface AssetLinkingCollectionsPageBlogPostCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
}

export enum AssetOrder {
  ContentTypeAsc = "contentType_ASC",
  ContentTypeDesc = "contentType_DESC",
  FileNameAsc = "fileName_ASC",
  FileNameDesc = "fileName_DESC",
  HeightAsc = "height_ASC",
  HeightDesc = "height_DESC",
  SizeAsc = "size_ASC",
  SizeDesc = "size_DESC",
  SysFirstPublishedAtAsc = "sys_firstPublishedAt_ASC",
  SysFirstPublishedAtDesc = "sys_firstPublishedAt_DESC",
  SysIdAsc = "sys_id_ASC",
  SysIdDesc = "sys_id_DESC",
  SysPublishedAtAsc = "sys_publishedAt_ASC",
  SysPublishedAtDesc = "sys_publishedAt_DESC",
  SysPublishedVersionAsc = "sys_publishedVersion_ASC",
  SysPublishedVersionDesc = "sys_publishedVersion_DESC",
  UrlAsc = "url_ASC",
  UrlDesc = "url_DESC",
  WidthAsc = "width_ASC",
  WidthDesc = "width_DESC",
}

/** To have author-related properties [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentAuthor) */
export type ComponentAuthor = Entry &
  _Node & {
    __typename?: "ComponentAuthor";
    _id: Scalars["ID"];
    avatar?: Maybe<Asset>;
    contentfulMetadata: ContentfulMetadata;
    internalName?: Maybe<Scalars["String"]>;
    linkedFrom?: Maybe<ComponentAuthorLinkingCollections>;
    name?: Maybe<Scalars["String"]>;
    sys: Sys;
  };

/** To have author-related properties [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentAuthor) */
export interface ComponentAuthorAvatarArgs {
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
}

/** To have author-related properties [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentAuthor) */
export interface ComponentAuthorInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** To have author-related properties [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentAuthor) */
export interface ComponentAuthorLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
}

/** To have author-related properties [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentAuthor) */
export interface ComponentAuthorNameArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

export interface ComponentAuthorCollection {
  __typename?: "ComponentAuthorCollection";
  items: Maybe<ComponentAuthor>[];
  limit: Scalars["Int"];
  skip: Scalars["Int"];
  total: Scalars["Int"];
}

export interface ComponentAuthorFilter {
  AND?: InputMaybe<InputMaybe<ComponentAuthorFilter>[]>;
  OR?: InputMaybe<InputMaybe<ComponentAuthorFilter>[]>;
  avatar_exists?: InputMaybe<Scalars["Boolean"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]>;
  internalName_contains?: InputMaybe<Scalars["String"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  name?: InputMaybe<Scalars["String"]>;
  name_contains?: InputMaybe<Scalars["String"]>;
  name_exists?: InputMaybe<Scalars["Boolean"]>;
  name_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  name_not?: InputMaybe<Scalars["String"]>;
  name_not_contains?: InputMaybe<Scalars["String"]>;
  name_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  sys?: InputMaybe<SysFilter>;
}

export interface ComponentAuthorLinkingCollections {
  __typename?: "ComponentAuthorLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
  pageBlogPostCollection?: Maybe<PageBlogPostCollection>;
}

export interface ComponentAuthorLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
}

export interface ComponentAuthorLinkingCollectionsPageBlogPostCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  order?: InputMaybe<InputMaybe<ComponentAuthorLinkingCollectionsPageBlogPostCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
}

export enum ComponentAuthorLinkingCollectionsPageBlogPostCollectionOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  PublishedDateAsc = "publishedDate_ASC",
  PublishedDateDesc = "publishedDate_DESC",
  SlugAsc = "slug_ASC",
  SlugDesc = "slug_DESC",
  SysFirstPublishedAtAsc = "sys_firstPublishedAt_ASC",
  SysFirstPublishedAtDesc = "sys_firstPublishedAt_DESC",
  SysIdAsc = "sys_id_ASC",
  SysIdDesc = "sys_id_DESC",
  SysPublishedAtAsc = "sys_publishedAt_ASC",
  SysPublishedAtDesc = "sys_publishedAt_DESC",
  SysPublishedVersionAsc = "sys_publishedVersion_ASC",
  SysPublishedVersionDesc = "sys_publishedVersion_DESC",
  TitleAsc = "title_ASC",
  TitleDesc = "title_DESC",
}

export enum ComponentAuthorOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  NameAsc = "name_ASC",
  NameDesc = "name_DESC",
  SysFirstPublishedAtAsc = "sys_firstPublishedAt_ASC",
  SysFirstPublishedAtDesc = "sys_firstPublishedAt_DESC",
  SysIdAsc = "sys_id_ASC",
  SysIdDesc = "sys_id_DESC",
  SysPublishedAtAsc = "sys_publishedAt_ASC",
  SysPublishedAtDesc = "sys_publishedAt_DESC",
  SysPublishedVersionAsc = "sys_publishedVersion_ASC",
  SysPublishedVersionDesc = "sys_publishedVersion_DESC",
}

/** To describe an image used in rich text fields [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentRichImage) */
export type ComponentRichImage = Entry &
  _Node & {
    __typename?: "ComponentRichImage";
    _id: Scalars["ID"];
    caption?: Maybe<Scalars["String"]>;
    contentfulMetadata: ContentfulMetadata;
    fullWidth?: Maybe<Scalars["Boolean"]>;
    image?: Maybe<Asset>;
    internalName?: Maybe<Scalars["String"]>;
    linkedFrom?: Maybe<ComponentRichImageLinkingCollections>;
    sys: Sys;
  };

/** To describe an image used in rich text fields [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentRichImage) */
export interface ComponentRichImageCaptionArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** To describe an image used in rich text fields [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentRichImage) */
export interface ComponentRichImageFullWidthArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** To describe an image used in rich text fields [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentRichImage) */
export interface ComponentRichImageImageArgs {
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
}

/** To describe an image used in rich text fields [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentRichImage) */
export interface ComponentRichImageInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** To describe an image used in rich text fields [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentRichImage) */
export interface ComponentRichImageLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
}

export interface ComponentRichImageCollection {
  __typename?: "ComponentRichImageCollection";
  items: Maybe<ComponentRichImage>[];
  limit: Scalars["Int"];
  skip: Scalars["Int"];
  total: Scalars["Int"];
}

export interface ComponentRichImageFilter {
  AND?: InputMaybe<InputMaybe<ComponentRichImageFilter>[]>;
  OR?: InputMaybe<InputMaybe<ComponentRichImageFilter>[]>;
  caption?: InputMaybe<Scalars["String"]>;
  caption_contains?: InputMaybe<Scalars["String"]>;
  caption_exists?: InputMaybe<Scalars["Boolean"]>;
  caption_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  caption_not?: InputMaybe<Scalars["String"]>;
  caption_not_contains?: InputMaybe<Scalars["String"]>;
  caption_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  fullWidth?: InputMaybe<Scalars["Boolean"]>;
  fullWidth_exists?: InputMaybe<Scalars["Boolean"]>;
  fullWidth_not?: InputMaybe<Scalars["Boolean"]>;
  image_exists?: InputMaybe<Scalars["Boolean"]>;
  internalName?: InputMaybe<Scalars["String"]>;
  internalName_contains?: InputMaybe<Scalars["String"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  sys?: InputMaybe<SysFilter>;
}

export interface ComponentRichImageLinkingCollections {
  __typename?: "ComponentRichImageLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
}

export interface ComponentRichImageLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
}

export enum ComponentRichImageOrder {
  CaptionAsc = "caption_ASC",
  CaptionDesc = "caption_DESC",
  FullWidthAsc = "fullWidth_ASC",
  FullWidthDesc = "fullWidth_DESC",
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  SysFirstPublishedAtAsc = "sys_firstPublishedAt_ASC",
  SysFirstPublishedAtDesc = "sys_firstPublishedAt_DESC",
  SysIdAsc = "sys_id_ASC",
  SysIdDesc = "sys_id_DESC",
  SysPublishedAtAsc = "sys_publishedAt_ASC",
  SysPublishedAtDesc = "sys_publishedAt_DESC",
  SysPublishedVersionAsc = "sys_publishedVersion_ASC",
  SysPublishedVersionDesc = "sys_publishedVersion_DESC",
}

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentSeo) */
export type ComponentSeo = Entry &
  _Node & {
    __typename?: "ComponentSeo";
    _id: Scalars["ID"];
    canonicalUrl?: Maybe<Scalars["String"]>;
    contentfulMetadata: ContentfulMetadata;
    internalName?: Maybe<Scalars["String"]>;
    linkedFrom?: Maybe<ComponentSeoLinkingCollections>;
    nofollow?: Maybe<Scalars["Boolean"]>;
    noindex?: Maybe<Scalars["Boolean"]>;
    pageDescription?: Maybe<Scalars["String"]>;
    pageTitle?: Maybe<Scalars["String"]>;
    shareImagesCollection?: Maybe<AssetCollection>;
    sys: Sys;
  };

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentSeo) */
export interface ComponentSeoCanonicalUrlArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentSeo) */
export interface ComponentSeoInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentSeo) */
export interface ComponentSeoLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
}

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentSeo) */
export interface ComponentSeoNofollowArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentSeo) */
export interface ComponentSeoNoindexArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentSeo) */
export interface ComponentSeoPageDescriptionArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentSeo) */
export interface ComponentSeoPageTitleArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/componentSeo) */
export interface ComponentSeoShareImagesCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
}

export interface ComponentSeoCollection {
  __typename?: "ComponentSeoCollection";
  items: Maybe<ComponentSeo>[];
  limit: Scalars["Int"];
  skip: Scalars["Int"];
  total: Scalars["Int"];
}

export interface ComponentSeoFilter {
  AND?: InputMaybe<InputMaybe<ComponentSeoFilter>[]>;
  OR?: InputMaybe<InputMaybe<ComponentSeoFilter>[]>;
  canonicalUrl?: InputMaybe<Scalars["String"]>;
  canonicalUrl_contains?: InputMaybe<Scalars["String"]>;
  canonicalUrl_exists?: InputMaybe<Scalars["Boolean"]>;
  canonicalUrl_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  canonicalUrl_not?: InputMaybe<Scalars["String"]>;
  canonicalUrl_not_contains?: InputMaybe<Scalars["String"]>;
  canonicalUrl_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]>;
  internalName_contains?: InputMaybe<Scalars["String"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  nofollow?: InputMaybe<Scalars["Boolean"]>;
  nofollow_exists?: InputMaybe<Scalars["Boolean"]>;
  nofollow_not?: InputMaybe<Scalars["Boolean"]>;
  noindex?: InputMaybe<Scalars["Boolean"]>;
  noindex_exists?: InputMaybe<Scalars["Boolean"]>;
  noindex_not?: InputMaybe<Scalars["Boolean"]>;
  pageDescription?: InputMaybe<Scalars["String"]>;
  pageDescription_contains?: InputMaybe<Scalars["String"]>;
  pageDescription_exists?: InputMaybe<Scalars["Boolean"]>;
  pageDescription_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  pageDescription_not?: InputMaybe<Scalars["String"]>;
  pageDescription_not_contains?: InputMaybe<Scalars["String"]>;
  pageDescription_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  pageTitle?: InputMaybe<Scalars["String"]>;
  pageTitle_contains?: InputMaybe<Scalars["String"]>;
  pageTitle_exists?: InputMaybe<Scalars["Boolean"]>;
  pageTitle_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  pageTitle_not?: InputMaybe<Scalars["String"]>;
  pageTitle_not_contains?: InputMaybe<Scalars["String"]>;
  pageTitle_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  shareImagesCollection_exists?: InputMaybe<Scalars["Boolean"]>;
  sys?: InputMaybe<SysFilter>;
}

export interface ComponentSeoLinkingCollections {
  __typename?: "ComponentSeoLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
  pageBlogPostCollection?: Maybe<PageBlogPostCollection>;
  pageLandingCollection?: Maybe<PageLandingCollection>;
}

export interface ComponentSeoLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
}

export interface ComponentSeoLinkingCollectionsPageBlogPostCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  order?: InputMaybe<InputMaybe<ComponentSeoLinkingCollectionsPageBlogPostCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
}

export interface ComponentSeoLinkingCollectionsPageLandingCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  order?: InputMaybe<InputMaybe<ComponentSeoLinkingCollectionsPageLandingCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
}

export enum ComponentSeoLinkingCollectionsPageBlogPostCollectionOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  PublishedDateAsc = "publishedDate_ASC",
  PublishedDateDesc = "publishedDate_DESC",
  SlugAsc = "slug_ASC",
  SlugDesc = "slug_DESC",
  SysFirstPublishedAtAsc = "sys_firstPublishedAt_ASC",
  SysFirstPublishedAtDesc = "sys_firstPublishedAt_DESC",
  SysIdAsc = "sys_id_ASC",
  SysIdDesc = "sys_id_DESC",
  SysPublishedAtAsc = "sys_publishedAt_ASC",
  SysPublishedAtDesc = "sys_publishedAt_DESC",
  SysPublishedVersionAsc = "sys_publishedVersion_ASC",
  SysPublishedVersionDesc = "sys_publishedVersion_DESC",
  TitleAsc = "title_ASC",
  TitleDesc = "title_DESC",
}

export enum ComponentSeoLinkingCollectionsPageLandingCollectionOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  SysFirstPublishedAtAsc = "sys_firstPublishedAt_ASC",
  SysFirstPublishedAtDesc = "sys_firstPublishedAt_DESC",
  SysIdAsc = "sys_id_ASC",
  SysIdDesc = "sys_id_DESC",
  SysPublishedAtAsc = "sys_publishedAt_ASC",
  SysPublishedAtDesc = "sys_publishedAt_DESC",
  SysPublishedVersionAsc = "sys_publishedVersion_ASC",
  SysPublishedVersionDesc = "sys_publishedVersion_DESC",
}

export enum ComponentSeoOrder {
  CanonicalUrlAsc = "canonicalUrl_ASC",
  CanonicalUrlDesc = "canonicalUrl_DESC",
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  NofollowAsc = "nofollow_ASC",
  NofollowDesc = "nofollow_DESC",
  NoindexAsc = "noindex_ASC",
  NoindexDesc = "noindex_DESC",
  PageTitleAsc = "pageTitle_ASC",
  PageTitleDesc = "pageTitle_DESC",
  SysFirstPublishedAtAsc = "sys_firstPublishedAt_ASC",
  SysFirstPublishedAtDesc = "sys_firstPublishedAt_DESC",
  SysIdAsc = "sys_id_ASC",
  SysIdDesc = "sys_id_DESC",
  SysPublishedAtAsc = "sys_publishedAt_ASC",
  SysPublishedAtDesc = "sys_publishedAt_DESC",
  SysPublishedVersionAsc = "sys_publishedVersion_ASC",
  SysPublishedVersionDesc = "sys_publishedVersion_DESC",
}

export interface ContentfulMetadata {
  __typename?: "ContentfulMetadata";
  tags: Maybe<ContentfulTag>[];
}

export interface ContentfulMetadataFilter {
  tags?: InputMaybe<ContentfulMetadataTagsFilter>;
  tags_exists?: InputMaybe<Scalars["Boolean"]>;
}

export interface ContentfulMetadataTagsFilter {
  id_contains_all?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  id_contains_none?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  id_contains_some?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
}

/**
 * Represents a tag entity for finding and organizing content easily.
 *       Find out more here: https://www.contentful.com/developers/docs/references/content-delivery-api/#/reference/content-tags
 */
export interface ContentfulTag {
  __typename?: "ContentfulTag";
  id?: Maybe<Scalars["String"]>;
  name?: Maybe<Scalars["String"]>;
}

export interface Entry {
  contentfulMetadata: ContentfulMetadata;
  sys: Sys;
}

export interface EntryCollection {
  __typename?: "EntryCollection";
  items: Maybe<Entry>[];
  limit: Scalars["Int"];
  skip: Scalars["Int"];
  total: Scalars["Int"];
}

export interface EntryFilter {
  AND?: InputMaybe<InputMaybe<EntryFilter>[]>;
  OR?: InputMaybe<InputMaybe<EntryFilter>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  sys?: InputMaybe<SysFilter>;
}

export enum EntryOrder {
  SysFirstPublishedAtAsc = "sys_firstPublishedAt_ASC",
  SysFirstPublishedAtDesc = "sys_firstPublishedAt_DESC",
  SysIdAsc = "sys_id_ASC",
  SysIdDesc = "sys_id_DESC",
  SysPublishedAtAsc = "sys_publishedAt_ASC",
  SysPublishedAtDesc = "sys_publishedAt_DESC",
  SysPublishedVersionAsc = "sys_publishedVersion_ASC",
  SysPublishedVersionDesc = "sys_publishedVersion_DESC",
}

export enum ImageFormat {
  Avif = "AVIF",
  /** JPG image format. */
  Jpg = "JPG",
  /**
   * Progressive JPG format stores multiple passes of an image in progressively higher detail.
   *         When a progressive image is loading, the viewer will first see a lower quality pixelated version which
   *         will gradually improve in detail, until the image is fully downloaded. This is to display an image as
   *         early as possible to make the layout look as designed.
   */
  JpgProgressive = "JPG_PROGRESSIVE",
  /** PNG image format */
  Png = "PNG",
  /**
   * 8-bit PNG images support up to 256 colors and weigh less than the standard 24-bit PNG equivalent.
   *         The 8-bit PNG format is mostly used for simple images, such as icons or logos.
   */
  Png8 = "PNG8",
  /** WebP image format. */
  Webp = "WEBP",
}

export enum ImageResizeFocus {
  /** Focus the resizing on the bottom. */
  Bottom = "BOTTOM",
  /** Focus the resizing on the bottom left. */
  BottomLeft = "BOTTOM_LEFT",
  /** Focus the resizing on the bottom right. */
  BottomRight = "BOTTOM_RIGHT",
  /** Focus the resizing on the center. */
  Center = "CENTER",
  /** Focus the resizing on the largest face. */
  Face = "FACE",
  /** Focus the resizing on the area containing all the faces. */
  Faces = "FACES",
  /** Focus the resizing on the left. */
  Left = "LEFT",
  /** Focus the resizing on the right. */
  Right = "RIGHT",
  /** Focus the resizing on the top. */
  Top = "TOP",
  /** Focus the resizing on the top left. */
  TopLeft = "TOP_LEFT",
  /** Focus the resizing on the top right. */
  TopRight = "TOP_RIGHT",
}

export enum ImageResizeStrategy {
  /** Crops a part of the original image to fit into the specified dimensions. */
  Crop = "CROP",
  /** Resizes the image to the specified dimensions, cropping the image if needed. */
  Fill = "FILL",
  /** Resizes the image to fit into the specified dimensions. */
  Fit = "FIT",
  /**
   * Resizes the image to the specified dimensions, padding the image if needed.
   *         Uses desired background color as padding color.
   */
  Pad = "PAD",
  /** Resizes the image to the specified dimensions, changing the original aspect ratio if needed. */
  Scale = "SCALE",
  /** Creates a thumbnail from the image. */
  Thumb = "THUMB",
}

export interface ImageTransformOptions {
  /**
   * Desired background color, used with corner radius or `PAD` resize strategy.
   *         Defaults to transparent (for `PNG`, `PNG8` and `WEBP`) or white (for `JPG` and `JPG_PROGRESSIVE`).
   */
  backgroundColor?: InputMaybe<Scalars["HexColor"]>;
  /**
   * Desired corner radius in pixels.
   *         Results in an image with rounded corners (pass `-1` for a full circle/ellipse).
   *         Defaults to `0`. Uses desired background color as padding color,
   *         unless the format is `JPG` or `JPG_PROGRESSIVE` and resize strategy is `PAD`, then defaults to white.
   */
  cornerRadius?: InputMaybe<Scalars["Int"]>;
  /** Desired image format. Defaults to the original image format. */
  format?: InputMaybe<ImageFormat>;
  /** Desired height in pixels. Defaults to the original image height. */
  height?: InputMaybe<Scalars["Dimension"]>;
  /**
   * Desired quality of the image in percents.
   *         Used for `PNG8`, `JPG`, `JPG_PROGRESSIVE` and `WEBP` formats.
   */
  quality?: InputMaybe<Scalars["Quality"]>;
  /** Desired resize focus area. Defaults to `CENTER`. */
  resizeFocus?: InputMaybe<ImageResizeFocus>;
  /** Desired resize strategy. Defaults to `FIT`. */
  resizeStrategy?: InputMaybe<ImageResizeStrategy>;
  /** Desired width in pixels. Defaults to the original image width. */
  width?: InputMaybe<Scalars["Dimension"]>;
}

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/pageBlogPost) */
export type PageBlogPost = Entry &
  _Node & {
    __typename?: "PageBlogPost";
    _id: Scalars["ID"];
    author?: Maybe<ComponentAuthor>;
    content?: Maybe<PageBlogPostContent>;
    contentfulMetadata: ContentfulMetadata;
    featuredImage?: Maybe<Asset>;
    internalName?: Maybe<Scalars["String"]>;
    linkedFrom?: Maybe<PageBlogPostLinkingCollections>;
    publishedDate?: Maybe<Scalars["DateTime"]>;
    relatedBlogPostsCollection?: Maybe<PageBlogPostRelatedBlogPostsCollection>;
    seoFields?: Maybe<ComponentSeo>;
    shortDescription?: Maybe<Scalars["String"]>;
    slug?: Maybe<Scalars["String"]>;
    sys: Sys;
    title?: Maybe<Scalars["String"]>;
  };

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/pageBlogPost) */
export interface PageBlogPostAuthorArgs {
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  where?: InputMaybe<ComponentAuthorFilter>;
}

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/pageBlogPost) */
export interface PageBlogPostContentArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/pageBlogPost) */
export interface PageBlogPostFeaturedImageArgs {
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
}

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/pageBlogPost) */
export interface PageBlogPostInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/pageBlogPost) */
export interface PageBlogPostLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
}

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/pageBlogPost) */
export interface PageBlogPostPublishedDateArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/pageBlogPost) */
export interface PageBlogPostRelatedBlogPostsCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  order?: InputMaybe<InputMaybe<PageBlogPostRelatedBlogPostsCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
  where?: InputMaybe<PageBlogPostFilter>;
}

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/pageBlogPost) */
export interface PageBlogPostSeoFieldsArgs {
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  where?: InputMaybe<ComponentSeoFilter>;
}

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/pageBlogPost) */
export interface PageBlogPostShortDescriptionArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/pageBlogPost) */
export interface PageBlogPostSlugArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/pageBlogPost) */
export interface PageBlogPostTitleArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

export interface PageBlogPostCollection {
  __typename?: "PageBlogPostCollection";
  items: Maybe<PageBlogPost>[];
  limit: Scalars["Int"];
  skip: Scalars["Int"];
  total: Scalars["Int"];
}

export interface PageBlogPostContent {
  __typename?: "PageBlogPostContent";
  json: Scalars["JSON"];
  links: PageBlogPostContentLinks;
}

export interface PageBlogPostContentAssets {
  __typename?: "PageBlogPostContentAssets";
  block: Maybe<Asset>[];
  hyperlink: Maybe<Asset>[];
}

export interface PageBlogPostContentEntries {
  __typename?: "PageBlogPostContentEntries";
  block: Maybe<Entry>[];
  hyperlink: Maybe<Entry>[];
  inline: Maybe<Entry>[];
}

export interface PageBlogPostContentLinks {
  __typename?: "PageBlogPostContentLinks";
  assets: PageBlogPostContentAssets;
  entries: PageBlogPostContentEntries;
  resources: PageBlogPostContentResources;
}

export interface PageBlogPostContentResources {
  __typename?: "PageBlogPostContentResources";
  block: PageBlogPostContentResourcesBlock[];
  hyperlink: PageBlogPostContentResourcesHyperlink[];
  inline: PageBlogPostContentResourcesInline[];
}

export type PageBlogPostContentResourcesBlock = ResourceLink & {
  __typename?: "PageBlogPostContentResourcesBlock";
  sys: ResourceSys;
};

export type PageBlogPostContentResourcesHyperlink = ResourceLink & {
  __typename?: "PageBlogPostContentResourcesHyperlink";
  sys: ResourceSys;
};

export type PageBlogPostContentResourcesInline = ResourceLink & {
  __typename?: "PageBlogPostContentResourcesInline";
  sys: ResourceSys;
};

export interface PageBlogPostFilter {
  AND?: InputMaybe<InputMaybe<PageBlogPostFilter>[]>;
  OR?: InputMaybe<InputMaybe<PageBlogPostFilter>[]>;
  author?: InputMaybe<CfComponentAuthorNestedFilter>;
  author_exists?: InputMaybe<Scalars["Boolean"]>;
  content_contains?: InputMaybe<Scalars["String"]>;
  content_exists?: InputMaybe<Scalars["Boolean"]>;
  content_not_contains?: InputMaybe<Scalars["String"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  featuredImage_exists?: InputMaybe<Scalars["Boolean"]>;
  internalName?: InputMaybe<Scalars["String"]>;
  internalName_contains?: InputMaybe<Scalars["String"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  publishedDate?: InputMaybe<Scalars["DateTime"]>;
  publishedDate_exists?: InputMaybe<Scalars["Boolean"]>;
  publishedDate_gt?: InputMaybe<Scalars["DateTime"]>;
  publishedDate_gte?: InputMaybe<Scalars["DateTime"]>;
  publishedDate_in?: InputMaybe<InputMaybe<Scalars["DateTime"]>[]>;
  publishedDate_lt?: InputMaybe<Scalars["DateTime"]>;
  publishedDate_lte?: InputMaybe<Scalars["DateTime"]>;
  publishedDate_not?: InputMaybe<Scalars["DateTime"]>;
  publishedDate_not_in?: InputMaybe<InputMaybe<Scalars["DateTime"]>[]>;
  relatedBlogPosts?: InputMaybe<CfPageBlogPostNestedFilter>;
  relatedBlogPostsCollection_exists?: InputMaybe<Scalars["Boolean"]>;
  seoFields?: InputMaybe<CfComponentSeoNestedFilter>;
  seoFields_exists?: InputMaybe<Scalars["Boolean"]>;
  shortDescription?: InputMaybe<Scalars["String"]>;
  shortDescription_contains?: InputMaybe<Scalars["String"]>;
  shortDescription_exists?: InputMaybe<Scalars["Boolean"]>;
  shortDescription_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  shortDescription_not?: InputMaybe<Scalars["String"]>;
  shortDescription_not_contains?: InputMaybe<Scalars["String"]>;
  shortDescription_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  slug?: InputMaybe<Scalars["String"]>;
  slug_contains?: InputMaybe<Scalars["String"]>;
  slug_exists?: InputMaybe<Scalars["Boolean"]>;
  slug_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  slug_not?: InputMaybe<Scalars["String"]>;
  slug_not_contains?: InputMaybe<Scalars["String"]>;
  slug_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]>;
  title_contains?: InputMaybe<Scalars["String"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]>;
  title_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  title_not?: InputMaybe<Scalars["String"]>;
  title_not_contains?: InputMaybe<Scalars["String"]>;
  title_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
}

export interface PageBlogPostLinkingCollections {
  __typename?: "PageBlogPostLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
  pageBlogPostCollection?: Maybe<PageBlogPostCollection>;
  pageLandingCollection?: Maybe<PageLandingCollection>;
}

export interface PageBlogPostLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
}

export interface PageBlogPostLinkingCollectionsPageBlogPostCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  order?: InputMaybe<InputMaybe<PageBlogPostLinkingCollectionsPageBlogPostCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
}

export interface PageBlogPostLinkingCollectionsPageLandingCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  order?: InputMaybe<InputMaybe<PageBlogPostLinkingCollectionsPageLandingCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
}

export enum PageBlogPostLinkingCollectionsPageBlogPostCollectionOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  PublishedDateAsc = "publishedDate_ASC",
  PublishedDateDesc = "publishedDate_DESC",
  SlugAsc = "slug_ASC",
  SlugDesc = "slug_DESC",
  SysFirstPublishedAtAsc = "sys_firstPublishedAt_ASC",
  SysFirstPublishedAtDesc = "sys_firstPublishedAt_DESC",
  SysIdAsc = "sys_id_ASC",
  SysIdDesc = "sys_id_DESC",
  SysPublishedAtAsc = "sys_publishedAt_ASC",
  SysPublishedAtDesc = "sys_publishedAt_DESC",
  SysPublishedVersionAsc = "sys_publishedVersion_ASC",
  SysPublishedVersionDesc = "sys_publishedVersion_DESC",
  TitleAsc = "title_ASC",
  TitleDesc = "title_DESC",
}

export enum PageBlogPostLinkingCollectionsPageLandingCollectionOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  SysFirstPublishedAtAsc = "sys_firstPublishedAt_ASC",
  SysFirstPublishedAtDesc = "sys_firstPublishedAt_DESC",
  SysIdAsc = "sys_id_ASC",
  SysIdDesc = "sys_id_DESC",
  SysPublishedAtAsc = "sys_publishedAt_ASC",
  SysPublishedAtDesc = "sys_publishedAt_DESC",
  SysPublishedVersionAsc = "sys_publishedVersion_ASC",
  SysPublishedVersionDesc = "sys_publishedVersion_DESC",
}

export enum PageBlogPostOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  PublishedDateAsc = "publishedDate_ASC",
  PublishedDateDesc = "publishedDate_DESC",
  SlugAsc = "slug_ASC",
  SlugDesc = "slug_DESC",
  SysFirstPublishedAtAsc = "sys_firstPublishedAt_ASC",
  SysFirstPublishedAtDesc = "sys_firstPublishedAt_DESC",
  SysIdAsc = "sys_id_ASC",
  SysIdDesc = "sys_id_DESC",
  SysPublishedAtAsc = "sys_publishedAt_ASC",
  SysPublishedAtDesc = "sys_publishedAt_DESC",
  SysPublishedVersionAsc = "sys_publishedVersion_ASC",
  SysPublishedVersionDesc = "sys_publishedVersion_DESC",
  TitleAsc = "title_ASC",
  TitleDesc = "title_DESC",
}

export interface PageBlogPostRelatedBlogPostsCollection {
  __typename?: "PageBlogPostRelatedBlogPostsCollection";
  items: Maybe<PageBlogPost>[];
  limit: Scalars["Int"];
  skip: Scalars["Int"];
  total: Scalars["Int"];
}

export enum PageBlogPostRelatedBlogPostsCollectionOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  PublishedDateAsc = "publishedDate_ASC",
  PublishedDateDesc = "publishedDate_DESC",
  SlugAsc = "slug_ASC",
  SlugDesc = "slug_DESC",
  SysFirstPublishedAtAsc = "sys_firstPublishedAt_ASC",
  SysFirstPublishedAtDesc = "sys_firstPublishedAt_DESC",
  SysIdAsc = "sys_id_ASC",
  SysIdDesc = "sys_id_DESC",
  SysPublishedAtAsc = "sys_publishedAt_ASC",
  SysPublishedAtDesc = "sys_publishedAt_DESC",
  SysPublishedVersionAsc = "sys_publishedVersion_ASC",
  SysPublishedVersionDesc = "sys_publishedVersion_DESC",
  TitleAsc = "title_ASC",
  TitleDesc = "title_DESC",
}

/** To have an entry point for the app (e.g. Homepage) [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/pageLanding) */
export type PageLanding = Entry &
  _Node & {
    __typename?: "PageLanding";
    _id: Scalars["ID"];
    contentfulMetadata: ContentfulMetadata;
    featuredBlogPost?: Maybe<PageBlogPost>;
    internalName?: Maybe<Scalars["String"]>;
    linkedFrom?: Maybe<PageLandingLinkingCollections>;
    seoFields?: Maybe<ComponentSeo>;
    sys: Sys;
  };

/** To have an entry point for the app (e.g. Homepage) [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/pageLanding) */
export interface PageLandingFeaturedBlogPostArgs {
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  where?: InputMaybe<PageBlogPostFilter>;
}

/** To have an entry point for the app (e.g. Homepage) [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/pageLanding) */
export interface PageLandingInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]>;
}

/** To have an entry point for the app (e.g. Homepage) [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/pageLanding) */
export interface PageLandingLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
}

/** To have an entry point for the app (e.g. Homepage) [See type definition](https://app.contentful.com/spaces/nvxmqufxogry/content_types/pageLanding) */
export interface PageLandingSeoFieldsArgs {
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  where?: InputMaybe<ComponentSeoFilter>;
}

export interface PageLandingCollection {
  __typename?: "PageLandingCollection";
  items: Maybe<PageLanding>[];
  limit: Scalars["Int"];
  skip: Scalars["Int"];
  total: Scalars["Int"];
}

export interface PageLandingFilter {
  AND?: InputMaybe<InputMaybe<PageLandingFilter>[]>;
  OR?: InputMaybe<InputMaybe<PageLandingFilter>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  featuredBlogPost?: InputMaybe<CfPageBlogPostNestedFilter>;
  featuredBlogPost_exists?: InputMaybe<Scalars["Boolean"]>;
  internalName?: InputMaybe<Scalars["String"]>;
  internalName_contains?: InputMaybe<Scalars["String"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  seoFields?: InputMaybe<CfComponentSeoNestedFilter>;
  seoFields_exists?: InputMaybe<Scalars["Boolean"]>;
  sys?: InputMaybe<SysFilter>;
}

export interface PageLandingLinkingCollections {
  __typename?: "PageLandingLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
}

export interface PageLandingLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
}

export enum PageLandingOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  SysFirstPublishedAtAsc = "sys_firstPublishedAt_ASC",
  SysFirstPublishedAtDesc = "sys_firstPublishedAt_DESC",
  SysIdAsc = "sys_id_ASC",
  SysIdDesc = "sys_id_DESC",
  SysPublishedAtAsc = "sys_publishedAt_ASC",
  SysPublishedAtDesc = "sys_publishedAt_DESC",
  SysPublishedVersionAsc = "sys_publishedVersion_ASC",
  SysPublishedVersionDesc = "sys_publishedVersion_DESC",
}

export interface Query {
  __typename?: "Query";
  _node?: Maybe<_Node>;
  asset?: Maybe<Asset>;
  assetCollection?: Maybe<AssetCollection>;
  componentAuthor?: Maybe<ComponentAuthor>;
  componentAuthorCollection?: Maybe<ComponentAuthorCollection>;
  componentRichImage?: Maybe<ComponentRichImage>;
  componentRichImageCollection?: Maybe<ComponentRichImageCollection>;
  componentSeo?: Maybe<ComponentSeo>;
  componentSeoCollection?: Maybe<ComponentSeoCollection>;
  entryCollection?: Maybe<EntryCollection>;
  pageBlogPost?: Maybe<PageBlogPost>;
  pageBlogPostCollection?: Maybe<PageBlogPostCollection>;
  pageLanding?: Maybe<PageLanding>;
  pageLandingCollection?: Maybe<PageLandingCollection>;
}

export interface Query_NodeArgs {
  id: Scalars["ID"];
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
}

export interface QueryAssetArgs {
  id: Scalars["String"];
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
}

export interface QueryAssetCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  order?: InputMaybe<InputMaybe<AssetOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
  where?: InputMaybe<AssetFilter>;
}

export interface QueryComponentAuthorArgs {
  id: Scalars["String"];
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
}

export interface QueryComponentAuthorCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  order?: InputMaybe<InputMaybe<ComponentAuthorOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
  where?: InputMaybe<ComponentAuthorFilter>;
}

export interface QueryComponentRichImageArgs {
  id: Scalars["String"];
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
}

export interface QueryComponentRichImageCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  order?: InputMaybe<InputMaybe<ComponentRichImageOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
  where?: InputMaybe<ComponentRichImageFilter>;
}

export interface QueryComponentSeoArgs {
  id: Scalars["String"];
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
}

export interface QueryComponentSeoCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  order?: InputMaybe<InputMaybe<ComponentSeoOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
  where?: InputMaybe<ComponentSeoFilter>;
}

export interface QueryEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  order?: InputMaybe<InputMaybe<EntryOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
  where?: InputMaybe<EntryFilter>;
}

export interface QueryPageBlogPostArgs {
  id: Scalars["String"];
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
}

export interface QueryPageBlogPostCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  order?: InputMaybe<InputMaybe<PageBlogPostOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
  where?: InputMaybe<PageBlogPostFilter>;
}

export interface QueryPageLandingArgs {
  id: Scalars["String"];
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
}

export interface QueryPageLandingCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]>;
  locale?: InputMaybe<Scalars["String"]>;
  order?: InputMaybe<InputMaybe<PageLandingOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  skip?: InputMaybe<Scalars["Int"]>;
  where?: InputMaybe<PageLandingFilter>;
}

export interface ResourceLink {
  sys: ResourceSys;
}

export interface ResourceSys {
  __typename?: "ResourceSys";
  linkType: Scalars["String"];
  urn: Scalars["String"];
}

export interface Sys {
  __typename?: "Sys";
  environmentId: Scalars["String"];
  firstPublishedAt?: Maybe<Scalars["DateTime"]>;
  id: Scalars["String"];
  /** The locale that was requested. */
  locale?: Maybe<Scalars["String"]>;
  publishedAt?: Maybe<Scalars["DateTime"]>;
  publishedVersion?: Maybe<Scalars["Int"]>;
  spaceId: Scalars["String"];
}

export interface SysFilter {
  firstPublishedAt?: InputMaybe<Scalars["DateTime"]>;
  firstPublishedAt_exists?: InputMaybe<Scalars["Boolean"]>;
  firstPublishedAt_gt?: InputMaybe<Scalars["DateTime"]>;
  firstPublishedAt_gte?: InputMaybe<Scalars["DateTime"]>;
  firstPublishedAt_in?: InputMaybe<InputMaybe<Scalars["DateTime"]>[]>;
  firstPublishedAt_lt?: InputMaybe<Scalars["DateTime"]>;
  firstPublishedAt_lte?: InputMaybe<Scalars["DateTime"]>;
  firstPublishedAt_not?: InputMaybe<Scalars["DateTime"]>;
  firstPublishedAt_not_in?: InputMaybe<InputMaybe<Scalars["DateTime"]>[]>;
  id?: InputMaybe<Scalars["String"]>;
  id_contains?: InputMaybe<Scalars["String"]>;
  id_exists?: InputMaybe<Scalars["Boolean"]>;
  id_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  id_not?: InputMaybe<Scalars["String"]>;
  id_not_contains?: InputMaybe<Scalars["String"]>;
  id_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  publishedAt?: InputMaybe<Scalars["DateTime"]>;
  publishedAt_exists?: InputMaybe<Scalars["Boolean"]>;
  publishedAt_gt?: InputMaybe<Scalars["DateTime"]>;
  publishedAt_gte?: InputMaybe<Scalars["DateTime"]>;
  publishedAt_in?: InputMaybe<InputMaybe<Scalars["DateTime"]>[]>;
  publishedAt_lt?: InputMaybe<Scalars["DateTime"]>;
  publishedAt_lte?: InputMaybe<Scalars["DateTime"]>;
  publishedAt_not?: InputMaybe<Scalars["DateTime"]>;
  publishedAt_not_in?: InputMaybe<InputMaybe<Scalars["DateTime"]>[]>;
  publishedVersion?: InputMaybe<Scalars["Float"]>;
  publishedVersion_exists?: InputMaybe<Scalars["Boolean"]>;
  publishedVersion_gt?: InputMaybe<Scalars["Float"]>;
  publishedVersion_gte?: InputMaybe<Scalars["Float"]>;
  publishedVersion_in?: InputMaybe<InputMaybe<Scalars["Float"]>[]>;
  publishedVersion_lt?: InputMaybe<Scalars["Float"]>;
  publishedVersion_lte?: InputMaybe<Scalars["Float"]>;
  publishedVersion_not?: InputMaybe<Scalars["Float"]>;
  publishedVersion_not_in?: InputMaybe<InputMaybe<Scalars["Float"]>[]>;
}

export interface _Node {
  _id: Scalars["ID"];
}

export interface CfComponentAuthorNestedFilter {
  AND?: InputMaybe<InputMaybe<CfComponentAuthorNestedFilter>[]>;
  OR?: InputMaybe<InputMaybe<CfComponentAuthorNestedFilter>[]>;
  avatar_exists?: InputMaybe<Scalars["Boolean"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]>;
  internalName_contains?: InputMaybe<Scalars["String"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  name?: InputMaybe<Scalars["String"]>;
  name_contains?: InputMaybe<Scalars["String"]>;
  name_exists?: InputMaybe<Scalars["Boolean"]>;
  name_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  name_not?: InputMaybe<Scalars["String"]>;
  name_not_contains?: InputMaybe<Scalars["String"]>;
  name_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  sys?: InputMaybe<SysFilter>;
}

export interface CfComponentSeoNestedFilter {
  AND?: InputMaybe<InputMaybe<CfComponentSeoNestedFilter>[]>;
  OR?: InputMaybe<InputMaybe<CfComponentSeoNestedFilter>[]>;
  canonicalUrl?: InputMaybe<Scalars["String"]>;
  canonicalUrl_contains?: InputMaybe<Scalars["String"]>;
  canonicalUrl_exists?: InputMaybe<Scalars["Boolean"]>;
  canonicalUrl_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  canonicalUrl_not?: InputMaybe<Scalars["String"]>;
  canonicalUrl_not_contains?: InputMaybe<Scalars["String"]>;
  canonicalUrl_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]>;
  internalName_contains?: InputMaybe<Scalars["String"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  nofollow?: InputMaybe<Scalars["Boolean"]>;
  nofollow_exists?: InputMaybe<Scalars["Boolean"]>;
  nofollow_not?: InputMaybe<Scalars["Boolean"]>;
  noindex?: InputMaybe<Scalars["Boolean"]>;
  noindex_exists?: InputMaybe<Scalars["Boolean"]>;
  noindex_not?: InputMaybe<Scalars["Boolean"]>;
  pageDescription?: InputMaybe<Scalars["String"]>;
  pageDescription_contains?: InputMaybe<Scalars["String"]>;
  pageDescription_exists?: InputMaybe<Scalars["Boolean"]>;
  pageDescription_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  pageDescription_not?: InputMaybe<Scalars["String"]>;
  pageDescription_not_contains?: InputMaybe<Scalars["String"]>;
  pageDescription_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  pageTitle?: InputMaybe<Scalars["String"]>;
  pageTitle_contains?: InputMaybe<Scalars["String"]>;
  pageTitle_exists?: InputMaybe<Scalars["Boolean"]>;
  pageTitle_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  pageTitle_not?: InputMaybe<Scalars["String"]>;
  pageTitle_not_contains?: InputMaybe<Scalars["String"]>;
  pageTitle_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  shareImagesCollection_exists?: InputMaybe<Scalars["Boolean"]>;
  sys?: InputMaybe<SysFilter>;
}

export interface CfPageBlogPostNestedFilter {
  AND?: InputMaybe<InputMaybe<CfPageBlogPostNestedFilter>[]>;
  OR?: InputMaybe<InputMaybe<CfPageBlogPostNestedFilter>[]>;
  author_exists?: InputMaybe<Scalars["Boolean"]>;
  content_contains?: InputMaybe<Scalars["String"]>;
  content_exists?: InputMaybe<Scalars["Boolean"]>;
  content_not_contains?: InputMaybe<Scalars["String"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  featuredImage_exists?: InputMaybe<Scalars["Boolean"]>;
  internalName?: InputMaybe<Scalars["String"]>;
  internalName_contains?: InputMaybe<Scalars["String"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  publishedDate?: InputMaybe<Scalars["DateTime"]>;
  publishedDate_exists?: InputMaybe<Scalars["Boolean"]>;
  publishedDate_gt?: InputMaybe<Scalars["DateTime"]>;
  publishedDate_gte?: InputMaybe<Scalars["DateTime"]>;
  publishedDate_in?: InputMaybe<InputMaybe<Scalars["DateTime"]>[]>;
  publishedDate_lt?: InputMaybe<Scalars["DateTime"]>;
  publishedDate_lte?: InputMaybe<Scalars["DateTime"]>;
  publishedDate_not?: InputMaybe<Scalars["DateTime"]>;
  publishedDate_not_in?: InputMaybe<InputMaybe<Scalars["DateTime"]>[]>;
  relatedBlogPostsCollection_exists?: InputMaybe<Scalars["Boolean"]>;
  seoFields_exists?: InputMaybe<Scalars["Boolean"]>;
  shortDescription?: InputMaybe<Scalars["String"]>;
  shortDescription_contains?: InputMaybe<Scalars["String"]>;
  shortDescription_exists?: InputMaybe<Scalars["Boolean"]>;
  shortDescription_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  shortDescription_not?: InputMaybe<Scalars["String"]>;
  shortDescription_not_contains?: InputMaybe<Scalars["String"]>;
  shortDescription_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  slug?: InputMaybe<Scalars["String"]>;
  slug_contains?: InputMaybe<Scalars["String"]>;
  slug_exists?: InputMaybe<Scalars["Boolean"]>;
  slug_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  slug_not?: InputMaybe<Scalars["String"]>;
  slug_not_contains?: InputMaybe<Scalars["String"]>;
  slug_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]>;
  title_contains?: InputMaybe<Scalars["String"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]>;
  title_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
  title_not?: InputMaybe<Scalars["String"]>;
  title_not_contains?: InputMaybe<Scalars["String"]>;
  title_not_in?: InputMaybe<InputMaybe<Scalars["String"]>[]>;
}

export interface AuthorFieldsFragment {
  __typename: "ComponentAuthor";
  name?: string | null;
  sys: { __typename?: "Sys"; id: string };
  avatar?: ({ __typename?: "Asset" } & ImageFieldsFragment) | null;
}

export interface ImageFieldsFragment {
  __typename: "Asset";
  title?: string | null;
  description?: string | null;
  width?: number | null;
  height?: number | null;
  url?: string | null;
  contentType?: string | null;
  sys: { __typename?: "Sys"; id: string };
}

export interface ReferencePageBlogPostFieldsFragment {
  __typename: "PageBlogPost";
  slug?: string | null;
  publishedDate?: string | null;
  title?: string | null;
  shortDescription?: string | null;
  sys: { __typename?: "Sys"; id: string; spaceId: string };
  author?: ({ __typename?: "ComponentAuthor" } & AuthorFieldsFragment) | null;
  featuredImage?: ({ __typename?: "Asset" } & ImageFieldsFragment) | null;
}

export interface PageBlogPostFieldsFragment {
  __typename: "PageBlogPost";
  internalName?: string | null;
  slug?: string | null;
  publishedDate?: string | null;
  title?: string | null;
  shortDescription?: string | null;
  sys: { __typename?: "Sys"; id: string; spaceId: string };
  seoFields?: ({ __typename?: "ComponentSeo" } & SeoFieldsFragment) | null;
  author?: ({ __typename?: "ComponentAuthor" } & AuthorFieldsFragment) | null;
  featuredImage?: ({ __typename?: "Asset" } & ImageFieldsFragment) | null;
  content?: {
    __typename?: "PageBlogPostContent";
    json: unknown;
    links: {
      __typename?: "PageBlogPostContentLinks";
      entries: {
        __typename?: "PageBlogPostContentEntries";
        block: (
          | { __typename?: "ComponentAuthor" }
          | ({ __typename?: "ComponentRichImage" } & RichImageFieldsFragment)
          | { __typename?: "ComponentSeo" }
          | { __typename?: "PageBlogPost" }
          | { __typename?: "PageLanding" }
          | null
        )[];
      };
    };
  } | null;
  relatedBlogPostsCollection?: {
    __typename?: "PageBlogPostRelatedBlogPostsCollection";
    items: (({ __typename?: "PageBlogPost" } & ReferencePageBlogPostFieldsFragment) | null)[];
  } | null;
}

export type PageBlogPostQueryVariables = Exact<{
  slug: Scalars["String"];
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
}>;

export interface PageBlogPostQuery {
  __typename?: "Query";
  pageBlogPostCollection?: {
    __typename?: "PageBlogPostCollection";
    items: (({ __typename?: "PageBlogPost" } & PageBlogPostFieldsFragment) | null)[];
  } | null;
}

export type PageBlogPostCollectionQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
  limit?: InputMaybe<Scalars["Int"]>;
  order?: InputMaybe<InputMaybe<PageBlogPostOrder>[] | InputMaybe<PageBlogPostOrder>>;
  where?: InputMaybe<PageBlogPostFilter>;
}>;

export interface PageBlogPostCollectionQuery {
  __typename?: "Query";
  pageBlogPostCollection?: {
    __typename?: "PageBlogPostCollection";
    items: (({ __typename?: "PageBlogPost" } & PageBlogPostFieldsFragment) | null)[];
  } | null;
}

export interface PageLandingFieldsFragment {
  __typename: "PageLanding";
  internalName?: string | null;
  sys: { __typename?: "Sys"; id: string; spaceId: string };
  seoFields?: ({ __typename?: "ComponentSeo" } & SeoFieldsFragment) | null;
  featuredBlogPost?: ({ __typename?: "PageBlogPost" } & ReferencePageBlogPostFieldsFragment) | null;
}

export type PageLandingQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
}>;

export interface PageLandingQuery {
  __typename?: "Query";
  pageLandingCollection?: {
    __typename?: "PageLandingCollection";
    items: (({ __typename?: "PageLanding" } & PageLandingFieldsFragment) | null)[];
  } | null;
}

export type PageLandingCollectionQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]>;
  preview?: InputMaybe<Scalars["Boolean"]>;
}>;

export interface PageLandingCollectionQuery {
  __typename?: "Query";
  pageLandingCollection?: {
    __typename?: "PageLandingCollection";
    items: (({ __typename?: "PageLanding" } & PageLandingFieldsFragment) | null)[];
  } | null;
}

export interface RichImageFieldsFragment {
  __typename: "ComponentRichImage";
  internalName?: string | null;
  caption?: string | null;
  fullWidth?: boolean | null;
  sys: { __typename?: "Sys"; id: string };
  image?: ({ __typename?: "Asset" } & ImageFieldsFragment) | null;
}

export interface SeoFieldsFragment {
  __typename: "ComponentSeo";
  pageTitle?: string | null;
  pageDescription?: string | null;
  canonicalUrl?: string | null;
  nofollow?: boolean | null;
  noindex?: boolean | null;
  shareImagesCollection?: {
    __typename?: "AssetCollection";
    items: (({ __typename?: "Asset" } & ImageFieldsFragment) | null)[];
  } | null;
}

export interface SitemapPagesFieldsFragment {
  __typename?: "Query";
  pageBlogPostCollection?: {
    __typename?: "PageBlogPostCollection";
    items: ({
      __typename?: "PageBlogPost";
      slug?: string | null;
      sys: { __typename?: "Sys"; publishedAt?: string | null };
    } | null)[];
  } | null;
  pageLandingCollection?: {
    __typename?: "PageLandingCollection";
    items: ({
      __typename?: "PageLanding";
      sys: { __typename?: "Sys"; publishedAt?: string | null };
    } | null)[];
  } | null;
}

export type SitemapPagesQueryVariables = Exact<{
  locale: Scalars["String"];
}>;

export type SitemapPagesQuery = {
  __typename?: "Query";
} & SitemapPagesFieldsFragment;

export const ImageFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment ImageFields on Asset {
    __typename
    sys {
      id
    }
    title
    description
    width
    height
    url
    contentType
  }
`;
export const SeoFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment SeoFields on ComponentSeo {
    __typename
    pageTitle
    pageDescription
    canonicalUrl
    nofollow
    noindex
    shareImagesCollection(limit: 3, locale: $locale) {
      items {
        ...ImageFields
      }
    }
  }
`;
export const AuthorFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment AuthorFields on ComponentAuthor {
    __typename
    sys {
      id
    }
    name
    avatar {
      ...ImageFields
    }
  }
`;
export const RichImageFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment RichImageFields on ComponentRichImage {
    __typename
    internalName
    sys {
      id
    }
    image {
      ...ImageFields
    }
    caption
    fullWidth
  }
`;
export const ReferencePageBlogPostFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment ReferencePageBlogPostFields on PageBlogPost {
    __typename
    sys {
      id
      spaceId
    }
    slug
    author {
      ...AuthorFields
    }
    publishedDate
    title
    shortDescription
    featuredImage {
      ...ImageFields
    }
  }
`;
export const PageBlogPostFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment PageBlogPostFields on PageBlogPost {
    __typename
    sys {
      id
      spaceId
    }
    internalName
    seoFields {
      ...SeoFields
    }
    slug
    author {
      ...AuthorFields
    }
    publishedDate
    title
    shortDescription
    featuredImage {
      ...ImageFields
    }
    content {
      json
      links {
        entries {
          block {
            ...RichImageFields
          }
        }
      }
    }
    relatedBlogPostsCollection(limit: 2) {
      items {
        ...ReferencePageBlogPostFields
      }
    }
  }
`;
export const PageLandingFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment PageLandingFields on PageLanding {
    __typename
    sys {
      id
      spaceId
    }
    internalName
    seoFields {
      ...SeoFields
    }
    featuredBlogPost {
      ...ReferencePageBlogPostFields
    }
  }
`;
export const SitemapPagesFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment sitemapPagesFields on Query {
    pageBlogPostCollection(limit: 100, locale: $locale) {
      items {
        slug
        sys {
          publishedAt
        }
      }
    }
    pageLandingCollection(limit: 1, locale: $locale) {
      items {
        sys {
          publishedAt
        }
      }
    }
  }
`;
export const PageBlogPostDocument: ReturnType<typeof gql> = gql`
  query pageBlogPost($slug: String!, $locale: String, $preview: Boolean) {
    pageBlogPostCollection(limit: 1, where: { slug: $slug }, locale: $locale, preview: $preview) {
      items {
        ...PageBlogPostFields
      }
    }
  }
  ${PageBlogPostFieldsFragmentDoc}
  ${SeoFieldsFragmentDoc}
  ${ImageFieldsFragmentDoc}
  ${AuthorFieldsFragmentDoc}
  ${RichImageFieldsFragmentDoc}
  ${ReferencePageBlogPostFieldsFragmentDoc}
`;
export const PageBlogPostCollectionDocument: ReturnType<typeof gql> = gql`
  query pageBlogPostCollection(
    $locale: String
    $preview: Boolean
    $limit: Int
    $order: [PageBlogPostOrder]
    $where: PageBlogPostFilter
  ) {
    pageBlogPostCollection(
      limit: $limit
      locale: $locale
      preview: $preview
      order: $order
      where: $where
    ) {
      items {
        ...PageBlogPostFields
      }
    }
  }
  ${PageBlogPostFieldsFragmentDoc}
  ${SeoFieldsFragmentDoc}
  ${ImageFieldsFragmentDoc}
  ${AuthorFieldsFragmentDoc}
  ${RichImageFieldsFragmentDoc}
  ${ReferencePageBlogPostFieldsFragmentDoc}
`;
export const PageLandingDocument: ReturnType<typeof gql> = gql`
  query pageLanding($locale: String, $preview: Boolean) {
    pageLandingCollection(limit: 1, locale: $locale, preview: $preview) {
      items {
        ...PageLandingFields
      }
    }
  }
  ${PageLandingFieldsFragmentDoc}
  ${SeoFieldsFragmentDoc}
  ${ImageFieldsFragmentDoc}
  ${ReferencePageBlogPostFieldsFragmentDoc}
  ${AuthorFieldsFragmentDoc}
`;
export const PageLandingCollectionDocument: ReturnType<typeof gql> = gql`
  query pageLandingCollection($locale: String, $preview: Boolean) {
    pageLandingCollection(limit: 100, locale: $locale, preview: $preview) {
      items {
        ...PageLandingFields
      }
    }
  }
  ${PageLandingFieldsFragmentDoc}
  ${SeoFieldsFragmentDoc}
  ${ImageFieldsFragmentDoc}
  ${ReferencePageBlogPostFieldsFragmentDoc}
  ${AuthorFieldsFragmentDoc}
`;
export const SitemapPagesDocument: ReturnType<typeof gql> = gql`
  query sitemapPages($locale: String!) {
    ...sitemapPagesFields
  }
  ${SitemapPagesFieldsFragmentDoc}
`;

export type SdkFunctionWrapper = <T>(
  action: (requestHeaders?: Record<string, string>) => Promise<T>,
  operationName: string,
  operationType?: string,
  variables?: unknown,
) => Promise<T>;

const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) =>
  action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    pageBlogPost(
      variables: PageBlogPostQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
    ): Promise<PageBlogPostQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PageBlogPostQuery>(PageBlogPostDocument, variables, {
            ...requestHeaders,
            ...wrappedRequestHeaders,
          }),
        "pageBlogPost",
        "query",
        variables,
      );
    },
    pageBlogPostCollection(
      variables?: PageBlogPostCollectionQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
    ): Promise<PageBlogPostCollectionQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PageBlogPostCollectionQuery>(PageBlogPostCollectionDocument, variables, {
            ...requestHeaders,
            ...wrappedRequestHeaders,
          }),
        "pageBlogPostCollection",
        "query",
        variables,
      );
    },
    pageLanding(
      variables?: PageLandingQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
    ): Promise<PageLandingQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PageLandingQuery>(PageLandingDocument, variables, {
            ...requestHeaders,
            ...wrappedRequestHeaders,
          }),
        "pageLanding",
        "query",
        variables,
      );
    },
    pageLandingCollection(
      variables?: PageLandingCollectionQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
    ): Promise<PageLandingCollectionQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PageLandingCollectionQuery>(PageLandingCollectionDocument, variables, {
            ...requestHeaders,
            ...wrappedRequestHeaders,
          }),
        "pageLandingCollection",
        "query",
        variables,
      );
    },
    sitemapPages(
      variables: SitemapPagesQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
    ): Promise<SitemapPagesQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<SitemapPagesQuery>(SitemapPagesDocument, variables, {
            ...requestHeaders,
            ...wrappedRequestHeaders,
          }),
        "sitemapPages",
        "query",
        variables,
      );
    },
  };
}
export type Sdk = ReturnType<typeof getSdk>;
