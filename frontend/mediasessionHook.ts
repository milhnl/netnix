import { useRef, useEffect } from "preact/hooks";
type ActionHandlers = {
  [K in MediaSessionAction]?: MediaSessionActionHandler;
};
export const useActionHandlers = (actionHandlers: ActionHandlers) => {
  const actionHandlersRef = useRef<ActionHandlers>({});
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    (
      Object.entries(
        Object.assign(
          {},
          Object.fromEntries(
            Object.keys(actionHandlersRef.current).map((action) => [
              action,
              null,
            ]),
          ),
          actionHandlers,
        ),
      ) as [keyof ActionHandlers, ActionHandlers[keyof ActionHandlers]][]
    ).forEach(([action, handler]) => {
      if (actionHandlersRef.current[action] !== actionHandlers[action]) {
        //Could be called a lot if you're not careful, so log for now
        console.log(
          `${handler ? "R" : "Unr"}egistering handler for ${action}`,
        );
        try {
          navigator.mediaSession.setActionHandler(action, handler ?? null);
        } catch {
          //May be unsupported, which isn't very interesting
        }
      }
    });
  }, [actionHandlers]);
};
