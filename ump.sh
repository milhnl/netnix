#!/usr/bin/env sh
#ump - universal media player
set -eu

. ./ump_library_jq.sh

# COMMON ----------------------------------------------------------------------
daemon() ( exec nohup "$@" >/dev/null 2>&1 & )
die() { printf '%s\n' "$*" >&2; exit 1; }
exists() { command -v "$1" >/dev/null 2>&1; }
fixed_as_regex() { echo "$1" | sed 's_[]$^*[\./]_\\&_g'; }
fnmatch() { case "$2" in $1) return 0 ;; *) return 1 ;; esac ; }
to_argv() { while read -r LINE; do set -- "$@" "$LINE"; done; "$@"; }
in_dir() ( cd "$1"; shift; "$@"; )

# PROVIDER: APPLE MUSIC -------------------------------------------------------
ump_applemusic() {
    case "$1" in
    now)
        shift
        artist="$1" title="$2" osascript -e '
            tell application "Music"
                set results to (every track ¬
                    whose name contains (do shell script "echo \"$title\"") ¬
                    and artist contains (do shell script "echo \"$artist\""))
                play item 1 of results
            end tell'
        ;;
    toggle) osascript -e 'tell application "Music" to playpause';;
    prev) osascript -e 'tell application "Music" to previous track';;
    next) osascript -e 'tell application "Music" to next track';;
    current)
        osascript -e '
            tell application "Music"
                copy (artist of current track) & " - " ¬
                    & (name of current track) to stdout
            end tell'
        ;;
    *) die 'Error: unsupported operation';;
    esac
}

# PROVIDER: YOUTUBE -----------------------------------------------------------
mpv_ensure_running() {
    if ! exists ump_youtube_tell_mpv; then
        if exists socat; then
            ump_youtube_tell_mpv() { socat - "$MPV_SOCKET" 2>/dev/null; }
        elif exists nc && [ "$(uname -s)" = Darwin ]; then
            ump_youtube_tell_mpv() { nc -U "$MPV_SOCKET"; }
        else
            die "Error: socat (or netcat with unix pipes) is not installed"
        fi
    fi
    if ! mpv_command get_version >/dev/null 2>&1; then
        exists mpv || die "Error: mpv is not installed"
        daemon mpv --idle --input-ipc-server="$MPV_SOCKET"
        until mpv_command get_version >/dev/null 2>&1; do sleep 1; done
    fi
}

as_mpv_command() {
    printf '{ "command": ['
    for x; do printf '%s' "$x" | sed 's/"/\\"/g;s/^/"/;s/$/",/'; done
    echo ']}'
}

mpv_ipc_response_jq() {
    jq -sr '
        if . == [] then
            "Error: could not connect to socket.\n" | halt_error
        elif .[0].error != "success" then
            "Error: \(.[0].error)\n" | halt_error
        else
            .[0].data'"${1:+ | $1}"'
        end'
}

mpv_command() {
    as_mpv_command "$@" | ump_youtube_tell_mpv \
        | mpv_ipc_response_jq 'if . == null then empty else . end'
}

ump_youtube_find_ext() {
    if [ -e "$1.mkv" ]; then
        echo "$1.mkv"
    elif [ -e "$1.webm" ]; then
        echo "$1.webm"
    elif [ -e "$1.mp4" ]; then
        echo "$1.mp4"
    else
        return 1
    fi
}

ump_youtube_video_name() { #1:json
    set -- "$1" "$(<"$1" jq -r '(.artist + env.SEP + .track)')"
    case "$2" in
    \ -\ |*\ -\ |\ -\ *) <"$1" jq -r .title | yt_title_clean;;
    *) echo "$2";;
    esac | if exists ump-title-clean; then ump-title-clean; else cat; fi
}

ump_youtube_move_file() { #1:file 2:json
    set -- "$1" "$2" \
        "$(ump_youtube_video_name "$2" | sed 's_ \{0,1\}/ \{0,1\}_ - _g')"
    set -- "$1" "$2" \
        "$UMP_DOWNLOADS/$3.${1##*.}" "$UMP_DOWNLOADS/.$3.info.json"
    [ "$1" = "$3" ] || mv "$1" "$3" >&2
    [ "$2" = "$4" ] || mv "$2" "$4" >&2
    echo "$3"
}

ump_organise_files() {
    for json in "$UMP_DOWNLOADS"/.*.info.json; do
        video="$(ump_youtube_find_ext "$(dirname "$json")/$(basename "$json" \
            | sed 's/^\.//;s/\.info\.json$//')")" || { rm "$json"; continue; }
        ump_youtube_move_file "$video" "$json"
    done
    for trash in "$UMP_DOWNLOADS"/.ytdl-tmp-*; do
        [ "$trash" != "$UMP_DOWNLOADS/.ytdl-tmp-*" ] || continue
        rm "$trash"
    done
    cat "$UMP_DOWNLOADS"/.*.json \
        | jq -r '(.extractor + " " + .id)' \
        >"$UMP_DOWNLOADS/.ytdl-archive"
    ump_update_library
}

ump_get_json_for() {
    path="$(echo "$1" | sed 's_^./__;s/"/\\"/g')"
    case "$1" in
    *.aac|*.flac|*.mp3|*.wav) type='music';;
    *.avi|*.m4v|*.mkv|*.mp4|*.mpg|*.webm)
        case "$PWD/$1" in
        */[Mm]usic/*) type='music","video';;
        *) [ "$PWD" = "$UMP_DOWNLOADS" ] \
            && type='music","video' || type='video';;
        esac;;
    *) type='unknown';;
    esac
    case "$type" in
    *music*)
        case "$1" in
        *.flac)
            meta="$(metaflac --export-tags-to=- "$1" | awk '
                BEGIN { out = ""; }
                /=/ {
                    eq = index($0, "=")
                    field = tolower(substr($0, 1, eq - 1))
                    value = substr($0, eq + 1)
                    gsub("\"", "\\\"", value)
                    gsub("[^[:print:]]", "", value)
                    out = out sprintf("\"%s\":\"%s\",", field, value)
                }
                END { printf("{%s}", substr(out, 1, length(out) - 1)); }
            ')";;#"'
        *.mp3)
            meta="$(mid3v2 -l "$1" | awk -vFS== '
                BEGIN {
                    map["TPE1"] = "ALBUMARTIST"
                    map["TPE2"] = "ARTIST"
                    map["TALB"] = "ALBUM"
                    map["TYER"] = "DATE"
                    map["TDRC"] = "DATE"
                    map["TCON"] = "GENRE"
                    map["TRCK"] = "TRACKNUMBER"
                    map["TIT2"] = "TITLE"
                    out = ""
                }
                /^[0-9A-Z][0-9A-Z][0-9A-Z][0-9A-Z]=/ {
                    field = tolower(map[$1])
                    value = substr($0, index($0, "=") + 1)
                    gsub("\"", "\\\"", value)
                    gsub("[^[:print:]]", "", value)
                    if (field != "")
                        out = out sprintf("\"%s\":\"%s\",", field, value)
                }
                END { printf("{%s}", substr(out, 1, length(out) - 1)); }
            ')";;#"'
        *.aac|*.wav)
            meta='{}';;
        *.mkv|*.mp4|*.webm)
            meta=''
            info="$(echo "$1" \
                | sed 's_^\(.*/\)\([^/]*\)\.[^/.]*$_\1.\2.info.json_')"
            if [ -e "$info" ]; then
                if ! meta="$(<"$info" jq -c '{
                            artist: (.artist // ("" | halt_error(1))),
                            title: (.track // ("" | halt_error(1))),
                            album
                        }')"; then
                    full="$(<"$info" jq -rc '.title // ""')"
                fi
            fi
            if [ -z "$meta" ]; then
                if [ -z "$full" ]; then
                    full="$(echo "$1" | sed 's_.*/__;s/\.[^.]*$//')"
                fi
                full="$(echo "$full" | yt_title_clean | sed 's/"/\\"/g')"
                if [ ._. = "$(echo "$full" \
                        | sed 's/_//g;s/ - /_/g;s/[^_]*/./g')" ]; then
                    meta='{"artist":"'"${full% - *}`
                        `"'","title":"'"${full#* - }"'"}'
                else
                    meta='{}'
                fi
            fi;;
        *) meta='{}';;
        esac;;
    video)
        case "$PWD/$1" in
        */Films/*|*/Movies/*)
            title="${path#*/}"; title="${title%.*}"
            meta='{ "title": "'"$title"'" }';;
        */Series/*|*/TV/*)
            show="${path#*/}"; show="${show%%/*}"
            number="$(echo "$path" | sed '
                /[0-9][0-9]x[0-9][0-9]/{
                    s/.*\([0-9][0-9]\)x\([0-9][0-9]\).*/\1.\2/p
                }
                /[sS][0-9][0-9][eE][0-9][0-9]/{
                    s/.*\([0-9][0-9]\)[eE]\([0-9][0-9]\)[-eE]\{0,2\}'`
                        `'\([0-9][0-9]\)\{0,1\}.*/\1.\2-\3/
                    s/-$//
                }
                /[0-9]\{2,3\}\.[0-9]\{2,3\}\(-[0-9]\{2,3\}\)\{0,1\}/{
                    s/.*\([0-9]\{2,3\}\.[0-9]\{2,3\}\(-[0-9]'`
                        `'\{2,3\}\)\{0,1\}\).*/\1/p
                }
                d
                ')"
            season="${number%%.*}"
            episode="${number#*.}"
            title="${path##*/}"; title="${title#* }"; title="${title%.*}"
            meta='{"show":"'"$show"'","title":"'"$title"'","season":"'"$season`
                `"'","episode":"'"$episode"'"}';;
        *) meta='{}';;
        esac;;
    esac
    echo '{"path":"'"$path"'","type":["'"$type"'"],"meta":'"$meta"'}'
}

ump_update_library() (
    cd "${1-$UMP_DOWNLOADS}"
    find . \( \
            -name '*.mkv' \
            -o -name '*.webm' \
            -o -name '*.mp4' \
            -o -name '*.playlist' \
            -o -name '*.aac' \
            -o -name '*.flac' \
            -o -name '*.mp3' \
            -o -name '*.wav' \
        \) -exec ump exec ump_get_json_for {} \; \
        | jq -sc '{ version: 0, items: . }' \
        >".ump-library.json"
)

ump_music_jq() {
    ump_library_jq 'map(select(.type[] | contains("music")))
        '"${1+| $1}"''
}

hash() {
    python -c \
        'import sys;'`
        `'from hashlib import sha256;'`
        `'print(sha256(sys.argv[2].encode("utf-8")).hexdigest())' -- "$1"
}

ump_youtube_download() {
    set -- "$*" "$(hash "$*")"
    mkdir -p "$UMP_DOWNLOADS"
    youtube-dl --default-search ytsearch \
        --download-archive "$UMP_DOWNLOADS/.ytdl-archive" \
        --write-info-json --add-metadata \
        -o "$UMP_DOWNLOADS/.ytdl-tmp-$2-%(autonumber)s.%(ext)s" "$1" >&2
    for json in "$UMP_DOWNLOADS/.ytdl-tmp-$2"-*.info.json; do
        video="$(ump_youtube_find_ext "${json%%.info.json}")" || return 1
        ump_youtube_move_file "$video" "$json"
    done
}

ump_youtube_find_by_name() {
    if [ $# -eq 1 ] && fnmatch "*$SEP*" "$1"; then
        artist="${1%$SEP*}" title="${1#*$SEP}" ump_music_jq 'first(.[]
            | select(.meta.artist == env.artist and .meta.title == env.title))
            | .url'
    else
        ump_music_jq '.[]
            | select(.path | test("'".*$( \
                for x; do jq_escape_regex "$x"; echo '.*'; done | tr -d '\n' \
            )"'"; "i")) | .url' | sort
    fi
}

ump_youtube_cached() {
    set -- "$(ump_youtube_find_by_name "$@")"
    case "$1" in
    "") return 1;;
    *.mkv|*.mp4|*.webm) echo "$1";;
    *.aac|*.flac|*.mp3|*.wav) echo "$1";;
    *.playlist)
        while read -r LINE; do
            ump_youtube_cached "$LINE" || ump_youtube_download "$LINE" ||:
        done <"$1";;
    *) die "ERROR: $1"; return 1;;
    esac
}

ump_youtube_ui() {
    ump_music_jq '
            .[] | if (.meta | has("artist")) and (.meta | has("title")) and
                        .meta.artist != null and .meta.title != null then
                    .meta.artist + env.SEP + .meta.title
                else
                    .path
                end
        ' \
        | shuf \
        | fzy
}

ump_youtube_now() {
    [ "$#" -ne 0 ] || set -- "$(ump_youtube_ui)"; [ -n "$1" ] || return 1
    {
        ump_youtube_cached "$@" || case "$*" in
            http*) echo "$*";;
            *) echo "ytdl://ytsearch:$*";;
        esac
    } | while read -r LINE; do
            mpv_command loadfile "$LINE" replace
        done
}

ump_youtube_add() {
    [ "$#" -ne 0 ] || set -- "$(ump_youtube_ui)"; [ -n "$1" ] || return 1
    ( ump_youtube_cached "$@" || ump_youtube_download "$@"; ) \
        | while read -r LINE; do
            mpv_command loadfile "$LINE" append-play
        done
}

ump_youtube_current() {
    as_mpv_command get_property metadata \
            | ump_youtube_tell_mpv \
            | mpv_ipc_response_jq \
                '(.ARTIST // .artist // ("" | halt_error(1))) +
                    env.SEP + (.TITLE // .title)' \
        || mpv_command get_property media-title | sed 's/\.[^.]*$//'
}

ump_youtube() {
    export SEP="${UMP_SEP- — }"
    MPV_SOCKET="${MPV_SOCKET:-$XDG_RUNTIME_DIR/ump_mpv_socket}"
    UMP_DOWNLOADS="${UMP_DOWNLOADS-${XDG_CACHE_HOME-$HOME/.cache}/ump/yt-lib}"
    [ "$1" = exec ] || mpv_ensure_running
    case "$1" in
    now) shift; ump_youtube_now "$@";;
    add) shift; ump_youtube_add "$@";;
    toggle) mpv_command cycle pause;;
    prev) shift; mpv_command playlist_prev;;
    next) shift; mpv_command playlist_next;;
    current) ump_youtube_current;;
    exec) shift; "$@";;
    rsync) shift; in_dir "$UMP_DOWNLOADS" rsync --progress -rh \
        --exclude '*/' --include '*.mp4' --include '*.mkv' --include '*.webm' \
        --include '.*.info.json' "$@";;
    *) die 'Error: unsupported operation';;
    esac
}

ump() {
    ump_youtube "$@"
}

ump "$@"
