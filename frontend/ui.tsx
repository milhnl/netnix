import { TargetedEvent, FunctionComponent as FC } from "preact";
import {
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  Dispatch,
} from "preact/hooks";
import { forwardRef } from "preact/compat";
import { css, styled } from "goober";
import { Link } from "wouter-preact";
import {
  MusicMeta,
  EpisodeMeta,
  FilmMeta,
  Item,
  HistoryItem,
  StateUpdate,
} from "./types.ts";
import { PlayerElement } from "./player.tsx";
import { useActionHandlers } from "./mediasessionHook.ts";
import { playState, playProgress, playContinue } from "./playState.ts";
import { LibraryContext, StateContext } from "./context.ts";
import { AuthContext } from "./auth.tsx";
import { asURL, getCoverArt } from "./utility.ts";

export const directoryContainerClass = css`
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

export const Directory = ({
  name,
  path,
  bg,
}: {
  name: string;
  path: string;
  bg?: string | undefined;
}) => (
  <Link
    to={path}
    className="nodefault"
    style={bg && { backgroundImage: `url(${bg})` }}
  >
    <span>{name}</span>
  </Link>
);

export const fileContainerClass = css`
  display: flex;
  flex-direction: column;
  & > *:nth-child(even) {
    background-color: rgba(128, 128, 128, 0.1);
  }
`;

export const ItemContainer = styled("div")`
  display: flex;
  height: 4.2rem;
  & > * {
    padding: 0.5rem 1rem;
    font-size: 1.8rem;
    line-height: 3.2rem;
    color: inherit;
    text-decoration: none;
  }
  & > .square {
    box-sizing: border-box;
    width: 4.2rem;
    color: rgba(128, 128, 128, 0.3);
    text-align: right;
  }
  & > img.square {
    padding: 0;
  }
  & > .grow {
    flex-grow: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const Header = styled("header")`
  display: flex;
  flex-direction: row;
  min-height: var(--header-height);
  vertical-align: middle;
  background-color: var(--header-color);
  font-size: calc(var(--header-height) * 0.5);
  padding: 0 var(--header-height);
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  & > span {
    flex: 1;
    text-align: center;
    line-height: var(--header-height);
  }
`;

const Footer = styled("div")`
  display: flex;
  flex-direction: row;
  height: var(--footer-height);
  vertical-align: middle;
  background-color: var(--header-color);
  font-size: calc(var(--header-height) * 0.5);
  padding: 0 0;
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
`;

const ControlsContainer = styled("div")`
  height: var(--footer-height);
  width: 100%;
`;

const InnerControlsContainer = styled("div")`
  display: flex;
  flex-direction: row;
  vertical-align: middle;
  font-size: calc(var(--header-height) * 0.5);
  padding: 0;
  & > span {
    flex: 1;
    text-align: center;
    line-height: calc(var(--footer-height) - 6px);
  }
  & > span.button {
    flex: 0;
    min-width: var(--header-height);
    cursor: pointer;
  }
`;

const ProgressBar = styled("input", forwardRef)`
  --progress-color: rgba(0.5, 0.5, 0.5, 0.3);
  display: block;
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  cursor: pointer;
  outline: none;
  border-radius: 0;
  margin: 0;

  height: 6px;
  background: transparent;
  border-radius: 0;
  transition: 0.2s ease-in-out;
  &:hover {
    height: 12px;
  }

  &::-webkit-slider-thumb,
  &::-moz-range-thumb {
    -webkit-appearance: none;
    appearance: none;
    height: 0;
    width: 0;
    border: none;
  }
`;

const HeaderLink = styled("a")`
  position: absolute;
  left: 0;
  display: block;
  flex: 0 var(--header-height);
  line-height: var(--header-height);
  height: var(--header-height);
  width: var(--header-height);
  font-size: calc(var(--header-height) * 0.7);
  text-align: center;
  & > svg {
    display: inline-block;
    vertical-align: middle;
    height: 75%;
  }
`;

const Progress: FC<{
  current: Item | null;
  currentLog?: HistoryItem;
  setState: Dispatch<StateUpdate>;
}> = ({ current, currentLog, setState }) => {
  const progressRef = useRef<HTMLInputElement | null>(null);
  const playing = currentLog?.action === "play";
  const progress =
    (currentLog?.progress instanceof Object
      ? currentLog?.progress.override
      : currentLog?.progress) ?? 0;
  const [progressOverride, setProgressOverride] = useState(
    undefined as number | undefined,
  );
  useEffect(() => {
    const callback = () => {
      if (playing && current && progressRef.current) {
        const actualProgress =
          progressOverride ??
          progress +
            (new Date().getTime() - currentLog.updated!.getTime()) / 1000;
        progressRef.current.value = String(actualProgress);
        progressRef.current.style.background = `linear-gradient(to right, var(--progress-color) ${(actualProgress / (current?.duration ?? 0)) * 100}%, rgba(128, 128, 128, 0.1) ${(actualProgress / (current?.duration ?? 0)) * 100}%)`;
        if ("mediaSession" in navigator) {
          navigator.mediaSession.setPositionState({
            duration: current.duration ?? 0,
            position: actualProgress,
          });
        }
      }
    };
    const interval = setInterval(callback, 100);
    return () => clearInterval(interval);
  }, [progress, progressOverride, progressRef, currentLog, playing]);
  return (
    <ProgressBar
      ref={progressRef}
      type="range"
      value={progressOverride ?? progress}
      style={{
        background: `linear-gradient(to right, var(--progress-color) ${((progressOverride ?? progress) / (current?.duration ?? 0)) * 100}%, rgba(128, 128, 128, 0.1) ${((progressOverride ?? progress) / (current?.duration ?? 0)) * 100}%)`,
      }}
      max={current?.duration}
      step="any"
      onChange={(ev: TargetedEvent<HTMLInputElement, Event>) => {
        setProgressOverride(undefined);
        setState(
          playProgress({
            override: Number((ev.target as HTMLInputElement).value),
          }),
        );
      }}
      onInput={(ev: TargetedEvent<HTMLInputElement, Event>) => {
        setProgressOverride(Number((ev.target as HTMLInputElement).value));
      }}
    />
  );
};

const Controls: FC = () => {
  const [state, setState] = useContext(StateContext);
  const library = useContext(LibraryContext);
  const auth = useContext(AuthContext);
  const actionHandlers: {
    [K in MediaSessionAction]?: MediaSessionActionHandler;
  } = useMemo(
    () =>
      setState
        ? {
            play: () => setState(playState(library, "play")),
            pause: () => setState(playState(library, "pause")),
            stop: () => setState(playState(library, "stop")),
            nexttrack: () => setState(playContinue(library)),
            seekto: ({ seekTime }) =>
              setState(playProgress({ override: seekTime! })),
          }
        : {},
    [setState, library],
  );
  useActionHandlers(actionHandlers);
  const currentLog = state.history.find((x) =>
    ["play", "pause"].includes(x.action),
  );
  const current = library.find((x) => x.path === currentLog?.path) ?? null;
  useEffect(() => {
    if (current && "mediaSession" in navigator) {
      const meta = current.meta as Record<
        keyof (MusicMeta & FilmMeta & EpisodeMeta),
        string | undefined
      >;
      const artwork = getCoverArt(library, current);
      navigator.mediaSession.metadata = new MediaMetadata({
        title: meta.title,
        artist: meta.artist,
        album: meta.title,
        artwork: artwork
          ? [{ src: asURL(artwork.path, auth), type: artwork.mime }]
          : [],
      });
    }
  }, [current]);
  const playing = currentLog?.action === "play";
  return (
    <ControlsContainer>
      <Progress
        current={current}
        currentLog={currentLog}
        setState={setState}
      />
      <InnerControlsContainer>
        {playing ? (
          <span
            className="button"
            style={{ fontSize: "150%" }}
            onClick={() => setState(playState(library, "pause"))}
          >
            ⏸︎
          </span>
        ) : (
          <span
            className="button"
            onClick={() => setState(playState(library, "play"))}
          >
            ▶︎
          </span>
        )}
        <span>
          {"title" in (current?.meta ?? {})
            ? (current?.meta as { title: string }).title
            : undefined}
        </span>
      </InnerControlsContainer>
    </ControlsContainer>
  );
};

export const Chrome: FC<{
  name: string;
}> = ({ name, children }) => (
  <>
    <Header>
      {location.hash && (
        <HeaderLink onClick={() => history.back()}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 10">
            <polyline
              points="4,2 1,5 4,8"
              stroke="blue"
              stroke-linecap="round"
              fill="none"
            />
          </svg>
        </HeaderLink>
      )}
      <span>{name}</span>
    </Header>
    <div style={{ height: "var(--header-height)" }} />
    {children}
    <div style={{ height: "var(--footer-height)" }} />
    <Footer>
      <PlayerElement />
      <Controls />
    </Footer>
  </>
);
