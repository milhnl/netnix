import { h, render } from "preact";
import { Router } from "wouter-preact";
import { useHashLocation } from "wouter-preact/use-hash-location";
import { setup } from "goober";
import { App } from "./App.tsx";

setup(h);
render(
  <Router hook={useHashLocation}>
    <App />
  </Router>,
  document.body
);
