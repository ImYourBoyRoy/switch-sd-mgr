import type { SourceRecord } from "./app-types";

export const emptySource = (): SourceRecord => ({
  id: "",
  name: "",
  source: { type: "github_release", repo: "" },
  alt_source: { type: "github_release", repo: "" },
  install_dir: "",
  blacklist: [],
  payload_info: { folder: "", pattern: "" },
  prerelease: false,
});

export function repoUrlForSource(source: Pick<SourceRecord, "source" | "repo_url">) {
  if (source.repo_url) {
    return source.repo_url;
  }
  const repo = source.source?.repo;
  if (!repo) {
    return "";
  }
  const kind = source.source?.type || source.source?.kind;
  const host = kind === "codeberg_release" ? "https://codeberg.org" : "https://github.com";
  return `${host}/${repo}`;
}
