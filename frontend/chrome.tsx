import { styled } from "./deps/goober.ts";
import { Fragment, FunctionComponent as FC, h } from "./deps/preact.ts";

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

export const Chrome: FC<{ name: string; className?: string }> = ({
  name,
  className,
  children,
}) => (
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
    <main className={className}>{children}</main>
  </>
);
