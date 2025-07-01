import { GraphQLClient, RequestOptions } from "graphql-request";
import gql from "graphql-tag";

export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = {
  [_ in K]?: never;
};
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"];
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  DateTime: { input: any; output: any };
  Dimension: { input: any; output: any };
  HexColor: { input: any; output: any };
  JSON: { input: any; output: any };
  Quality: { input: any; output: any };
};

/** Represents a binary file in a space. An asset can be any file type. */
export type Asset = {
  __typename?: "Asset";
  contentType?: Maybe<Scalars["String"]["output"]>;
  contentfulMetadata: ContentfulMetadata;
  description?: Maybe<Scalars["String"]["output"]>;
  fileName?: Maybe<Scalars["String"]["output"]>;
  height?: Maybe<Scalars["Int"]["output"]>;
  linkedFrom?: Maybe<AssetLinkingCollections>;
  size?: Maybe<Scalars["Int"]["output"]>;
  sys: Sys;
  title?: Maybe<Scalars["String"]["output"]>;
  url?: Maybe<Scalars["String"]["output"]>;
  width?: Maybe<Scalars["Int"]["output"]>;
};

/** Represents a binary file in a space. An asset can be any file type. */
export type AssetContentTypeArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** Represents a binary file in a space. An asset can be any file type. */
export type AssetDescriptionArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** Represents a binary file in a space. An asset can be any file type. */
export type AssetFileNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** Represents a binary file in a space. An asset can be any file type. */
export type AssetHeightArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** Represents a binary file in a space. An asset can be any file type. */
export type AssetLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** Represents a binary file in a space. An asset can be any file type. */
export type AssetSizeArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** Represents a binary file in a space. An asset can be any file type. */
export type AssetTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** Represents a binary file in a space. An asset can be any file type. */
export type AssetUrlArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  transform?: InputMaybe<ImageTransformOptions>;
};

/** Represents a binary file in a space. An asset can be any file type. */
export type AssetWidthArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

export type AssetCollection = {
  __typename?: "AssetCollection";
  items: Array<Maybe<Asset>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type AssetFilter = {
  AND?: InputMaybe<Array<InputMaybe<AssetFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<AssetFilter>>>;
  contentType?: InputMaybe<Scalars["String"]["input"]>;
  contentType_contains?: InputMaybe<Scalars["String"]["input"]>;
  contentType_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  contentType_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  contentType_not?: InputMaybe<Scalars["String"]["input"]>;
  contentType_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  contentType_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  description?: InputMaybe<Scalars["String"]["input"]>;
  description_contains?: InputMaybe<Scalars["String"]["input"]>;
  description_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  description_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  description_not?: InputMaybe<Scalars["String"]["input"]>;
  description_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  description_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  fileName?: InputMaybe<Scalars["String"]["input"]>;
  fileName_contains?: InputMaybe<Scalars["String"]["input"]>;
  fileName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  fileName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  fileName_not?: InputMaybe<Scalars["String"]["input"]>;
  fileName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  fileName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  height?: InputMaybe<Scalars["Int"]["input"]>;
  height_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  height_gt?: InputMaybe<Scalars["Int"]["input"]>;
  height_gte?: InputMaybe<Scalars["Int"]["input"]>;
  height_in?: InputMaybe<Array<InputMaybe<Scalars["Int"]["input"]>>>;
  height_lt?: InputMaybe<Scalars["Int"]["input"]>;
  height_lte?: InputMaybe<Scalars["Int"]["input"]>;
  height_not?: InputMaybe<Scalars["Int"]["input"]>;
  height_not_in?: InputMaybe<Array<InputMaybe<Scalars["Int"]["input"]>>>;
  size?: InputMaybe<Scalars["Int"]["input"]>;
  size_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  size_gt?: InputMaybe<Scalars["Int"]["input"]>;
  size_gte?: InputMaybe<Scalars["Int"]["input"]>;
  size_in?: InputMaybe<Array<InputMaybe<Scalars["Int"]["input"]>>>;
  size_lt?: InputMaybe<Scalars["Int"]["input"]>;
  size_lte?: InputMaybe<Scalars["Int"]["input"]>;
  size_not?: InputMaybe<Scalars["Int"]["input"]>;
  size_not_in?: InputMaybe<Array<InputMaybe<Scalars["Int"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  url?: InputMaybe<Scalars["String"]["input"]>;
  url_contains?: InputMaybe<Scalars["String"]["input"]>;
  url_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  url_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  url_not?: InputMaybe<Scalars["String"]["input"]>;
  url_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  url_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  width?: InputMaybe<Scalars["Int"]["input"]>;
  width_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  width_gt?: InputMaybe<Scalars["Int"]["input"]>;
  width_gte?: InputMaybe<Scalars["Int"]["input"]>;
  width_in?: InputMaybe<Array<InputMaybe<Scalars["Int"]["input"]>>>;
  width_lt?: InputMaybe<Scalars["Int"]["input"]>;
  width_lte?: InputMaybe<Scalars["Int"]["input"]>;
  width_not?: InputMaybe<Scalars["Int"]["input"]>;
  width_not_in?: InputMaybe<Array<InputMaybe<Scalars["Int"]["input"]>>>;
};

export type AssetLinkingCollections = {
  __typename?: "AssetLinkingCollections";
  componentAuthorCollection?: Maybe<ComponentAuthorCollection>;
  componentRichImageCollection?: Maybe<ComponentRichImageCollection>;
  componentSeoCollection?: Maybe<ComponentSeoCollection>;
  entryCollection?: Maybe<EntryCollection>;
  pageAboutCollection?: Maybe<PageAboutCollection>;
  pageBlogPostCollection?: Maybe<PageBlogPostCollection>;
};

export type AssetLinkingCollectionsComponentAuthorCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

export type AssetLinkingCollectionsComponentRichImageCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

export type AssetLinkingCollectionsComponentSeoCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

export type AssetLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

export type AssetLinkingCollectionsPageAboutCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

export type AssetLinkingCollectionsPageBlogPostCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

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

/** To have author-related properties [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentAuthor) */
export type ComponentAuthor = Entry &
  _Node & {
    __typename?: "ComponentAuthor";
    _id: Scalars["ID"]["output"];
    avatar?: Maybe<Asset>;
    contentfulMetadata: ContentfulMetadata;
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<ComponentAuthorLinkingCollections>;
    name?: Maybe<Scalars["String"]["output"]>;
    sys: Sys;
  };

/** To have author-related properties [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentAuthor) */
export type ComponentAuthorAvatarArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To have author-related properties [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentAuthor) */
export type ComponentAuthorInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** To have author-related properties [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentAuthor) */
export type ComponentAuthorLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** To have author-related properties [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentAuthor) */
export type ComponentAuthorNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

export type ComponentAuthorCollection = {
  __typename?: "ComponentAuthorCollection";
  items: Array<Maybe<ComponentAuthor>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type ComponentAuthorFilter = {
  AND?: InputMaybe<Array<InputMaybe<ComponentAuthorFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<ComponentAuthorFilter>>>;
  avatar_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  name_contains?: InputMaybe<Scalars["String"]["input"]>;
  name_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  name_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  name_not?: InputMaybe<Scalars["String"]["input"]>;
  name_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  name_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
};

export type ComponentAuthorLinkingCollections = {
  __typename?: "ComponentAuthorLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
  pageBlogPostCollection?: Maybe<PageBlogPostCollection>;
};

export type ComponentAuthorLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

export type ComponentAuthorLinkingCollectionsPageBlogPostCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<
    Array<InputMaybe<ComponentAuthorLinkingCollectionsPageBlogPostCollectionOrder>>
  >;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

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

/** To describe an image used in rich text fields [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentRichImage) */
export type ComponentRichImage = Entry &
  _Node & {
    __typename?: "ComponentRichImage";
    _id: Scalars["ID"]["output"];
    caption?: Maybe<Scalars["String"]["output"]>;
    contentfulMetadata: ContentfulMetadata;
    fullWidth?: Maybe<Scalars["Boolean"]["output"]>;
    image?: Maybe<Asset>;
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<ComponentRichImageLinkingCollections>;
    sys: Sys;
  };

/** To describe an image used in rich text fields [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentRichImage) */
export type ComponentRichImageCaptionArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** To describe an image used in rich text fields [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentRichImage) */
export type ComponentRichImageFullWidthArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** To describe an image used in rich text fields [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentRichImage) */
export type ComponentRichImageImageArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To describe an image used in rich text fields [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentRichImage) */
export type ComponentRichImageInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** To describe an image used in rich text fields [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentRichImage) */
export type ComponentRichImageLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type ComponentRichImageCollection = {
  __typename?: "ComponentRichImageCollection";
  items: Array<Maybe<ComponentRichImage>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type ComponentRichImageFilter = {
  AND?: InputMaybe<Array<InputMaybe<ComponentRichImageFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<ComponentRichImageFilter>>>;
  caption?: InputMaybe<Scalars["String"]["input"]>;
  caption_contains?: InputMaybe<Scalars["String"]["input"]>;
  caption_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  caption_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  caption_not?: InputMaybe<Scalars["String"]["input"]>;
  caption_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  caption_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  fullWidth?: InputMaybe<Scalars["Boolean"]["input"]>;
  fullWidth_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  fullWidth_not?: InputMaybe<Scalars["Boolean"]["input"]>;
  image_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
};

export type ComponentRichImageLinkingCollections = {
  __typename?: "ComponentRichImageLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
};

export type ComponentRichImageLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

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

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export type ComponentSeo = Entry &
  _Node & {
    __typename?: "ComponentSeo";
    _id: Scalars["ID"]["output"];
    canonicalUrl?: Maybe<Scalars["String"]["output"]>;
    contentfulMetadata: ContentfulMetadata;
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<ComponentSeoLinkingCollections>;
    nofollow?: Maybe<Scalars["Boolean"]["output"]>;
    noindex?: Maybe<Scalars["Boolean"]["output"]>;
    pageDescription?: Maybe<Scalars["String"]["output"]>;
    pageTitle?: Maybe<Scalars["String"]["output"]>;
    shareImagesCollection?: Maybe<AssetCollection>;
    sys: Sys;
  };

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export type ComponentSeoCanonicalUrlArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export type ComponentSeoInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export type ComponentSeoLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export type ComponentSeoNofollowArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export type ComponentSeoNoindexArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export type ComponentSeoPageDescriptionArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export type ComponentSeoPageTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export type ComponentSeoShareImagesCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

export type ComponentSeoCollection = {
  __typename?: "ComponentSeoCollection";
  items: Array<Maybe<ComponentSeo>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type ComponentSeoFilter = {
  AND?: InputMaybe<Array<InputMaybe<ComponentSeoFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<ComponentSeoFilter>>>;
  canonicalUrl?: InputMaybe<Scalars["String"]["input"]>;
  canonicalUrl_contains?: InputMaybe<Scalars["String"]["input"]>;
  canonicalUrl_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  canonicalUrl_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  canonicalUrl_not?: InputMaybe<Scalars["String"]["input"]>;
  canonicalUrl_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  canonicalUrl_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  nofollow?: InputMaybe<Scalars["Boolean"]["input"]>;
  nofollow_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  nofollow_not?: InputMaybe<Scalars["Boolean"]["input"]>;
  noindex?: InputMaybe<Scalars["Boolean"]["input"]>;
  noindex_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  noindex_not?: InputMaybe<Scalars["Boolean"]["input"]>;
  pageDescription?: InputMaybe<Scalars["String"]["input"]>;
  pageDescription_contains?: InputMaybe<Scalars["String"]["input"]>;
  pageDescription_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  pageDescription_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  pageDescription_not?: InputMaybe<Scalars["String"]["input"]>;
  pageDescription_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  pageDescription_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  pageTitle?: InputMaybe<Scalars["String"]["input"]>;
  pageTitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  pageTitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  pageTitle_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  pageTitle_not?: InputMaybe<Scalars["String"]["input"]>;
  pageTitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  pageTitle_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  shareImagesCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  sys?: InputMaybe<SysFilter>;
};

export type ComponentSeoLinkingCollections = {
  __typename?: "ComponentSeoLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
  pageBlogPostCollection?: Maybe<PageBlogPostCollection>;
  pageLandingCollection?: Maybe<PageLandingCollection>;
};

export type ComponentSeoLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

export type ComponentSeoLinkingCollectionsPageBlogPostCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<ComponentSeoLinkingCollectionsPageBlogPostCollectionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

export type ComponentSeoLinkingCollectionsPageLandingCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<ComponentSeoLinkingCollectionsPageLandingCollectionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

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

export type ContentfulMetadata = {
  __typename?: "ContentfulMetadata";
  concepts: Array<Maybe<TaxonomyConcept>>;
  tags: Array<Maybe<ContentfulTag>>;
};

export type ContentfulMetadataConceptsDescendantsFilter = {
  id_contains_all?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  id_contains_none?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  id_contains_some?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type ContentfulMetadataConceptsFilter = {
  descendants?: InputMaybe<ContentfulMetadataConceptsDescendantsFilter>;
  id_contains_all?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  id_contains_none?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  id_contains_some?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type ContentfulMetadataFilter = {
  concepts?: InputMaybe<ContentfulMetadataConceptsFilter>;
  concepts_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  tags?: InputMaybe<ContentfulMetadataTagsFilter>;
  tags_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type ContentfulMetadataTagsFilter = {
  id_contains_all?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  id_contains_none?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  id_contains_some?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/**
 * Represents a tag entity for finding and organizing content easily.
 *       Find out more here: https://www.contentful.com/developers/docs/references/content-delivery-api/#/reference/content-tags
 */
export type ContentfulTag = {
  __typename?: "ContentfulTag";
  id?: Maybe<Scalars["String"]["output"]>;
  name?: Maybe<Scalars["String"]["output"]>;
};

export type Entry = {
  contentfulMetadata: ContentfulMetadata;
  sys: Sys;
};

export type EntryCollection = {
  __typename?: "EntryCollection";
  items: Array<Maybe<Entry>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type EntryFilter = {
  AND?: InputMaybe<Array<InputMaybe<EntryFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<EntryFilter>>>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  sys?: InputMaybe<SysFilter>;
};

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
  /** AVIF image format. */
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

export type ImageTransformOptions = {
  /**
   * Desired background color, used with corner radius or `PAD` resize strategy.
   *         Defaults to transparent (for `PNG`, `PNG8` and `WEBP`) or white (for `JPG` and `JPG_PROGRESSIVE`).
   */
  backgroundColor?: InputMaybe<Scalars["HexColor"]["input"]>;
  /**
   * Desired corner radius in pixels.
   *         Results in an image with rounded corners (pass `-1` for a full circle/ellipse).
   *         Defaults to `0`. Uses desired background color as padding color,
   *         unless the format is `JPG` or `JPG_PROGRESSIVE` and resize strategy is `PAD`, then defaults to white.
   */
  cornerRadius?: InputMaybe<Scalars["Int"]["input"]>;
  /** Desired image format. Defaults to the original image format. */
  format?: InputMaybe<ImageFormat>;
  /** Desired height in pixels. Defaults to the original image height. */
  height?: InputMaybe<Scalars["Dimension"]["input"]>;
  /**
   * Desired quality of the image in percents.
   *         Used for `PNG8`, `JPG`, `JPG_PROGRESSIVE` and `WEBP` formats.
   */
  quality?: InputMaybe<Scalars["Quality"]["input"]>;
  /** Desired resize focus area. Defaults to `CENTER`. */
  resizeFocus?: InputMaybe<ImageResizeFocus>;
  /** Desired resize strategy. Defaults to `FIT`. */
  resizeStrategy?: InputMaybe<ImageResizeStrategy>;
  /** Desired width in pixels. Defaults to the original image width. */
  width?: InputMaybe<Scalars["Dimension"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageAbout) */
export type PageAbout = Entry &
  _Node & {
    __typename?: "PageAbout";
    _id: Scalars["ID"]["output"];
    contentfulMetadata: ContentfulMetadata;
    description?: Maybe<PageAboutDescription>;
    image?: Maybe<Asset>;
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<PageAboutLinkingCollections>;
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageAbout) */
export type PageAboutDescriptionArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageAbout) */
export type PageAboutImageArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageAbout) */
export type PageAboutInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageAbout) */
export type PageAboutLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageAbout) */
export type PageAboutTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

export type PageAboutCollection = {
  __typename?: "PageAboutCollection";
  items: Array<Maybe<PageAbout>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type PageAboutDescription = {
  __typename?: "PageAboutDescription";
  json: Scalars["JSON"]["output"];
  links: PageAboutDescriptionLinks;
};

export type PageAboutDescriptionAssets = {
  __typename?: "PageAboutDescriptionAssets";
  block: Array<Maybe<Asset>>;
  hyperlink: Array<Maybe<Asset>>;
};

export type PageAboutDescriptionEntries = {
  __typename?: "PageAboutDescriptionEntries";
  block: Array<Maybe<Entry>>;
  hyperlink: Array<Maybe<Entry>>;
  inline: Array<Maybe<Entry>>;
};

export type PageAboutDescriptionLinks = {
  __typename?: "PageAboutDescriptionLinks";
  assets: PageAboutDescriptionAssets;
  entries: PageAboutDescriptionEntries;
  resources: PageAboutDescriptionResources;
};

export type PageAboutDescriptionResources = {
  __typename?: "PageAboutDescriptionResources";
  block: Array<PageAboutDescriptionResourcesBlock>;
  hyperlink: Array<PageAboutDescriptionResourcesHyperlink>;
  inline: Array<PageAboutDescriptionResourcesInline>;
};

export type PageAboutDescriptionResourcesBlock = ResourceLink & {
  __typename?: "PageAboutDescriptionResourcesBlock";
  sys: ResourceSys;
};

export type PageAboutDescriptionResourcesHyperlink = ResourceLink & {
  __typename?: "PageAboutDescriptionResourcesHyperlink";
  sys: ResourceSys;
};

export type PageAboutDescriptionResourcesInline = ResourceLink & {
  __typename?: "PageAboutDescriptionResourcesInline";
  sys: ResourceSys;
};

export type PageAboutFilter = {
  AND?: InputMaybe<Array<InputMaybe<PageAboutFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<PageAboutFilter>>>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  description_contains?: InputMaybe<Scalars["String"]["input"]>;
  description_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  description_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  image_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type PageAboutLinkingCollections = {
  __typename?: "PageAboutLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
};

export type PageAboutLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

export enum PageAboutOrder {
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
  TitleAsc = "title_ASC",
  TitleDesc = "title_DESC",
}

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPost = Entry &
  _Node & {
    __typename?: "PageBlogPost";
    _id: Scalars["ID"]["output"];
    author?: Maybe<ComponentAuthor>;
    content?: Maybe<PageBlogPostContent>;
    contentfulMetadata: ContentfulMetadata;
    featuredImage?: Maybe<Asset>;
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<PageBlogPostLinkingCollections>;
    publishedDate?: Maybe<Scalars["DateTime"]["output"]>;
    relatedBlogPostsCollection?: Maybe<PageBlogPostRelatedBlogPostsCollection>;
    seoFields?: Maybe<ComponentSeo>;
    shortDescription?: Maybe<Scalars["String"]["output"]>;
    slug?: Maybe<Scalars["String"]["output"]>;
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostAuthorArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentAuthorFilter>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostContentArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostFeaturedImageArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostPublishedDateArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostRelatedBlogPostsCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageBlogPostRelatedBlogPostsCollectionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<PageBlogPostFilter>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostSeoFieldsArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentSeoFilter>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostShortDescriptionArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostSlugArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

export type PageBlogPostCollection = {
  __typename?: "PageBlogPostCollection";
  items: Array<Maybe<PageBlogPost>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type PageBlogPostContent = {
  __typename?: "PageBlogPostContent";
  json: Scalars["JSON"]["output"];
  links: PageBlogPostContentLinks;
};

export type PageBlogPostContentAssets = {
  __typename?: "PageBlogPostContentAssets";
  block: Array<Maybe<Asset>>;
  hyperlink: Array<Maybe<Asset>>;
};

export type PageBlogPostContentEntries = {
  __typename?: "PageBlogPostContentEntries";
  block: Array<Maybe<Entry>>;
  hyperlink: Array<Maybe<Entry>>;
  inline: Array<Maybe<Entry>>;
};

export type PageBlogPostContentLinks = {
  __typename?: "PageBlogPostContentLinks";
  assets: PageBlogPostContentAssets;
  entries: PageBlogPostContentEntries;
  resources: PageBlogPostContentResources;
};

export type PageBlogPostContentResources = {
  __typename?: "PageBlogPostContentResources";
  block: Array<PageBlogPostContentResourcesBlock>;
  hyperlink: Array<PageBlogPostContentResourcesHyperlink>;
  inline: Array<PageBlogPostContentResourcesInline>;
};

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

export type PageBlogPostFilter = {
  AND?: InputMaybe<Array<InputMaybe<PageBlogPostFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<PageBlogPostFilter>>>;
  author?: InputMaybe<CfComponentAuthorNestedFilter>;
  author_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  content_contains?: InputMaybe<Scalars["String"]["input"]>;
  content_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  content_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  featuredImage_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  publishedDate?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  publishedDate_gt?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_gte?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_in?: InputMaybe<Array<InputMaybe<Scalars["DateTime"]["input"]>>>;
  publishedDate_lt?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_lte?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_not?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_not_in?: InputMaybe<Array<InputMaybe<Scalars["DateTime"]["input"]>>>;
  relatedBlogPosts?: InputMaybe<CfPageBlogPostNestedFilter>;
  relatedBlogPostsCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  seoFields?: InputMaybe<CfComponentSeoNestedFilter>;
  seoFields_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  shortDescription?: InputMaybe<Scalars["String"]["input"]>;
  shortDescription_contains?: InputMaybe<Scalars["String"]["input"]>;
  shortDescription_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  shortDescription_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  shortDescription_not?: InputMaybe<Scalars["String"]["input"]>;
  shortDescription_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  shortDescription_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  slug?: InputMaybe<Scalars["String"]["input"]>;
  slug_contains?: InputMaybe<Scalars["String"]["input"]>;
  slug_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  slug_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  slug_not?: InputMaybe<Scalars["String"]["input"]>;
  slug_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  slug_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type PageBlogPostLinkingCollections = {
  __typename?: "PageBlogPostLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
  pageBlogPostCollection?: Maybe<PageBlogPostCollection>;
  pageLandingCollection?: Maybe<PageLandingCollection>;
};

export type PageBlogPostLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

export type PageBlogPostLinkingCollectionsPageBlogPostCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageBlogPostLinkingCollectionsPageBlogPostCollectionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

export type PageBlogPostLinkingCollectionsPageLandingCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageBlogPostLinkingCollectionsPageLandingCollectionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

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

export type PageBlogPostRelatedBlogPostsCollection = {
  __typename?: "PageBlogPostRelatedBlogPostsCollection";
  items: Array<Maybe<PageBlogPost>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

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

/** To have an entry point for the app (e.g. Homepage) [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageLanding) */
export type PageLanding = Entry &
  _Node & {
    __typename?: "PageLanding";
    _id: Scalars["ID"]["output"];
    contentfulMetadata: ContentfulMetadata;
    featuredBlogPost?: Maybe<PageBlogPost>;
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<PageLandingLinkingCollections>;
    seoFields?: Maybe<ComponentSeo>;
    sys: Sys;
  };

/** To have an entry point for the app (e.g. Homepage) [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageLanding) */
export type PageLandingFeaturedBlogPostArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<PageBlogPostFilter>;
};

/** To have an entry point for the app (e.g. Homepage) [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageLanding) */
export type PageLandingInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** To have an entry point for the app (e.g. Homepage) [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageLanding) */
export type PageLandingLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** To have an entry point for the app (e.g. Homepage) [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageLanding) */
export type PageLandingSeoFieldsArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentSeoFilter>;
};

export type PageLandingCollection = {
  __typename?: "PageLandingCollection";
  items: Array<Maybe<PageLanding>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type PageLandingFilter = {
  AND?: InputMaybe<Array<InputMaybe<PageLandingFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<PageLandingFilter>>>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  featuredBlogPost?: InputMaybe<CfPageBlogPostNestedFilter>;
  featuredBlogPost_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  seoFields?: InputMaybe<CfComponentSeoNestedFilter>;
  seoFields_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  sys?: InputMaybe<SysFilter>;
};

export type PageLandingLinkingCollections = {
  __typename?: "PageLandingLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
};

export type PageLandingLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

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

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pagePolicies) */
export type PagePolicies = Entry &
  _Node & {
    __typename?: "PagePolicies";
    _id: Scalars["ID"]["output"];
    content?: Maybe<PagePoliciesContent>;
    contentfulMetadata: ContentfulMetadata;
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<PagePoliciesLinkingCollections>;
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pagePolicies) */
export type PagePoliciesContentArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pagePolicies) */
export type PagePoliciesInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pagePolicies) */
export type PagePoliciesLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pagePolicies) */
export type PagePoliciesTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
};

export type PagePoliciesCollection = {
  __typename?: "PagePoliciesCollection";
  items: Array<Maybe<PagePolicies>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type PagePoliciesContent = {
  __typename?: "PagePoliciesContent";
  json: Scalars["JSON"]["output"];
  links: PagePoliciesContentLinks;
};

export type PagePoliciesContentAssets = {
  __typename?: "PagePoliciesContentAssets";
  block: Array<Maybe<Asset>>;
  hyperlink: Array<Maybe<Asset>>;
};

export type PagePoliciesContentEntries = {
  __typename?: "PagePoliciesContentEntries";
  block: Array<Maybe<Entry>>;
  hyperlink: Array<Maybe<Entry>>;
  inline: Array<Maybe<Entry>>;
};

export type PagePoliciesContentLinks = {
  __typename?: "PagePoliciesContentLinks";
  assets: PagePoliciesContentAssets;
  entries: PagePoliciesContentEntries;
  resources: PagePoliciesContentResources;
};

export type PagePoliciesContentResources = {
  __typename?: "PagePoliciesContentResources";
  block: Array<PagePoliciesContentResourcesBlock>;
  hyperlink: Array<PagePoliciesContentResourcesHyperlink>;
  inline: Array<PagePoliciesContentResourcesInline>;
};

export type PagePoliciesContentResourcesBlock = ResourceLink & {
  __typename?: "PagePoliciesContentResourcesBlock";
  sys: ResourceSys;
};

export type PagePoliciesContentResourcesHyperlink = ResourceLink & {
  __typename?: "PagePoliciesContentResourcesHyperlink";
  sys: ResourceSys;
};

export type PagePoliciesContentResourcesInline = ResourceLink & {
  __typename?: "PagePoliciesContentResourcesInline";
  sys: ResourceSys;
};

export type PagePoliciesFilter = {
  AND?: InputMaybe<Array<InputMaybe<PagePoliciesFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<PagePoliciesFilter>>>;
  content_contains?: InputMaybe<Scalars["String"]["input"]>;
  content_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  content_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type PagePoliciesLinkingCollections = {
  __typename?: "PagePoliciesLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
};

export type PagePoliciesLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
};

export enum PagePoliciesOrder {
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
  TitleAsc = "title_ASC",
  TitleDesc = "title_DESC",
}

export type Query = {
  __typename?: "Query";
  _node?: Maybe<_Node>;
  _nodes: Array<Maybe<_Node>>;
  asset?: Maybe<Asset>;
  assetCollection?: Maybe<AssetCollection>;
  componentAuthor?: Maybe<ComponentAuthor>;
  componentAuthorCollection?: Maybe<ComponentAuthorCollection>;
  componentRichImage?: Maybe<ComponentRichImage>;
  componentRichImageCollection?: Maybe<ComponentRichImageCollection>;
  componentSeo?: Maybe<ComponentSeo>;
  componentSeoCollection?: Maybe<ComponentSeoCollection>;
  entryCollection?: Maybe<EntryCollection>;
  pageAbout?: Maybe<PageAbout>;
  pageAboutCollection?: Maybe<PageAboutCollection>;
  pageBlogPost?: Maybe<PageBlogPost>;
  pageBlogPostCollection?: Maybe<PageBlogPostCollection>;
  pageLanding?: Maybe<PageLanding>;
  pageLandingCollection?: Maybe<PageLandingCollection>;
  pagePolicies?: Maybe<PagePolicies>;
  pagePoliciesCollection?: Maybe<PagePoliciesCollection>;
};

export type Query_NodeArgs = {
  id: Scalars["ID"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type Query_NodesArgs = {
  ids: Array<Scalars["ID"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryAssetArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryAssetCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<AssetOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<AssetFilter>;
};

export type QueryComponentAuthorArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryComponentAuthorCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<ComponentAuthorOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<ComponentAuthorFilter>;
};

export type QueryComponentRichImageArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryComponentRichImageCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<ComponentRichImageOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<ComponentRichImageFilter>;
};

export type QueryComponentSeoArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryComponentSeoCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<ComponentSeoOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<ComponentSeoFilter>;
};

export type QueryEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<EntryOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<EntryFilter>;
};

export type QueryPageAboutArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryPageAboutCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageAboutOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<PageAboutFilter>;
};

export type QueryPageBlogPostArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryPageBlogPostCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageBlogPostOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<PageBlogPostFilter>;
};

export type QueryPageLandingArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryPageLandingCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageLandingOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<PageLandingFilter>;
};

export type QueryPagePoliciesArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryPagePoliciesCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PagePoliciesOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<PagePoliciesFilter>;
};

export type ResourceLink = {
  sys: ResourceSys;
};

export type ResourceSys = {
  __typename?: "ResourceSys";
  linkType: Scalars["String"]["output"];
  urn: Scalars["String"]["output"];
};

export type Sys = {
  __typename?: "Sys";
  environmentId: Scalars["String"]["output"];
  firstPublishedAt?: Maybe<Scalars["DateTime"]["output"]>;
  id: Scalars["String"]["output"];
  /** The locale that was requested. */
  locale?: Maybe<Scalars["String"]["output"]>;
  publishedAt?: Maybe<Scalars["DateTime"]["output"]>;
  publishedVersion?: Maybe<Scalars["Int"]["output"]>;
  spaceId: Scalars["String"]["output"];
};

export type SysFilter = {
  firstPublishedAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  firstPublishedAt_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  firstPublishedAt_gt?: InputMaybe<Scalars["DateTime"]["input"]>;
  firstPublishedAt_gte?: InputMaybe<Scalars["DateTime"]["input"]>;
  firstPublishedAt_in?: InputMaybe<Array<InputMaybe<Scalars["DateTime"]["input"]>>>;
  firstPublishedAt_lt?: InputMaybe<Scalars["DateTime"]["input"]>;
  firstPublishedAt_lte?: InputMaybe<Scalars["DateTime"]["input"]>;
  firstPublishedAt_not?: InputMaybe<Scalars["DateTime"]["input"]>;
  firstPublishedAt_not_in?: InputMaybe<Array<InputMaybe<Scalars["DateTime"]["input"]>>>;
  id?: InputMaybe<Scalars["String"]["input"]>;
  id_contains?: InputMaybe<Scalars["String"]["input"]>;
  id_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  id_not?: InputMaybe<Scalars["String"]["input"]>;
  id_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  publishedAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedAt_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  publishedAt_gt?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedAt_gte?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedAt_in?: InputMaybe<Array<InputMaybe<Scalars["DateTime"]["input"]>>>;
  publishedAt_lt?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedAt_lte?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedAt_not?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedAt_not_in?: InputMaybe<Array<InputMaybe<Scalars["DateTime"]["input"]>>>;
  publishedVersion?: InputMaybe<Scalars["Float"]["input"]>;
  publishedVersion_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  publishedVersion_gt?: InputMaybe<Scalars["Float"]["input"]>;
  publishedVersion_gte?: InputMaybe<Scalars["Float"]["input"]>;
  publishedVersion_in?: InputMaybe<Array<InputMaybe<Scalars["Float"]["input"]>>>;
  publishedVersion_lt?: InputMaybe<Scalars["Float"]["input"]>;
  publishedVersion_lte?: InputMaybe<Scalars["Float"]["input"]>;
  publishedVersion_not?: InputMaybe<Scalars["Float"]["input"]>;
  publishedVersion_not_in?: InputMaybe<Array<InputMaybe<Scalars["Float"]["input"]>>>;
};

/**
 * Represents a taxonomy concept entity for finding and organizing content easily.
 *         Find out more here: https://www.contentful.com/developers/docs/references/content-delivery-api/#/reference/content-concepts
 */
export type TaxonomyConcept = {
  __typename?: "TaxonomyConcept";
  id?: Maybe<Scalars["String"]["output"]>;
};

export type _Node = {
  _id: Scalars["ID"]["output"];
};

export type CfComponentAuthorNestedFilter = {
  AND?: InputMaybe<Array<InputMaybe<CfComponentAuthorNestedFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<CfComponentAuthorNestedFilter>>>;
  avatar_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  name_contains?: InputMaybe<Scalars["String"]["input"]>;
  name_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  name_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  name_not?: InputMaybe<Scalars["String"]["input"]>;
  name_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  name_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
};

export type CfComponentSeoNestedFilter = {
  AND?: InputMaybe<Array<InputMaybe<CfComponentSeoNestedFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<CfComponentSeoNestedFilter>>>;
  canonicalUrl?: InputMaybe<Scalars["String"]["input"]>;
  canonicalUrl_contains?: InputMaybe<Scalars["String"]["input"]>;
  canonicalUrl_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  canonicalUrl_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  canonicalUrl_not?: InputMaybe<Scalars["String"]["input"]>;
  canonicalUrl_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  canonicalUrl_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  nofollow?: InputMaybe<Scalars["Boolean"]["input"]>;
  nofollow_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  nofollow_not?: InputMaybe<Scalars["Boolean"]["input"]>;
  noindex?: InputMaybe<Scalars["Boolean"]["input"]>;
  noindex_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  noindex_not?: InputMaybe<Scalars["Boolean"]["input"]>;
  pageDescription?: InputMaybe<Scalars["String"]["input"]>;
  pageDescription_contains?: InputMaybe<Scalars["String"]["input"]>;
  pageDescription_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  pageDescription_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  pageDescription_not?: InputMaybe<Scalars["String"]["input"]>;
  pageDescription_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  pageDescription_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  pageTitle?: InputMaybe<Scalars["String"]["input"]>;
  pageTitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  pageTitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  pageTitle_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  pageTitle_not?: InputMaybe<Scalars["String"]["input"]>;
  pageTitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  pageTitle_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  shareImagesCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  sys?: InputMaybe<SysFilter>;
};

export type CfPageBlogPostNestedFilter = {
  AND?: InputMaybe<Array<InputMaybe<CfPageBlogPostNestedFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<CfPageBlogPostNestedFilter>>>;
  author_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  content_contains?: InputMaybe<Scalars["String"]["input"]>;
  content_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  content_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  featuredImage_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  publishedDate?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  publishedDate_gt?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_gte?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_in?: InputMaybe<Array<InputMaybe<Scalars["DateTime"]["input"]>>>;
  publishedDate_lt?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_lte?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_not?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_not_in?: InputMaybe<Array<InputMaybe<Scalars["DateTime"]["input"]>>>;
  relatedBlogPostsCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  seoFields_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  shortDescription?: InputMaybe<Scalars["String"]["input"]>;
  shortDescription_contains?: InputMaybe<Scalars["String"]["input"]>;
  shortDescription_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  shortDescription_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  shortDescription_not?: InputMaybe<Scalars["String"]["input"]>;
  shortDescription_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  shortDescription_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  slug?: InputMaybe<Scalars["String"]["input"]>;
  slug_contains?: InputMaybe<Scalars["String"]["input"]>;
  slug_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  slug_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  slug_not?: InputMaybe<Scalars["String"]["input"]>;
  slug_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  slug_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type AuthorFieldsFragment = {
  __typename: "ComponentAuthor";
  name?: string | null;
  sys: { __typename?: "Sys"; id: string };
  avatar?: ({ __typename?: "Asset" } & ImageFieldsFragment) | null;
};

export type ImageFieldsFragment = {
  __typename: "Asset";
  title?: string | null;
  description?: string | null;
  width?: number | null;
  height?: number | null;
  url?: string | null;
  contentType?: string | null;
  sys: { __typename?: "Sys"; id: string };
};

export type PageAboutFieldsFragment = {
  __typename: "PageAbout";
  internalName?: string | null;
  title?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  description?: { __typename?: "PageAboutDescription"; json: any } | null;
  image?: {
    __typename?: "Asset";
    url?: string | null;
    title?: string | null;
    sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  } | null;
};

export type PageAboutQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type PageAboutQuery = {
  __typename?: "Query";
  pageAboutCollection?: {
    __typename?: "PageAboutCollection";
    items: Array<({ __typename?: "PageAbout" } & PageAboutFieldsFragment) | null>;
  } | null;
};

export type ReferencePageBlogPostFieldsFragment = {
  __typename: "PageBlogPost";
  slug?: string | null;
  publishedDate?: any | null;
  title?: string | null;
  shortDescription?: string | null;
  sys: { __typename?: "Sys"; id: string; spaceId: string };
  author?: ({ __typename?: "ComponentAuthor" } & AuthorFieldsFragment) | null;
  featuredImage?: ({ __typename?: "Asset" } & ImageFieldsFragment) | null;
};

export type PageBlogPostFieldsFragment = {
  __typename: "PageBlogPost";
  internalName?: string | null;
  slug?: string | null;
  publishedDate?: any | null;
  title?: string | null;
  shortDescription?: string | null;
  sys: { __typename?: "Sys"; id: string; spaceId: string };
  seoFields?: ({ __typename?: "ComponentSeo" } & SeoFieldsFragment) | null;
  author?: ({ __typename?: "ComponentAuthor" } & AuthorFieldsFragment) | null;
  featuredImage?: ({ __typename?: "Asset" } & ImageFieldsFragment) | null;
  content?: {
    __typename?: "PageBlogPostContent";
    json: any;
    links: {
      __typename?: "PageBlogPostContentLinks";
      entries: {
        __typename?: "PageBlogPostContentEntries";
        block: Array<
          | { __typename?: "ComponentAuthor" }
          | ({ __typename?: "ComponentRichImage" } & RichImageFieldsFragment)
          | { __typename?: "ComponentSeo" }
          | { __typename?: "PageAbout" }
          | { __typename?: "PageBlogPost" }
          | { __typename?: "PageLanding" }
          | { __typename?: "PagePolicies" }
          | null
        >;
      };
    };
  } | null;
  relatedBlogPostsCollection?: {
    __typename?: "PageBlogPostRelatedBlogPostsCollection";
    items: Array<({ __typename?: "PageBlogPost" } & ReferencePageBlogPostFieldsFragment) | null>;
  } | null;
};

export type PageBlogPostQueryVariables = Exact<{
  slug: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type PageBlogPostQuery = {
  __typename?: "Query";
  pageBlogPostCollection?: {
    __typename?: "PageBlogPostCollection";
    items: Array<({ __typename?: "PageBlogPost" } & PageBlogPostFieldsFragment) | null>;
  } | null;
};

export type PageBlogPostCollectionQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageBlogPostOrder>> | InputMaybe<PageBlogPostOrder>>;
  where?: InputMaybe<PageBlogPostFilter>;
}>;

export type PageBlogPostCollectionQuery = {
  __typename?: "Query";
  pageBlogPostCollection?: {
    __typename?: "PageBlogPostCollection";
    items: Array<({ __typename?: "PageBlogPost" } & PageBlogPostFieldsFragment) | null>;
  } | null;
};

export type PageLandingFieldsFragment = {
  __typename: "PageLanding";
  internalName?: string | null;
  sys: { __typename?: "Sys"; id: string; spaceId: string };
  seoFields?: ({ __typename?: "ComponentSeo" } & SeoFieldsFragment) | null;
  featuredBlogPost?: ({ __typename?: "PageBlogPost" } & ReferencePageBlogPostFieldsFragment) | null;
};

export type PageLandingQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type PageLandingQuery = {
  __typename?: "Query";
  pageLandingCollection?: {
    __typename?: "PageLandingCollection";
    items: Array<({ __typename?: "PageLanding" } & PageLandingFieldsFragment) | null>;
  } | null;
};

export type PageLandingCollectionQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type PageLandingCollectionQuery = {
  __typename?: "Query";
  pageLandingCollection?: {
    __typename?: "PageLandingCollection";
    items: Array<({ __typename?: "PageLanding" } & PageLandingFieldsFragment) | null>;
  } | null;
};

export type PagePoliciesFieldsFragment = {
  __typename: "PagePolicies";
  internalName?: string | null;
  title?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  content?: { __typename?: "PagePoliciesContent"; json: any } | null;
};

export type PagePoliciesQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type PagePoliciesQuery = {
  __typename?: "Query";
  pagePoliciesCollection?: {
    __typename?: "PagePoliciesCollection";
    items: Array<({ __typename?: "PagePolicies" } & PagePoliciesFieldsFragment) | null>;
  } | null;
};

export type RichImageFieldsFragment = {
  __typename: "ComponentRichImage";
  internalName?: string | null;
  caption?: string | null;
  fullWidth?: boolean | null;
  sys: { __typename?: "Sys"; id: string };
  image?: ({ __typename?: "Asset" } & ImageFieldsFragment) | null;
};

export type SeoFieldsFragment = {
  __typename: "ComponentSeo";
  pageTitle?: string | null;
  pageDescription?: string | null;
  canonicalUrl?: string | null;
  nofollow?: boolean | null;
  noindex?: boolean | null;
  shareImagesCollection?: {
    __typename?: "AssetCollection";
    items: Array<({ __typename?: "Asset" } & ImageFieldsFragment) | null>;
  } | null;
};

export type SitemapPagesFieldsFragment = {
  __typename?: "Query";
  pageBlogPostCollection?: {
    __typename?: "PageBlogPostCollection";
    items: Array<{
      __typename?: "PageBlogPost";
      slug?: string | null;
      sys: { __typename?: "Sys"; publishedAt?: any | null };
    } | null>;
  } | null;
  pageLandingCollection?: {
    __typename?: "PageLandingCollection";
    items: Array<{
      __typename?: "PageLanding";
      sys: { __typename?: "Sys"; publishedAt?: any | null };
    } | null>;
  } | null;
};

export type SitemapPagesQueryVariables = Exact<{
  locale: Scalars["String"]["input"];
}>;

export type SitemapPagesQuery = { __typename?: "Query" } & SitemapPagesFieldsFragment;

export const PageAboutFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment PageAboutFields on PageAbout {
    __typename
    sys {
      id
      publishedAt
      environmentId
    }
    internalName
    title
    description {
      json
    }
    image {
      url
      title
      sys {
        id
        publishedAt
        environmentId
      }
    }
  }
`;
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
export const PagePoliciesFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment PagePoliciesFields on PagePolicies {
    __typename
    sys {
      id
      publishedAt
      environmentId
    }
    internalName
    title
    content {
      json
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
export const PageAboutDocument: ReturnType<typeof gql> = gql`
  query pageAbout($locale: String, $preview: Boolean) {
    pageAboutCollection(limit: 1, locale: $locale, preview: $preview) {
      items {
        ...PageAboutFields
      }
    }
  }
  ${PageAboutFieldsFragmentDoc}
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
export const PagePoliciesDocument: ReturnType<typeof gql> = gql`
  query pagePolicies($locale: String, $preview: Boolean) {
    pagePoliciesCollection(limit: 1, locale: $locale, preview: $preview) {
      items {
        ...PagePoliciesFields
      }
    }
  }
  ${PagePoliciesFieldsFragmentDoc}
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
  variables?: any,
) => Promise<T>;

const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) =>
  action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    pageAbout(
      variables?: PageAboutQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PageAboutQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PageAboutQuery>({
            document: PageAboutDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "pageAbout",
        "query",
        variables,
      );
    },
    pageBlogPost(
      variables: PageBlogPostQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PageBlogPostQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PageBlogPostQuery>({
            document: PageBlogPostDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "pageBlogPost",
        "query",
        variables,
      );
    },
    pageBlogPostCollection(
      variables?: PageBlogPostCollectionQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PageBlogPostCollectionQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PageBlogPostCollectionQuery>({
            document: PageBlogPostCollectionDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "pageBlogPostCollection",
        "query",
        variables,
      );
    },
    pageLanding(
      variables?: PageLandingQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PageLandingQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PageLandingQuery>({
            document: PageLandingDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "pageLanding",
        "query",
        variables,
      );
    },
    pageLandingCollection(
      variables?: PageLandingCollectionQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PageLandingCollectionQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PageLandingCollectionQuery>({
            document: PageLandingCollectionDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "pageLandingCollection",
        "query",
        variables,
      );
    },
    pagePolicies(
      variables?: PagePoliciesQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PagePoliciesQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PagePoliciesQuery>({
            document: PagePoliciesDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "pagePolicies",
        "query",
        variables,
      );
    },
    sitemapPages(
      variables: SitemapPagesQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<SitemapPagesQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<SitemapPagesQuery>({
            document: SitemapPagesDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "sitemapPages",
        "query",
        variables,
      );
    },
  };
}
export type Sdk = ReturnType<typeof getSdk>;
