import { h, render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { Router } from "wouter-preact";
import { setup } from "goober";
import { App } from "./App.tsx";

const currentLocation = () => self.location.hash.replace(/^#/, "") || "/";
const navigate = (to: string) => (self.location.hash = to);

const useHashLocation = (): [string, (path: string) => void] => {
  const [loc, setLoc] = useState(currentLocation());
  useEffect(() => {
    const handler = () => setLoc(currentLocation());
    self.addEventListener("hashchange", handler);
    return () => self.removeEventListener("hashchange", handler);
  }, []);
  return [loc, navigate];
};

setup(h);
render(
  <Router hook={useHashLocation}>
    <App />
  </Router>,
  document.body,
);
