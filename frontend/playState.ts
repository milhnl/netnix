import { Item, HistoryItem, isMusic } from "./types.ts";

const progress = (p: number | { override: number }) =>
  p instanceof Object ? p.override : p;

const endOrSkip = (library: Item[], log: HistoryItem) =>
  progress(log.progress) + 10 >
  (library.find((y) => y.path === log.path)?.duration ?? 0) * 0.99
    ? ("end" as const)
    : ("skip" as const);

export const playNow =
  (library: Item[], item: Item) => (history: HistoryItem[]) =>
    history
      .map((x) =>
        x.action === "play" || x.action === "pause"
          ? {
              ...x,
              action: endOrSkip(library, x),
            }
          : x,
      )
      .concat([
        {
          path: item.path,
          date: new Date(),
          progress:
            item.mime.startsWith("video") && !isMusic(item)
              ? ((() => {
                  const lastPlay = history.findLast(
                    (x) => x.path === item.path,
                  );
                  if (lastPlay?.action === "skip") return lastPlay.progress;
                })() ?? 0)
              : 0,
          action: "play" as const,
        },
      ]);

export const playState =
  (library: Item[], update?: "play" | "pause" | "stop") =>
  (history: HistoryItem[]) =>
    history.map((x) =>
      x.action === "play" || x.action === "pause"
        ? {
            ...x,
            action:
              (update == "stop" ? endOrSkip(library, x) : update) ??
              {
                play: "pause" as const,
                pause: "play" as const,
              }[x.action],
          }
        : x,
    );

export const playProgress =
  (update: number | { override: number }) => (history: HistoryItem[]) =>
    history.map((x) =>
      x.action === "play" || x.action === "pause"
        ? {
            ...x,
            updated: new Date(),
            progress: update,
          }
        : x,
    );

const shuffleArray = function <T>(array: T[]): T[] {
  let count = array.length;
  while (count) {
    const r = (Math.random() * count--) | 0;
    const temp = array[count];
    array[count] = array[r];
    array[r] = temp;
  }
  return array;
};

export const playContinue = (library: Item[]) => (history: HistoryItem[]) =>
  history
    .map(
      (x) =>
        (
          ({
            play: { ...x, action: endOrSkip(library, x) },
            pause: { ...x, action: endOrSkip(library, x) },
          }) as Partial<Record<HistoryItem["action"], HistoryItem>>
        )[x.action] ?? x,
    )
    .concat(
      (() => {
        const currentLog = history.find((x) =>
          ["play", "pause"].includes(x.action),
        );
        const current =
          library.find((x) => x.path === currentLog?.path) ?? null;
        if (isMusic(current!)) {
          let next: Item | undefined = undefined;
          let autoplay: undefined | true = undefined;
          if (!currentLog!.autoplay) {
            const albumtracks = library
              .filter(isMusic)
              .filter(
                (x) =>
                  (x.mime.startsWith("audio") || x.mime.startsWith("video")) &&
                  (x.meta.albumartist ?? x.meta.artist) ==
                    (current.meta.albumartist ?? current.meta.artist) &&
                  x.meta.album == current.meta.album,
              )
              .sort(
                ({ meta: a }, { meta: b }) =>
                  (a.discnumber ?? 0) - (b.discnumber ?? 0) ||
                  a.tracknumber - b.tracknumber,
              );
            const currentIndex = albumtracks.findIndex(
              (x) => x.path === current.path,
            );
            if (currentIndex !== -1) next = albumtracks[currentIndex + 1];
          }
          if (!next && current.meta.genre) {
            next = shuffleArray(
              library.filter(
                (x) => isMusic(x) && x.meta.genre === current.meta.genre,
              ),
            )[0];
            autoplay = true;
          }
          return next
            ? [
                {
                  path: next.path,
                  date: new Date(),
                  progress: 0,
                  action: "play",
                  autoplay,
                },
              ]
            : [];
        }
        return [];
      })(),
    );
