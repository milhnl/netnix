#!/usr/bin/env sh
#ump - universal media player
set -eu

# COMMON ----------------------------------------------------------------------
daemon() ( exec "$@" >/dev/null 2>&1 & )
die() { printf '%s\n' "$*" >&2; exit 1; }
exists() { command -v "$1" >/dev/null 2>&1; }

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

ump_youtube_download() (
    mkdir -p "$UMP_VIDEO_LIBRARY"
    cd "$(mktemp -d)"
    youtube-dl --default-search ytsearch \
        --download-archive "$UMP_VIDEO_LIBRARY/.ytdl-archive" \
        --write-info-json \
        -o 'ytdl.%(ext)s' "$*" >&2
    set -- "$(<ytdl.info.json jq -r '(.artist + " - " + .track)')"
    set -- "$([ "$1" = " - " ]
            && <ytdl.info.json jq -r .title | yt_title_clean
            || echo "$1")" \
        "$(find . -type f | sed 's/.*\.//' | grep -E 'mkv|webm|mp4')"
    mv "ytdl.$2" "$UMP_VIDEO_LIBRARY/$1.$2" >&2
    mv "ytdl.info.json" "$UMP_VIDEO_LIBRARY/.$1.info.json" >&2
    echo "$UMP_VIDEO_LIBRARY/$1.$2"
)

ump_youtube_cached() {
    set -- "$(find "$UMP_VIDEO_LIBRARY" -not -name '.*' -a \
        -iname "*$(for x; do printf "%s*" "$x"; done)")"
    [ -n "$1" ] && echo "$1" || return 1
}

ump_youtube() {
    MPV_SOCKET="${MPV_SOCKET:-$XDG_CONFIG_HOME/mpv/socket}"
    UMP_VIDEO_LIBRARY="$(video_lib_location)"
    mpv_ensure_running
    case "$1" in
    now) shift; mpv_command loadfile \
        "$(ump_youtube_cached "$@" || echo "ytdl://ytsearch:$*")";;
    add) shift; mpv_command loadfile \
        "$(ump_youtube_cached "$@" || ump_youtube_download "$@")" append-play;;
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
