import {
  Fragment,
  FunctionComponent as FC,
  h,
  render,
  StateUpdater,
  useEffect,
  useMemo,
  useState,
} from "./deps/preact.ts";
import { Link, Route, Router, Switch } from "./deps/wouter-preact.ts";
import { setup, styled } from "./deps/goober.ts";
import { Auth, getAuthHeader, Login } from "./auth.tsx";
import { Chrome } from "./chrome.tsx";

interface EpisodeMeta {
  show: string;
  season: string;
  episode: string;
  title: string;
  language?: string;
}
interface MusicMeta {
  artist: string;
  title: string;
}
interface FilmMeta {
  title: string;
  language?: string;
}

type Item = {
  meta: Record<never, never> | FilmMeta | EpisodeMeta | MusicMeta;
  path: string;
  type: ("music" | "video" | "subtitle")[];
};
type Library = {
  version: number;
  items: Item[];
};

interface Player {
  play: (item: Item) => void;
}

const isEpisode = (x: Item): x is Item & { meta: EpisodeMeta } =>
  "show" in x.meta;
const isFilm = (x: Item): x is Item & { meta: FilmMeta } =>
  "title" in x.meta && !("show" in x.meta);

const currentLocation = () => self.location.hash.replace(/^#/, "") || "/";
const navigate = (to: string) => (self.location.hash = to);

const useHashLocation = (): [string, (path: string) => void] => {
  const [loc, setLoc] = useState(currentLocation());
  useEffect(() => {
    const handler = () => setLoc(currentLocation());
    self.addEventListener("hashchange", handler);
    return () => self.removeEventListener("hashchange", handler);
  }, []);
  return [loc, navigate];
};

const isAndroid = /(android)/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.platform) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isMobile = isIOS || isAndroid;

const encodeURIAll = (x: string) =>
  encodeURIComponent(x).replace(/[!'()*]/g, escape);
const asURL = <T extends string | undefined>(path: T, auth: Auth): T => {
  if (path === undefined) return path;
  const url = new URL(
    encodeURIAll(path).replaceAll(/%2F/g, "/"),
    location.href.replace(location.hash, "").replace(/\/[^\/]*$/, "/"),
  );
  if (auth.type == "http") {
    url.username = auth.username;
    url.password = auth.password;
  }
  return url.toString() as T;
};

const playerAppURL = isIOS
  ? "https://apps.apple.com/us/app/vlc-for-mobile/id650377962"
  : isAndroid
  ? "https://play.google.com/store/apps/details?id=org.videolan.vlc"
  : undefined;

const asPlayableURL = (
  path: string,
  subtitle: string | undefined,
  auth: Auth,
) =>
  isAndroid
    ? "vlc://" + asURL(path, auth)
    : isIOS
    ? `vlc-x-callback://x-callback-url/stream?url=${
      encodeURIAll(
        asURL(path, auth),
      )
    }${subtitle ? `&sub=${encodeURIAll(asURL(subtitle, auth))}` : ""}`
    : asURL(path, auth);

const getSubtitle = (library: Item[], item: Item) =>
  (
    (isEpisode(item)
      ? library.filter(
        (x) =>
          isEpisode(x) &&
          x.type.includes("subtitle") &&
          x.meta.show === item.meta.show &&
          x.meta.season === item.meta.season &&
          x.meta.episode === item.meta.episode,
      )
      : isFilm(item)
      ? library.filter(
        (x) =>
          isFilm(x) &&
          x.type.includes("subtitle") &&
          x.meta.title === item.meta.title,
      )
      : []) as (Item & { meta: { language: string } })[]
  ).sort(
    (a, b) =>
      ([a.meta.language, null, b.meta.language].findIndex((x) => x === "en") +
          1 || 2) - 2,
  )[0];

const FileContainer = styled("div")`
  display: flex;
  flex-direction: column;
  & > * {
    padding: 0.5em 1em;
    font-size: 1.8rem;
    line-height: 1.3;
    color: inherit;
    text-decoration: none;
  }
  & > *:nth-child(even) {
    background-color: rgba(128, 128, 128, 0.1);
  }
`;

const ListItem = ({ item, player }: { item: Item; player: Player }) => (
  <a onClick={() => player.play(item)}>
    {isFilm(item)
      ? item.meta.title
      : isEpisode(item)
      ? item.meta.season + "." + item.meta.episode + " " + item.meta.title
      : "No title"}
  </a>
);

const DirectoryContainer = styled("div")`
  @media (min-width: 1000px) {
    --item-size: 20vw;
  }
  @media (max-width: 1000px) {
    --item-size: 25vw;
  }
  @media (max-width: 800px) {
    --item-size: 33.33vw;
  }
  @media (max-width: 600px) {
    --item-size: 50vw;
  }
  @media (max-width: 200px) {
    --item-size: 100vw;
  }
  display: flex;
  flex-wrap: wrap;
  & > * {
    cursor: pointer;
    width: var(--item-size);
    height: var(--item-size);
    background-color: rgba(128, 128, 128, 0.1);
    background-size: cover;
    background-position: center;
    display: grid;
    align-items: end;
    justify-items: stretch;
  }
  & > * > span {
    padding: 0.2em 0.5em;
    background-color: rgba(0, 0, 0, 0.75);
    text-align: center;
  }
  @media (prefers-color-scheme: light) {
    & > * > span {
      color: white;
    }
  }
  a.nodefault {
    font-size: 1.8rem;
    line-height: 1.3;
    color: inherit;
    text-decoration: none;
  }
`;

const Directory = ({
  name,
  path,
  auth,
}: {
  name: string;
  path: string;
  auth: Auth;
}) => (
  <Link to={path}>
    <a
      className="nodefault"
      style={{
        backgroundImage: `url(${asURL(path + "/folder.jpg", auth)})`,
      }}
    >
      <span>{name}</span>
    </a>
  </Link>
);

const Message = styled("p")`
  margin: var(--header-height);
  padding: 4vmin;
  border-radius: 3vmin;
  background-color: rgba(128, 128, 128, 0.1);
  font-size: 1.6rem;
`;

const MainContainer = styled("div")`
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - var(--header-height));
  & > a {
    flex-grow: 1;
    font-size: 10vh;
    color: inherit;
    text-decoration: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  & > a:nth-child(odd) {
    background-color: rgba(128, 128, 128, 0.1);
  }
`;

const MainLink: FC<{ to: string; bgText: string; i: number }> = ({
  to,
  bgText,
  i,
  children,
}) => {
  const viewBox = new Array(2)
    .fill(bgText.length)
    .map((x) => (x * 5 + 25).toString())
    .join(" ");
  const textDims = new Array(2)
    .fill(bgText.length)
    .map((x) => `${4 + x / 5}rem`)
    .join(" ");
  const direction = i % 2 ? "-" : "";
  const bg = `
    <svg
      style="transform: rotate(${direction}45deg); font-family: sans-serif"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 ${viewBox}"
    >
      <text x="0" y="25" fill="gray" opacity="0.2">${bgText}</text>
    </svg>
  `;
  return (
    <a
      href={"#" + to}
      style={{
        background: `url('data:image/svg+xml;base64,${btoa(bg)}')` +
          `0 0/${textDims}, rgba(128, 128, 128, 0.1)`,
      }}
    >
      {children}
    </a>
  );
};

const App = () => {
  const [auth, setAuth] = useState<Auth>({ type: "unknown" });
  const [library, setLibrary] = useState([] as Item[]);
  useEffect(() => {
    if (auth.type === "http" || auth.type === "none") {
      fetch(asURL(".ump-library.json", { type: "none" }), {
        headers: getAuthHeader(auth),
      })
        .then((x) => {
          if (x.ok) return x.json();
          else {
            setAuth({ type: "unknown" });
            return { items: [] };
          }
        })
        .then((x) => setLibrary(x.items));
    }
  }, [auth]);
  useEffect(() => {
    if (location.hash) {
      const current = location.hash;
      history.replaceState(null, "", "#/");
      history.pushState(null, "", current);
    }
  }, []);
  if (auth.type !== "http" && auth.type !== "none") {
    return (
      <>
        <Login
          checkURL={asURL(".ump-library.json", { type: "none" })}
          auth={auth}
          setAuth={setAuth}
        />
        {isMobile && (
          <Message>
            You will need VLC player installed on your phone to actually play
            the video files on this server. You can download it at the{" "}
            <a href={playerAppURL}>{isIOS ? "App Store" : "Play Store"}</a>
          </Message>
        )}
      </>
    );
  }
  const player = useMemo<Player>(
    () => ({
      play: (item) => (window.location.href = asPlayableURL(
        item.path,
        getSubtitle(library, item)?.path,
        auth,
      )),
    }),
    [library, auth],
  );
  return (
    <Switch>
      <Route path="/Series">
        {() => (
          <DirectoryContainer as={Chrome} name="Series">
            {library
              .filter(isEpisode)
              .filter((x) => x.type.includes("video"))
              .reduce(
                (a, n) => (a.includes(n.meta.show) ? a : [...a, n.meta.show]),
                [] as string[],
              )
              .sort((a, b) => a.localeCompare(b))
              .map((x) => (
                <Directory
                  name={x}
                  path={"/Series/" + encodeURIAll(x)}
                  auth={auth}
                />
              ))}
          </DirectoryContainer>
        )}
      </Route>
      <Route path="/Series/:name+">
        {({ name }: { name: string }) => (
          <FileContainer as={Chrome} name={decodeURIComponent(name)}>
            {library
              .filter(isEpisode)
              .filter(
                (x) =>
                  x.type.includes("video") &&
                  x.meta.show == decodeURIComponent(name),
              )
              .sort(
                (a, b) =>
                  a.meta.season.localeCompare(b.meta.season) ||
                  a.meta.episode.localeCompare(b.meta.episode),
              )
              .map((x) => <ListItem item={x} player={player} />)}
          </FileContainer>
        )}
      </Route>
      <Route path="/Films">
        {() => (
          <FileContainer as={Chrome} name="Films">
            {library
              .filter(isFilm)
              .filter((x) => x.type.length == 1 && x.type[0] === "video")
              .sort((a, b) => a.meta.title.localeCompare(b.meta.title))
              .map((x) => <ListItem item={x} player={player} />)}
          </FileContainer>
        )}
      </Route>
      <Route>
        {() => (
          <MainContainer as={Chrome} name="Netnix">
            <MainLink to="/Films" bgText="FILMS" i={0}>
              <span>Films</span>
            </MainLink>
            <MainLink to="/Series" bgText="TV" i={1}>
              <span>Series</span>
            </MainLink>
          </MainContainer>
        )}
      </Route>
    </Switch>
  );
};

setup(h);
render(
  <Router hook={useHashLocation}>
    <App />
  </Router>,
  document.body,
);
