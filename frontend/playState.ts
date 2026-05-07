import { Item, HistoryItem, isMusic } from "./types.ts";
import { shuffleArray } from "./utility.ts";

export const readProgress = (p: number | { override: number }) =>
  p instanceof Object ? p.override : p;

const endOrSkip = (library: Item[], log: HistoryItem) =>
  readProgress(log.progress) + 10 >
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
              updated: new Date(),
              action: endOrSkip(library, x),
            }
          : x,
      )
      .concat([
        {
          path: item.path,
          date: new Date(),
          updated: new Date(),
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

type CurrentHistoryItem = Omit<HistoryItem, "action"> & {
  action: "play" | "pause";
};
const playUpdateCurrent =
  (updater: (current: CurrentHistoryItem) => HistoryItem) =>
  (history: HistoryItem[]): HistoryItem[] => {
    const currentIndex = history.findIndex(
      (x) => x.action === "play" || x.action === "pause",
    );
    if (currentIndex === -1) return history;
    const current = history[currentIndex];
    const now = new Date();
    const almostNewCurrent = {
      ...current,
      updated: now,
      progress:
        current.action === "play"
          ? readProgress(current.progress) +
            (now.getTime() - current.updated!.getTime()) / 1000
          : current.progress,
    };
    const newCurrent = updater(almostNewCurrent as CurrentHistoryItem);
    if (almostNewCurrent === newCurrent) return history;
    const newHistory = history.slice();
    newHistory[currentIndex] = newCurrent;
    return newHistory;
  };

export const playState = (
  library: Item[],
  update: "play" | "pause" | "stop",
) =>
  playUpdateCurrent((current) =>
    current.action !== update
      ? {
          ...current,
          action: update == "stop" ? endOrSkip(library, current) : update,
        }
      : current,
  );

const cmpnums = (a: number, b: number, d: number) => Math.abs(a - b) < d;
export const playProgress = (
  update: number | { override: number },
  force?: true,
) =>
  playUpdateCurrent((current) =>
    typeof update === "number" &&
    typeof current.progress === "number" &&
    cmpnums(
      current.progress +
        (new Date().getTime() - current.updated!.getTime()) / 1000,
      update,
      5,
    ) &&
    !force
      ? current
      : {
          ...current,
          progress: update,
        },
  );

export const playContinue =
  (library: Item[], action?: "end") => (history: HistoryItem[]) =>
    history
      .map(
        (x) =>
          (
            ({
              play: {
                ...x,
                updated: new Date(),
                action: action ?? endOrSkip(library, x),
              },
              pause: {
                ...x,
                updated: new Date(),
                action: action ?? endOrSkip(library, x),
              },
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
                    (x.mime.startsWith("audio") ||
                      x.mime.startsWith("video")) &&
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
                    updated: new Date(),
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
