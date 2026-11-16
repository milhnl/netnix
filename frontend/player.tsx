import { DOMAttributes, FunctionComponent as FC } from "preact";
import { useEffect, useContext, useLayoutEffect, useRef } from "preact/hooks";
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
  readProgress,
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
  const currentLog = state.history.find((x) =>
    ["play", "pause"].includes(x.action),
  );
  const current = library.find((x) => x.path === currentLog?.path) ?? null;
  const currentSrc = asURL(current?.path, auth);
  const playing = currentLog?.action === "play";
  const timeOverride =
    currentLog?.progress instanceof Object
      ? currentLog.progress.override
      : undefined;
  const playbackRate = currentLog?.rate;
  // Work around iOS Safari not firing fullscreenchange and pausing video
  const resumeTimer = useRef<ReturnType<typeof setTimeout>>();
  useLayoutEffect(() => {
    const elem = mediaRef.current;
    if (!playing || !(elem instanceof HTMLVideoElement)) return;
    const fullscreenchangeHandler = () => {
      if (elem.paused) return;
      clearTimeout(resumeTimer.current);
      resumeTimer.current = setTimeout(() => {
        resumeTimer.current = undefined;
        if (elem.isConnected && elem.paused) elem.play().catch(console.warn);
      }, 500);
    };
    elem.addEventListener("webkitendfullscreen", fullscreenchangeHandler);
    return () => {
      clearTimeout(resumeTimer.current);
      resumeTimer.current = undefined;
      elem.removeEventListener("webkitendfullscreen", fullscreenchangeHandler);
    };
  }, [playing, currentSrc, currentLog?.date.getTime(), current?.mime]);
  //Try to save current position on page reload/whatever
  useEffect(() => {
    const listener = () => {
      return mediaRef.current?.readyState
        ? setState(playProgress(mediaRef.current.currentTime, true))
        : undefined;
    };
    const targets = [
      [window, "pagehide"] as const,
      [document, "visibilitychange"] as const,
    ];
    targets.forEach(([target, eventName]) =>
      target.addEventListener(eventName, listener),
    );
    return () =>
      targets.forEach(([target, eventName]) =>
        target.removeEventListener(eventName, listener),
      );
  }, [mediaRef]);
  const sharedProps: Partial<DOMAttributes<HTMLMediaElement>> = {
    onPlay: () => playingSync.current || setState(playState(library, "play")),
    onPause: () =>
      playingSync.current ||
      resumeTimer.current !== undefined ||
      setState(playState(library, "pause")),
    onEnded: () => setState(playContinue(library, "end")),
    onLoadedMetadata: ({ target }) =>
      target && (target as HTMLMediaElement).played?.length === 0 && currentLog
        ? ((target as HTMLMediaElement).currentTime = readProgress(
            currentLog.progress,
          ))
        : undefined,
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
      const elem = ev.target as HTMLMediaElement | null;
      //Check whether this is not an early emitted zero
      const progress = elem?.readyState ? elem.currentTime : undefined;
      if (progress !== undefined && Number.isFinite(progress))
        setState(playProgress(progress));
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
    if (
      mediaRef.current &&
      timeOverride !== undefined &&
      mediaRef.current.readyState >= HTMLMediaElement.HAVE_METADATA
    )
      mediaRef.current.currentTime = timeOverride;
  }, [timeOverride, mediaRef]);
  useEffect(() => {
    if (mediaRef.current) mediaRef.current.playbackRate = playbackRate ?? 1;
  }, [current, mediaRef, playbackRate]);
  if (current?.mime.startsWith("video"))
    return (
      <video
        ref={setMediaRef}
        src={currentSrc}
        playsinline
        webkit-playsinline
        {...sharedProps}
        {...{
          onfullscreenchange: ({ currentTarget }: Event) =>
            ((currentTarget as HTMLVideoElement).controls =
              document.fullscreenElement === currentTarget),
          onwebkitbeginfullscreen: ({ currentTarget }: Event) =>
            ((currentTarget as HTMLVideoElement).controls = true),
          onwebkitendfullscreen: ({ currentTarget }: Event) =>
            ((currentTarget as HTMLVideoElement).controls = false),
        }}
        onClick={({ target }) => {
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
