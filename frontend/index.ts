import { Fragment, html, render, useEffect, useState } from './deps/preact.ts';
import { Link, Route, Router, Switch } from './deps/wouter-preact.ts';

const currentLocation = () => window.location.hash.replace(/^#/, '') || '/';
const navigate = (to) => (window.location.hash = to);

const useHashLocation = () => {
  const [loc, setLoc] = useState(currentLocation());
  useEffect(() => {
    const handler = () => setLoc(currentLocation());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return [loc, navigate];
};

const isAndroid = /(android)/i.test(navigator.userAgent);
const isIOS =
  /iPad|iPhone|iPod/.test(navigator.platform) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = isIOS || isAndroid;

const encodeURIAll = (x) => encodeURIComponent(x).replace(/[!'()*]/g, escape);
const asURL = (path) =>
  location.href.replace(location.hash, '').replace(/\/[^\/]*$/, '/') + path;

const playerAppURL = isIOS
  ? 'https://apps.apple.com/us/app/vlc-for-mobile/id650377962'
  : isAndroid
  ? 'https://play.google.com/store/apps/details?id=org.videolan.vlc'
  : false;

const asPlayableURL = (path, subtitle) =>
  isAndroid
    ? 'vlc://' + asURL(path)
    : isIOS
    ? `vlc-x-callback://x-callback-url/stream?url=${encodeURIAll(
        asURL(path)
      )}${subtitle ? `&sub=${encodeURIAll(asURL(subtitle))}` : ''}`
    : asURL(path);

const getSubtitle = (library, item) =>
  ('show' in item.meta
    ? library.filter(
        (x) =>
          x.type.includes('subtitle') &&
          x.meta.show === item.meta.show &&
          x.meta.season === item.meta.season &&
          x.meta.episode === item.meta.episode
      )
    : library.filter(
        (x) => x.type.includes('subtitle') && x.meta.title === item.meta.title
      )
  )
    .sort((a, b) => ([a, null, b].findIndex((x) => x === 'en') + 1 || 2) - 2)
    .map((x) => encodeURI(x.path))[0];

const File = ({ name, path, subtitle }) =>
  html`
    <a
      className="nodefault"
      href=${path.match(/\.(mkv|webm|mp4|m4v)$/)
        ? asPlayableURL(path, subtitle)
        : path}
      >${isMobile ? name.replace(/\.[a-z0-9]+$/, '') : name}</a
    >
  `;

const Directory = ({ name, path }) =>
  html`
    <${Link} to=${path}>
      <a
        className="nodefault"
        style=${{ backgroundImage: `url(${path}/folder.jpg)` }}
      >
        <span>${name}</span>
      </a>
    <//>
  `;

const Chrome = ({ name, children }) =>
  html`
    <${Fragment}>
      <header>
        ${location.hash &&
        html`
          <a className="nodefault" onClick=${() => history.back()}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 10">
              <polyline
                points="4,2 1,5 4,8"
                stroke="blue"
                stroke-linecap="round"
                fill="none"
              />
            </svg>
          </a>
        `}
        <span>${name}</span>
      </header>
      <main>${children}</main>
    <//>
  `;

const App = (props) => {
  const [library, setLibrary] = useState([]);
  useEffect(
    () =>
      fetch(asURL('.ump-library.json'))
        .then((x) => x.json())
        .then((x) => setLibrary(x.items)),
    []
  );
  //replace this mess with https://github.com/molefrog/wouter
  return html`
    <${Switch}>
      <${Route} path="/Series">
        ${() =>
          html`
            <${Chrome} name="Series">
              <div id="directories">
                ${library
                  .filter((x) => x.type.includes('video') && 'show' in x.meta)
                  .reduce(
                    (a, n) =>
                      a.includes(n.meta.show) ? a : [...a, n.meta.show],
                    []
                  )
                  .sort((a, b) => a.localeCompare(b))
                  .map(
                    (x) =>
                      html`
                        <${Directory}
                          name=${x}
                          path=${'/Series/' + encodeURIAll(x)}
                        />
                      `
                  )}
              </div>
            <//>
          `}
      <//>
      <${Route} path="/Series/:name+">
        ${({ name }) =>
          html`<${Chrome} name=${decodeURIComponent(name)}>
            <div id="files">
              ${library
                .filter(
                  (x) =>
                    'show' in x.meta &&
                    x.type.includes('video') &&
                    x.meta.show == decodeURIComponent(name)
                )
                .sort(
                  (a, b) =>
                    a.meta.season.localeCompare(b.meta.season) ||
                    a.meta.episode.localeCompare(b.meta.episode)
                )
                .map(
                  (x) =>
                    html`
                      <${File}
                        name=${x.meta.season +
                        '.' +
                        x.meta.episode +
                        ' ' +
                        x.meta.title}
                        path=${encodeURI(x.path)}
                        subtitle=${getSubtitle(library, x)}
                      />
                    `
                )}
            </div>
          <//>`}
      <//>
      <${Route} path="/Films">
        ${({ name }) =>
          html`<${Chrome} name="Films">
            <div id="files">
              ${library
                .filter(
                  (x) =>
                    x.type.length == 1 &&
                    x.type[0] === 'video' &&
                    !('show' in x.meta) &&
                    'title' in x.meta
                )
                .sort((a, b) => a.meta.title.localeCompare(b.meta.title))
                .map(
                  (x) =>
                    html`
                      <${File}
                        name=${x.meta.title}
                        path=${encodeURI(x.path)}
                        subtitle=${getSubtitle(library, x)}
                      />
                    `
                )}
            </div>
          <//>`}
      <//>
      <${Route}>
        ${() =>
          html`
            <${Chrome} name="Netnix">
              <div id="directories">
                <${Directory} name="Series" path="/Series" />
                <${Directory} name="Films" path="/Films" />
              </div>
              ${isMobile &&
              html`
                <p>
                  You will need VLC player installed on your phone to actually
                  play the video files on this server. You can download it at
                  the${' '}
                  <a href=${playerAppURL}
                    >${isIOS ? 'App Store' : 'Play Store'}</a
                  >
                </p>
              `}
            <//>
          `}
      <//>
    <//>
  `;
};

render(html`<${Router} hook=${useHashLocation}><${App} /><//>`, document.body);
