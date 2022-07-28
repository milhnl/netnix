#!/usr/bin/env sh
#tv - watch series
set -eu

. ./ump_library_jq.sh

tv() {
    recently_watched="$(mktemp)"
    XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
    UMP_DOWNLOADS="${UMP_DOWNLOADS-$XDG_CACHE_HOME/ump/yt-lib}"
    UMP_LIBRARIES="file:$UMP_DOWNLOADS${UMP_LIBRARIES+ $UMP_LIBRARIES}"
    mkdir -p "$XDG_CACHE_HOME/tv"
    ls -1t "$XDG_CACHE_HOME/tv" \
        | printf "$(printf "%s" "$(cat)" | sed 's/%/\\x/g')\n" \
        >"$recently_watched"
    set -- "$(ump_library_jq '
            map(select((.type[] | contains("video")) and (.meta | has("show")))
                | .meta.show) | unique | .[]' \
        | cat "$recently_watched" - \
        | awk '!_[$0]++' \
        | fzy)"
    rm "$recently_watched"
    [ -n "$1" ] || exit 1
    ump_library_jq \
        'map(select((.type[] | contains("video")) and (.meta | has("show"))
                and .meta.show == "'"$(jq_escape_string "$1")"'"))
            | .[] | .url' \
        >"$XDG_CACHE_HOME/tv/$(echo "$1" | jq -rR @uri)"
    mpv --playlist="$XDG_CACHE_HOME/tv/$(echo "$1" | jq -rR @uri)"
}
tv "$@"
