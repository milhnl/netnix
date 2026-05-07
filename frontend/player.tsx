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
import {
  playState,
  playProgress,
  playRate,
  playContinue,
} from "./playState.ts";
import { LibraryContext, StateContext } from "./context.ts";
import { AuthContext } from "./auth.tsx";

const getSubtitle = (library: Item[], item: Item): Item | undefined =>
  (
    (isEpisode(item)
      ? library.filter(
          (x) =>
            isEpisode(x) &&
            x.mime == "application/x-subrip" &&
            x.meta.show === item.meta.show &&
            x.meta.season === item.meta.season &&
            x.meta.episode === item.meta.episode,
        )
      : isFilm(item)
        ? library.filter(
            (x) =>
              isFilm(x) &&
              x.mime == "application/x-subrip" &&
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
  const playingSync = useRef<boolean>(false);

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const setMediaRef = (node: HTMLVideoElement | HTMLAudioElement | null) => {
    mediaRef.current = node;
  };
  useEffect(() => {
    const fullscreenchangeHandler = () => {
      if (
        document.fullscreenElement &&
        document.fullscreenElement === mediaRef.current
      ) {
        mediaRef.current!.controls = true;
      } else {
        mediaRef.current!.controls = false;
      }
    };
    document.addEventListener("fullscreenchange", fullscreenchangeHandler);
    return () =>
      document.removeEventListener(
        "fullscreenchange",
        fullscreenchangeHandler,
      );
  }, []);
  // Work around iOS Safari not firing fullscreenchange and pausing video
  useEffect(() => {
    if (!(mediaRef.current instanceof HTMLVideoElement)) return;
    const fullscreenchangeHandler = (ev: Event) => {
      const elem = ev.target as HTMLVideoElement;
      elem.controls = false;
      if (!elem.paused)
        setTimeout(() => playingSync.current || elem.play(), 500);
    };
    mediaRef.current.addEventListener(
      "webkitendfullscreen",
      fullscreenchangeHandler,
    );
    return () =>
      document.removeEventListener(
        "webkitendfullscreen",
        fullscreenchangeHandler,
      );
  }, [mediaRef.current]);
  const currentLog = state.history.find((x) =>
    ["play", "pause"].includes(x.action),
  );
  const current = library.find((x) => x.path === currentLog?.path) ?? null;
  const currentSrc = asURL(current?.path, auth);
  const playing = currentLog?.action === "play";
  const timeOverride =
    currentLog?.progress instanceof Object
      ? currentLog.progress.override
      : mediaRef.current?.src !== currentSrc
        ? currentLog?.progress
        : undefined;
  const playbackRate = currentLog?.rate;
  const sharedProps: Partial<DOMAttributes<HTMLMediaElement>> = {
    onPlay: () => playingSync.current || setState(playState(library, "play")),
    onPause: () =>
      playingSync.current || setState(playState(library, "pause")),
    onEnded: () => setState(playContinue(library, "end")),
    onCanPlay: ({ target }) => {
      if (
        target &&
        (target as HTMLMediaElement).played?.length === 0 &&
        playing
      ) {
        playingSync.current = true;
        (target as HTMLMediaElement).play().finally(() => {
          playingSync.current = false;
        });
      }
    },
    onRateChange: ({ target }) =>
      setState(playRate((target as HTMLMediaElement).playbackRate)),
    onTimeUpdate: (ev) => {
      const progress = (ev.target as HTMLMediaElement | null)?.currentTime;
      if (progress) setState(playProgress(progress));
    },
  };
  useEffect(() => {
    if (
      mediaRef.current &&
      playing == mediaRef.current.paused &&
      mediaRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      playingSync.current = true;
      if (playing) {
        mediaRef.current.play().finally(() => {
          playingSync.current = false;
        });
      } else {
        mediaRef.current.pause();
        playingSync.current = false;
      }
    }
  }, [playing, mediaRef]);
  useEffect(() => {
    if (mediaRef.current && timeOverride)
      mediaRef.current.currentTime = timeOverride;
  }, [timeOverride, mediaRef]);
  useEffect(() => {
    if (mediaRef.current && playbackRate) {
      mediaRef.current.playbackRate = playbackRate;
    }
  }, [current, mediaRef, playbackRate]);
  if (current?.mime.startsWith("video"))
    return (
      <video
        ref={setMediaRef}
        src={currentSrc}
        playsinline={isMusic(current)}
        {...sharedProps}
        onClick={({ target }) => {
          (target as HTMLVideoElement).controls = true;
          if (isIOS && target && "webkitEnterFullscreen" in target)
            (
              target as unknown as { webkitEnterFullscreen: () => void }
            ).webkitEnterFullscreen();
          else (target as HTMLVideoElement).requestFullscreen();
        }}
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
  else if (current?.mime.startsWith("audio"))
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
