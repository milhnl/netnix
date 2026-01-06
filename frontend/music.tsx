import { useEffect, useContext, Dispatch, StateUpdater } from "preact/hooks";
import { Switch, Route } from "wouter-preact";
import { AuthContext } from "./auth.tsx";
import { LibraryContext, PlayerContext } from "./context.ts";
import { isMusic } from "./types.ts";
import { asURL, encodeURIAll, getCoverArt } from "./utility.ts";
import {
  directoryContainerClass,
  Directory,
  ItemContainer,
  fileContainerClass,
} from "./ui.tsx";

export const ArtistsOverview = ({
  setUiName,
}: {
  setUiName: Dispatch<StateUpdater<string>>;
}) => {
  useEffect(() => setUiName("Music"), []);
  const library = useContext(LibraryContext);
  const auth = useContext(AuthContext);
  return (
    <main className={directoryContainerClass}>
      {library
        .filter(isMusic)
        .filter((x) => x.type.includes("music"))
        .reduce((a, n) => {
          const artist = n.meta.albumartist ?? n.meta.artist;
          return a.includes(artist) ? a : [...a, artist];
        }, [] as string[])
        .sort((a, b) => a.localeCompare(b))
        .map((artist) => (
          <Directory
            name={artist}
            path={`/${encodeURIAll(artist)}`}
            bg={asURL(
              getCoverArt(library, {
                meta: { artist },
              })?.path,
              auth,
            )}
          />
        ))}
    </main>
  );
};

export const AlbumsOverview = ({
  setUiName,
  artist,
}: {
  setUiName: Dispatch<StateUpdater<string>>;
  artist: string;
}) => {
  useEffect(() => setUiName(artist), []);
  const library = useContext(LibraryContext);
  const auth = useContext(AuthContext);

  return (
    <main className={directoryContainerClass}>
      {library
        .filter(isMusic)
        .filter(
          (x) =>
            x.type.includes("music") &&
            (x.meta.albumartist ?? x.meta.artist) == artist,
        )
        .reduce(
          (a, n) => {
            const album = n.meta.album;
            return a.includes(album) ? a : [...a, album];
          },
          [] as (string | undefined)[],
        )
        .sort((a, b) => a?.localeCompare(b!) ?? Number.MAX_VALUE)
        .map((album) => (
          <Directory
            name={album ?? "Other"}
            path={`/${encodeURIAll(artist)}/${encodeURIAll(album ?? "Other")}`}
            bg={asURL(
              getCoverArt(library, {
                meta: { artist, album },
              })?.path,
              auth,
            )}
          />
        ))}
    </main>
  );
};

export const AlbumOverview = ({
  setUiName,
  artist,
  album,
}: {
  setUiName: Dispatch<StateUpdater<string>>;
  artist: string;
  album: string | undefined;
}) => {
  useEffect(() => setUiName(`${artist} – ${album}`), []);
  const library = useContext(LibraryContext);
  const player = useContext(PlayerContext);

  const tracks = library
    .filter(isMusic)
    .filter(
      (x) =>
        x.type.includes("music") &&
        (x.meta.albumartist ?? x.meta.artist) == artist &&
        x.meta.album == album,
    )
    .sort((a, b) => a.meta.tracknumber - b.meta.tracknumber);

  return (
    <main className={fileContainerClass}>
      {tracks.map((item) => (
        <ItemContainer>
          <span className="square">{item.meta.tracknumber}</span>
          <a class="grow" onClick={() => player.play(item)}>
            {"title" in item.meta ? item.meta.title : "No title"}
          </a>
        </ItemContainer>
      ))}
    </main>
  );
};

export const MusicRoutes = ({
  setUiName,
}: {
  setUiName: Dispatch<StateUpdater<string>>;
}) => (
  <Switch>
    <Route path="/:artist/:album">
      {({ artist, album }: { artist: string; album: string }) => (
        <AlbumOverview
          setUiName={setUiName}
          artist={decodeURIComponent(artist)}
          album={decodeURIComponent(album)}
        />
      )}
    </Route>
    <Route path="/:artist">
      {({ artist }: { artist: string }) => (
        <AlbumsOverview
          setUiName={setUiName}
          artist={decodeURIComponent(artist)}
        />
      )}
    </Route>
    <Route path="">{() => <ArtistsOverview setUiName={setUiName} />}</Route>
  </Switch>
);
