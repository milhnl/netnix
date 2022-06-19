export interface EpisodeMeta {
  show: string;
  season: string;
  episode: string;
  title: string;
  language?: string;
}

export const isEpisode = (x: Item): x is Item & { meta: EpisodeMeta } =>
  "show" in x.meta;

export interface FilmMeta {
  title: string;
  language?: string;
}

export const isFilm = (x: Item): x is Item & { meta: FilmMeta } =>
  "title" in x.meta && !("show" in x.meta) && !("artist" in x.meta);

export interface Item {
  meta: Record<never, never> | FilmMeta | EpisodeMeta;
  path: string;
  type: ("video" | "subtitle" | "artwork")[];
}

export interface Player {
  play: (item: Item) => void;
}
