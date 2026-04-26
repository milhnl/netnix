#!/usr/bin/env sh
#tv - watch series
set -eu

. ./ump_library_jq.sh

fnmatch() { case "$2" in $1) return 0 ;; *) return 1 ;; esac }

tv() {
    recently_watched="$(mktemp)"
    XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
    NETNIX_LOCAL_ROOT="${NETNIX_LOCAL_ROOT-$XDG_DATA_HOME/netnix/library}"
    if ! fnmatch "/*" "${NETNIX_LOCAL_ROOT_SERIES-}"; then
        NETNIX_LOCAL_ROOT_SERIES="$NETNIX_LOCAL_ROOT/$(
        )${NETNIX_LOCAL_ROOT_SERIES-Series}"
    fi
    NETNIX_LIBRARIES="file://$NETNIX_LOCAL_ROOT_SERIES$(
    )${NETNIX_LIBRARIES+ $NETNIX_LIBRARIES}"

    mkdir -p "$XDG_DATA_HOME/netnix/watched-series"
    ls -1t "$XDG_DATA_HOME/netnix/watched-series" \
        | printf "$(printf "%s" "$(cat)" | sed 's/%/\\x/g')\n" \
            >"$recently_watched"
    set -- "$(ump_library_jq '
            map(select((.mime | startswith("video")) and (.meta | has("show")))
                | .meta.show) | unique | .[]' \
        | cat "$recently_watched" - \
        | awk '!_[$0]++' \
        | fzy)"
    rm "$recently_watched"
    [ -n "$1" ] || exit 1
    ump_library_jq \
        'map(select((.meta | has("show")) and (.mime | startswith("video"))
                and .meta.show == "'"$(jq_escape_string "$1")"'"))
            | .[] | .url' \
        >"$XDG_DATA_HOME/netnix/watched-series/$(echo "$1" | jq -rR @uri)"
    mpv --playlist="$XDG_DATA_HOME/netnix/watched-series/$(
        echo "$1" | jq -rR @uri
    )"
}
tv "$@"
