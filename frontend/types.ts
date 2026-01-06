import { StateUpdater } from "preact/hooks";

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
  discnumber?: number;
  tracknumber: number;
  date?: string;
}

export const isMusic = (
  x: Pick<Item, "meta">,
): x is Item & { meta: MusicMeta } => "artist" in x.meta;

export interface Item {
  meta: Record<never, never> | FilmMeta | EpisodeMeta | MusicMeta;
  path: string;
  mime: string;
  type: ("video" | "music" | "subtitle" | "artwork")[];
}

export type HistoryItem = Pick<Item, "path"> & {
  date: Date;
  action: "play" | "pause" | "end" | "skip";
};

export interface State {
  history: HistoryItem[];
}

export type StateUpdate = StateUpdater<HistoryItem[]> | HistoryItem;
