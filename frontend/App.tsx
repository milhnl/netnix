import { FunctionComponent as FC } from "preact";
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  Dispatch,
  StateUpdater,
} from "preact/hooks";
import { Route, Switch } from "wouter-preact";
import { css, styled } from "goober";
import { Item, State, StateUpdate, HistoryItem } from "./types.ts";
import { useStorage } from "./state.ts";
import { asURL, isIOS, isAndroid, isMobile } from "./utility.ts";
import { Auth, getAuthHeader, Login, AuthContext } from "./auth.tsx";
import { Chrome } from "./ui.tsx";
import { VideoRoutes } from "./video.tsx";
import { FileViewRoutes } from "./fileView.tsx";
import { LibraryContext, StateContext } from "./context.ts";
import { MusicRoutes } from "./music.tsx";

const dateFormatter = new Intl.DateTimeFormat("en", {
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "numeric",
  fractionalSecondDigits: 3,
  timeZoneName: "longOffset",
});

const rfc9557string = (date = new Date()) => {
  const parts = dateFormatter
    .formatToParts(date)
    .filter(({ type }) => type !== "literal");
  const {
    year,
    month,
    day,
    hour,
    minute,
    second,
    fractionalSecond,
    timeZoneName,
  } = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  const offset =
    timeZoneName === "GMT" ? "+00:00" : timeZoneName.replace("GMT", "");

  const decimal = fractionalSecond ? `.${fractionalSecond}` : "";
  const ts = `${year}-${month}-${day}T${hour}:${minute}:${second}${decimal}`;

  return `${ts}${offset}[${dateFormatter.resolvedOptions().timeZone}]`;
};

const playerAppURL = isIOS
  ? "https://apps.apple.com/us/app/vlc-for-mobile/id650377962"
  : isAndroid
    ? "https://play.google.com/store/apps/details?id=org.videolan.vlc"
    : undefined;

const Message = styled("p")`
  margin: var(--header-height);
  padding: 4vmin;
  border-radius: 3vmin;
  background-color: rgba(128, 128, 128, 0.1);
  font-size: 1.6rem;
`;

const mainContainerClass = css`
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - var(--header-height) - var(--footer-height));
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
        background:
          `url('data:image/svg+xml;base64,${btoa(bg)}')` +
          `0 0/${textDims}, rgba(128, 128, 128, 0.1)`,
      }}
    >
      {children}
    </a>
  );
};

export const MainScreen = ({
  setUiName,
}: {
  setUiName: Dispatch<StateUpdater<string>>;
}) => {
  useEffect(() => setUiName("Netnix"), []);
  return (
    <main className={mainContainerClass}>
      {[
        { to: "/TV/Films", bgText: "FILMS", label: "Films" },
        { to: "/TV/Series", bgText: "TV", label: "Series" },
        { to: "/Music", bgText: "MUSIC", label: "Music" },
        { to: "/Files", bgText: "FILES", label: "Files" },
      ].map(({ label, ...link }, i) => (
        <MainLink i={i} {...link}>
          {label}
        </MainLink>
      ))}
    </main>
  );
};

export const App = () => {
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
  const [replicated, setReplicated] = useStorage<HistoryItem[]>(
    "ump-state",
    [],
    {
      replacer: function (k, v) {
        return k === "date" && v instanceof Date && !isNaN(this[k]?.getTime())
          ? rfc9557string(this[k])
          : v;
      },
      reviver: (k, v) =>
        (
          ({
            date: () =>
              v.match(/.*\[.*\/.*\]/) ? new Date(v.replace(/\[.*\]$/, "")) : v,
            action: () => (v === "play" ? "pause" : v),
          })[k] ?? (() => v)
        )(),
    },
  );
  const dispatch = useCallback(
    (update: StateUpdater<HistoryItem[]> | HistoryItem) =>
      setReplicated(
        Array.isArray(update) || update instanceof Function
          ? update
          : (x) => {
              return x.concat([update]);
            },
      ),
    [setReplicated],
  );
  const stateWithSetter = useMemo<[State, Dispatch<StateUpdate>]>(() => {
    return [
      {
        history: replicated,
      },
      dispatch,
    ];
  }, [replicated]);
  const [uiName, setUiName] = useState("Netnix");
  return (
    <AuthContext.Provider value={auth}>
      <LibraryContext.Provider value={library}>
        <StateContext.Provider value={stateWithSetter}>
          <Chrome name={uiName}>
            <Switch>
              <Route path="/TV" nest>
                <VideoRoutes setUiName={setUiName} />
              </Route>
              <Route path="/Music" nest>
                <MusicRoutes setUiName={setUiName} />
              </Route>
              <Route path="/Files" nest>
                <FileViewRoutes setUiName={setUiName} />
              </Route>
              <Route>
                <MainScreen setUiName={setUiName} />
              </Route>
            </Switch>
          </Chrome>
        </StateContext.Provider>
      </LibraryContext.Provider>
    </AuthContext.Provider>
  );
};
