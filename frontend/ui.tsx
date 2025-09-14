import { Fragment, FunctionComponent as FC, h } from "preact";
import { css, styled } from "goober";
import { Link } from "wouter-preact";

export const directoryContainerClass = css`
  @media (min-width: 1000px) {
    --item-size: 20vw;
  }
  @media (max-width: 1000px) {
    --item-size: 25vw;
  }
  @media (max-width: 800px) {
    --item-size: 33.33vw;
  }
  @media (max-width: 600px) {
    --item-size: 50vw;
  }
  @media (max-width: 200px) {
    --item-size: 100vw;
  }
  display: flex;
  flex-wrap: wrap;
  & > * {
    cursor: pointer;
    width: var(--item-size);
    height: var(--item-size);
    background-color: rgba(128, 128, 128, 0.1);
    background-size: cover;
    background-position: center;
    display: grid;
    align-items: end;
    justify-items: stretch;
  }
  & > * > span {
    padding: 0.2em 0.5em;
    background-color: rgba(0, 0, 0, 0.75);
    text-align: center;
  }
  @media (prefers-color-scheme: light) {
    & > * > span {
      color: white;
    }
  }
  a.nodefault {
    font-size: 1.8rem;
    line-height: 1.3;
    color: inherit;
    text-decoration: none;
  }
`;

export const Directory = ({
  name,
  path,
  bg,
}: {
  name: string;
  path: string;
  bg?: string | undefined;
}) => (
  <Link
    to={path}
    className="nodefault"
    style={bg && { backgroundImage: `url(${bg})` }}
  >
    <span>{name}</span>
  </Link>
);

export const fileContainerClass = css`
  display: flex;
  flex-direction: column;
  & > *:nth-child(even) {
    background-color: rgba(128, 128, 128, 0.1);
  }
`;

export const ItemContainer = styled("div")`
  display: flex;
  height: 4.2rem;
  & > * {
    padding: 0.5rem 1rem;
    font-size: 1.8rem;
    line-height: 3.2rem;
    color: inherit;
    text-decoration: none;
  }
  & > .square {
    box-sizing: border-box;
    width: 4.2rem;
    color: rgba(128, 128, 128, 0.3);
    text-align: right;
  }
  & > img.square {
    padding: 0;
  }
  & > .grow {
    flex-grow: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const Header = styled("header")`
  display: flex;
  flex-direction: row;
  min-height: var(--header-height);
  vertical-align: middle;
  background-color: var(--header-color);
  font-size: calc(var(--header-height) * 0.5);
  padding: 0 var(--header-height);
  @supports (-webkit-touch-callout: none) {
    position: sticky;
    top: 0;
    left: 0;
  }
  & > span {
    flex: 1;
    text-align: center;
    line-height: var(--header-height);
  }
`;

const HeaderLink = styled("a")`
  position: absolute;
  left: 0;
  display: block;
  flex: 0 var(--header-height);
  line-height: var(--header-height);
  height: var(--header-height);
  width: var(--header-height);
  font-size: calc(var(--header-height) * 0.7);
  text-align: center;
  & > svg {
    display: inline-block;
    vertical-align: middle;
    height: 75%;
  }
`;

export const Chrome: FC<{ name: string }> = ({ name, children }) => (
  <>
    <Header>
      {location.hash && (
        <HeaderLink onClick={() => history.back()}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 10">
            <polyline
              points="4,2 1,5 4,8"
              stroke="blue"
              stroke-linecap="round"
              fill="none"
            />
          </svg>
        </HeaderLink>
      )}
      <span>{name}</span>
    </Header>
    {children}
  </>
);
