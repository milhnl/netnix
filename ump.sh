#!/usr/bin/env sh
#ump - universal media player
set -eu

# COMMON ----------------------------------------------------------------------
daemon() ( exec "$@" >/dev/null 2>&1 & )
die() { printf '%s\n' "$*" >&2; exit 1; }
exists() { command -v "$1" >/dev/null 2>&1; }
to_argv() { while read -r LINE; do set -- "$@" "$LINE"; done; "$@"; }

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
    if ! mpv_command get_version >/dev/null; then
        daemon mpv --idle --input-ipc-server="$MPV_SOCKET"
        until mpv_command get_version >/dev/null; do sleep 1; done
    fi
}

mpv_command() {
    {
        printf '{ "command": ['
        for x; do printf '"%s",' "$x"; done
        echo ']}'
    } | {
        if exists socat; then
            socat - "$MPV_SOCKET" 2>/dev/null;
        else
            nc -U "$MPV_SOCKET";
        fi
    }
}

video_lib_location() {
    if [ -n "${UMP_VIDEO_LIBRARY:-}" ]; then
        echo "${UMP_VIDEO_LIBRARY:-}"
    elif exists xdg-user-dir; then
        echo "$(xdg-user-dir MUSIC)"
    else
        echo "$XDG_DATA_HOME/ump/downloaded"
    fi
}

ump_youtube_move_file() { #1:file 2:json
    set -- "$1" "$2" "$(<"$2" jq -r '(.artist + " - " + .track)')"
    [ "$3" != " - " ] \
        || set -- "$1" "$2" "$(<"$2" jq -r .title | yt_title_clean)"
    set -- "$1" "$2" \
        "$UMP_VIDEO_LIBRARY/$3.${1##*.}" "$UMP_VIDEO_LIBRARY/.$3.info.json"
    [ "$1" = "$3" ] || mv "$1" "$3" >&2
    [ "$2" = "$4" ] || mv "$2" "$4" >&2
    echo "$3"
}

ump_youtube_organise() {
    for x in "$UMP_VIDEO_LIBRARY"/*.webm "$UMP_VIDEO_LIBRARY"/*.mkv \
            "$UMP_VIDEO_LIBRARY"/*.mp4; do
        [ -e "$x" ] || continue
        ump_youtube_move_file "$x" \
            "$(dirname "$x")/.$(basename "${x%.*}").info.json"
    done
}

ump_youtube_download() (
    mkdir -p "$UMP_VIDEO_LIBRARY"
    cd "$(mktemp -d)"
    youtube-dl --default-search ytsearch \
        --download-archive "$UMP_VIDEO_LIBRARY/.ytdl-archive" \
        --write-info-json \
        -o 'ytdl.%(ext)s' "$*" >&2
    ump_youtube_move_file \
        "$(find . -name '*.webm' -o -name '*.mkv' -o -name '*.mp4')" \
        ytdl.info.json
)

ump_youtube_cached() {
    set -- "$(find "$UMP_VIDEO_LIBRARY" -not -name '.*' -a \
        -iname "*$(for x; do printf "%s*" "$x"; done)")"
    [ -n "$1" ] && echo "$1" || return 1
}

ump_youtube_ui() {
    find "$UMP_VIDEO_LIBRARY" -maxdepth 1 \( \
            -name '*.mkv' -o -name '*.webm' -o -name '*.mp4' \) \
        | sed 's_.*/__;s/\.[a-z0-9]*$//' \
        | fzy \
        | to_argv "$@"
}

ump_youtube_now() {
    mpv_command loadfile \
        "$(ump_youtube_cached "$@" || echo "ytdl://ytsearch:$*")"
}

ump_youtube_add() {
    mpv_command loadfile \
        "$(ump_youtube_cached "$@" || ump_youtube_download "$@")" append-play
}

ump_youtube() {
    MPV_SOCKET="${MPV_SOCKET:-$XDG_CONFIG_HOME/mpv/socket}"
    UMP_VIDEO_LIBRARY="$(video_lib_location)"
    mpv_ensure_running
    case "$1" in
    now)
        shift;
        if [ $# -eq 0 ]; then
            ump_youtube_ui ump_youtube_now
        else
            ump_youtube_now "$@"
        fi;;
    add)
        shift;
        if [ $# -eq 0 ]; then
            ump_youtube_ui ump_youtube_add
        else
            ump_youtube_add "$@"
        fi;;
    toggle) mpv_command cycle pause;;
    prev) shift; mpv_command playlist_prev;;
    next) shift; mpv_command playlist_next;;
    current) mpv_command get_property media-title | jq -r .data \
        | sed 's/\.[^.]*$//';;
    exec) shift; "$@";;
    *) die 'Error: unsupported operation';;
    esac
}

ump() {
    ump_youtube "$@"
}

ump "$@"
