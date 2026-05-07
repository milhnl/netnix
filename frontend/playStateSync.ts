import { HistoryItem } from "./types.ts";

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

export const serializeState = (state: HistoryItem[]) =>
  JSON.stringify(state, function (k, v) {
    return ["date", "updated"].includes(k) &&
      this[k] instanceof Date &&
      !isNaN(this[k]?.getTime())
      ? rfc9557string(this[k])
      : v;
  });

export const deserializeState = (state: string): HistoryItem[] =>
  JSON.parse(state, (k, v) =>
    (
      ({
        date: () =>
          v.match(/^\d{4}-\d{2}-\d{2}T/)
            ? new Date(v.replace(/\[.*\]$/, ""))
            : v,
        updated: () =>
          v.match(/^\d{4}-\d{2}-\d{2}T/)
            ? new Date(v.replace(/\[.*\]$/, ""))
            : v,
        action: () => (v === "play" ? "pause" : v),
      })[k] ?? (() => v)
    )(),
  );
