import {
  Fragment,
  FunctionComponent as FC,
  h,
  render,
  useEffect,
  useState,
} from "./deps/preact.ts";
import { Link, Route, Router, Switch } from "./deps/wouter-preact.ts";

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

interface Settings {
  sublang: string;
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

export const useLocalStorage = <T,>(key: string, initialValue: T) => {
  const [value, setValue] = useState(() => {
    const value = localStorage.getItem(key);
    return value !== null ? JSON.parse(value) : initialValue;
  });
  self.addEventListener(
    "storage",
    (e) =>
      e.key === key &&
      setValue(e.newValue != null ? JSON.parse(e.newValue) : initialValue),
  );
  useEffect(
    () => localStorage.setItem(key, JSON.stringify(value)),
    [key, value],
  );
  return [value, setValue];
};

const isAndroid = /(android)/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.platform) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isMobile = isIOS || isAndroid;

const encodeURIAll = (x: string) =>
  encodeURIComponent(x).replace(/[!'()*]/g, escape);
const asURL = (path: string) =>
  location.href.replace(location.hash, "").replace(/\/[^\/]*$/, "/") + path;

const playerAppURL = isIOS
  ? "https://apps.apple.com/us/app/vlc-for-mobile/id650377962"
  : isAndroid
  ? "https://play.google.com/store/apps/details?id=org.videolan.vlc"
  : undefined;

const asPlayableURL = (path: string, subtitle: string | undefined) =>
  isAndroid
    ? "vlc://" + asURL(path)
    : isIOS
    ? `vlc-x-callback://x-callback-url/stream?url=${
      encodeURIAll(
        asURL(path),
      )
    }${subtitle ? `&sub=${encodeURIAll(asURL(subtitle))}` : ""}`
    : asURL(path);

const getSubtitle = (library: Item[], item: Item, settings: Settings) =>
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
  )
    .sort(
      (a, b) =>
        (([a.meta.language, null, b.meta.language].findIndex(
          (x) => x === settings.sublang,
        ) + 1) ||
          ([a.meta.language, null, b.meta.language].findIndex(
            (x) => x === "en",
          ) + 1) ||
          2) - 2,
    )
    .map((x) => encodeURI(x.path))[0];

const File = ({
  name,
  path,
  subtitle,
}: {
  name: string;
  path: string;
  subtitle: string | undefined;
}) => (
  <a
    className="nodefault"
    href={path.match(/\.(mkv|webm|mp4|m4v)$/)
      ? asPlayableURL(path, subtitle)
      : path}
  >
    {isMobile ? name.replace(/\.[a-z0-9]+$/, "") : name}
  </a>
);
const Directory = ({ name, path }: { name: string; path: string }) => (
  <Link to={path}>
    <a
      className="nodefault"
      style={{ backgroundImage: `url(${path}/folder.jpg)` }}
    >
      <span>{name}</span>
    </a>
  </Link>
);
const Chrome: FC<{ name: string }> = ({ name, children }) => (
  <>
    <header>
      {location.hash && (
        <a
          className="nodefault"
          style={{ left: 0 }}
          onClick={() => history.back()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 10">
            <polyline
              points="4,2 1,5 4,8"
              stroke="blue"
              stroke-linecap="round"
              fill="none"
            />
          </svg>
        </a>
      )}
      <span>{name}</span>
      <Link className="nodefault" style={{ right: 0 }} to="/Settings">
        S
      </Link>
    </header>
    <main>{children}</main>
  </>
);
const App = () => {
  const [settings, setSettings] = useLocalStorage<Settings>("settings", {
    sublang: "en",
  });
  const [library, setLibrary] = useState([] as Item[]);
  useEffect(() => {
    fetch(asURL(".ump-library.json"))
      .then((x) => x.json())
      .then((x) => setLibrary(x.items));
  }, []);
  useEffect(() => {
    if (location.hash) {
      const current = location.hash;
      history.replaceState(null, "", "#/");
      history.pushState(null, "", current);
    }
  }, []);
  return (
    <Switch>
      <Route path="/Series">
        {() => (
          <Chrome name="Series">
            <div id="directories">
              {library
                .filter(isEpisode)
                .filter((x) => x.type.includes("video"))
                .reduce(
                  (a, n) => a.includes(n.meta.show) ? a : [...a, n.meta.show],
                  [] as string[],
                )
                .sort((a, b) => a.localeCompare(b))
                .map((x) => (
                  <Directory name={x} path={"/Series/" + encodeURIAll(x)} />
                ))}
            </div>
          </Chrome>
        )}
      </Route>
      <Route path="/Series/:name+">
        {({ name }: { name: string }) => (
          <Chrome name={decodeURIComponent(name)}>
            <div id="files">
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
                .map((x) => (
                  <File
                    name={x.meta.season + "." + x.meta.episode + " " +
                      x.meta.title}
                    path={encodeURI(x.path)}
                    subtitle={getSubtitle(library, x, settings)}
                  />
                ))}
            </div>
          </Chrome>
        )}
      </Route>
      <Route path="/Films">
        {() => (
          <Chrome name="Films">
            <div id="files">
              {library
                .filter(isFilm)
                .filter((x) => x.type.length == 1 && x.type[0] === "video")
                .sort((a, b) => a.meta.title.localeCompare(b.meta.title))
                .map((x) => (
                  <File
                    name={x.meta.title}
                    path={encodeURI(x.path)}
                    subtitle={getSubtitle(library, x, settings)}
                  />
                ))}
            </div>
          </Chrome>
        )}
      </Route>
      <Route path="/Settings">
        {() => (
          <Chrome name="Settings">
            <div id="settings">
              <label>Authentication method</label>
              <label class="toggle">
                <input
                  id="auth-http"
                  type="radio"
                  name="auth"
                  value="http"
                  checked={settings.auth == "http"}
                  onClick={(e) =>
                    setSettings((x: Settings) => ({
                      ...x,
                      auth: (e.target as HTMLInputElement).value,
                    }))}
                />
                <span>Username/password</span>
              </label>
              <label class="toggle">
                <input
                  id="auth-none"
                  type="radio"
                  name="auth"
                  value="none"
                  checked={settings.auth == "none"}
                  onClick={(e) =>
                    setSettings((x: Settings) => ({
                      ...x,
                      auth: (e.target as HTMLInputElement).value,
                    }))}
                />
                <span>None (or IP-based)</span>
              </label>
              <label for="sublang">Preferred subtitle language</label>
              <select id="sublang" value={settings.sublang}>
                <option value="en">English</option>
                <option value="nl">Dutch</option>
              </select>
            </div>
          </Chrome>
        )}
      </Route>
      <Route>
        {() => (
          <Chrome name="Netnix">
            <div id="directories">
              <Directory name="Series" path="/Series" />
              <Directory name="Films" path="/Films" />
            </div>
            {isMobile && (
              <p>
                You will need VLC player installed on your phone to actually
                play the video files on this server. You can download it at the
                {" "}
                <a href={playerAppURL}>{isIOS ? "App Store" : "Play Store"}</a>
              </p>
            )}
          </Chrome>
        )}
      </Route>
    </Switch>
  );
};

render(
  <Router hook={useHashLocation}>
    <App />
  </Router>,
  document.body,
);
