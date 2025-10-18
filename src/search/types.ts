/** Unified search result shape across providers. */
export interface SearchResultItem {
  url: string;
  title?: string;
  snippet?: string;
  rawContent?: string;
  score?: number;
}

export interface SearchResults {
  provider: string;
  query: string;
  items: SearchResultItem[];
}
