import { h, StateUpdater, useCallback, useEffect } from "./deps/preact.ts";
import { createGlobalStyles, css, styled } from "./deps/goober.ts";

export type Auth =
  | {
    type: "http" | "unfinished";
    username: string;
    password: string;
  }
  | { type: "none" | "unknown" };

export const getAuthHeader = (auth: Auth) =>
  auth.type === "http" || auth.type === "unfinished"
    ? { Authorization: "Basic " + btoa(`${auth.username}:${auth.password}`) }
    : ({} as Record<never, never>);

export const tryAuthenticate = (
  checkURL: string,
  auth: Auth,
  setAuth: StateUpdater<Auth>,
) => {
  const handleResult = (success: boolean) =>
    success
      ? setAuth(
        auth.type === "unfinished"
          ? { ...auth, type: "http" }
          : { type: "none" },
      )
      : setAuth({ username: "", password: "", ...auth, type: "unfinished" });
  if (/.*Version.*Safari.*/.test(navigator.userAgent)) {
    const req = new XMLHttpRequest();
    req.withCredentials = true;
    req.open(
      "HEAD",
      checkURL,
      false,
      "username" in auth ? auth.username : "",
      "password" in auth ? auth.password : "",
    );
    req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    req.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    req.onreadystatechange = () => handleResult(req.status !== 401);
    req.send();
  } else {
    fetch(checkURL, {
      method: "HEAD",
      headers: {
        Authorization: "Basic 000000",
        "X-Requested-With": "XMLHttpRequest",
        ...getAuthHeader(auth),
      },
    }).then((x) => handleResult(x.status !== 401));
  }
};

const Main = styled("main")`
  margin: var(--header-height);
`;

const Label = styled("label")`
  margin-bottom: 0.5em;
  font-size: 2rem;
`;

const inputClassname = css`
  display: block;
  box-sizing: border-box;
  margin-bottom: 1.5em;
  height: 44px;
  padding: 0 1em;
  width: 100%;
  font-size: 1.6rem;
  @keyframes onAutoFillStart {
    from {
    }
    to {
    }
  }
  @keyframes onAutoFillCancel {
    from {
    }
    to {
    }
  }
  &[autocomplete="current-password"]:-webkit-autofill {
    animation-name: onAutoFillStart;
    transition: background-color 0.01s ease-in-out 0s;
  }
  &[autocomplete="current-password"]:not(:-webkit-autofill) {
    animation-name: onAutoFillCancel;
  }
`;

export const Login = ({
  checkURL,
  auth,
  setAuth,
}: {
  checkURL: string;
  auth: Auth;
  setAuth: StateUpdater<Auth>;
}) => {
  const withCurrentValue = (name: "username" | "password", auth: Auth) =>
    (
      document.querySelector(
        `input[autocomplete='${
          name === "password" ? "current-password" : name
        }']`,
      ) as HTMLInputElement
    )?.value ?? (auth as Exclude<Auth, { type: "none" | "unknown" }>)[name];
  const ref = useCallback((node: HTMLInputElement | null) => {
    if (node === null) return;
    node.addEventListener(
      "animationend",
      (e) =>
        e.animationName == "onAutoFillStart" &&
        setAuth((x) => ({
          type: "http",
          username: withCurrentValue("username", auth),
          password: withCurrentValue("password", auth),
        })),
    );
  }, []);
  useEffect(() => tryAuthenticate(checkURL, auth, setAuth), []);
  return "username" in auth
    ? (
      <Main>
        <Label for="username">Username</Label>
        <input
          className={inputClassname}
          type="text"
          value={auth.username}
          autofocus
          autocomplete="username"
          onChange={(ev) =>
            setAuth((x: Auth) => ({
              ...x,
              username: (ev.target as HTMLInputElement).value,
              password: withCurrentValue("password", auth),
            }))}
        />
        <Label for="password">Password</Label>
        <input
          className={inputClassname}
          ref={ref}
          type="password"
          value={auth.password}
          autocomplete="current-password"
          onChange={(ev) =>
            setAuth((x: Auth) => ({
              ...x,
              password: (ev.target as HTMLInputElement).value,
              username: withCurrentValue("username", auth),
            }))}
        />
        <button
          type="submit"
          className={inputClassname}
          disabled={auth.username === "" || auth.password === ""}
          onClick={() => tryAuthenticate(checkURL, auth, setAuth)}
        >
          Log in
        </button>
      </Main>
    )
    : <span>loading</span>;
};
