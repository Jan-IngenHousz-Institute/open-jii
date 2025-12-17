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
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** Represents a binary file in a space. An asset can be any file type. */
export type AssetDescriptionArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** Represents a binary file in a space. An asset can be any file type. */
export type AssetFileNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** Represents a binary file in a space. An asset can be any file type. */
export type AssetHeightArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** Represents a binary file in a space. An asset can be any file type. */
export type AssetLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** Represents a binary file in a space. An asset can be any file type. */
export type AssetSizeArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** Represents a binary file in a space. An asset can be any file type. */
export type AssetTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** Represents a binary file in a space. An asset can be any file type. */
export type AssetUrlArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  transform?: InputMaybe<ImageTransformOptions>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** Represents a binary file in a space. An asset can be any file type. */
export type AssetWidthArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
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
  componentFeatureCollection?: Maybe<ComponentFeatureCollection>;
  componentPartnerCollection?: Maybe<ComponentPartnerCollection>;
  componentRichImageCollection?: Maybe<ComponentRichImageCollection>;
  componentSeoCollection?: Maybe<ComponentSeoCollection>;
  entryCollection?: Maybe<EntryCollection>;
  pageAboutCollection?: Maybe<PageAboutCollection>;
  pageBlogPostCollection?: Maybe<PageBlogPostCollection>;
  pageHomeFeaturesCollection?: Maybe<PageHomeFeaturesCollection>;
  pageHomeHeroCollection?: Maybe<PageHomeHeroCollection>;
  pageHomeMissionCollection?: Maybe<PageHomeMissionCollection>;
  pageHomePartnersCollection?: Maybe<PageHomePartnersCollection>;
};

export type AssetLinkingCollectionsComponentAuthorCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type AssetLinkingCollectionsComponentFeatureCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type AssetLinkingCollectionsComponentPartnerCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type AssetLinkingCollectionsComponentRichImageCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type AssetLinkingCollectionsComponentSeoCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type AssetLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type AssetLinkingCollectionsPageAboutCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type AssetLinkingCollectionsPageBlogPostCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type AssetLinkingCollectionsPageHomeFeaturesCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type AssetLinkingCollectionsPageHomeHeroCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type AssetLinkingCollectionsPageHomeMissionCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type AssetLinkingCollectionsPageHomePartnersCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
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
    profession?: Maybe<Scalars["String"]["output"]>;
    sys: Sys;
  };

/** To have author-related properties [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentAuthor) */
export type ComponentAuthorAvatarArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To have author-related properties [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentAuthor) */
export type ComponentAuthorInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To have author-related properties [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentAuthor) */
export type ComponentAuthorLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** To have author-related properties [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentAuthor) */
export type ComponentAuthorNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To have author-related properties [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentAuthor) */
export type ComponentAuthorProfessionArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
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
  profession?: InputMaybe<Scalars["String"]["input"]>;
  profession_contains?: InputMaybe<Scalars["String"]["input"]>;
  profession_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  profession_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  profession_not?: InputMaybe<Scalars["String"]["input"]>;
  profession_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  profession_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
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
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type ComponentAuthorLinkingCollectionsPageBlogPostCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<
    Array<InputMaybe<ComponentAuthorLinkingCollectionsPageBlogPostCollectionOrder>>
  >;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
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
  ProfessionAsc = "profession_ASC",
  ProfessionDesc = "profession_DESC",
  SysFirstPublishedAtAsc = "sys_firstPublishedAt_ASC",
  SysFirstPublishedAtDesc = "sys_firstPublishedAt_DESC",
  SysIdAsc = "sys_id_ASC",
  SysIdDesc = "sys_id_DESC",
  SysPublishedAtAsc = "sys_publishedAt_ASC",
  SysPublishedAtDesc = "sys_publishedAt_DESC",
  SysPublishedVersionAsc = "sys_publishedVersion_ASC",
  SysPublishedVersionDesc = "sys_publishedVersion_DESC",
}

/** CTA button for Hero section [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentButton) */
export type ComponentButton = Entry &
  _Node & {
    __typename?: "ComponentButton";
    _id: Scalars["ID"]["output"];
    contentfulMetadata: ContentfulMetadata;
    internalName?: Maybe<Scalars["String"]["output"]>;
    label?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<ComponentButtonLinkingCollections>;
    sys: Sys;
    url?: Maybe<Scalars["String"]["output"]>;
  };

/** CTA button for Hero section [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentButton) */
export type ComponentButtonInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** CTA button for Hero section [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentButton) */
export type ComponentButtonLabelArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** CTA button for Hero section [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentButton) */
export type ComponentButtonLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** CTA button for Hero section [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentButton) */
export type ComponentButtonUrlArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type ComponentButtonCollection = {
  __typename?: "ComponentButtonCollection";
  items: Array<Maybe<ComponentButton>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type ComponentButtonFilter = {
  AND?: InputMaybe<Array<InputMaybe<ComponentButtonFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<ComponentButtonFilter>>>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  label?: InputMaybe<Scalars["String"]["input"]>;
  label_contains?: InputMaybe<Scalars["String"]["input"]>;
  label_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  label_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  label_not?: InputMaybe<Scalars["String"]["input"]>;
  label_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  label_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
  url?: InputMaybe<Scalars["String"]["input"]>;
  url_contains?: InputMaybe<Scalars["String"]["input"]>;
  url_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  url_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  url_not?: InputMaybe<Scalars["String"]["input"]>;
  url_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  url_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type ComponentButtonLinkingCollections = {
  __typename?: "ComponentButtonLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
  footerCollection?: Maybe<FooterCollection>;
  pageHomeHeroCollection?: Maybe<PageHomeHeroCollection>;
};

export type ComponentButtonLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type ComponentButtonLinkingCollectionsFooterCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<ComponentButtonLinkingCollectionsFooterCollectionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type ComponentButtonLinkingCollectionsPageHomeHeroCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<
    Array<InputMaybe<ComponentButtonLinkingCollectionsPageHomeHeroCollectionOrder>>
  >;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export enum ComponentButtonLinkingCollectionsFooterCollectionOrder {
  BadgeAsc = "badge_ASC",
  BadgeDesc = "badge_DESC",
  BrandAsc = "brand_ASC",
  BrandDesc = "brand_DESC",
  CopyrightAsc = "copyright_ASC",
  CopyrightDesc = "copyright_DESC",
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  MenuTitleAsc = "menuTitle_ASC",
  MenuTitleDesc = "menuTitle_DESC",
  SupportTitleAsc = "supportTitle_ASC",
  SupportTitleDesc = "supportTitle_DESC",
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

export enum ComponentButtonLinkingCollectionsPageHomeHeroCollectionOrder {
  BadgeAsc = "badge_ASC",
  BadgeDesc = "badge_DESC",
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  SubtitleAsc = "subtitle_ASC",
  SubtitleDesc = "subtitle_DESC",
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

export enum ComponentButtonOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  LabelAsc = "label_ASC",
  LabelDesc = "label_DESC",
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
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentFaqQuestion) */
export type ComponentFaqQuestion = Entry &
  _Node & {
    __typename?: "ComponentFaqQuestion";
    _id: Scalars["ID"]["output"];
    answer?: Maybe<ComponentFaqQuestionAnswer>;
    contentfulMetadata: ContentfulMetadata;
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<ComponentFaqQuestionLinkingCollections>;
    question?: Maybe<Scalars["String"]["output"]>;
    sys: Sys;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentFaqQuestion) */
export type ComponentFaqQuestionAnswerArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentFaqQuestion) */
export type ComponentFaqQuestionInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentFaqQuestion) */
export type ComponentFaqQuestionLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentFaqQuestion) */
export type ComponentFaqQuestionQuestionArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type ComponentFaqQuestionAnswer = {
  __typename?: "ComponentFaqQuestionAnswer";
  json: Scalars["JSON"]["output"];
  links: ComponentFaqQuestionAnswerLinks;
};

export type ComponentFaqQuestionAnswerAssets = {
  __typename?: "ComponentFaqQuestionAnswerAssets";
  block: Array<Maybe<Asset>>;
  hyperlink: Array<Maybe<Asset>>;
};

export type ComponentFaqQuestionAnswerEntries = {
  __typename?: "ComponentFaqQuestionAnswerEntries";
  block: Array<Maybe<Entry>>;
  hyperlink: Array<Maybe<Entry>>;
  inline: Array<Maybe<Entry>>;
};

export type ComponentFaqQuestionAnswerLinks = {
  __typename?: "ComponentFaqQuestionAnswerLinks";
  assets: ComponentFaqQuestionAnswerAssets;
  entries: ComponentFaqQuestionAnswerEntries;
  resources: ComponentFaqQuestionAnswerResources;
};

export type ComponentFaqQuestionAnswerResources = {
  __typename?: "ComponentFaqQuestionAnswerResources";
  block: Array<ComponentFaqQuestionAnswerResourcesBlock>;
  hyperlink: Array<ComponentFaqQuestionAnswerResourcesHyperlink>;
  inline: Array<ComponentFaqQuestionAnswerResourcesInline>;
};

export type ComponentFaqQuestionAnswerResourcesBlock = ResourceLink & {
  __typename?: "ComponentFaqQuestionAnswerResourcesBlock";
  sys: ResourceSys;
};

export type ComponentFaqQuestionAnswerResourcesHyperlink = ResourceLink & {
  __typename?: "ComponentFaqQuestionAnswerResourcesHyperlink";
  sys: ResourceSys;
};

export type ComponentFaqQuestionAnswerResourcesInline = ResourceLink & {
  __typename?: "ComponentFaqQuestionAnswerResourcesInline";
  sys: ResourceSys;
};

export type ComponentFaqQuestionCollection = {
  __typename?: "ComponentFaqQuestionCollection";
  items: Array<Maybe<ComponentFaqQuestion>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type ComponentFaqQuestionFilter = {
  AND?: InputMaybe<Array<InputMaybe<ComponentFaqQuestionFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<ComponentFaqQuestionFilter>>>;
  answer_contains?: InputMaybe<Scalars["String"]["input"]>;
  answer_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  answer_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  question?: InputMaybe<Scalars["String"]["input"]>;
  question_contains?: InputMaybe<Scalars["String"]["input"]>;
  question_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  question_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  question_not?: InputMaybe<Scalars["String"]["input"]>;
  question_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  question_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
};

export type ComponentFaqQuestionLinkingCollections = {
  __typename?: "ComponentFaqQuestionLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
  pageFaqCollection?: Maybe<PageFaqCollection>;
};

export type ComponentFaqQuestionLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type ComponentFaqQuestionLinkingCollectionsPageFaqCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<
    Array<InputMaybe<ComponentFaqQuestionLinkingCollectionsPageFaqCollectionOrder>>
  >;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export enum ComponentFaqQuestionLinkingCollectionsPageFaqCollectionOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  IntroAsc = "intro_ASC",
  IntroDesc = "intro_DESC",
  PageDescriptionAsc = "pageDescription_ASC",
  PageDescriptionDesc = "pageDescription_DESC",
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
  TitleAsc = "title_ASC",
  TitleDesc = "title_DESC",
}

export enum ComponentFaqQuestionOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  QuestionAsc = "question_ASC",
  QuestionDesc = "question_DESC",
  SysFirstPublishedAtAsc = "sys_firstPublishedAt_ASC",
  SysFirstPublishedAtDesc = "sys_firstPublishedAt_DESC",
  SysIdAsc = "sys_id_ASC",
  SysIdDesc = "sys_id_DESC",
  SysPublishedAtAsc = "sys_publishedAt_ASC",
  SysPublishedAtDesc = "sys_publishedAt_DESC",
  SysPublishedVersionAsc = "sys_publishedVersion_ASC",
  SysPublishedVersionDesc = "sys_publishedVersion_DESC",
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentFeature) */
export type ComponentFeature = Entry &
  _Node & {
    __typename?: "ComponentFeature";
    _id: Scalars["ID"]["output"];
    contentfulMetadata: ContentfulMetadata;
    icon?: Maybe<Asset>;
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<ComponentFeatureLinkingCollections>;
    subtitle?: Maybe<Scalars["String"]["output"]>;
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentFeature) */
export type ComponentFeatureIconArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentFeature) */
export type ComponentFeatureInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentFeature) */
export type ComponentFeatureLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentFeature) */
export type ComponentFeatureSubtitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentFeature) */
export type ComponentFeatureTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type ComponentFeatureCollection = {
  __typename?: "ComponentFeatureCollection";
  items: Array<Maybe<ComponentFeature>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type ComponentFeatureFilter = {
  AND?: InputMaybe<Array<InputMaybe<ComponentFeatureFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<ComponentFeatureFilter>>>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  icon_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  subtitle?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  subtitle_not?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type ComponentFeatureLinkingCollections = {
  __typename?: "ComponentFeatureLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
  pageHomeFeaturesCollection?: Maybe<PageHomeFeaturesCollection>;
};

export type ComponentFeatureLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type ComponentFeatureLinkingCollectionsPageHomeFeaturesCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<
    Array<InputMaybe<ComponentFeatureLinkingCollectionsPageHomeFeaturesCollectionOrder>>
  >;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export enum ComponentFeatureLinkingCollectionsPageHomeFeaturesCollectionOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  SubtitleAsc = "subtitle_ASC",
  SubtitleDesc = "subtitle_DESC",
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

export enum ComponentFeatureOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  SubtitleAsc = "subtitle_ASC",
  SubtitleDesc = "subtitle_DESC",
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

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentPartner) */
export type ComponentPartner = Entry &
  _Node & {
    __typename?: "ComponentPartner";
    _id: Scalars["ID"]["output"];
    contentfulMetadata: ContentfulMetadata;
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<ComponentPartnerLinkingCollections>;
    logo?: Maybe<Asset>;
    subtitle?: Maybe<Scalars["String"]["output"]>;
    sys: Sys;
    url?: Maybe<Scalars["String"]["output"]>;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentPartner) */
export type ComponentPartnerInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentPartner) */
export type ComponentPartnerLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentPartner) */
export type ComponentPartnerLogoArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentPartner) */
export type ComponentPartnerSubtitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentPartner) */
export type ComponentPartnerUrlArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type ComponentPartnerCollection = {
  __typename?: "ComponentPartnerCollection";
  items: Array<Maybe<ComponentPartner>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type ComponentPartnerFilter = {
  AND?: InputMaybe<Array<InputMaybe<ComponentPartnerFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<ComponentPartnerFilter>>>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  logo_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  subtitle_not?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
  url?: InputMaybe<Scalars["String"]["input"]>;
  url_contains?: InputMaybe<Scalars["String"]["input"]>;
  url_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  url_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  url_not?: InputMaybe<Scalars["String"]["input"]>;
  url_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  url_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type ComponentPartnerLinkingCollections = {
  __typename?: "ComponentPartnerLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
  pageHomePartnersCollection?: Maybe<PageHomePartnersCollection>;
};

export type ComponentPartnerLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type ComponentPartnerLinkingCollectionsPageHomePartnersCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<
    Array<InputMaybe<ComponentPartnerLinkingCollectionsPageHomePartnersCollectionOrder>>
  >;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export enum ComponentPartnerLinkingCollectionsPageHomePartnersCollectionOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  SubtitleAsc = "subtitle_ASC",
  SubtitleDesc = "subtitle_DESC",
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

export enum ComponentPartnerOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  SubtitleAsc = "subtitle_ASC",
  SubtitleDesc = "subtitle_DESC",
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
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To describe an image used in rich text fields [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentRichImage) */
export type ComponentRichImageFullWidthArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To describe an image used in rich text fields [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentRichImage) */
export type ComponentRichImageImageArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To describe an image used in rich text fields [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentRichImage) */
export type ComponentRichImageInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
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
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
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
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export type ComponentSeoInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export type ComponentSeoLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export type ComponentSeoNofollowArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export type ComponentSeoNoindexArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export type ComponentSeoPageDescriptionArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export type ComponentSeoPageTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To have SEO-related properties to the pages we render [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export type ComponentSeoShareImagesCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
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
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type ComponentSeoLinkingCollectionsPageBlogPostCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<ComponentSeoLinkingCollectionsPageBlogPostCollectionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type ComponentSeoLinkingCollectionsPageLandingCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<ComponentSeoLinkingCollectionsPageLandingCollectionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
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

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export type Footer = Entry &
  _Node & {
    __typename?: "Footer";
    _id: Scalars["ID"]["output"];
    badge?: Maybe<Scalars["String"]["output"]>;
    brand?: Maybe<Scalars["String"]["output"]>;
    contentfulMetadata: ContentfulMetadata;
    copyright?: Maybe<Scalars["String"]["output"]>;
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<FooterLinkingCollections>;
    menuButtonsCollection?: Maybe<FooterMenuButtonsCollection>;
    menuTitle?: Maybe<Scalars["String"]["output"]>;
    supportButtonsCollection?: Maybe<FooterSupportButtonsCollection>;
    supportTitle?: Maybe<Scalars["String"]["output"]>;
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export type FooterBadgeArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export type FooterBrandArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export type FooterCopyrightArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export type FooterInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export type FooterLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export type FooterMenuButtonsCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<FooterMenuButtonsCollectionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentButtonFilter>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export type FooterMenuTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export type FooterSupportButtonsCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<FooterSupportButtonsCollectionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentButtonFilter>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export type FooterSupportTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export type FooterTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type FooterCollection = {
  __typename?: "FooterCollection";
  items: Array<Maybe<Footer>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type FooterFilter = {
  AND?: InputMaybe<Array<InputMaybe<FooterFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<FooterFilter>>>;
  badge?: InputMaybe<Scalars["String"]["input"]>;
  badge_contains?: InputMaybe<Scalars["String"]["input"]>;
  badge_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  badge_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  badge_not?: InputMaybe<Scalars["String"]["input"]>;
  badge_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  badge_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  brand?: InputMaybe<Scalars["String"]["input"]>;
  brand_contains?: InputMaybe<Scalars["String"]["input"]>;
  brand_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  brand_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  brand_not?: InputMaybe<Scalars["String"]["input"]>;
  brand_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  brand_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  copyright?: InputMaybe<Scalars["String"]["input"]>;
  copyright_contains?: InputMaybe<Scalars["String"]["input"]>;
  copyright_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  copyright_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  copyright_not?: InputMaybe<Scalars["String"]["input"]>;
  copyright_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  copyright_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  menuButtons?: InputMaybe<CfComponentButtonNestedFilter>;
  menuButtonsCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  menuTitle?: InputMaybe<Scalars["String"]["input"]>;
  menuTitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  menuTitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  menuTitle_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  menuTitle_not?: InputMaybe<Scalars["String"]["input"]>;
  menuTitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  menuTitle_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  supportButtons?: InputMaybe<CfComponentButtonNestedFilter>;
  supportButtonsCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  supportTitle?: InputMaybe<Scalars["String"]["input"]>;
  supportTitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  supportTitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  supportTitle_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  supportTitle_not?: InputMaybe<Scalars["String"]["input"]>;
  supportTitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  supportTitle_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type FooterLinkingCollections = {
  __typename?: "FooterLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
};

export type FooterLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type FooterMenuButtonsCollection = {
  __typename?: "FooterMenuButtonsCollection";
  items: Array<Maybe<ComponentButton>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export enum FooterMenuButtonsCollectionOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  LabelAsc = "label_ASC",
  LabelDesc = "label_DESC",
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
}

export enum FooterOrder {
  BadgeAsc = "badge_ASC",
  BadgeDesc = "badge_DESC",
  BrandAsc = "brand_ASC",
  BrandDesc = "brand_DESC",
  CopyrightAsc = "copyright_ASC",
  CopyrightDesc = "copyright_DESC",
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  MenuTitleAsc = "menuTitle_ASC",
  MenuTitleDesc = "menuTitle_DESC",
  SupportTitleAsc = "supportTitle_ASC",
  SupportTitleDesc = "supportTitle_DESC",
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

export type FooterSupportButtonsCollection = {
  __typename?: "FooterSupportButtonsCollection";
  items: Array<Maybe<ComponentButton>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export enum FooterSupportButtonsCollectionOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  LabelAsc = "label_ASC",
  LabelDesc = "label_DESC",
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

/** This component contains the metadata for the pages found outside the platform. [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/landingMetadata) */
export type LandingMetadata = Entry &
  _Node & {
    __typename?: "LandingMetadata";
    _id: Scalars["ID"]["output"];
    contentfulMetadata: ContentfulMetadata;
    description?: Maybe<Scalars["String"]["output"]>;
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<LandingMetadataLinkingCollections>;
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** This component contains the metadata for the pages found outside the platform. [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/landingMetadata) */
export type LandingMetadataDescriptionArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** This component contains the metadata for the pages found outside the platform. [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/landingMetadata) */
export type LandingMetadataInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** This component contains the metadata for the pages found outside the platform. [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/landingMetadata) */
export type LandingMetadataLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** This component contains the metadata for the pages found outside the platform. [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/landingMetadata) */
export type LandingMetadataTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type LandingMetadataCollection = {
  __typename?: "LandingMetadataCollection";
  items: Array<Maybe<LandingMetadata>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type LandingMetadataFilter = {
  AND?: InputMaybe<Array<InputMaybe<LandingMetadataFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<LandingMetadataFilter>>>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  description?: InputMaybe<Scalars["String"]["input"]>;
  description_contains?: InputMaybe<Scalars["String"]["input"]>;
  description_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  description_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  description_not?: InputMaybe<Scalars["String"]["input"]>;
  description_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  description_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
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

export type LandingMetadataLinkingCollections = {
  __typename?: "LandingMetadataLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
};

export type LandingMetadataLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export enum LandingMetadataOrder {
  DescriptionAsc = "description_ASC",
  DescriptionDesc = "description_DESC",
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
    pageDescription?: Maybe<Scalars["String"]["output"]>;
    pageTitle?: Maybe<Scalars["String"]["output"]>;
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageAbout) */
export type PageAboutDescriptionArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageAbout) */
export type PageAboutImageArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageAbout) */
export type PageAboutInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageAbout) */
export type PageAboutLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageAbout) */
export type PageAboutPageDescriptionArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageAbout) */
export type PageAboutPageTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageAbout) */
export type PageAboutTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
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
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export enum PageAboutOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  PageDescriptionAsc = "pageDescription_ASC",
  PageDescriptionDesc = "pageDescription_DESC",
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
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentAuthorFilter>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostContentArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostFeaturedImageArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostPublishedDateArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostRelatedBlogPostsCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageBlogPostRelatedBlogPostsCollectionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<PageBlogPostFilter>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostSeoFieldsArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentSeoFilter>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostShortDescriptionArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostSlugArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To create individual blog posts [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export type PageBlogPostTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
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
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type PageBlogPostLinkingCollectionsPageBlogPostCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageBlogPostLinkingCollectionsPageBlogPostCollectionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type PageBlogPostLinkingCollectionsPageLandingCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageBlogPostLinkingCollectionsPageLandingCollectionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
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

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageFaq) */
export type PageFaq = Entry &
  _Node & {
    __typename?: "PageFaq";
    _id: Scalars["ID"]["output"];
    contentfulMetadata: ContentfulMetadata;
    internalName?: Maybe<Scalars["String"]["output"]>;
    intro?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<PageFaqLinkingCollections>;
    pageDescription?: Maybe<Scalars["String"]["output"]>;
    pageTitle?: Maybe<Scalars["String"]["output"]>;
    questionsCollection?: Maybe<PageFaqQuestionsCollection>;
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageFaq) */
export type PageFaqInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageFaq) */
export type PageFaqIntroArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageFaq) */
export type PageFaqLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageFaq) */
export type PageFaqPageDescriptionArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageFaq) */
export type PageFaqPageTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageFaq) */
export type PageFaqQuestionsCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageFaqQuestionsCollectionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentFaqQuestionFilter>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageFaq) */
export type PageFaqTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type PageFaqCollection = {
  __typename?: "PageFaqCollection";
  items: Array<Maybe<PageFaq>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type PageFaqFilter = {
  AND?: InputMaybe<Array<InputMaybe<PageFaqFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<PageFaqFilter>>>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  intro?: InputMaybe<Scalars["String"]["input"]>;
  intro_contains?: InputMaybe<Scalars["String"]["input"]>;
  intro_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  intro_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  intro_not?: InputMaybe<Scalars["String"]["input"]>;
  intro_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  intro_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
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
  questions?: InputMaybe<CfComponentFaqQuestionNestedFilter>;
  questionsCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type PageFaqLinkingCollections = {
  __typename?: "PageFaqLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
};

export type PageFaqLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export enum PageFaqOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  IntroAsc = "intro_ASC",
  IntroDesc = "intro_DESC",
  PageDescriptionAsc = "pageDescription_ASC",
  PageDescriptionDesc = "pageDescription_DESC",
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
  TitleAsc = "title_ASC",
  TitleDesc = "title_DESC",
}

export type PageFaqQuestionsCollection = {
  __typename?: "PageFaqQuestionsCollection";
  items: Array<Maybe<ComponentFaqQuestion>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export enum PageFaqQuestionsCollectionOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  QuestionAsc = "question_ASC",
  QuestionDesc = "question_DESC",
  SysFirstPublishedAtAsc = "sys_firstPublishedAt_ASC",
  SysFirstPublishedAtDesc = "sys_firstPublishedAt_DESC",
  SysIdAsc = "sys_id_ASC",
  SysIdDesc = "sys_id_DESC",
  SysPublishedAtAsc = "sys_publishedAt_ASC",
  SysPublishedAtDesc = "sys_publishedAt_DESC",
  SysPublishedVersionAsc = "sys_publishedVersion_ASC",
  SysPublishedVersionDesc = "sys_publishedVersion_DESC",
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeFeatures) */
export type PageHomeFeatures = Entry &
  _Node & {
    __typename?: "PageHomeFeatures";
    _id: Scalars["ID"]["output"];
    contentfulMetadata: ContentfulMetadata;
    featuresCollection?: Maybe<PageHomeFeaturesFeaturesCollection>;
    image?: Maybe<Asset>;
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<PageHomeFeaturesLinkingCollections>;
    subtitle?: Maybe<Scalars["String"]["output"]>;
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeFeatures) */
export type PageHomeFeaturesFeaturesCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageHomeFeaturesFeaturesCollectionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentFeatureFilter>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeFeatures) */
export type PageHomeFeaturesImageArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeFeatures) */
export type PageHomeFeaturesInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeFeatures) */
export type PageHomeFeaturesLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeFeatures) */
export type PageHomeFeaturesSubtitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeFeatures) */
export type PageHomeFeaturesTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type PageHomeFeaturesCollection = {
  __typename?: "PageHomeFeaturesCollection";
  items: Array<Maybe<PageHomeFeatures>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type PageHomeFeaturesFeaturesCollection = {
  __typename?: "PageHomeFeaturesFeaturesCollection";
  items: Array<Maybe<ComponentFeature>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export enum PageHomeFeaturesFeaturesCollectionOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  SubtitleAsc = "subtitle_ASC",
  SubtitleDesc = "subtitle_DESC",
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

export type PageHomeFeaturesFilter = {
  AND?: InputMaybe<Array<InputMaybe<PageHomeFeaturesFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<PageHomeFeaturesFilter>>>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  features?: InputMaybe<CfComponentFeatureNestedFilter>;
  featuresCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  image_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  subtitle?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  subtitle_not?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type PageHomeFeaturesLinkingCollections = {
  __typename?: "PageHomeFeaturesLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
};

export type PageHomeFeaturesLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export enum PageHomeFeaturesOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  SubtitleAsc = "subtitle_ASC",
  SubtitleDesc = "subtitle_DESC",
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

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeHero) */
export type PageHomeHero = Entry &
  _Node & {
    __typename?: "PageHomeHero";
    _id: Scalars["ID"]["output"];
    badge?: Maybe<Scalars["String"]["output"]>;
    buttonsCollection?: Maybe<PageHomeHeroButtonsCollection>;
    contentfulMetadata: ContentfulMetadata;
    image?: Maybe<Asset>;
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<PageHomeHeroLinkingCollections>;
    subtitle?: Maybe<Scalars["String"]["output"]>;
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeHero) */
export type PageHomeHeroBadgeArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeHero) */
export type PageHomeHeroButtonsCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageHomeHeroButtonsCollectionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentButtonFilter>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeHero) */
export type PageHomeHeroImageArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeHero) */
export type PageHomeHeroInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeHero) */
export type PageHomeHeroLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeHero) */
export type PageHomeHeroSubtitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeHero) */
export type PageHomeHeroTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type PageHomeHeroButtonsCollection = {
  __typename?: "PageHomeHeroButtonsCollection";
  items: Array<Maybe<ComponentButton>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export enum PageHomeHeroButtonsCollectionOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  LabelAsc = "label_ASC",
  LabelDesc = "label_DESC",
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
}

export type PageHomeHeroCollection = {
  __typename?: "PageHomeHeroCollection";
  items: Array<Maybe<PageHomeHero>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type PageHomeHeroFilter = {
  AND?: InputMaybe<Array<InputMaybe<PageHomeHeroFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<PageHomeHeroFilter>>>;
  badge?: InputMaybe<Scalars["String"]["input"]>;
  badge_contains?: InputMaybe<Scalars["String"]["input"]>;
  badge_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  badge_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  badge_not?: InputMaybe<Scalars["String"]["input"]>;
  badge_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  badge_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  buttons?: InputMaybe<CfComponentButtonNestedFilter>;
  buttonsCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  image_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  subtitle?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  subtitle_not?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type PageHomeHeroLinkingCollections = {
  __typename?: "PageHomeHeroLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
};

export type PageHomeHeroLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export enum PageHomeHeroOrder {
  BadgeAsc = "badge_ASC",
  BadgeDesc = "badge_DESC",
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  SubtitleAsc = "subtitle_ASC",
  SubtitleDesc = "subtitle_DESC",
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

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeMission) */
export type PageHomeMission = Entry &
  _Node & {
    __typename?: "PageHomeMission";
    _id: Scalars["ID"]["output"];
    about?: Maybe<PageHomeMissionAbout>;
    contentfulMetadata: ContentfulMetadata;
    image?: Maybe<Asset>;
    imagesCollection?: Maybe<AssetCollection>;
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<PageHomeMissionLinkingCollections>;
    mission?: Maybe<PageHomeMissionMission>;
    subtitle?: Maybe<Scalars["String"]["output"]>;
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeMission) */
export type PageHomeMissionAboutArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeMission) */
export type PageHomeMissionImageArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeMission) */
export type PageHomeMissionImagesCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeMission) */
export type PageHomeMissionInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeMission) */
export type PageHomeMissionLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeMission) */
export type PageHomeMissionMissionArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeMission) */
export type PageHomeMissionSubtitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeMission) */
export type PageHomeMissionTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type PageHomeMissionAbout = {
  __typename?: "PageHomeMissionAbout";
  json: Scalars["JSON"]["output"];
  links: PageHomeMissionAboutLinks;
};

export type PageHomeMissionAboutAssets = {
  __typename?: "PageHomeMissionAboutAssets";
  block: Array<Maybe<Asset>>;
  hyperlink: Array<Maybe<Asset>>;
};

export type PageHomeMissionAboutEntries = {
  __typename?: "PageHomeMissionAboutEntries";
  block: Array<Maybe<Entry>>;
  hyperlink: Array<Maybe<Entry>>;
  inline: Array<Maybe<Entry>>;
};

export type PageHomeMissionAboutLinks = {
  __typename?: "PageHomeMissionAboutLinks";
  assets: PageHomeMissionAboutAssets;
  entries: PageHomeMissionAboutEntries;
  resources: PageHomeMissionAboutResources;
};

export type PageHomeMissionAboutResources = {
  __typename?: "PageHomeMissionAboutResources";
  block: Array<PageHomeMissionAboutResourcesBlock>;
  hyperlink: Array<PageHomeMissionAboutResourcesHyperlink>;
  inline: Array<PageHomeMissionAboutResourcesInline>;
};

export type PageHomeMissionAboutResourcesBlock = ResourceLink & {
  __typename?: "PageHomeMissionAboutResourcesBlock";
  sys: ResourceSys;
};

export type PageHomeMissionAboutResourcesHyperlink = ResourceLink & {
  __typename?: "PageHomeMissionAboutResourcesHyperlink";
  sys: ResourceSys;
};

export type PageHomeMissionAboutResourcesInline = ResourceLink & {
  __typename?: "PageHomeMissionAboutResourcesInline";
  sys: ResourceSys;
};

export type PageHomeMissionCollection = {
  __typename?: "PageHomeMissionCollection";
  items: Array<Maybe<PageHomeMission>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type PageHomeMissionFilter = {
  AND?: InputMaybe<Array<InputMaybe<PageHomeMissionFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<PageHomeMissionFilter>>>;
  about_contains?: InputMaybe<Scalars["String"]["input"]>;
  about_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  about_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  image_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  imagesCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  mission_contains?: InputMaybe<Scalars["String"]["input"]>;
  mission_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  mission_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  subtitle_not?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type PageHomeMissionLinkingCollections = {
  __typename?: "PageHomeMissionLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
};

export type PageHomeMissionLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type PageHomeMissionMission = {
  __typename?: "PageHomeMissionMission";
  json: Scalars["JSON"]["output"];
  links: PageHomeMissionMissionLinks;
};

export type PageHomeMissionMissionAssets = {
  __typename?: "PageHomeMissionMissionAssets";
  block: Array<Maybe<Asset>>;
  hyperlink: Array<Maybe<Asset>>;
};

export type PageHomeMissionMissionEntries = {
  __typename?: "PageHomeMissionMissionEntries";
  block: Array<Maybe<Entry>>;
  hyperlink: Array<Maybe<Entry>>;
  inline: Array<Maybe<Entry>>;
};

export type PageHomeMissionMissionLinks = {
  __typename?: "PageHomeMissionMissionLinks";
  assets: PageHomeMissionMissionAssets;
  entries: PageHomeMissionMissionEntries;
  resources: PageHomeMissionMissionResources;
};

export type PageHomeMissionMissionResources = {
  __typename?: "PageHomeMissionMissionResources";
  block: Array<PageHomeMissionMissionResourcesBlock>;
  hyperlink: Array<PageHomeMissionMissionResourcesHyperlink>;
  inline: Array<PageHomeMissionMissionResourcesInline>;
};

export type PageHomeMissionMissionResourcesBlock = ResourceLink & {
  __typename?: "PageHomeMissionMissionResourcesBlock";
  sys: ResourceSys;
};

export type PageHomeMissionMissionResourcesHyperlink = ResourceLink & {
  __typename?: "PageHomeMissionMissionResourcesHyperlink";
  sys: ResourceSys;
};

export type PageHomeMissionMissionResourcesInline = ResourceLink & {
  __typename?: "PageHomeMissionMissionResourcesInline";
  sys: ResourceSys;
};

export enum PageHomeMissionOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  SubtitleAsc = "subtitle_ASC",
  SubtitleDesc = "subtitle_DESC",
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

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomePartners) */
export type PageHomePartners = Entry &
  _Node & {
    __typename?: "PageHomePartners";
    _id: Scalars["ID"]["output"];
    contentfulMetadata: ContentfulMetadata;
    imagesCollection?: Maybe<AssetCollection>;
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<PageHomePartnersLinkingCollections>;
    partnersCollection?: Maybe<PageHomePartnersPartnersCollection>;
    subtitle?: Maybe<Scalars["String"]["output"]>;
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomePartners) */
export type PageHomePartnersImagesCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomePartners) */
export type PageHomePartnersInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomePartners) */
export type PageHomePartnersLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomePartners) */
export type PageHomePartnersPartnersCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageHomePartnersPartnersCollectionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentPartnerFilter>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomePartners) */
export type PageHomePartnersSubtitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomePartners) */
export type PageHomePartnersTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type PageHomePartnersCollection = {
  __typename?: "PageHomePartnersCollection";
  items: Array<Maybe<PageHomePartners>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type PageHomePartnersFilter = {
  AND?: InputMaybe<Array<InputMaybe<PageHomePartnersFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<PageHomePartnersFilter>>>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  imagesCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  partners?: InputMaybe<CfComponentPartnerNestedFilter>;
  partnersCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  subtitle_not?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type PageHomePartnersLinkingCollections = {
  __typename?: "PageHomePartnersLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
};

export type PageHomePartnersLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export enum PageHomePartnersOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  SubtitleAsc = "subtitle_ASC",
  SubtitleDesc = "subtitle_DESC",
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

export type PageHomePartnersPartnersCollection = {
  __typename?: "PageHomePartnersPartnersCollection";
  items: Array<Maybe<ComponentPartner>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export enum PageHomePartnersPartnersCollectionOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  SubtitleAsc = "subtitle_ASC",
  SubtitleDesc = "subtitle_DESC",
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
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<PageBlogPostFilter>;
};

/** To have an entry point for the app (e.g. Homepage) [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageLanding) */
export type PageLandingInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** To have an entry point for the app (e.g. Homepage) [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageLanding) */
export type PageLandingLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** To have an entry point for the app (e.g. Homepage) [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageLanding) */
export type PageLandingSeoFieldsArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
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
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
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
    pageDescription?: Maybe<Scalars["String"]["output"]>;
    pageTitle?: Maybe<Scalars["String"]["output"]>;
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pagePolicies) */
export type PagePoliciesContentArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pagePolicies) */
export type PagePoliciesInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pagePolicies) */
export type PagePoliciesLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pagePolicies) */
export type PagePoliciesPageDescriptionArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pagePolicies) */
export type PagePoliciesPageTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pagePolicies) */
export type PagePoliciesTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
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
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export enum PagePoliciesOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  PageDescriptionAsc = "pageDescription_ASC",
  PageDescriptionDesc = "pageDescription_DESC",
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
  TitleAsc = "title_ASC",
  TitleDesc = "title_DESC",
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageTermsAndConditions) */
export type PageTermsAndConditions = Entry &
  _Node & {
    __typename?: "PageTermsAndConditions";
    _id: Scalars["ID"]["output"];
    content?: Maybe<PageTermsAndConditionsContent>;
    contentfulMetadata: ContentfulMetadata;
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<PageTermsAndConditionsLinkingCollections>;
    pageDescription?: Maybe<Scalars["String"]["output"]>;
    pageTitle?: Maybe<Scalars["String"]["output"]>;
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageTermsAndConditions) */
export type PageTermsAndConditionsContentArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageTermsAndConditions) */
export type PageTermsAndConditionsInternalNameArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageTermsAndConditions) */
export type PageTermsAndConditionsLinkedFromArgs = {
  allowedLocales?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageTermsAndConditions) */
export type PageTermsAndConditionsPageDescriptionArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageTermsAndConditions) */
export type PageTermsAndConditionsPageTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageTermsAndConditions) */
export type PageTermsAndConditionsTitleArgs = {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type PageTermsAndConditionsCollection = {
  __typename?: "PageTermsAndConditionsCollection";
  items: Array<Maybe<PageTermsAndConditions>>;
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
};

export type PageTermsAndConditionsContent = {
  __typename?: "PageTermsAndConditionsContent";
  json: Scalars["JSON"]["output"];
  links: PageTermsAndConditionsContentLinks;
};

export type PageTermsAndConditionsContentAssets = {
  __typename?: "PageTermsAndConditionsContentAssets";
  block: Array<Maybe<Asset>>;
  hyperlink: Array<Maybe<Asset>>;
};

export type PageTermsAndConditionsContentEntries = {
  __typename?: "PageTermsAndConditionsContentEntries";
  block: Array<Maybe<Entry>>;
  hyperlink: Array<Maybe<Entry>>;
  inline: Array<Maybe<Entry>>;
};

export type PageTermsAndConditionsContentLinks = {
  __typename?: "PageTermsAndConditionsContentLinks";
  assets: PageTermsAndConditionsContentAssets;
  entries: PageTermsAndConditionsContentEntries;
  resources: PageTermsAndConditionsContentResources;
};

export type PageTermsAndConditionsContentResources = {
  __typename?: "PageTermsAndConditionsContentResources";
  block: Array<PageTermsAndConditionsContentResourcesBlock>;
  hyperlink: Array<PageTermsAndConditionsContentResourcesHyperlink>;
  inline: Array<PageTermsAndConditionsContentResourcesInline>;
};

export type PageTermsAndConditionsContentResourcesBlock = ResourceLink & {
  __typename?: "PageTermsAndConditionsContentResourcesBlock";
  sys: ResourceSys;
};

export type PageTermsAndConditionsContentResourcesHyperlink = ResourceLink & {
  __typename?: "PageTermsAndConditionsContentResourcesHyperlink";
  sys: ResourceSys;
};

export type PageTermsAndConditionsContentResourcesInline = ResourceLink & {
  __typename?: "PageTermsAndConditionsContentResourcesInline";
  sys: ResourceSys;
};

export type PageTermsAndConditionsFilter = {
  AND?: InputMaybe<Array<InputMaybe<PageTermsAndConditionsFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<PageTermsAndConditionsFilter>>>;
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
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type PageTermsAndConditionsLinkingCollections = {
  __typename?: "PageTermsAndConditionsLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
};

export type PageTermsAndConditionsLinkingCollectionsEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export enum PageTermsAndConditionsOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  PageDescriptionAsc = "pageDescription_ASC",
  PageDescriptionDesc = "pageDescription_DESC",
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
  componentButton?: Maybe<ComponentButton>;
  componentButtonCollection?: Maybe<ComponentButtonCollection>;
  componentFaqQuestion?: Maybe<ComponentFaqQuestion>;
  componentFaqQuestionCollection?: Maybe<ComponentFaqQuestionCollection>;
  componentFeature?: Maybe<ComponentFeature>;
  componentFeatureCollection?: Maybe<ComponentFeatureCollection>;
  componentPartner?: Maybe<ComponentPartner>;
  componentPartnerCollection?: Maybe<ComponentPartnerCollection>;
  componentRichImage?: Maybe<ComponentRichImage>;
  componentRichImageCollection?: Maybe<ComponentRichImageCollection>;
  componentSeo?: Maybe<ComponentSeo>;
  componentSeoCollection?: Maybe<ComponentSeoCollection>;
  entryCollection?: Maybe<EntryCollection>;
  footer?: Maybe<Footer>;
  footerCollection?: Maybe<FooterCollection>;
  landingMetadata?: Maybe<LandingMetadata>;
  landingMetadataCollection?: Maybe<LandingMetadataCollection>;
  pageAbout?: Maybe<PageAbout>;
  pageAboutCollection?: Maybe<PageAboutCollection>;
  pageBlogPost?: Maybe<PageBlogPost>;
  pageBlogPostCollection?: Maybe<PageBlogPostCollection>;
  pageFaq?: Maybe<PageFaq>;
  pageFaqCollection?: Maybe<PageFaqCollection>;
  pageHomeFeatures?: Maybe<PageHomeFeatures>;
  pageHomeFeaturesCollection?: Maybe<PageHomeFeaturesCollection>;
  pageHomeHero?: Maybe<PageHomeHero>;
  pageHomeHeroCollection?: Maybe<PageHomeHeroCollection>;
  pageHomeMission?: Maybe<PageHomeMission>;
  pageHomeMissionCollection?: Maybe<PageHomeMissionCollection>;
  pageHomePartners?: Maybe<PageHomePartners>;
  pageHomePartnersCollection?: Maybe<PageHomePartnersCollection>;
  pageLanding?: Maybe<PageLanding>;
  pageLandingCollection?: Maybe<PageLandingCollection>;
  pagePolicies?: Maybe<PagePolicies>;
  pagePoliciesCollection?: Maybe<PagePoliciesCollection>;
  pageTermsAndConditions?: Maybe<PageTermsAndConditions>;
  pageTermsAndConditionsCollection?: Maybe<PageTermsAndConditionsCollection>;
};

export type Query_NodeArgs = {
  id: Scalars["ID"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type Query_NodesArgs = {
  ids: Array<Scalars["ID"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryAssetArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryAssetCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<AssetOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<AssetFilter>;
};

export type QueryComponentAuthorArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryComponentAuthorCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<ComponentAuthorOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentAuthorFilter>;
};

export type QueryComponentButtonArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryComponentButtonCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<ComponentButtonOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentButtonFilter>;
};

export type QueryComponentFaqQuestionArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryComponentFaqQuestionCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<ComponentFaqQuestionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentFaqQuestionFilter>;
};

export type QueryComponentFeatureArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryComponentFeatureCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<ComponentFeatureOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentFeatureFilter>;
};

export type QueryComponentPartnerArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryComponentPartnerCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<ComponentPartnerOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentPartnerFilter>;
};

export type QueryComponentRichImageArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryComponentRichImageCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<ComponentRichImageOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentRichImageFilter>;
};

export type QueryComponentSeoArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryComponentSeoCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<ComponentSeoOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentSeoFilter>;
};

export type QueryEntryCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<EntryOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<EntryFilter>;
};

export type QueryFooterArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryFooterCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<FooterOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<FooterFilter>;
};

export type QueryLandingMetadataArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryLandingMetadataCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<LandingMetadataOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<LandingMetadataFilter>;
};

export type QueryPageAboutArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryPageAboutCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageAboutOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<PageAboutFilter>;
};

export type QueryPageBlogPostArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryPageBlogPostCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageBlogPostOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<PageBlogPostFilter>;
};

export type QueryPageFaqArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryPageFaqCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageFaqOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<PageFaqFilter>;
};

export type QueryPageHomeFeaturesArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryPageHomeFeaturesCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageHomeFeaturesOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<PageHomeFeaturesFilter>;
};

export type QueryPageHomeHeroArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryPageHomeHeroCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageHomeHeroOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<PageHomeHeroFilter>;
};

export type QueryPageHomeMissionArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryPageHomeMissionCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageHomeMissionOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<PageHomeMissionFilter>;
};

export type QueryPageHomePartnersArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryPageHomePartnersCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageHomePartnersOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<PageHomePartnersFilter>;
};

export type QueryPageLandingArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryPageLandingCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageLandingOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<PageLandingFilter>;
};

export type QueryPagePoliciesArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryPagePoliciesCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PagePoliciesOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<PagePoliciesFilter>;
};

export type QueryPageTermsAndConditionsArgs = {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type QueryPageTermsAndConditionsCollectionArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<Array<InputMaybe<PageTermsAndConditionsOrder>>>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  useFallbackLocale?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<PageTermsAndConditionsFilter>;
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

export type TimelineFilterInput = {
  /** Preview content starting from a given release date */
  release_lte?: InputMaybe<Scalars["String"]["input"]>;
  /** Preview content starting from a given timestamp */
  timestamp_lte?: InputMaybe<Scalars["DateTime"]["input"]>;
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
  profession?: InputMaybe<Scalars["String"]["input"]>;
  profession_contains?: InputMaybe<Scalars["String"]["input"]>;
  profession_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  profession_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  profession_not?: InputMaybe<Scalars["String"]["input"]>;
  profession_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  profession_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
};

export type CfComponentButtonNestedFilter = {
  AND?: InputMaybe<Array<InputMaybe<CfComponentButtonNestedFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<CfComponentButtonNestedFilter>>>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  label?: InputMaybe<Scalars["String"]["input"]>;
  label_contains?: InputMaybe<Scalars["String"]["input"]>;
  label_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  label_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  label_not?: InputMaybe<Scalars["String"]["input"]>;
  label_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  label_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
  url?: InputMaybe<Scalars["String"]["input"]>;
  url_contains?: InputMaybe<Scalars["String"]["input"]>;
  url_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  url_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  url_not?: InputMaybe<Scalars["String"]["input"]>;
  url_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  url_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type CfComponentFaqQuestionNestedFilter = {
  AND?: InputMaybe<Array<InputMaybe<CfComponentFaqQuestionNestedFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<CfComponentFaqQuestionNestedFilter>>>;
  answer_contains?: InputMaybe<Scalars["String"]["input"]>;
  answer_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  answer_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  question?: InputMaybe<Scalars["String"]["input"]>;
  question_contains?: InputMaybe<Scalars["String"]["input"]>;
  question_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  question_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  question_not?: InputMaybe<Scalars["String"]["input"]>;
  question_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  question_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
};

export type CfComponentFeatureNestedFilter = {
  AND?: InputMaybe<Array<InputMaybe<CfComponentFeatureNestedFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<CfComponentFeatureNestedFilter>>>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  icon_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  subtitle?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  subtitle_not?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
};

export type CfComponentPartnerNestedFilter = {
  AND?: InputMaybe<Array<InputMaybe<CfComponentPartnerNestedFilter>>>;
  OR?: InputMaybe<Array<InputMaybe<CfComponentPartnerNestedFilter>>>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  logo_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  subtitle_not?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  sys?: InputMaybe<SysFilter>;
  url?: InputMaybe<Scalars["String"]["input"]>;
  url_contains?: InputMaybe<Scalars["String"]["input"]>;
  url_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  url_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  url_not?: InputMaybe<Scalars["String"]["input"]>;
  url_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  url_not_in?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
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
  profession?: string | null;
  sys: { __typename?: "Sys"; id: string };
  avatar?: ({ __typename?: "Asset" } & ImageFieldsFragment) | null;
};

export type FooterFieldsFragment = {
  __typename: "Footer";
  internalName?: string | null;
  brand?: string | null;
  title?: string | null;
  badge?: string | null;
  menuTitle?: string | null;
  supportTitle?: string | null;
  copyright?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  menuButtonsCollection?: {
    __typename?: "FooterMenuButtonsCollection";
    items: Array<({ __typename?: "ComponentButton" } & ButtonFieldsFragment) | null>;
  } | null;
  supportButtonsCollection?: {
    __typename?: "FooterSupportButtonsCollection";
    items: Array<({ __typename?: "ComponentButton" } & ButtonFieldsFragment) | null>;
  } | null;
};

export type ButtonFieldsFragment = {
  __typename: "ComponentButton";
  label?: string | null;
  url?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
};

export type FooterQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type FooterQuery = {
  __typename?: "Query";
  footerCollection?: {
    __typename?: "FooterCollection";
    items: Array<({ __typename?: "Footer" } & FooterFieldsFragment) | null>;
  } | null;
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

export type LandingMetadataFieldsFragment = {
  __typename: "LandingMetadata";
  internalName?: string | null;
  title?: string | null;
  description?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
};

export type LandingMetadataQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type LandingMetadataQuery = {
  __typename?: "Query";
  landingMetadataCollection?: {
    __typename?: "LandingMetadataCollection";
    items: Array<({ __typename?: "LandingMetadata" } & LandingMetadataFieldsFragment) | null>;
  } | null;
};

export type PageAboutFieldsFragment = {
  __typename: "PageAbout";
  pageTitle?: string | null;
  pageDescription?: string | null;
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
          | { __typename?: "ComponentButton" }
          | { __typename?: "ComponentFaqQuestion" }
          | { __typename?: "ComponentFeature" }
          | { __typename?: "ComponentPartner" }
          | ({ __typename?: "ComponentRichImage" } & RichImageFieldsFragment)
          | { __typename?: "ComponentSeo" }
          | { __typename?: "Footer" }
          | { __typename?: "LandingMetadata" }
          | { __typename?: "PageAbout" }
          | { __typename?: "PageBlogPost" }
          | { __typename?: "PageFaq" }
          | { __typename?: "PageHomeFeatures" }
          | { __typename?: "PageHomeHero" }
          | { __typename?: "PageHomeMission" }
          | { __typename?: "PageHomePartners" }
          | { __typename?: "PageLanding" }
          | { __typename?: "PagePolicies" }
          | { __typename?: "PageTermsAndConditions" }
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

export type FaqQuestionFieldsFragment = {
  __typename: "ComponentFaqQuestion";
  question?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  answer?: { __typename?: "ComponentFaqQuestionAnswer"; json: any } | null;
};

export type PageFaqFieldsFragment = {
  __typename: "PageFaq";
  pageTitle?: string | null;
  pageDescription?: string | null;
  internalName?: string | null;
  title?: string | null;
  intro?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  questionsCollection?: {
    __typename?: "PageFaqQuestionsCollection";
    items: Array<({ __typename?: "ComponentFaqQuestion" } & FaqQuestionFieldsFragment) | null>;
  } | null;
};

export type PageFaqQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type PageFaqQuery = {
  __typename?: "Query";
  pageFaqCollection?: {
    __typename?: "PageFaqCollection";
    items: Array<({ __typename?: "PageFaq" } & PageFaqFieldsFragment) | null>;
  } | null;
};

export type PageHomeFeaturesFieldsFragment = {
  __typename: "PageHomeFeatures";
  internalName?: string | null;
  title?: string | null;
  subtitle?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  featuresCollection?: {
    __typename?: "PageHomeFeaturesFeaturesCollection";
    items: Array<({ __typename?: "ComponentFeature" } & FeatureFieldsFragment) | null>;
  } | null;
  image?: {
    __typename?: "Asset";
    url?: string | null;
    title?: string | null;
    sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  } | null;
};

export type FeatureFieldsFragment = {
  __typename: "ComponentFeature";
  title?: string | null;
  subtitle?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  icon?: {
    __typename?: "Asset";
    url?: string | null;
    title?: string | null;
    sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  } | null;
};

export type PageHomeFeaturesQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type PageHomeFeaturesQuery = {
  __typename?: "Query";
  pageHomeFeaturesCollection?: {
    __typename?: "PageHomeFeaturesCollection";
    items: Array<({ __typename?: "PageHomeFeatures" } & PageHomeFeaturesFieldsFragment) | null>;
  } | null;
};

export type PageHomeHeroFieldsFragment = {
  __typename: "PageHomeHero";
  internalName?: string | null;
  badge?: string | null;
  title?: string | null;
  subtitle?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  buttonsCollection?: {
    __typename?: "PageHomeHeroButtonsCollection";
    items: Array<({ __typename?: "ComponentButton" } & ButtonFieldsFragment) | null>;
  } | null;
  image?: {
    __typename?: "Asset";
    url?: string | null;
    title?: string | null;
    sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  } | null;
};

export type PageHomeHeroQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type PageHomeHeroQuery = {
  __typename?: "Query";
  pageHomeHeroCollection?: {
    __typename?: "PageHomeHeroCollection";
    items: Array<({ __typename?: "PageHomeHero" } & PageHomeHeroFieldsFragment) | null>;
  } | null;
};

export type PageHomeMissionFieldsFragment = {
  __typename: "PageHomeMission";
  internalName?: string | null;
  title?: string | null;
  subtitle?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  about?: {
    __typename?: "PageHomeMissionAbout";
    json: any;
    links: {
      __typename?: "PageHomeMissionAboutLinks";
      entries: {
        __typename?: "PageHomeMissionAboutEntries";
        block: Array<
          | { __typename?: "ComponentAuthor" }
          | { __typename?: "ComponentButton" }
          | { __typename?: "ComponentFaqQuestion" }
          | { __typename?: "ComponentFeature" }
          | { __typename?: "ComponentPartner" }
          | ({ __typename?: "ComponentRichImage" } & RichImageFieldsFragment)
          | { __typename?: "ComponentSeo" }
          | { __typename?: "Footer" }
          | { __typename?: "LandingMetadata" }
          | { __typename?: "PageAbout" }
          | { __typename?: "PageBlogPost" }
          | { __typename?: "PageFaq" }
          | { __typename?: "PageHomeFeatures" }
          | { __typename?: "PageHomeHero" }
          | { __typename?: "PageHomeMission" }
          | { __typename?: "PageHomePartners" }
          | { __typename?: "PageLanding" }
          | { __typename?: "PagePolicies" }
          | { __typename?: "PageTermsAndConditions" }
          | null
        >;
      };
    };
  } | null;
  mission?: {
    __typename?: "PageHomeMissionMission";
    json: any;
    links: {
      __typename?: "PageHomeMissionMissionLinks";
      entries: {
        __typename?: "PageHomeMissionMissionEntries";
        block: Array<
          | { __typename?: "ComponentAuthor" }
          | { __typename?: "ComponentButton" }
          | { __typename?: "ComponentFaqQuestion" }
          | { __typename?: "ComponentFeature" }
          | { __typename?: "ComponentPartner" }
          | ({ __typename?: "ComponentRichImage" } & RichImageFieldsFragment)
          | { __typename?: "ComponentSeo" }
          | { __typename?: "Footer" }
          | { __typename?: "LandingMetadata" }
          | { __typename?: "PageAbout" }
          | { __typename?: "PageBlogPost" }
          | { __typename?: "PageFaq" }
          | { __typename?: "PageHomeFeatures" }
          | { __typename?: "PageHomeHero" }
          | { __typename?: "PageHomeMission" }
          | { __typename?: "PageHomePartners" }
          | { __typename?: "PageLanding" }
          | { __typename?: "PagePolicies" }
          | { __typename?: "PageTermsAndConditions" }
          | null
        >;
      };
    };
  } | null;
  image?: {
    __typename?: "Asset";
    url?: string | null;
    title?: string | null;
    sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  } | null;
  imagesCollection?: {
    __typename?: "AssetCollection";
    items: Array<({ __typename?: "Asset" } & ImageFieldsFragment) | null>;
  } | null;
};

export type PageHomeMissionQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type PageHomeMissionQuery = {
  __typename?: "Query";
  pageHomeMissionCollection?: {
    __typename?: "PageHomeMissionCollection";
    items: Array<({ __typename?: "PageHomeMission" } & PageHomeMissionFieldsFragment) | null>;
  } | null;
};

export type PageHomePartnersFieldsFragment = {
  __typename: "PageHomePartners";
  title?: string | null;
  subtitle?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  partnersCollection?: {
    __typename?: "PageHomePartnersPartnersCollection";
    items: Array<({ __typename?: "ComponentPartner" } & PartnerFieldsFragment) | null>;
  } | null;
  imagesCollection?: {
    __typename?: "AssetCollection";
    items: Array<({ __typename?: "Asset" } & ImageFieldsFragment) | null>;
  } | null;
};

export type PartnerFieldsFragment = {
  __typename: "ComponentPartner";
  subtitle?: string | null;
  url?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  logo?: {
    __typename?: "Asset";
    url?: string | null;
    title?: string | null;
    sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  } | null;
};

export type PageHomePartnersQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type PageHomePartnersQuery = {
  __typename?: "Query";
  pageHomePartnersCollection?: {
    __typename?: "PageHomePartnersCollection";
    items: Array<({ __typename?: "PageHomePartners" } & PageHomePartnersFieldsFragment) | null>;
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
  pageTitle?: string | null;
  pageDescription?: string | null;
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

export type PageTermsAndConditionsFieldsFragment = {
  __typename: "PageTermsAndConditions";
  pageTitle?: string | null;
  pageDescription?: string | null;
  internalName?: string | null;
  title?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  content?: { __typename?: "PageTermsAndConditionsContent"; json: any } | null;
};

export type PageTermsAndConditionsQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type PageTermsAndConditionsQuery = {
  __typename?: "Query";
  pageTermsAndConditionsCollection?: {
    __typename?: "PageTermsAndConditionsCollection";
    items: Array<
      ({ __typename?: "PageTermsAndConditions" } & PageTermsAndConditionsFieldsFragment) | null
    >;
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

export const ButtonFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment ButtonFields on ComponentButton {
    __typename
    sys {
      id
      publishedAt
      environmentId
    }
    label
    url
  }
`;
export const FooterFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment FooterFields on Footer {
    __typename
    sys {
      id
      publishedAt
      environmentId
    }
    internalName
    brand
    title
    badge
    menuTitle
    supportTitle
    copyright
    menuButtonsCollection {
      items {
        ...ButtonFields
      }
    }
    supportButtonsCollection {
      items {
        ...ButtonFields
      }
    }
  }
`;
export const LandingMetadataFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment LandingMetadataFields on LandingMetadata {
    __typename
    sys {
      id
      publishedAt
      environmentId
    }
    internalName
    title
    description
  }
`;
export const PageAboutFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment PageAboutFields on PageAbout {
    __typename
    sys {
      id
      publishedAt
      environmentId
    }
    pageTitle
    pageDescription
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
    profession
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
export const FaqQuestionFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment FaqQuestionFields on ComponentFaqQuestion {
    __typename
    sys {
      id
      publishedAt
      environmentId
    }
    question
    answer {
      json
    }
  }
`;
export const PageFaqFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment PageFaqFields on PageFaq {
    __typename
    sys {
      id
      publishedAt
      environmentId
    }
    pageTitle
    pageDescription
    internalName
    title
    intro
    questionsCollection {
      items {
        ...FaqQuestionFields
      }
    }
  }
`;
export const FeatureFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment FeatureFields on ComponentFeature {
    __typename
    sys {
      id
      publishedAt
      environmentId
    }
    title
    subtitle
    icon {
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
export const PageHomeFeaturesFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment PageHomeFeaturesFields on PageHomeFeatures {
    __typename
    sys {
      id
      publishedAt
      environmentId
    }
    internalName
    title
    subtitle
    featuresCollection {
      items {
        ...FeatureFields
      }
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
export const PageHomeHeroFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment PageHomeHeroFields on PageHomeHero {
    __typename
    sys {
      id
      publishedAt
      environmentId
    }
    internalName
    badge
    title
    subtitle
    buttonsCollection {
      items {
        ...ButtonFields
      }
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
export const PageHomeMissionFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment PageHomeMissionFields on PageHomeMission {
    __typename
    sys {
      id
      publishedAt
      environmentId
    }
    internalName
    title
    about {
      json
      links {
        entries {
          block {
            ...RichImageFields
          }
        }
      }
    }
    subtitle
    mission {
      json
      links {
        entries {
          block {
            ...RichImageFields
          }
        }
      }
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
    imagesCollection {
      items {
        ...ImageFields
      }
    }
  }
`;
export const PartnerFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment PartnerFields on ComponentPartner {
    __typename
    sys {
      id
      publishedAt
      environmentId
    }
    logo {
      url
      title
      sys {
        id
        publishedAt
        environmentId
      }
    }
    subtitle
    url
  }
`;
export const PageHomePartnersFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment PageHomePartnersFields on PageHomePartners {
    __typename
    sys {
      id
      publishedAt
      environmentId
    }
    title
    subtitle
    partnersCollection {
      items {
        ...PartnerFields
      }
    }
    imagesCollection {
      items {
        ...ImageFields
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
    pageTitle
    pageDescription
    internalName
    title
    content {
      json
    }
  }
`;
export const PageTermsAndConditionsFieldsFragmentDoc: ReturnType<typeof gql> = gql`
  fragment PageTermsAndConditionsFields on PageTermsAndConditions {
    __typename
    sys {
      id
      publishedAt
      environmentId
    }
    pageTitle
    pageDescription
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
export const FooterDocument: ReturnType<typeof gql> = gql`
  query footer($locale: String, $preview: Boolean) {
    footerCollection(limit: 1, locale: $locale, preview: $preview) {
      items {
        ...FooterFields
      }
    }
  }
  ${FooterFieldsFragmentDoc}
  ${ButtonFieldsFragmentDoc}
`;
export const LandingMetadataDocument: ReturnType<typeof gql> = gql`
  query landingMetadata($locale: String, $preview: Boolean) {
    landingMetadataCollection(limit: 1, locale: $locale, preview: $preview) {
      items {
        ...LandingMetadataFields
      }
    }
  }
  ${LandingMetadataFieldsFragmentDoc}
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
export const PageFaqDocument: ReturnType<typeof gql> = gql`
  query pageFaq($locale: String, $preview: Boolean) {
    pageFaqCollection(limit: 1, locale: $locale, preview: $preview) {
      items {
        ...PageFaqFields
      }
    }
  }
  ${PageFaqFieldsFragmentDoc}
  ${FaqQuestionFieldsFragmentDoc}
`;
export const PageHomeFeaturesDocument: ReturnType<typeof gql> = gql`
  query pageHomeFeatures($locale: String, $preview: Boolean) {
    pageHomeFeaturesCollection(limit: 1, locale: $locale, preview: $preview) {
      items {
        ...PageHomeFeaturesFields
      }
    }
  }
  ${PageHomeFeaturesFieldsFragmentDoc}
  ${FeatureFieldsFragmentDoc}
`;
export const PageHomeHeroDocument: ReturnType<typeof gql> = gql`
  query pageHomeHero($locale: String, $preview: Boolean) {
    pageHomeHeroCollection(limit: 1, locale: $locale, preview: $preview) {
      items {
        ...PageHomeHeroFields
      }
    }
  }
  ${PageHomeHeroFieldsFragmentDoc}
  ${ButtonFieldsFragmentDoc}
`;
export const PageHomeMissionDocument: ReturnType<typeof gql> = gql`
  query pageHomeMission($locale: String, $preview: Boolean) {
    pageHomeMissionCollection(limit: 1, locale: $locale, preview: $preview) {
      items {
        ...PageHomeMissionFields
      }
    }
  }
  ${PageHomeMissionFieldsFragmentDoc}
  ${RichImageFieldsFragmentDoc}
  ${ImageFieldsFragmentDoc}
`;
export const PageHomePartnersDocument: ReturnType<typeof gql> = gql`
  query pageHomePartners($locale: String, $preview: Boolean) {
    pageHomePartnersCollection(limit: 1, locale: $locale, preview: $preview) {
      items {
        ...PageHomePartnersFields
      }
    }
  }
  ${PageHomePartnersFieldsFragmentDoc}
  ${PartnerFieldsFragmentDoc}
  ${ImageFieldsFragmentDoc}
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
export const PageTermsAndConditionsDocument: ReturnType<typeof gql> = gql`
  query pageTermsAndConditions($locale: String, $preview: Boolean) {
    pageTermsAndConditionsCollection(limit: 1, locale: $locale, preview: $preview) {
      items {
        ...PageTermsAndConditionsFields
      }
    }
  }
  ${PageTermsAndConditionsFieldsFragmentDoc}
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
    footer(
      variables?: FooterQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<FooterQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<FooterQuery>({
            document: FooterDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "footer",
        "query",
        variables,
      );
    },
    landingMetadata(
      variables?: LandingMetadataQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<LandingMetadataQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<LandingMetadataQuery>({
            document: LandingMetadataDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "landingMetadata",
        "query",
        variables,
      );
    },
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
    pageFaq(
      variables?: PageFaqQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PageFaqQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PageFaqQuery>({
            document: PageFaqDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "pageFaq",
        "query",
        variables,
      );
    },
    pageHomeFeatures(
      variables?: PageHomeFeaturesQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PageHomeFeaturesQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PageHomeFeaturesQuery>({
            document: PageHomeFeaturesDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "pageHomeFeatures",
        "query",
        variables,
      );
    },
    pageHomeHero(
      variables?: PageHomeHeroQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PageHomeHeroQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PageHomeHeroQuery>({
            document: PageHomeHeroDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "pageHomeHero",
        "query",
        variables,
      );
    },
    pageHomeMission(
      variables?: PageHomeMissionQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PageHomeMissionQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PageHomeMissionQuery>({
            document: PageHomeMissionDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "pageHomeMission",
        "query",
        variables,
      );
    },
    pageHomePartners(
      variables?: PageHomePartnersQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PageHomePartnersQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PageHomePartnersQuery>({
            document: PageHomePartnersDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "pageHomePartners",
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
    pageTermsAndConditions(
      variables?: PageTermsAndConditionsQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PageTermsAndConditionsQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PageTermsAndConditionsQuery>({
            document: PageTermsAndConditionsDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "pageTermsAndConditions",
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
