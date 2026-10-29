// The shapes src/docs/build/plugin.ts exports from the repository's Markdown and the docs components read.

/** The public repository the pages link to for anything unpublished, and for "Edit this page". */
export type DocsRepository = { url: string; branch: string };

/** One h2 or h3 of a page, for its contents list. */
export type DocsTocEntry = { depth: 2 | 3; id: string; text: string };

/** One published page in the section navigation, in manifest order. */
export type DocsNavPage = { slug: string; label: string; href: string; source: string };

export type DocsSection = { title: string; pages: DocsNavPage[] };

/** A page rendered from Markdown at build time: its title, contents and body HTML. */
export type DocsPageData = {
  slug: string;
  source: string;
  title: string;
  titleId: string;
  description: string;
  html: string;
  toc: DocsTocEntry[];
};

/** What a docs route loads: the page, the navigation and repository it is shown with, the docs version it came from, and whether the reader has an open session (an installation's docs only). */
export type DocsView = { page: DocsPageData; sections: DocsSection[]; repository: DocsRepository; version: number; signedIn?: boolean };
