#!/usr/bin/env sh
#ump_library_jq - perform query on media library

jq_escape_string() { #1: string
    echo "$1" | sed 's/\\/\\&/g;s/"/\\"/g'
}

jq_escape_regex() { #1: string
    echo "$1" | sed 's/[][{}()\\.$^*+?]/\\\\&/g;s/"/\\"/g'
}

ump_include_library() { #1 root
    curl -fs "${1%%/.ump-library.json}/.ump-library.json" \
        | jq '.root = "'"${1%%/.ump-library.json}/"'"'
}

ump_library_jq() {
    { for x in $UMP_LIBRARIES; do ump_include_library "$x"; done; } \
        | jq -rs '
            map(
                .root as $root | .items |=
                    (if ($root | test("^file:")) then
                        map(. + { url: ($root[5:] + .path)})
                    else
                        map(. + { url: ($root + (.path | @uri))})
                    end)
            )
                | reduce .[].items as $x ([]; . + $x)
                | unique_by(.path)
                '"${1+| $1}"'
        '
}
