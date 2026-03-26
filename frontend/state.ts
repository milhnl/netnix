import { Dispatch, StateUpdater, useEffect, useState } from "preact/hooks";

/**
 * Narrow a setState hook to a property
 * @param setState The setState hook for the full object/array
 * @param key The key of the child property/element
 * @returns A setState hook which only updates state[key]
 */
export const slice =
  <T, U extends keyof T>(
    setState: Dispatch<StateUpdater<T>>,
    key: U,
  ): Dispatch<StateUpdater<T[U]>> =>
  (newState) =>
    setState((state) =>
      Object.assign(Array.isArray(state) ? [] : {}, state, {
        [key]: newState instanceof Function ? newState(state[key]) : newState,
      }),
    );

export default slice;

export type WithSetter<Props> = Props & {
  [k in keyof Props as `set${Capitalize<string & k>}`]: Dispatch<
    StateUpdater<Props[k]>
  >;
};

export const useStorage = <T>(
  key: string,
  initialValue: T,
  options: {
    storage?: Storage;
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
  },
): [T, Dispatch<StateUpdater<T>>] => {
  const storage = options.storage ?? localStorage;
  const parseValue = (value: string | null) =>
    value && value !== "undefined"
      ? (options.deserialize ? options.deserialize : JSON.parse)(value)
      : initialValue;
  const [value, setValue] = useState(() => parseValue(storage.getItem(key)));
  self.addEventListener(
    "storage",
    (e) => e.key === key && setValue(parseValue(e.newValue)),
  );
  useEffect(
    () =>
      storage.setItem(
        key,
        (options.serialize ? options.serialize : JSON.stringify)(value),
      ),
    [key, value, storage],
  );
  return [value, setValue];
};
