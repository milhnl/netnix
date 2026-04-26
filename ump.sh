#!/usr/bin/env sh
#ump - universal media player
set -eu

. ./ump_library_jq.sh

# COMMON ----------------------------------------------------------------------
daemon() (exec nohup "$@" >/dev/null 2>&1 &)
die() { if [ "$#" -gt 0 ]; then printf "%s\n" "$*" >&2; fi && exit 1; }
exists() { command -v "$1" >/dev/null 2>&1; }
fixed_as_regex() { echo "$1" | sed 's_[]$^*[\./]_\\&_g'; }
fnmatch() { case "$2" in $1) return 0 ;; *) return 1 ;; esac }
to_argv() { while read -r LINE; do set -- "$@" "$LINE"; done && "$@"; }
in_dir() (cd "$1" && shift && "$@")

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
    toggle) osascript -e 'tell application "Music" to playpause' ;;
    prev) osascript -e 'tell application "Music" to previous track' ;;
    next) osascript -e 'tell application "Music" to next track' ;;
    current)
        osascript -e '
            tell application "Music"
                copy (artist of current track) & " - " ¬
                    & (name of current track) to stdout
            end tell'
        ;;
    *) die 'Error: unsupported operation' ;;
    esac
}

# PROVIDER: YOUTUBE -----------------------------------------------------------
MPV_LUA='
function seek_to_last_chapter()
    local chapters = mp.get_property_number("chapters") or 0
    if chapters ~= 0 then
        mp.commandv("set", "chapter", chapters - 1)
        mp.commandv("script-message", "osc-chapterlist")
    else
        mp.commandv("script-message", "osc-playlist")
    end
    mp.unregister_event(seek_to_last_chapter)
end

function seek(offset)
    local chapter  = mp.get_property_number("chapter") or 0
    local chapters = mp.get_property_number("chapters") or 0
    if chapter + offset < 0 then
        mp.commandv("playlist_prev")
        mp.register_event("file-loaded", seek_to_last_chapter)
    elseif chapter + offset >= chapters then
        mp.commandv("playlist_next")
        mp.commandv("script-message", "osc-playlist")
    else
        mp.commandv("set", "chapter", chapter + offset)
        mp.commandv("script-message", "osc-chapterlist")
    end
end

mp.add_key_binding(nil, "ump-next", function() seek(1) end)
mp.add_key_binding(nil, "ump-prev", function() seek(-1) end)
'

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
        MPV_HOME="${MPV_HOME-${XDG_CONFIG_HOME-$HOME/.config}/mpv}"
        if
            ! echo "$MPV_LUA" | diff - "$MPV_HOME/scripts/ump-ext.lua" \
                >/dev/null 2>&1
        then
            mkdir -p "$MPV_HOME/scripts"
            echo "$MPV_LUA" >"$MPV_HOME/scripts/ump-ext.lua"
        fi
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
        else
            .[] | select(has("error")) |
                if .error != "success" then
                    "Error: \(.error)\n" | halt_error
                else
                    .data'"${1:+ | $1}"'
                end
        end'
}

mpv_command() {
    as_mpv_command "$@" | ump_youtube_tell_mpv \
        | mpv_ipc_response_jq 'if . == null then empty else . end'
}

ump_youtube_video_name() { #1:json
    set -- "$1" "$(<"$1" jq -r '(.artist + env.SEP + .track)')"
    if fnmatch "*?$SEP?*" "$2"; then
        echo "$2"
    else
        <"$1" jq -r .title | yt_title_clean
    fi \
        | sed 's_/_⧸_g' \
        | if exists ump-title-clean; then ump-title-clean; else cat; fi
}

ump_youtube_move_file() { #1:json
    newname="$(ump_youtube_video_name "$1")"
    for x in "$(dirname "$1")/$(
        basename "$1" | sed 's/^\.//;s/\.info\.json$//'
    )".* "${1%.info.json}".*; do
        [ -e "$x" ] || return 1
        ext="${x##*/}"
        ext="${ext#.}"
        oldname="${1##*/.}"
        oldname="${oldname%.info.json}"
        ext="${ext#"$oldname"}"
        dot="${x%"$oldname$ext"}"
        dot="${dot##*/}"
        newfullname="$NETNIX_LOCAL_ROOT_MUSIC/$dot$newname$ext"
        case "$ext" in
        .webm | .mkv | .mp4 | .m4a) printf '%s\n' "$newfullname" ;;
        esac
        [ "$x" = "$newfullname" ] || mv "$x" "$newfullname"
    done
}

ump_organise_files() {
    for json in "$NETNIX_LOCAL_ROOT_MUSIC"/.*.info.json; do
        ump_youtube_move_file "$json" || rm "$json"
    done
    for trash in "$NETNIX_LOCAL_ROOT_MUSIC"/.ytdl-tmp-*; do
        [ "$trash" != "$NETNIX_LOCAL_ROOT_MUSIC/.ytdl-tmp-*" ] || continue
        rm "$trash"
    done
    cat "$NETNIX_LOCAL_ROOT_MUSIC"/.*.json \
        | jq -r '(.extractor + " " + .id)' \
            >"$NETNIX_LOCAL_ROOT_MUSIC/.ytdl-archive"
    ump_update_library
}

ump_get_type_for() {
    case "$PWD/$1" in
    */[Mm]usic/*) echo 'music' ;;
    *) [ "$PWD" = "$NETNIX_LOCAL_ROOT_MUSIC" ] && echo 'music' || echo 'video' ;;
    esac
}

ump_get_json_for() {
    path="$(echo "$1" | sed 's_^./__;s/"/\\"/g')" #'
    case "$1" in
    *.aac) type='music' && mime='audio/aac' ;;
    *.flac) type='music' && mime='audio/flac' ;;
    *.mp3) type='music' && mime='audio/mpeg' ;;
    *.m4a) type='music' && mime='audio/mp4' ;;
    *.wav) type='music' && mime='audio/wav' ;;
    *.avi) type="$(ump_get_type_for "$1")" && mime='video/avi' ;;
    *.m4v) type="$(ump_get_type_for "$1")" && mime='video/x-m4v' ;;
    *.mkv) type="$(ump_get_type_for "$1")" && mime='video/matroska' ;;
    *.mp4) type="$(ump_get_type_for "$1")" && mime='video/mp4' ;;
    *.webm) type="$(ump_get_type_for "$1")" && mime='video/webm' ;;
    *.srt) type='subtitle' && mime='application/x-subrip' ;;
    *) type='unknown' && mime='application/octet-stream' ;;
    esac
    case "$type" in
    music)
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
            ')"
            ;;
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
            ')"
            ;;
        *.aac | *.wav) meta='{}' ;;
        *.mkv | *.mp4 | *.webm | *.m4a)
            meta=''
            full=''
            info="$(echo "$1" \
                | sed 's_^\(.*/\)\([^/]*\)\.[^/.]*$_\1.\2.info.json_')"
            if [ -e "$info" ]; then
                if
                    ! meta="$(<"$info" jq -c '{
                            artist: (.artist // ("" | halt_error(1))),
                            title: (.track // ("" | halt_error(1))),
                            album
                        }')"
                then
                    full="$(<"$info" jq -rc '.title // ""')"
                fi
            fi
            if [ -z "$meta" ]; then
                if [ -z "$full" ]; then
                    full="$(echo "$1" | sed 's_.*/__;s/\.[^.]*$//')"
                fi
                full="$(echo "$full" | yt_title_clean | sed 's/"/\\"/g')" #'
                if
                    [ ._. = "$(
                        echo "$full" | sed 's/_//g;s/ - /_/g;s/[^_]*/./g'
                    )" ]
                then
                    meta='{"artist":"'"${full% - *}$(
                    )"'","title":"'"${full#* - }"'"}'
                else
                    meta='{}'
                fi
            fi
            ;;
        *) meta='{}' ;;
        esac
        ;;
    video | subtitle)
        case "$PWD/$1" in
        */Films/* | */Movies/*)
            title="${path#*/}"
            title="${title%.*}"
            meta='{"title":"'"$title"'"}'
            ;;
        */Series/* | */TV/*)
            show="${path#*/}"
            show="${show%%/*}"
            number="$(echo "$path" | sed '
                /[0-9][0-9]x[0-9][0-9]/{
                    s/.*\([0-9][0-9]\)x\([0-9][0-9]\).*/\1.\2/p
                }
                /[sS][0-9][0-9][eE][0-9][0-9]/{
                    s/.*\([0-9][0-9]\)[eE]\([0-9][0-9]\)[-eE]\{0,2\}'$(
            )'\([0-9][0-9]\)\{0,1\}.*/\1.\2-\3/
                    s/-$//
                }
                /[0-9]\{2,3\}\.[0-9]\{2,3\}\(-[0-9]\{2,3\}\)\{0,1\}/{
                    s/.*\([0-9]\{2,3\}\.[0-9]\{2,3\}\(-[0-9]'$(
            )'\{2,3\}\)\{0,1\}\).*/\1/p
                }
                d
                ')"
            season="${number%%.*}"
            episode="${number#*.}"
            title="${path##*/}"
            title="${title#* }"
            title="${title%.*}"
            meta='{"show":"'"$show"'","title":"'"$title"'","season":"'"$(
            )$season"'","episode":"'"$episode"'"}'
            ;;
        *) meta='{}' ;;
        esac
        ;;
    esac
    echo '{"path":"'"$path"'","mime":"'"$mime"'","meta":'"$meta"'}'
}

ump_update_library() (
    cd "${1-$NETNIX_LOCAL_ROOT_MUSIC}"
    find . \( \
        -name '*.mkv' \
        -o -name '*.webm' \
        -o -name '*.mp4' \
        -o -name '*.m4a' \
        -o -name '*.playlist' \
        -o -name '*.aac' \
        -o -name '*.flac' \
        -o -name '*.mp3' \
        -o -name '*.wav' \
        \) -exec ump exec ump_get_json_for {} \; \
        | jq -sc '{ version: 0, items: . }' \
            >".ump-library.new.json" \
        && mv ".ump-library.new.json" ".ump-library.json"
)

ump_music_jq() {
    ump_library_jq 'map(select((.meta | has("artist")) and (
        (.mime | startswith("video")) or
        (.mime | startswith("audio"))
    ))) '"${1+| $1}"''
}

hash() {
    python3 -c \
        'import sys;'$(
        )'from hashlib import sha256;'$(
        )'print(sha256(sys.argv[2].encode("utf-8")).hexdigest())' -- "$1"
}

ump_youtube_download() {
    set -- "$*" "$(hash "$*")"
    [ -n "$2" ] || set "$1" "$(
        LC_ALL=C </dev/urandom tr -dc "[:alnum:]" | head -c 32
    )"
    mkdir -p "$NETNIX_LOCAL_ROOT_MUSIC/$2"
    yt-dlp \
        --abort-on-unavailable-fragment --fragment-retries=20 \
        --default-search ytsearch \
        --download-archive "$NETNIX_LOCAL_ROOT_MUSIC/.ytdl-archive" \
        --write-info-json --write-thumbnail --add-metadata \
        -P "$NETNIX_LOCAL_ROOT_MUSIC/$2" \
        -o "infojson:.%(fulltitle)s.%(ext)s" \
        -o "thumbnail:.%(fulltitle)s.%(ext)s" \
        -o "%(fulltitle)s.%(ext)s" "$1" >&2
    for json in "$NETNIX_LOCAL_ROOT_MUSIC/$2"/.*.info.json; do
        ump_youtube_move_file "$json" || die "Downloading went wrong"
    done
    rm -rf "${NETNIX_LOCAL_ROOT_MUSIC:?}/$2"
}

ump_youtube_find_by_name() {
    if [ $# -eq 1 ] && fnmatch "*$SEP*" "$1"; then
        artist="${1%$SEP*}" title="${1#*$SEP}" ump_music_jq 'first(.[]
            | select(.meta.artist == env.artist and .meta.title == env.title))
            | .url'
    else
        ump_music_jq '.[]
            | select(.path | test("'".*$(
            for x; do
                jq_escape_regex "$x"
                echo '.*'
            done | tr -d '\n'
        )"'"; "i")) | .url' | sort
    fi
}

ump_youtube_cached() {
    set -- "$(ump_youtube_find_by_name "$@")"
    case "$1" in
    "") return 1 ;;
    *.mkv | *.mp4 | *.webm | *.m4a) echo "$1" ;;
    *.aac | *.flac | *.mp3 | *.wav) echo "$1" ;;
    *.playlist)
        while read -r LINE; do
            ump_youtube_cached "$LINE" || ump_youtube_download "$LINE" || :
        done <"$1"
        ;;
    *) die "ERROR: $1" ;;
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
        | { if exists shuf; then shuf; else sort -R; fi; } \
        | fzy
}

ump_youtube_now() {
    [ "$#" -ne 0 ] || set -- "$(ump_youtube_ui)"
    [ -n "$1" ] || return 1
    {
        ump_youtube_cached "$@" || case "$*" in
        http*) echo "$*" ;;
        *) echo "ytdl://ytsearch:$*" ;;
        esac
    } | while read -r LINE; do
        mpv_command loadfile "$LINE" replace
    done
}

ump_youtube_add() {
    [ "$#" -ne 0 ] || set -- "$(ump_youtube_ui)"
    [ -n "$1" ] || return 1
    (ump_youtube_cached "$@" || ump_youtube_download "$@") \
        | while read -r LINE; do
            mpv_command loadfile "$LINE" append-play
        done
}

ump_youtube_current() {
    mpv_command get_property chapter-metadata/title 2>/dev/null \
        || as_mpv_command get_property metadata \
        | ump_youtube_tell_mpv \
            | mpv_ipc_response_jq \
                '(.ARTIST // .artist // ("" | halt_error(1))) +
                    env.SEP + (.TITLE // .title)' 2>/dev/null \
        || mpv_command get_property media-title | sed 's/\.[^.]*$//'
}

ump_youtube() {
    export SEP="${UMP_SEP- – }"
    MPV_SOCKET="${MPV_SOCKET:-$XDG_RUNTIME_DIR/ump_mpv_socket}"
    XDG_CACHE_HOME="${XDG_CACHE_HOME-$HOME/.cache}"
    NETNIX_LOCAL_ROOT="${NETNIX_LOCAL_ROOT-$XDG_DATA_HOME/netnix/library}"
    if ! fnmatch "/*" "${NETNIX_LOCAL_ROOT_MUSIC-}"; then
        NETNIX_LOCAL_ROOT_MUSIC="$NETNIX_LOCAL_ROOT/$(
        )${NETNIX_LOCAL_ROOT_MUSIC-Music}"
    fi
    NETNIX_LIBRARIES="file://$NETNIX_LOCAL_ROOT_MUSIC$(
    )${NETNIX_LIBRARIES+ $NETNIX_LIBRARIES}"
    [ "$1" = exec ] && [ "$2" = ump_get_json_for ] || mpv_ensure_running
    case "$1" in
    now) shift && ump_youtube_now "$@" ;;
    add) shift && ump_youtube_add "$@" ;;
    toggle) mpv_command cycle pause ;;
    prev) shift && mpv_command script-binding ump-prev ;;
    next) shift && mpv_command script-binding ump-next ;;
    current) ump_youtube_current ;;
    exec) shift && "$@" ;;
    rsync)
        shift
        in_dir "$NETNIX_LOCAL_ROOT_MUSIC" rsync --progress -rh \
            --exclude '*/' --include '*.mp4' --include '*.m4a' \
            --include '*.mkv' --include '*.webm' --include '.*.info.json' "$@"
        ;;
    *) die 'Error: unsupported operation' ;;
    esac
}

ump() {
    ump_youtube "$@"
}

ump "$@"
