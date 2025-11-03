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
    reviver?: Parameters<typeof JSON.parse>[1];
    // deno-lint-ignore no-explicit-any
    replacer?: (this: any, key: string, value: any) => any;
  },
): [T, Dispatch<StateUpdater<T>>] => {
  const storage = options.storage ?? localStorage;
  const parseValue = (value: string | null) =>
    value && value !== "undefined"
      ? JSON.parse(value, options.reviver)
      : initialValue;
  const [value, setValue] = useState(() => parseValue(storage.getItem(key)));
  self.addEventListener(
    "storage",
    (e) => e.key === key && setValue(parseValue(e.newValue)),
  );
  useEffect(
    () => storage.setItem(key, JSON.stringify(value, options.replacer)),
    [key, value, storage],
  );
  return [value, setValue];
};
