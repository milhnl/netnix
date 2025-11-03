import { Auth } from "./auth.tsx";
import { isEpisode, Item } from "./types.ts";

export const encodeURIAll = <T extends string | undefined>(x: T) =>
  x
    ? encodeURIComponent(x).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      )
    : x;

export const asURL = <T extends string | undefined>(path: T, auth: Auth): T => {
  if (path === undefined) return path;
  const url = new URL(
    encodeURIAll(path).replaceAll(/%2F/g, "/"),
    location.href.replace(location.hash, "").replace(/[^\/]$/, "$&/"),
  );
  if (auth.type == "http") {
    url.username = auth.username;
    url.password = auth.password;
  }
  return url.toString() as T;
};

export const isAndroid = /(android)/i.test(navigator.userAgent);
export const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !((window as { MSStream?: unknown }).MSStream as unknown);
export const isMobile = isIOS || isAndroid;

export const getCoverArt = (library: Item[], item: Pick<Item, "meta">) => {
  if (isEpisode(item)) {
    return library.find(
      (x) =>
        x.type.includes("artwork") &&
        isEpisode(x) &&
        x.meta.show === item.meta.show,
    );
  } else return undefined;
};
