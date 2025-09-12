import { h } from "preact";
import { useEffect, StateUpdater } from "preact/hooks";

import {
  isEpisode,
  EpisodeMeta,
  isFilm,
  Item,
  Player,
  HistoryItem,
} from "./types.ts";
import { asURL, encodeURIAll, getCoverArt } from "./utility.ts";
import { Auth } from "./auth.tsx";

import {
  directoryContainerClass,
  Directory,
  fileContainerClass,
  ItemContainer,
} from "./ui.tsx";

export const ListItem = ({ item, player }: { item: Item; player: Player }) => (
  <ItemContainer>
    <a class="grow" onClick={() => player.play(item)}>
      {"title" in item.meta ? item.meta.title : "No title"}
    </a>
  </ItemContainer>
);

export const EpisodeItem = ({
  item,
  player,
  history,
}: {
  item: Item & { meta: EpisodeMeta };
  bg?: string;
  player: Player;
  history: HistoryItem[];
}) => (
  <ItemContainer>
    <span class="square">{item.meta.season}</span>
    <span class="square">{item.meta.episode}</span>
    <a
      class="grow"
      style={
        history.some(
          (x) =>
            (x instanceof Object ? (x as Exclude<typeof x, string>).path : x) ==
            item.path,
        )
          ? { opacity: 0.5 }
          : undefined
      }
      onClick={() => player.play(item)}
    >
      {"title" in item.meta ? item.meta.title : "No title"}
    </a>
  </ItemContainer>
);

export const SeriesEpisodeList = ({
  library,
  player,
  history,
  name,
  setUiName,
}: {
  library: Item[];
  player: Player;
  history: HistoryItem[];
  name: string;
  setUiName: StateUpdater<string>;
}) => {
  useEffect(() => setUiName(name), []);
  return (
    <main className={fileContainerClass}>
      {library
        .filter(isEpisode)
        .filter((x) => x.type.includes("video") && x.meta.show == name)
        .sort(
          (a, b) =>
            a.meta.season.localeCompare(b.meta.season) ||
            a.meta.episode.localeCompare(b.meta.episode),
        )
        .map((x) => (
          <EpisodeItem item={x} player={player} history={history} />
        ))}
    </main>
  );
};

export const SeriesOverview = ({
  library,
  setUiName,
  auth,
}: {
  library: Item[];
  setUiName: StateUpdater<string>;
  auth: Auth;
}) => {
  useEffect(() => setUiName("Series"), []);
  return (
    <main className={directoryContainerClass}>
      {library
        .filter(isEpisode)
        .filter((x) => x.type.includes("video"))
        .reduce(
          (a, n) => (a.includes(n.meta.show) ? a : [...a, n.meta.show]),
          [] as string[],
        )
        .sort((a, b) => a.localeCompare(b))
        .map((show) => (
          <Directory
            name={show}
            path={"/Series/" + encodeURIAll(show)}
            bg={asURL(
              getCoverArt(library, {
                path: "",
                type: [],
                meta: { show },
              })?.path,
              auth,
            )}
          />
        ))}
    </main>
  );
};

export const FilmsOverview = ({
  library,
  player,
  setUiName,
}: {
  library: Item[];
  player: Player;
  setUiName: StateUpdater<string>;
}) => {
  useEffect(() => setUiName("Films"), []);
  return (
    <main className={fileContainerClass}>
      {library
        .filter(isFilm)
        .filter((x) => x.type.length == 1 && x.type[0] === "video")
        .sort((a, b) => a.meta.title.localeCompare(b.meta.title))
        .map((x) => (
          <ListItem item={x} player={player} />
        ))}
    </main>
  );
};
