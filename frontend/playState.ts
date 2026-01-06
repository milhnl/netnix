import { Item, HistoryItem, isMusic } from "./types.ts";
export const playNow = (item: Item) => (history: HistoryItem[]) =>
  history
    .map((x) =>
      x.action === "play" || x.action === "pause"
        ? { ...x, action: "end" as const }
        : x,
    )
    .concat([
      {
        path: item.path,
        date: new Date(),
        action: "play" as const,
      },
    ]);

export const playState =
  (update?: "play" | "pause" | "stop") => (history: HistoryItem[]) =>
    history.map((x) =>
      x.action === "play" || x.action === "pause"
        ? {
            ...x,
            action:
              (update == "stop" ? ("skip" as const) : update) ??
              {
                play: "pause" as const,
                pause: "play" as const,
              }[x.action],
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
            play: { ...x, action: "end" as const },
            pause: { ...x, action: "end" as const },
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
                  x.type.includes("music") &&
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
                  action: "play",
                  autoplay,
                },
              ]
            : [];
        }
        return [];
      })(),
    );
