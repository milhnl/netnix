import { useEffect, useContext, Dispatch, StateUpdater } from "preact/hooks";
import { Switch, Route } from "wouter-preact";
import { isEpisode, EpisodeMeta, isFilm, Item, HistoryItem } from "./types.ts";
import { playNow } from "./playState.ts";
import { asURL, encodeURIAll, getCoverArt } from "./utility.ts";
import { AuthContext } from "./auth.tsx";
import { LibraryContext, StateContext } from "./context.ts";

import {
  directoryContainerClass,
  Directory,
  fileContainerClass,
  ItemContainer,
} from "./ui.tsx";

export const EpisodeItem = ({
  item,
  history,
}: {
  item: Item<EpisodeMeta>;
  bg?: string;
  history: HistoryItem[];
}) => {
  const [, setState] = useContext(StateContext);
  return (
    <ItemContainer>
      <span class="square">{item.meta.season}</span>
      <span class="square">{item.meta.episode}</span>
      <a
        class="grow"
        style={
          history.some(
            (x) =>
              (x instanceof Object
                ? (x as Exclude<typeof x, string>).path
                : x) == item.path,
          )
            ? { opacity: 0.5 }
            : undefined
        }
        onClick={() => setState(playNow(item))}
      >
        {"title" in item.meta ? item.meta.title : "No title"}
      </a>
    </ItemContainer>
  );
};

export const SeriesEpisodeList = ({
  name,
  setUiName,
}: {
  name: string;
  setUiName: Dispatch<StateUpdater<string>>;
}) => {
  useEffect(() => setUiName(name), []);
  const library = useContext(LibraryContext);
  const [{ history }] = useContext(StateContext);
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
          <EpisodeItem item={x} history={history} />
        ))}
    </main>
  );
};

export const SeriesOverview = ({
  setUiName,
}: {
  setUiName: Dispatch<StateUpdater<string>>;
}) => {
  useEffect(() => setUiName("Series"), []);
  const auth = useContext(AuthContext);
  const library = useContext(LibraryContext);
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
            bg={asURL(getCoverArt(library, { meta: { show } })?.path, auth)}
          />
        ))}
    </main>
  );
};

export const FilmsOverview = ({
  setUiName,
}: {
  setUiName: Dispatch<StateUpdater<string>>;
}) => {
  useEffect(() => setUiName("Films"), []);
  const library = useContext(LibraryContext);
  const [, setState] = useContext(StateContext);
  return (
    <main className={fileContainerClass}>
      {library
        .filter(isFilm)
        .filter((x) => x.type.length == 1 && x.type[0] === "video")
        .sort((a, b) => a.meta.title.localeCompare(b.meta.title))
        .map((x) => (
          <ItemContainer>
            <a class="grow" onClick={() => setState(playNow(x))}>
              {"title" in x.meta ? x.meta.title : "No title"}
            </a>
          </ItemContainer>
        ))}
    </main>
  );
};

export const VideoRoutes = ({
  setUiName,
}: {
  setUiName: Dispatch<StateUpdater<string>>;
}) => (
  <Switch>
    <Route path="/Series">
      {() => <SeriesOverview setUiName={setUiName} />}
    </Route>
    <Route path="/Series/:name">
      {({ name }: { name: string }) => (
        <SeriesEpisodeList
          setUiName={setUiName}
          name={decodeURIComponent(name)}
        />
      )}
    </Route>
    <Route path="/Films">
      {() => <FilmsOverview setUiName={setUiName} />}
    </Route>
  </Switch>
);
