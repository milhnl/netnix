import { DOMAttributes, FunctionComponent as FC } from "preact";
import { useEffect, useContext, useRef } from "preact/hooks";
import { useLocation } from "wouter-preact";
import { Item, isEpisode, isFilm, isMusic } from "./types.ts";
import {
  encodeURIAll,
  asURL,
  isIOS,
  isAndroid,
  getCoverArt,
} from "./utility.ts";
import { playState, playContinue } from "./playState.ts";
import { LibraryContext, StateContext } from "./context.ts";
import { AuthContext } from "./auth.tsx";

const getSubtitle = (library: Item[], item: Item): Item | undefined =>
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

export const PlayerElement: FC = () => {
  const [state, setState] = useContext(StateContext);
  const [, navigate] = useLocation();
  const auth = useContext(AuthContext);
  const library = useContext(LibraryContext);

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const setMediaRef = (node: HTMLVideoElement | HTMLAudioElement | null) => {
    mediaRef.current = node;
  };
  const currentLog = state.history.find((x) =>
    ["play", "pause"].includes(x.action),
  );
  const current = library.find((x) => x.path === currentLog?.path) ?? null;
  const currentSrc = asURL(current?.path, auth);
  const playing = currentLog?.action === "play";
  const sharedProps: Partial<DOMAttributes<HTMLMediaElement>> = {
    onPlay: () => playing || setState(playState("play")),
    onPause: () => playing && setState(playState("pause")),
    onEnded: () => setState(playContinue(library)),
    onCanPlay: ({ target }) =>
      playing ? (target as HTMLMediaElement).play() : undefined,
  };
  useEffect(() => {
    playing ? mediaRef.current?.play() : mediaRef.current?.pause();
  }, [playing, mediaRef]);
  if (current?.type.includes("video"))
    return (
      <video
        ref={setMediaRef}
        src={currentSrc}
        {...sharedProps}
        onClick={({ target }) =>
          (target as HTMLVideoElement).requestFullscreen()
        }
        onError={(ev) => {
          console.error(ev);
          const subtitle = encodeURIAll(
            asURL(getSubtitle(library, current!)?.path, auth),
          );
          globalThis.location.href = isAndroid
            ? "vlc://" + asURL(current!.path, auth)
            : isIOS
              ? `vlc-x-callback://x-callback-url/stream?url=${encodeURIAll(
                  asURL(current!.path, auth),
                )}${subtitle ? `&sub=${subtitle}` : ""}`
              : asURL(current!.path, auth);
        }}
      />
    );
  else if (current?.type.includes("music"))
    return (
      <>
        <img
          {...(isMusic(current)
            ? {
                onClick: () =>
                  navigate(
                    `/Music/${
                      current.meta.albumartist ?? current.meta.artist
                    }/${current.meta.album}`,
                  ),
              }
            : undefined)}
          src={asURL(getCoverArt(library, current)?.path, auth)}
        />
        <audio
          ref={setMediaRef}
          style={{ display: "none" }}
          src={currentSrc}
          {...sharedProps}
        />
      </>
    );
  return null;
};
