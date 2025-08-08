import type { GraphQLClient, RequestOptions } from "graphql-request";
import gql from "graphql-tag";

export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends Record<string, unknown>> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends Record<string, unknown>, K extends keyof T> = Partial<
  Record<K, never>
>;
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"];
/** All built-in and custom scalars, mapped to their actual values */
export interface Scalars {
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
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface Asset {
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
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface AssetContentTypeArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface AssetDescriptionArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface AssetFileNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface AssetHeightArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface AssetLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface AssetSizeArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface AssetTitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface AssetUrlArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  transform?: InputMaybe<ImageTransformOptions>;
}

/** Represents a binary file in a space. An asset can be any file type. */
export interface AssetWidthArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

export interface AssetCollection {
  __typename?: "AssetCollection";
  items: Maybe<Asset>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

export interface AssetFilter {
  AND?: InputMaybe<InputMaybe<AssetFilter>[]>;
  OR?: InputMaybe<InputMaybe<AssetFilter>[]>;
  contentType?: InputMaybe<Scalars["String"]["input"]>;
  contentType_contains?: InputMaybe<Scalars["String"]["input"]>;
  contentType_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  contentType_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  contentType_not?: InputMaybe<Scalars["String"]["input"]>;
  contentType_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  contentType_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  description?: InputMaybe<Scalars["String"]["input"]>;
  description_contains?: InputMaybe<Scalars["String"]["input"]>;
  description_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  description_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  description_not?: InputMaybe<Scalars["String"]["input"]>;
  description_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  description_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  fileName?: InputMaybe<Scalars["String"]["input"]>;
  fileName_contains?: InputMaybe<Scalars["String"]["input"]>;
  fileName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  fileName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  fileName_not?: InputMaybe<Scalars["String"]["input"]>;
  fileName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  fileName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  height?: InputMaybe<Scalars["Int"]["input"]>;
  height_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  height_gt?: InputMaybe<Scalars["Int"]["input"]>;
  height_gte?: InputMaybe<Scalars["Int"]["input"]>;
  height_in?: InputMaybe<InputMaybe<Scalars["Int"]["input"]>[]>;
  height_lt?: InputMaybe<Scalars["Int"]["input"]>;
  height_lte?: InputMaybe<Scalars["Int"]["input"]>;
  height_not?: InputMaybe<Scalars["Int"]["input"]>;
  height_not_in?: InputMaybe<InputMaybe<Scalars["Int"]["input"]>[]>;
  size?: InputMaybe<Scalars["Int"]["input"]>;
  size_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  size_gt?: InputMaybe<Scalars["Int"]["input"]>;
  size_gte?: InputMaybe<Scalars["Int"]["input"]>;
  size_in?: InputMaybe<InputMaybe<Scalars["Int"]["input"]>[]>;
  size_lt?: InputMaybe<Scalars["Int"]["input"]>;
  size_lte?: InputMaybe<Scalars["Int"]["input"]>;
  size_not?: InputMaybe<Scalars["Int"]["input"]>;
  size_not_in?: InputMaybe<InputMaybe<Scalars["Int"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  url?: InputMaybe<Scalars["String"]["input"]>;
  url_contains?: InputMaybe<Scalars["String"]["input"]>;
  url_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  url_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  url_not?: InputMaybe<Scalars["String"]["input"]>;
  url_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  url_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  width?: InputMaybe<Scalars["Int"]["input"]>;
  width_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  width_gt?: InputMaybe<Scalars["Int"]["input"]>;
  width_gte?: InputMaybe<Scalars["Int"]["input"]>;
  width_in?: InputMaybe<InputMaybe<Scalars["Int"]["input"]>[]>;
  width_lt?: InputMaybe<Scalars["Int"]["input"]>;
  width_lte?: InputMaybe<Scalars["Int"]["input"]>;
  width_not?: InputMaybe<Scalars["Int"]["input"]>;
  width_not_in?: InputMaybe<InputMaybe<Scalars["Int"]["input"]>[]>;
}

export interface AssetLinkingCollections {
  __typename?: "AssetLinkingCollections";
  componentAuthorCollection?: Maybe<ComponentAuthorCollection>;
  componentFeatureCollection?: Maybe<ComponentFeatureCollection>;
  componentPartnerCollection?: Maybe<ComponentPartnerCollection>;
  componentRichImageCollection?: Maybe<ComponentRichImageCollection>;
  componentSeoCollection?: Maybe<ComponentSeoCollection>;
  entryCollection?: Maybe<EntryCollection>;
  pageAboutCollection?: Maybe<PageAboutCollection>;
  pageBlogPostCollection?: Maybe<PageBlogPostCollection>;
  pageHomeMissionCollection?: Maybe<PageHomeMissionCollection>;
  pageHomePartnersCollection?: Maybe<PageHomePartnersCollection>;
}

export interface AssetLinkingCollectionsComponentAuthorCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface AssetLinkingCollectionsComponentFeatureCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface AssetLinkingCollectionsComponentPartnerCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface AssetLinkingCollectionsComponentRichImageCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface AssetLinkingCollectionsComponentSeoCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface AssetLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface AssetLinkingCollectionsPageAboutCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface AssetLinkingCollectionsPageBlogPostCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface AssetLinkingCollectionsPageHomeMissionCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface AssetLinkingCollectionsPageHomePartnersCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
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

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentAuthor) */
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

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentAuthor) */
export interface ComponentAuthorAvatarArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentAuthor) */
export interface ComponentAuthorInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentAuthor) */
export interface ComponentAuthorLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentAuthor) */
export interface ComponentAuthorNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

export interface ComponentAuthorCollection {
  __typename?: "ComponentAuthorCollection";
  items: Maybe<ComponentAuthor>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

export interface ComponentAuthorFilter {
  AND?: InputMaybe<InputMaybe<ComponentAuthorFilter>[]>;
  OR?: InputMaybe<InputMaybe<ComponentAuthorFilter>[]>;
  avatar_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  name_contains?: InputMaybe<Scalars["String"]["input"]>;
  name_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  name_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  name_not?: InputMaybe<Scalars["String"]["input"]>;
  name_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  name_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
}

export interface ComponentAuthorLinkingCollections {
  __typename?: "ComponentAuthorLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
  pageBlogPostCollection?: Maybe<PageBlogPostCollection>;
}

export interface ComponentAuthorLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface ComponentAuthorLinkingCollectionsPageBlogPostCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<ComponentAuthorLinkingCollectionsPageBlogPostCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
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

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentButton) */
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

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentButton) */
export interface ComponentButtonInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentButton) */
export interface ComponentButtonLabelArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentButton) */
export interface ComponentButtonLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentButton) */
export interface ComponentButtonUrlArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

export interface ComponentButtonCollection {
  __typename?: "ComponentButtonCollection";
  items: Maybe<ComponentButton>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

export interface ComponentButtonFilter {
  AND?: InputMaybe<InputMaybe<ComponentButtonFilter>[]>;
  OR?: InputMaybe<InputMaybe<ComponentButtonFilter>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  label?: InputMaybe<Scalars["String"]["input"]>;
  label_contains?: InputMaybe<Scalars["String"]["input"]>;
  label_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  label_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  label_not?: InputMaybe<Scalars["String"]["input"]>;
  label_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  label_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
  url?: InputMaybe<Scalars["String"]["input"]>;
  url_contains?: InputMaybe<Scalars["String"]["input"]>;
  url_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  url_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  url_not?: InputMaybe<Scalars["String"]["input"]>;
  url_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  url_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

export interface ComponentButtonLinkingCollections {
  __typename?: "ComponentButtonLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
  footerCollection?: Maybe<FooterCollection>;
  pageHomeHeroCollection?: Maybe<PageHomeHeroCollection>;
}

export interface ComponentButtonLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface ComponentButtonLinkingCollectionsFooterCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<ComponentButtonLinkingCollectionsFooterCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface ComponentButtonLinkingCollectionsPageHomeHeroCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<ComponentButtonLinkingCollectionsPageHomeHeroCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

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
export interface ComponentFaqQuestionAnswerArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentFaqQuestion) */
export interface ComponentFaqQuestionInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentFaqQuestion) */
export interface ComponentFaqQuestionLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentFaqQuestion) */
export interface ComponentFaqQuestionQuestionArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

export interface ComponentFaqQuestionAnswer {
  __typename?: "ComponentFaqQuestionAnswer";
  json: Scalars["JSON"]["output"];
  links: ComponentFaqQuestionAnswerLinks;
}

export interface ComponentFaqQuestionAnswerAssets {
  __typename?: "ComponentFaqQuestionAnswerAssets";
  block: Maybe<Asset>[];
  hyperlink: Maybe<Asset>[];
}

export interface ComponentFaqQuestionAnswerEntries {
  __typename?: "ComponentFaqQuestionAnswerEntries";
  block: Maybe<Entry>[];
  hyperlink: Maybe<Entry>[];
  inline: Maybe<Entry>[];
}

export interface ComponentFaqQuestionAnswerLinks {
  __typename?: "ComponentFaqQuestionAnswerLinks";
  assets: ComponentFaqQuestionAnswerAssets;
  entries: ComponentFaqQuestionAnswerEntries;
  resources: ComponentFaqQuestionAnswerResources;
}

export interface ComponentFaqQuestionAnswerResources {
  __typename?: "ComponentFaqQuestionAnswerResources";
  block: ComponentFaqQuestionAnswerResourcesBlock[];
  hyperlink: ComponentFaqQuestionAnswerResourcesHyperlink[];
  inline: ComponentFaqQuestionAnswerResourcesInline[];
}

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

export interface ComponentFaqQuestionCollection {
  __typename?: "ComponentFaqQuestionCollection";
  items: Maybe<ComponentFaqQuestion>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

export interface ComponentFaqQuestionFilter {
  AND?: InputMaybe<InputMaybe<ComponentFaqQuestionFilter>[]>;
  OR?: InputMaybe<InputMaybe<ComponentFaqQuestionFilter>[]>;
  answer_contains?: InputMaybe<Scalars["String"]["input"]>;
  answer_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  answer_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  question?: InputMaybe<Scalars["String"]["input"]>;
  question_contains?: InputMaybe<Scalars["String"]["input"]>;
  question_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  question_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  question_not?: InputMaybe<Scalars["String"]["input"]>;
  question_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  question_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
}

export interface ComponentFaqQuestionLinkingCollections {
  __typename?: "ComponentFaqQuestionLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
  pageFaqCollection?: Maybe<PageFaqCollection>;
}

export interface ComponentFaqQuestionLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface ComponentFaqQuestionLinkingCollectionsPageFaqCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<ComponentFaqQuestionLinkingCollectionsPageFaqCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export enum ComponentFaqQuestionLinkingCollectionsPageFaqCollectionOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  IntroAsc = "intro_ASC",
  IntroDesc = "intro_DESC",
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
export interface ComponentFeatureIconArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentFeature) */
export interface ComponentFeatureInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentFeature) */
export interface ComponentFeatureLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentFeature) */
export interface ComponentFeatureSubtitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentFeature) */
export interface ComponentFeatureTitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

export interface ComponentFeatureCollection {
  __typename?: "ComponentFeatureCollection";
  items: Maybe<ComponentFeature>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

export interface ComponentFeatureFilter {
  AND?: InputMaybe<InputMaybe<ComponentFeatureFilter>[]>;
  OR?: InputMaybe<InputMaybe<ComponentFeatureFilter>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  icon_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  subtitle?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  subtitle_not?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

export interface ComponentFeatureLinkingCollections {
  __typename?: "ComponentFeatureLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
  pageHomeFeaturesCollection?: Maybe<PageHomeFeaturesCollection>;
}

export interface ComponentFeatureLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface ComponentFeatureLinkingCollectionsPageHomeFeaturesCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<
    InputMaybe<ComponentFeatureLinkingCollectionsPageHomeFeaturesCollectionOrder>[]
  >;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

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
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentPartner) */
export interface ComponentPartnerInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentPartner) */
export interface ComponentPartnerLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentPartner) */
export interface ComponentPartnerLogoArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentPartner) */
export interface ComponentPartnerSubtitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

export interface ComponentPartnerCollection {
  __typename?: "ComponentPartnerCollection";
  items: Maybe<ComponentPartner>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

export interface ComponentPartnerFilter {
  AND?: InputMaybe<InputMaybe<ComponentPartnerFilter>[]>;
  OR?: InputMaybe<InputMaybe<ComponentPartnerFilter>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  logo_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  subtitle_not?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
}

export interface ComponentPartnerLinkingCollections {
  __typename?: "ComponentPartnerLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
  pageHomePartnersCollection?: Maybe<PageHomePartnersCollection>;
}

export interface ComponentPartnerLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface ComponentPartnerLinkingCollectionsPageHomePartnersCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<
    InputMaybe<ComponentPartnerLinkingCollectionsPageHomePartnersCollectionOrder>[]
  >;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

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
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentRichImage) */
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

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentRichImage) */
export interface ComponentRichImageCaptionArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentRichImage) */
export interface ComponentRichImageFullWidthArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentRichImage) */
export interface ComponentRichImageImageArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentRichImage) */
export interface ComponentRichImageInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentRichImage) */
export interface ComponentRichImageLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

export interface ComponentRichImageCollection {
  __typename?: "ComponentRichImageCollection";
  items: Maybe<ComponentRichImage>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

export interface ComponentRichImageFilter {
  AND?: InputMaybe<InputMaybe<ComponentRichImageFilter>[]>;
  OR?: InputMaybe<InputMaybe<ComponentRichImageFilter>[]>;
  caption?: InputMaybe<Scalars["String"]["input"]>;
  caption_contains?: InputMaybe<Scalars["String"]["input"]>;
  caption_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  caption_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  caption_not?: InputMaybe<Scalars["String"]["input"]>;
  caption_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  caption_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  fullWidth?: InputMaybe<Scalars["Boolean"]["input"]>;
  fullWidth_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  fullWidth_not?: InputMaybe<Scalars["Boolean"]["input"]>;
  image_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
}

export interface ComponentRichImageLinkingCollections {
  __typename?: "ComponentRichImageLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
}

export interface ComponentRichImageLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
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

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
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

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export interface ComponentSeoCanonicalUrlArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export interface ComponentSeoInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export interface ComponentSeoLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export interface ComponentSeoNofollowArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export interface ComponentSeoNoindexArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export interface ComponentSeoPageDescriptionArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export interface ComponentSeoPageTitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/componentSeo) */
export interface ComponentSeoShareImagesCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface ComponentSeoCollection {
  __typename?: "ComponentSeoCollection";
  items: Maybe<ComponentSeo>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

export interface ComponentSeoFilter {
  AND?: InputMaybe<InputMaybe<ComponentSeoFilter>[]>;
  OR?: InputMaybe<InputMaybe<ComponentSeoFilter>[]>;
  canonicalUrl?: InputMaybe<Scalars["String"]["input"]>;
  canonicalUrl_contains?: InputMaybe<Scalars["String"]["input"]>;
  canonicalUrl_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  canonicalUrl_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  canonicalUrl_not?: InputMaybe<Scalars["String"]["input"]>;
  canonicalUrl_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  canonicalUrl_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  nofollow?: InputMaybe<Scalars["Boolean"]["input"]>;
  nofollow_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  nofollow_not?: InputMaybe<Scalars["Boolean"]["input"]>;
  noindex?: InputMaybe<Scalars["Boolean"]["input"]>;
  noindex_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  noindex_not?: InputMaybe<Scalars["Boolean"]["input"]>;
  pageDescription?: InputMaybe<Scalars["String"]["input"]>;
  pageDescription_contains?: InputMaybe<Scalars["String"]["input"]>;
  pageDescription_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  pageDescription_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  pageDescription_not?: InputMaybe<Scalars["String"]["input"]>;
  pageDescription_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  pageDescription_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  pageTitle?: InputMaybe<Scalars["String"]["input"]>;
  pageTitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  pageTitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  pageTitle_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  pageTitle_not?: InputMaybe<Scalars["String"]["input"]>;
  pageTitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  pageTitle_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  shareImagesCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  sys?: InputMaybe<SysFilter>;
}

export interface ComponentSeoLinkingCollections {
  __typename?: "ComponentSeoLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
  pageBlogPostCollection?: Maybe<PageBlogPostCollection>;
  pageLandingCollection?: Maybe<PageLandingCollection>;
}

export interface ComponentSeoLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface ComponentSeoLinkingCollectionsPageBlogPostCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<ComponentSeoLinkingCollectionsPageBlogPostCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface ComponentSeoLinkingCollectionsPageLandingCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<ComponentSeoLinkingCollectionsPageLandingCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
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
  concepts: Maybe<TaxonomyConcept>[];
  tags: Maybe<ContentfulTag>[];
}

export interface ContentfulMetadataConceptsDescendantsFilter {
  id_contains_all?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  id_contains_none?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  id_contains_some?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

export interface ContentfulMetadataConceptsFilter {
  descendants?: InputMaybe<ContentfulMetadataConceptsDescendantsFilter>;
  id_contains_all?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  id_contains_none?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  id_contains_some?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

export interface ContentfulMetadataFilter {
  concepts?: InputMaybe<ContentfulMetadataConceptsFilter>;
  concepts_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  tags?: InputMaybe<ContentfulMetadataTagsFilter>;
  tags_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface ContentfulMetadataTagsFilter {
  id_contains_all?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  id_contains_none?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  id_contains_some?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

/**
 * Represents a tag entity for finding and organizing content easily.
 *       Find out more here: https://www.contentful.com/developers/docs/references/content-delivery-api/#/reference/content-tags
 */
export interface ContentfulTag {
  __typename?: "ContentfulTag";
  id?: Maybe<Scalars["String"]["output"]>;
  name?: Maybe<Scalars["String"]["output"]>;
}

export interface Entry {
  contentfulMetadata: ContentfulMetadata;
  sys: Sys;
}

export interface EntryCollection {
  __typename?: "EntryCollection";
  items: Maybe<Entry>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
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
export interface FooterBadgeArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export interface FooterBrandArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export interface FooterCopyrightArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export interface FooterInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export interface FooterLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export interface FooterMenuButtonsCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<FooterMenuButtonsCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<ComponentButtonFilter>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export interface FooterMenuTitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export interface FooterSupportButtonsCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<FooterSupportButtonsCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<ComponentButtonFilter>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export interface FooterSupportTitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/footer) */
export interface FooterTitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

export interface FooterCollection {
  __typename?: "FooterCollection";
  items: Maybe<Footer>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

export interface FooterFilter {
  AND?: InputMaybe<InputMaybe<FooterFilter>[]>;
  OR?: InputMaybe<InputMaybe<FooterFilter>[]>;
  badge?: InputMaybe<Scalars["String"]["input"]>;
  badge_contains?: InputMaybe<Scalars["String"]["input"]>;
  badge_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  badge_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  badge_not?: InputMaybe<Scalars["String"]["input"]>;
  badge_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  badge_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  brand?: InputMaybe<Scalars["String"]["input"]>;
  brand_contains?: InputMaybe<Scalars["String"]["input"]>;
  brand_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  brand_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  brand_not?: InputMaybe<Scalars["String"]["input"]>;
  brand_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  brand_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  copyright?: InputMaybe<Scalars["String"]["input"]>;
  copyright_contains?: InputMaybe<Scalars["String"]["input"]>;
  copyright_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  copyright_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  copyright_not?: InputMaybe<Scalars["String"]["input"]>;
  copyright_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  copyright_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  menuButtons?: InputMaybe<CfComponentButtonNestedFilter>;
  menuButtonsCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  menuTitle?: InputMaybe<Scalars["String"]["input"]>;
  menuTitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  menuTitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  menuTitle_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  menuTitle_not?: InputMaybe<Scalars["String"]["input"]>;
  menuTitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  menuTitle_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  supportButtons?: InputMaybe<CfComponentButtonNestedFilter>;
  supportButtonsCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  supportTitle?: InputMaybe<Scalars["String"]["input"]>;
  supportTitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  supportTitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  supportTitle_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  supportTitle_not?: InputMaybe<Scalars["String"]["input"]>;
  supportTitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  supportTitle_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

export interface FooterLinkingCollections {
  __typename?: "FooterLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
}

export interface FooterLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface FooterMenuButtonsCollection {
  __typename?: "FooterMenuButtonsCollection";
  items: Maybe<ComponentButton>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

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

export interface FooterSupportButtonsCollection {
  __typename?: "FooterSupportButtonsCollection";
  items: Maybe<ComponentButton>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

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

export interface ImageTransformOptions {
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
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageAbout) */
export interface PageAboutDescriptionArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageAbout) */
export interface PageAboutImageArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageAbout) */
export interface PageAboutInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageAbout) */
export interface PageAboutLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageAbout) */
export interface PageAboutTitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

export interface PageAboutCollection {
  __typename?: "PageAboutCollection";
  items: Maybe<PageAbout>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

export interface PageAboutDescription {
  __typename?: "PageAboutDescription";
  json: Scalars["JSON"]["output"];
  links: PageAboutDescriptionLinks;
}

export interface PageAboutDescriptionAssets {
  __typename?: "PageAboutDescriptionAssets";
  block: Maybe<Asset>[];
  hyperlink: Maybe<Asset>[];
}

export interface PageAboutDescriptionEntries {
  __typename?: "PageAboutDescriptionEntries";
  block: Maybe<Entry>[];
  hyperlink: Maybe<Entry>[];
  inline: Maybe<Entry>[];
}

export interface PageAboutDescriptionLinks {
  __typename?: "PageAboutDescriptionLinks";
  assets: PageAboutDescriptionAssets;
  entries: PageAboutDescriptionEntries;
  resources: PageAboutDescriptionResources;
}

export interface PageAboutDescriptionResources {
  __typename?: "PageAboutDescriptionResources";
  block: PageAboutDescriptionResourcesBlock[];
  hyperlink: PageAboutDescriptionResourcesHyperlink[];
  inline: PageAboutDescriptionResourcesInline[];
}

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

export interface PageAboutFilter {
  AND?: InputMaybe<InputMaybe<PageAboutFilter>[]>;
  OR?: InputMaybe<InputMaybe<PageAboutFilter>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  description_contains?: InputMaybe<Scalars["String"]["input"]>;
  description_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  description_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  image_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

export interface PageAboutLinkingCollections {
  __typename?: "PageAboutLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
}

export interface PageAboutLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

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

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
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

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export interface PageBlogPostAuthorArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentAuthorFilter>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export interface PageBlogPostContentArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export interface PageBlogPostFeaturedImageArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export interface PageBlogPostInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export interface PageBlogPostLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export interface PageBlogPostPublishedDateArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export interface PageBlogPostRelatedBlogPostsCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<PageBlogPostRelatedBlogPostsCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<PageBlogPostFilter>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export interface PageBlogPostSeoFieldsArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentSeoFilter>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export interface PageBlogPostShortDescriptionArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export interface PageBlogPostSlugArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageBlogPost) */
export interface PageBlogPostTitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

export interface PageBlogPostCollection {
  __typename?: "PageBlogPostCollection";
  items: Maybe<PageBlogPost>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

export interface PageBlogPostContent {
  __typename?: "PageBlogPostContent";
  json: Scalars["JSON"]["output"];
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
  author_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  content_contains?: InputMaybe<Scalars["String"]["input"]>;
  content_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  content_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  featuredImage_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  publishedDate?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  publishedDate_gt?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_gte?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_in?: InputMaybe<InputMaybe<Scalars["DateTime"]["input"]>[]>;
  publishedDate_lt?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_lte?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_not?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_not_in?: InputMaybe<InputMaybe<Scalars["DateTime"]["input"]>[]>;
  relatedBlogPosts?: InputMaybe<CfPageBlogPostNestedFilter>;
  relatedBlogPostsCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  seoFields?: InputMaybe<CfComponentSeoNestedFilter>;
  seoFields_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  shortDescription?: InputMaybe<Scalars["String"]["input"]>;
  shortDescription_contains?: InputMaybe<Scalars["String"]["input"]>;
  shortDescription_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  shortDescription_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  shortDescription_not?: InputMaybe<Scalars["String"]["input"]>;
  shortDescription_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  shortDescription_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  slug?: InputMaybe<Scalars["String"]["input"]>;
  slug_contains?: InputMaybe<Scalars["String"]["input"]>;
  slug_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  slug_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  slug_not?: InputMaybe<Scalars["String"]["input"]>;
  slug_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  slug_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

export interface PageBlogPostLinkingCollections {
  __typename?: "PageBlogPostLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
  pageBlogPostCollection?: Maybe<PageBlogPostCollection>;
  pageLandingCollection?: Maybe<PageLandingCollection>;
}

export interface PageBlogPostLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface PageBlogPostLinkingCollectionsPageBlogPostCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<PageBlogPostLinkingCollectionsPageBlogPostCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface PageBlogPostLinkingCollectionsPageLandingCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<PageBlogPostLinkingCollectionsPageLandingCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
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
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
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

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageFaq) */
export type PageFaq = Entry &
  _Node & {
    __typename?: "PageFaq";
    _id: Scalars["ID"]["output"];
    contentfulMetadata: ContentfulMetadata;
    internalName?: Maybe<Scalars["String"]["output"]>;
    intro?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<PageFaqLinkingCollections>;
    questionsCollection?: Maybe<PageFaqQuestionsCollection>;
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageFaq) */
export interface PageFaqInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageFaq) */
export interface PageFaqIntroArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageFaq) */
export interface PageFaqLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageFaq) */
export interface PageFaqQuestionsCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<PageFaqQuestionsCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<ComponentFaqQuestionFilter>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageFaq) */
export interface PageFaqTitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

export interface PageFaqCollection {
  __typename?: "PageFaqCollection";
  items: Maybe<PageFaq>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

export interface PageFaqFilter {
  AND?: InputMaybe<InputMaybe<PageFaqFilter>[]>;
  OR?: InputMaybe<InputMaybe<PageFaqFilter>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  intro?: InputMaybe<Scalars["String"]["input"]>;
  intro_contains?: InputMaybe<Scalars["String"]["input"]>;
  intro_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  intro_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  intro_not?: InputMaybe<Scalars["String"]["input"]>;
  intro_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  intro_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  questions?: InputMaybe<CfComponentFaqQuestionNestedFilter>;
  questionsCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

export interface PageFaqLinkingCollections {
  __typename?: "PageFaqLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
}

export interface PageFaqLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export enum PageFaqOrder {
  InternalNameAsc = "internalName_ASC",
  InternalNameDesc = "internalName_DESC",
  IntroAsc = "intro_ASC",
  IntroDesc = "intro_DESC",
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

export interface PageFaqQuestionsCollection {
  __typename?: "PageFaqQuestionsCollection";
  items: Maybe<ComponentFaqQuestion>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

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
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<PageHomeFeaturesLinkingCollections>;
    subtitle?: Maybe<Scalars["String"]["output"]>;
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeFeatures) */
export interface PageHomeFeaturesFeaturesCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<PageHomeFeaturesFeaturesCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<ComponentFeatureFilter>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeFeatures) */
export interface PageHomeFeaturesInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeFeatures) */
export interface PageHomeFeaturesLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeFeatures) */
export interface PageHomeFeaturesSubtitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeFeatures) */
export interface PageHomeFeaturesTitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

export interface PageHomeFeaturesCollection {
  __typename?: "PageHomeFeaturesCollection";
  items: Maybe<PageHomeFeatures>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

export interface PageHomeFeaturesFeaturesCollection {
  __typename?: "PageHomeFeaturesFeaturesCollection";
  items: Maybe<ComponentFeature>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

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

export interface PageHomeFeaturesFilter {
  AND?: InputMaybe<InputMaybe<PageHomeFeaturesFilter>[]>;
  OR?: InputMaybe<InputMaybe<PageHomeFeaturesFilter>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  features?: InputMaybe<CfComponentFeatureNestedFilter>;
  featuresCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  subtitle?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  subtitle_not?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

export interface PageHomeFeaturesLinkingCollections {
  __typename?: "PageHomeFeaturesLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
}

export interface PageHomeFeaturesLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

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
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<PageHomeHeroLinkingCollections>;
    subtitle?: Maybe<Scalars["String"]["output"]>;
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeHero) */
export interface PageHomeHeroBadgeArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeHero) */
export interface PageHomeHeroButtonsCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<PageHomeHeroButtonsCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<ComponentButtonFilter>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeHero) */
export interface PageHomeHeroInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeHero) */
export interface PageHomeHeroLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeHero) */
export interface PageHomeHeroSubtitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeHero) */
export interface PageHomeHeroTitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

export interface PageHomeHeroButtonsCollection {
  __typename?: "PageHomeHeroButtonsCollection";
  items: Maybe<ComponentButton>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

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

export interface PageHomeHeroCollection {
  __typename?: "PageHomeHeroCollection";
  items: Maybe<PageHomeHero>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

export interface PageHomeHeroFilter {
  AND?: InputMaybe<InputMaybe<PageHomeHeroFilter>[]>;
  OR?: InputMaybe<InputMaybe<PageHomeHeroFilter>[]>;
  badge?: InputMaybe<Scalars["String"]["input"]>;
  badge_contains?: InputMaybe<Scalars["String"]["input"]>;
  badge_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  badge_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  badge_not?: InputMaybe<Scalars["String"]["input"]>;
  badge_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  badge_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  buttons?: InputMaybe<CfComponentButtonNestedFilter>;
  buttonsCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  subtitle?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  subtitle_not?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

export interface PageHomeHeroLinkingCollections {
  __typename?: "PageHomeHeroLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
}

export interface PageHomeHeroLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

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
    internalName?: Maybe<Scalars["String"]["output"]>;
    linkedFrom?: Maybe<PageHomeMissionLinkingCollections>;
    mission?: Maybe<PageHomeMissionMission>;
    subtitle?: Maybe<Scalars["String"]["output"]>;
    sys: Sys;
    title?: Maybe<Scalars["String"]["output"]>;
  };

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeMission) */
export interface PageHomeMissionAboutArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeMission) */
export interface PageHomeMissionImageArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeMission) */
export interface PageHomeMissionInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeMission) */
export interface PageHomeMissionLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeMission) */
export interface PageHomeMissionMissionArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeMission) */
export interface PageHomeMissionSubtitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomeMission) */
export interface PageHomeMissionTitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

export interface PageHomeMissionAbout {
  __typename?: "PageHomeMissionAbout";
  json: Scalars["JSON"]["output"];
  links: PageHomeMissionAboutLinks;
}

export interface PageHomeMissionAboutAssets {
  __typename?: "PageHomeMissionAboutAssets";
  block: Maybe<Asset>[];
  hyperlink: Maybe<Asset>[];
}

export interface PageHomeMissionAboutEntries {
  __typename?: "PageHomeMissionAboutEntries";
  block: Maybe<Entry>[];
  hyperlink: Maybe<Entry>[];
  inline: Maybe<Entry>[];
}

export interface PageHomeMissionAboutLinks {
  __typename?: "PageHomeMissionAboutLinks";
  assets: PageHomeMissionAboutAssets;
  entries: PageHomeMissionAboutEntries;
  resources: PageHomeMissionAboutResources;
}

export interface PageHomeMissionAboutResources {
  __typename?: "PageHomeMissionAboutResources";
  block: PageHomeMissionAboutResourcesBlock[];
  hyperlink: PageHomeMissionAboutResourcesHyperlink[];
  inline: PageHomeMissionAboutResourcesInline[];
}

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

export interface PageHomeMissionCollection {
  __typename?: "PageHomeMissionCollection";
  items: Maybe<PageHomeMission>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

export interface PageHomeMissionFilter {
  AND?: InputMaybe<InputMaybe<PageHomeMissionFilter>[]>;
  OR?: InputMaybe<InputMaybe<PageHomeMissionFilter>[]>;
  about_contains?: InputMaybe<Scalars["String"]["input"]>;
  about_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  about_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  image_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  mission_contains?: InputMaybe<Scalars["String"]["input"]>;
  mission_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  mission_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  subtitle_not?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

export interface PageHomeMissionLinkingCollections {
  __typename?: "PageHomeMissionLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
}

export interface PageHomeMissionLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

export interface PageHomeMissionMission {
  __typename?: "PageHomeMissionMission";
  json: Scalars["JSON"]["output"];
  links: PageHomeMissionMissionLinks;
}

export interface PageHomeMissionMissionAssets {
  __typename?: "PageHomeMissionMissionAssets";
  block: Maybe<Asset>[];
  hyperlink: Maybe<Asset>[];
}

export interface PageHomeMissionMissionEntries {
  __typename?: "PageHomeMissionMissionEntries";
  block: Maybe<Entry>[];
  hyperlink: Maybe<Entry>[];
  inline: Maybe<Entry>[];
}

export interface PageHomeMissionMissionLinks {
  __typename?: "PageHomeMissionMissionLinks";
  assets: PageHomeMissionMissionAssets;
  entries: PageHomeMissionMissionEntries;
  resources: PageHomeMissionMissionResources;
}

export interface PageHomeMissionMissionResources {
  __typename?: "PageHomeMissionMissionResources";
  block: PageHomeMissionMissionResourcesBlock[];
  hyperlink: PageHomeMissionMissionResourcesHyperlink[];
  inline: PageHomeMissionMissionResourcesInline[];
}

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
export interface PageHomePartnersImagesCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomePartners) */
export interface PageHomePartnersInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomePartners) */
export interface PageHomePartnersLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomePartners) */
export interface PageHomePartnersPartnersCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<PageHomePartnersPartnersCollectionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<ComponentPartnerFilter>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomePartners) */
export interface PageHomePartnersSubtitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageHomePartners) */
export interface PageHomePartnersTitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

export interface PageHomePartnersCollection {
  __typename?: "PageHomePartnersCollection";
  items: Maybe<PageHomePartners>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

export interface PageHomePartnersFilter {
  AND?: InputMaybe<InputMaybe<PageHomePartnersFilter>[]>;
  OR?: InputMaybe<InputMaybe<PageHomePartnersFilter>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  imagesCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  partners?: InputMaybe<CfComponentPartnerNestedFilter>;
  partnersCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  subtitle_not?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

export interface PageHomePartnersLinkingCollections {
  __typename?: "PageHomePartnersLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
}

export interface PageHomePartnersLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

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

export interface PageHomePartnersPartnersCollection {
  __typename?: "PageHomePartnersPartnersCollection";
  items: Maybe<ComponentPartner>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

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
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageLanding) */
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

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageLanding) */
export interface PageLandingFeaturedBlogPostArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<PageBlogPostFilter>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageLanding) */
export interface PageLandingInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageLanding) */
export interface PageLandingLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pageLanding) */
export interface PageLandingSeoFieldsArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  where?: InputMaybe<ComponentSeoFilter>;
}

export interface PageLandingCollection {
  __typename?: "PageLandingCollection";
  items: Maybe<PageLanding>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

export interface PageLandingFilter {
  AND?: InputMaybe<InputMaybe<PageLandingFilter>[]>;
  OR?: InputMaybe<InputMaybe<PageLandingFilter>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  featuredBlogPost?: InputMaybe<CfPageBlogPostNestedFilter>;
  featuredBlogPost_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  seoFields?: InputMaybe<CfComponentSeoNestedFilter>;
  seoFields_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  sys?: InputMaybe<SysFilter>;
}

export interface PageLandingLinkingCollections {
  __typename?: "PageLandingLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
}

export interface PageLandingLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
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
export interface PagePoliciesContentArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pagePolicies) */
export interface PagePoliciesInternalNameArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pagePolicies) */
export interface PagePoliciesLinkedFromArgs {
  allowedLocales?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

/** [See type definition](https://app.contentful.com/spaces/9h8woqnnje85/content_types/pagePolicies) */
export interface PagePoliciesTitleArgs {
  locale?: InputMaybe<Scalars["String"]["input"]>;
}

export interface PagePoliciesCollection {
  __typename?: "PagePoliciesCollection";
  items: Maybe<PagePolicies>[];
  limit: Scalars["Int"]["output"];
  skip: Scalars["Int"]["output"];
  total: Scalars["Int"]["output"];
}

export interface PagePoliciesContent {
  __typename?: "PagePoliciesContent";
  json: Scalars["JSON"]["output"];
  links: PagePoliciesContentLinks;
}

export interface PagePoliciesContentAssets {
  __typename?: "PagePoliciesContentAssets";
  block: Maybe<Asset>[];
  hyperlink: Maybe<Asset>[];
}

export interface PagePoliciesContentEntries {
  __typename?: "PagePoliciesContentEntries";
  block: Maybe<Entry>[];
  hyperlink: Maybe<Entry>[];
  inline: Maybe<Entry>[];
}

export interface PagePoliciesContentLinks {
  __typename?: "PagePoliciesContentLinks";
  assets: PagePoliciesContentAssets;
  entries: PagePoliciesContentEntries;
  resources: PagePoliciesContentResources;
}

export interface PagePoliciesContentResources {
  __typename?: "PagePoliciesContentResources";
  block: PagePoliciesContentResourcesBlock[];
  hyperlink: PagePoliciesContentResourcesHyperlink[];
  inline: PagePoliciesContentResourcesInline[];
}

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

export interface PagePoliciesFilter {
  AND?: InputMaybe<InputMaybe<PagePoliciesFilter>[]>;
  OR?: InputMaybe<InputMaybe<PagePoliciesFilter>[]>;
  content_contains?: InputMaybe<Scalars["String"]["input"]>;
  content_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  content_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

export interface PagePoliciesLinkingCollections {
  __typename?: "PagePoliciesLinkingCollections";
  entryCollection?: Maybe<EntryCollection>;
}

export interface PagePoliciesLinkingCollectionsEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
}

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

export interface Query {
  __typename?: "Query";
  _node?: Maybe<_Node>;
  _nodes: Maybe<_Node>[];
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
}

export interface Query_NodeArgs {
  id: Scalars["ID"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface Query_NodesArgs {
  ids: Scalars["ID"]["input"][];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryAssetArgs {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryAssetCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<AssetOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<AssetFilter>;
}

export interface QueryComponentAuthorArgs {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryComponentAuthorCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<ComponentAuthorOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<ComponentAuthorFilter>;
}

export interface QueryComponentButtonArgs {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryComponentButtonCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<ComponentButtonOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<ComponentButtonFilter>;
}

export interface QueryComponentFaqQuestionArgs {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryComponentFaqQuestionCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<ComponentFaqQuestionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<ComponentFaqQuestionFilter>;
}

export interface QueryComponentFeatureArgs {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryComponentFeatureCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<ComponentFeatureOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<ComponentFeatureFilter>;
}

export interface QueryComponentPartnerArgs {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryComponentPartnerCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<ComponentPartnerOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<ComponentPartnerFilter>;
}

export interface QueryComponentRichImageArgs {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryComponentRichImageCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<ComponentRichImageOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<ComponentRichImageFilter>;
}

export interface QueryComponentSeoArgs {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryComponentSeoCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<ComponentSeoOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<ComponentSeoFilter>;
}

export interface QueryEntryCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<EntryOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<EntryFilter>;
}

export interface QueryFooterArgs {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryFooterCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<FooterOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<FooterFilter>;
}

export interface QueryPageAboutArgs {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryPageAboutCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<PageAboutOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<PageAboutFilter>;
}

export interface QueryPageBlogPostArgs {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryPageBlogPostCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<PageBlogPostOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<PageBlogPostFilter>;
}

export interface QueryPageFaqArgs {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryPageFaqCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<PageFaqOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<PageFaqFilter>;
}

export interface QueryPageHomeFeaturesArgs {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryPageHomeFeaturesCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<PageHomeFeaturesOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<PageHomeFeaturesFilter>;
}

export interface QueryPageHomeHeroArgs {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryPageHomeHeroCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<PageHomeHeroOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<PageHomeHeroFilter>;
}

export interface QueryPageHomeMissionArgs {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryPageHomeMissionCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<PageHomeMissionOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<PageHomeMissionFilter>;
}

export interface QueryPageHomePartnersArgs {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryPageHomePartnersCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<PageHomePartnersOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<PageHomePartnersFilter>;
}

export interface QueryPageLandingArgs {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryPageLandingCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<PageLandingOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<PageLandingFilter>;
}

export interface QueryPagePoliciesArgs {
  id: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}

export interface QueryPagePoliciesCollectionArgs {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  order?: InputMaybe<InputMaybe<PagePoliciesOrder>[]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  skip?: InputMaybe<Scalars["Int"]["input"]>;
  where?: InputMaybe<PagePoliciesFilter>;
}

export interface ResourceLink {
  sys: ResourceSys;
}

export interface ResourceSys {
  __typename?: "ResourceSys";
  linkType: Scalars["String"]["output"];
  urn: Scalars["String"]["output"];
}

export interface Sys {
  __typename?: "Sys";
  environmentId: Scalars["String"]["output"];
  firstPublishedAt?: Maybe<Scalars["DateTime"]["output"]>;
  id: Scalars["String"]["output"];
  /** The locale that was requested. */
  locale?: Maybe<Scalars["String"]["output"]>;
  publishedAt?: Maybe<Scalars["DateTime"]["output"]>;
  publishedVersion?: Maybe<Scalars["Int"]["output"]>;
  spaceId: Scalars["String"]["output"];
}

export interface SysFilter {
  firstPublishedAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  firstPublishedAt_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  firstPublishedAt_gt?: InputMaybe<Scalars["DateTime"]["input"]>;
  firstPublishedAt_gte?: InputMaybe<Scalars["DateTime"]["input"]>;
  firstPublishedAt_in?: InputMaybe<InputMaybe<Scalars["DateTime"]["input"]>[]>;
  firstPublishedAt_lt?: InputMaybe<Scalars["DateTime"]["input"]>;
  firstPublishedAt_lte?: InputMaybe<Scalars["DateTime"]["input"]>;
  firstPublishedAt_not?: InputMaybe<Scalars["DateTime"]["input"]>;
  firstPublishedAt_not_in?: InputMaybe<InputMaybe<Scalars["DateTime"]["input"]>[]>;
  id?: InputMaybe<Scalars["String"]["input"]>;
  id_contains?: InputMaybe<Scalars["String"]["input"]>;
  id_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  id_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  id_not?: InputMaybe<Scalars["String"]["input"]>;
  id_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  id_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  publishedAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedAt_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  publishedAt_gt?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedAt_gte?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedAt_in?: InputMaybe<InputMaybe<Scalars["DateTime"]["input"]>[]>;
  publishedAt_lt?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedAt_lte?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedAt_not?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedAt_not_in?: InputMaybe<InputMaybe<Scalars["DateTime"]["input"]>[]>;
  publishedVersion?: InputMaybe<Scalars["Float"]["input"]>;
  publishedVersion_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  publishedVersion_gt?: InputMaybe<Scalars["Float"]["input"]>;
  publishedVersion_gte?: InputMaybe<Scalars["Float"]["input"]>;
  publishedVersion_in?: InputMaybe<InputMaybe<Scalars["Float"]["input"]>[]>;
  publishedVersion_lt?: InputMaybe<Scalars["Float"]["input"]>;
  publishedVersion_lte?: InputMaybe<Scalars["Float"]["input"]>;
  publishedVersion_not?: InputMaybe<Scalars["Float"]["input"]>;
  publishedVersion_not_in?: InputMaybe<InputMaybe<Scalars["Float"]["input"]>[]>;
}

/**
 * Represents a taxonomy concept entity for finding and organizing content easily.
 *         Find out more here: https://www.contentful.com/developers/docs/references/content-delivery-api/#/reference/content-concepts
 */
export interface TaxonomyConcept {
  __typename?: "TaxonomyConcept";
  id?: Maybe<Scalars["String"]["output"]>;
}

export interface _Node {
  _id: Scalars["ID"]["output"];
}

export interface CfComponentAuthorNestedFilter {
  AND?: InputMaybe<InputMaybe<CfComponentAuthorNestedFilter>[]>;
  OR?: InputMaybe<InputMaybe<CfComponentAuthorNestedFilter>[]>;
  avatar_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  name_contains?: InputMaybe<Scalars["String"]["input"]>;
  name_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  name_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  name_not?: InputMaybe<Scalars["String"]["input"]>;
  name_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  name_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
}

export interface CfComponentButtonNestedFilter {
  AND?: InputMaybe<InputMaybe<CfComponentButtonNestedFilter>[]>;
  OR?: InputMaybe<InputMaybe<CfComponentButtonNestedFilter>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  label?: InputMaybe<Scalars["String"]["input"]>;
  label_contains?: InputMaybe<Scalars["String"]["input"]>;
  label_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  label_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  label_not?: InputMaybe<Scalars["String"]["input"]>;
  label_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  label_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
  url?: InputMaybe<Scalars["String"]["input"]>;
  url_contains?: InputMaybe<Scalars["String"]["input"]>;
  url_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  url_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  url_not?: InputMaybe<Scalars["String"]["input"]>;
  url_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  url_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

export interface CfComponentFaqQuestionNestedFilter {
  AND?: InputMaybe<InputMaybe<CfComponentFaqQuestionNestedFilter>[]>;
  OR?: InputMaybe<InputMaybe<CfComponentFaqQuestionNestedFilter>[]>;
  answer_contains?: InputMaybe<Scalars["String"]["input"]>;
  answer_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  answer_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  question?: InputMaybe<Scalars["String"]["input"]>;
  question_contains?: InputMaybe<Scalars["String"]["input"]>;
  question_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  question_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  question_not?: InputMaybe<Scalars["String"]["input"]>;
  question_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  question_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
}

export interface CfComponentFeatureNestedFilter {
  AND?: InputMaybe<InputMaybe<CfComponentFeatureNestedFilter>[]>;
  OR?: InputMaybe<InputMaybe<CfComponentFeatureNestedFilter>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  icon_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  subtitle?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  subtitle_not?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

export interface CfComponentPartnerNestedFilter {
  AND?: InputMaybe<InputMaybe<CfComponentPartnerNestedFilter>[]>;
  OR?: InputMaybe<InputMaybe<CfComponentPartnerNestedFilter>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  logo_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  subtitle_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  subtitle_not?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  subtitle_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
}

export interface CfComponentSeoNestedFilter {
  AND?: InputMaybe<InputMaybe<CfComponentSeoNestedFilter>[]>;
  OR?: InputMaybe<InputMaybe<CfComponentSeoNestedFilter>[]>;
  canonicalUrl?: InputMaybe<Scalars["String"]["input"]>;
  canonicalUrl_contains?: InputMaybe<Scalars["String"]["input"]>;
  canonicalUrl_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  canonicalUrl_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  canonicalUrl_not?: InputMaybe<Scalars["String"]["input"]>;
  canonicalUrl_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  canonicalUrl_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  nofollow?: InputMaybe<Scalars["Boolean"]["input"]>;
  nofollow_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  nofollow_not?: InputMaybe<Scalars["Boolean"]["input"]>;
  noindex?: InputMaybe<Scalars["Boolean"]["input"]>;
  noindex_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  noindex_not?: InputMaybe<Scalars["Boolean"]["input"]>;
  pageDescription?: InputMaybe<Scalars["String"]["input"]>;
  pageDescription_contains?: InputMaybe<Scalars["String"]["input"]>;
  pageDescription_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  pageDescription_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  pageDescription_not?: InputMaybe<Scalars["String"]["input"]>;
  pageDescription_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  pageDescription_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  pageTitle?: InputMaybe<Scalars["String"]["input"]>;
  pageTitle_contains?: InputMaybe<Scalars["String"]["input"]>;
  pageTitle_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  pageTitle_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  pageTitle_not?: InputMaybe<Scalars["String"]["input"]>;
  pageTitle_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  pageTitle_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  shareImagesCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  sys?: InputMaybe<SysFilter>;
}

export interface CfPageBlogPostNestedFilter {
  AND?: InputMaybe<InputMaybe<CfPageBlogPostNestedFilter>[]>;
  OR?: InputMaybe<InputMaybe<CfPageBlogPostNestedFilter>[]>;
  author_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  content_contains?: InputMaybe<Scalars["String"]["input"]>;
  content_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  content_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  contentfulMetadata?: InputMaybe<ContentfulMetadataFilter>;
  featuredImage_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName?: InputMaybe<Scalars["String"]["input"]>;
  internalName_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  internalName_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  internalName_not?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  internalName_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  publishedDate?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  publishedDate_gt?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_gte?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_in?: InputMaybe<InputMaybe<Scalars["DateTime"]["input"]>[]>;
  publishedDate_lt?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_lte?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_not?: InputMaybe<Scalars["DateTime"]["input"]>;
  publishedDate_not_in?: InputMaybe<InputMaybe<Scalars["DateTime"]["input"]>[]>;
  relatedBlogPostsCollection_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  seoFields_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  shortDescription?: InputMaybe<Scalars["String"]["input"]>;
  shortDescription_contains?: InputMaybe<Scalars["String"]["input"]>;
  shortDescription_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  shortDescription_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  shortDescription_not?: InputMaybe<Scalars["String"]["input"]>;
  shortDescription_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  shortDescription_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  slug?: InputMaybe<Scalars["String"]["input"]>;
  slug_contains?: InputMaybe<Scalars["String"]["input"]>;
  slug_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  slug_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  slug_not?: InputMaybe<Scalars["String"]["input"]>;
  slug_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  slug_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  sys?: InputMaybe<SysFilter>;
  title?: InputMaybe<Scalars["String"]["input"]>;
  title_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_exists?: InputMaybe<Scalars["Boolean"]["input"]>;
  title_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
  title_not?: InputMaybe<Scalars["String"]["input"]>;
  title_not_contains?: InputMaybe<Scalars["String"]["input"]>;
  title_not_in?: InputMaybe<InputMaybe<Scalars["String"]["input"]>[]>;
}

export interface AuthorFieldsFragment {
  __typename: "ComponentAuthor";
  name?: string | null;
  sys: { __typename?: "Sys"; id: string };
  avatar?: ({ __typename?: "Asset" } & ImageFieldsFragment) | null;
}

export interface FooterFieldsFragment {
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
    items: (({ __typename?: "ComponentButton" } & ButtonFieldsFragment) | null)[];
  } | null;
  supportButtonsCollection?: {
    __typename?: "FooterSupportButtonsCollection";
    items: (({ __typename?: "ComponentButton" } & ButtonFieldsFragment) | null)[];
  } | null;
}

export interface ButtonFieldsFragment {
  __typename: "ComponentButton";
  label?: string | null;
  url?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
}

export type FooterQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export interface FooterQuery {
  __typename?: "Query";
  footerCollection?: {
    __typename?: "FooterCollection";
    items: (({ __typename?: "Footer" } & FooterFieldsFragment) | null)[];
  } | null;
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

export interface PageAboutFieldsFragment {
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
}

export type PageAboutQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export interface PageAboutQuery {
  __typename?: "Query";
  pageAboutCollection?: {
    __typename?: "PageAboutCollection";
    items: (({ __typename?: "PageAbout" } & PageAboutFieldsFragment) | null)[];
  } | null;
}

export interface ReferencePageBlogPostFieldsFragment {
  __typename: "PageBlogPost";
  slug?: string | null;
  publishedDate?: any | null;
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
        block: (
          | { __typename?: "ComponentAuthor" }
          | { __typename?: "ComponentButton" }
          | { __typename?: "ComponentFaqQuestion" }
          | { __typename?: "ComponentFeature" }
          | { __typename?: "ComponentPartner" }
          | ({ __typename?: "ComponentRichImage" } & RichImageFieldsFragment)
          | { __typename?: "ComponentSeo" }
          | { __typename?: "Footer" }
          | { __typename?: "PageAbout" }
          | { __typename?: "PageBlogPost" }
          | { __typename?: "PageFaq" }
          | { __typename?: "PageHomeFeatures" }
          | { __typename?: "PageHomeHero" }
          | { __typename?: "PageHomeMission" }
          | { __typename?: "PageHomePartners" }
          | { __typename?: "PageLanding" }
          | { __typename?: "PagePolicies" }
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
  slug: Scalars["String"]["input"];
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export interface PageBlogPostQuery {
  __typename?: "Query";
  pageBlogPostCollection?: {
    __typename?: "PageBlogPostCollection";
    items: (({ __typename?: "PageBlogPost" } & PageBlogPostFieldsFragment) | null)[];
  } | null;
}

export type PageBlogPostCollectionQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
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

export interface FaqQuestionFieldsFragment {
  __typename: "ComponentFaqQuestion";
  question?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  answer?: { __typename?: "ComponentFaqQuestionAnswer"; json: any } | null;
}

export interface PageFaqFieldsFragment {
  __typename: "PageFaq";
  internalName?: string | null;
  title?: string | null;
  intro?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  questionsCollection?: {
    __typename?: "PageFaqQuestionsCollection";
    items: (({ __typename?: "ComponentFaqQuestion" } & FaqQuestionFieldsFragment) | null)[];
  } | null;
}

export type PageFaqQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export interface PageFaqQuery {
  __typename?: "Query";
  pageFaqCollection?: {
    __typename?: "PageFaqCollection";
    items: (({ __typename?: "PageFaq" } & PageFaqFieldsFragment) | null)[];
  } | null;
}

export interface PageHomeFeaturesFieldsFragment {
  __typename: "PageHomeFeatures";
  internalName?: string | null;
  title?: string | null;
  subtitle?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  featuresCollection?: {
    __typename?: "PageHomeFeaturesFeaturesCollection";
    items: (({ __typename?: "ComponentFeature" } & FeatureFieldsFragment) | null)[];
  } | null;
}

export interface FeatureFieldsFragment {
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
}

export type PageHomeFeaturesQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export interface PageHomeFeaturesQuery {
  __typename?: "Query";
  pageHomeFeaturesCollection?: {
    __typename?: "PageHomeFeaturesCollection";
    items: (({ __typename?: "PageHomeFeatures" } & PageHomeFeaturesFieldsFragment) | null)[];
  } | null;
}

export interface PageHomeHeroFieldsFragment {
  __typename: "PageHomeHero";
  internalName?: string | null;
  badge?: string | null;
  title?: string | null;
  subtitle?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  buttonsCollection?: {
    __typename?: "PageHomeHeroButtonsCollection";
    items: (({ __typename?: "ComponentButton" } & ButtonFieldsFragment) | null)[];
  } | null;
}

export type PageHomeHeroQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export interface PageHomeHeroQuery {
  __typename?: "Query";
  pageHomeHeroCollection?: {
    __typename?: "PageHomeHeroCollection";
    items: (({ __typename?: "PageHomeHero" } & PageHomeHeroFieldsFragment) | null)[];
  } | null;
}

export interface PageHomeMissionFieldsFragment {
  __typename: "PageHomeMission";
  internalName?: string | null;
  title?: string | null;
  subtitle?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  about?: { __typename?: "PageHomeMissionAbout"; json: any } | null;
  mission?: { __typename?: "PageHomeMissionMission"; json: any } | null;
  image?: {
    __typename?: "Asset";
    url?: string | null;
    title?: string | null;
    sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  } | null;
}

export type PageHomeMissionQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export interface PageHomeMissionQuery {
  __typename?: "Query";
  pageHomeMissionCollection?: {
    __typename?: "PageHomeMissionCollection";
    items: (({ __typename?: "PageHomeMission" } & PageHomeMissionFieldsFragment) | null)[];
  } | null;
}

export interface PageHomePartnersFieldsFragment {
  __typename: "PageHomePartners";
  title?: string | null;
  subtitle?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  partnersCollection?: {
    __typename?: "PageHomePartnersPartnersCollection";
    items: (({ __typename?: "ComponentPartner" } & PartnerFieldsFragment) | null)[];
  } | null;
  imagesCollection?: {
    __typename?: "AssetCollection";
    items: (({ __typename?: "Asset" } & ImageFieldsFragment) | null)[];
  } | null;
}

export interface PartnerFieldsFragment {
  __typename: "ComponentPartner";
  subtitle?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  logo?: {
    __typename?: "Asset";
    url?: string | null;
    title?: string | null;
    sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  } | null;
}

export type PageHomePartnersQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export interface PageHomePartnersQuery {
  __typename?: "Query";
  pageHomePartnersCollection?: {
    __typename?: "PageHomePartnersCollection";
    items: (({ __typename?: "PageHomePartners" } & PageHomePartnersFieldsFragment) | null)[];
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
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export interface PageLandingQuery {
  __typename?: "Query";
  pageLandingCollection?: {
    __typename?: "PageLandingCollection";
    items: (({ __typename?: "PageLanding" } & PageLandingFieldsFragment) | null)[];
  } | null;
}

export type PageLandingCollectionQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export interface PageLandingCollectionQuery {
  __typename?: "Query";
  pageLandingCollection?: {
    __typename?: "PageLandingCollection";
    items: (({ __typename?: "PageLanding" } & PageLandingFieldsFragment) | null)[];
  } | null;
}

export interface PagePoliciesFieldsFragment {
  __typename: "PagePolicies";
  internalName?: string | null;
  title?: string | null;
  sys: { __typename?: "Sys"; id: string; publishedAt?: any | null; environmentId: string };
  content?: { __typename?: "PagePoliciesContent"; json: any } | null;
}

export type PagePoliciesQueryVariables = Exact<{
  locale?: InputMaybe<Scalars["String"]["input"]>;
  preview?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export interface PagePoliciesQuery {
  __typename?: "Query";
  pagePoliciesCollection?: {
    __typename?: "PagePoliciesCollection";
    items: (({ __typename?: "PagePolicies" } & PagePoliciesFieldsFragment) | null)[];
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
      sys: { __typename?: "Sys"; publishedAt?: any | null };
    } | null)[];
  } | null;
  pageLandingCollection?: {
    __typename?: "PageLandingCollection";
    items: ({
      __typename?: "PageLanding";
      sys: { __typename?: "Sys"; publishedAt?: any | null };
    } | null)[];
  } | null;
}

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
    }
    subtitle
    mission {
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
