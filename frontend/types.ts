export interface EpisodeMeta {
  show: string;
  season: string;
  episode: string;
  title: string;
  language?: string;
}

export const isEpisode = (
  x: Pick<Item, "meta">,
): x is Item & { meta: EpisodeMeta } => "show" in x.meta;

export interface FilmMeta {
  title: string;
  language?: string;
}

export const isFilm = (
  x: Pick<Item, "meta">,
): x is Item & { meta: FilmMeta } =>
  "title" in x.meta && !("show" in x.meta) && !("artist" in x.meta);

export interface MusicMeta {
  artist: string;
  albumartist?: string;
  album?: string;
  title: string;
  tracknumber: number;
}

export const isMusic = (
  x: Pick<Item, "meta">,
): x is Item & { meta: MusicMeta } => "artist" in x.meta;

export interface Item {
  meta: Record<never, never> | FilmMeta | EpisodeMeta | MusicMeta;
  path: string;
  type: ("video" | "music" | "subtitle" | "artwork")[];
}

export interface Player {
  play: (item: Item) => void;
}

export type HistoryItem = Pick<Item, "path"> & { date: Date };

export interface State {
  history: HistoryItem[];
  queue: Item[];
}
