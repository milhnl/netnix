import {
  useEffect,
  useMemo,
  useContext,
  Dispatch,
  StateUpdater,
} from "preact/hooks";
import { Switch, Link, Route, useLocation } from "wouter-preact";
import { Item } from "./types.ts";
import { playNow } from "./playState.ts";
import { LibraryContext, StateContext } from "./context.ts";
import { fileContainerClass, ItemContainer } from "./ui.tsx";

const fileTreeAtom: unique symbol = Symbol();

interface FileTree {
  [key: string]: Item | FileTree;
  [fileTreeAtom]: unknown;
}

const isFileTree = (x: object): x is FileTree => fileTreeAtom in x;

export const FilesOverview = ({
  setUiName,
}: {
  setUiName: Dispatch<StateUpdater<string>>;
}) => {
  useEffect(() => setUiName("File explorer"), []);
  const [location] = useLocation();
  const currentPath = location.split("/").filter((x) => x !== "");
  const library = useContext(LibraryContext);
  const [, setState] = useContext(StateContext);
  const tree = useMemo(
    () =>
      library.reduce((tree, item) => {
        const components = item.path.split("/");
        const basename = components.pop()!;
        const where = components.reduce<FileTree>((a, n) => {
          if (!(n in a)) a[n] = { [fileTreeAtom]: null };
          return a[n] as FileTree;
        }, tree);
        where[basename] = item;
        return tree;
      }, {} as FileTree),
    [library],
  );
  const currentTree = currentPath.reduce<FileTree>(
    (a, n) => a[n] as FileTree,
    tree,
  );
  return (
    <main className={fileContainerClass}>
      {currentTree
        ? (currentPath.length > 0
            ? [
                <ItemContainer key="..">
                  <Link to={"/" + currentPath.slice(0, -1).join("/")}>..</Link>
                </ItemContainer>,
              ]
            : []
          ).concat(
            Object.entries(currentTree)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([path, item]) =>
                isFileTree(item) ? (
                  <ItemContainer>
                    <Link to={`/${currentPath.join("/")}/${path}`}>
                      {path + "/"}
                    </Link>
                  </ItemContainer>
                ) : (
                  <ItemContainer>
                    <a
                      class="grow"
                      onClick={() => setState(playNow(library, item))}
                    >
                      {path}
                    </a>
                  </ItemContainer>
                ),
              ),
          )
        : "Empty..."}
    </main>
  );
};

export const FileViewRoutes = ({
  setUiName,
}: {
  setUiName: Dispatch<StateUpdater<string>>;
}) => (
  <Switch>
    <Route path="*">{() => <FilesOverview setUiName={setUiName} />}</Route>
  </Switch>
);
