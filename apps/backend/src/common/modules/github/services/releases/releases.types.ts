/** The subset of GitHub's release payload this facade reads. */
export interface GithubReleasePayload {
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  html_url: string;
  assets: { name: string; size: number; browser_download_url: string }[];
}
