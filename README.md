# Netnix

A different type of media server. Runs on very light/cheap hardware, does not
do any transcoding and is blazing fast. The client works in every modern
browser (except for playback of many video formats in Safari). Very much in
development, but it is starting to be usable.

### Installation/Usage

1.  **Installing the indexer**  
    Install [cargo](https://doc.rust-lang.org/cargo/) and
    [Deno](https://deno.com/) using these links or your package manager.

    If you put your binaries in `~/.local/bin`:

    ```sh
    PREFIX="$HOME/.local" make install
    ```

    This will install the indexer as a `netnix` executable.

2.  **Running the indexer**  
    You might have a folder (structure) containing some media files. Let's call
    that `/path/to/media`.

    ```sh
    netnix "/path/to/media" >"/path/to/media/.ump-library.json"
    ```

    This runs the indexer on `/path/to/media`, and redirects the output to
    `/path/to/media/.ump-library.json`. Yes, questions:
    - **Isn't one big JSON file slow?** You'd think that, but not in my
      experience. It should be cached, compresses quite well, and is just _so_
      easy to work with.
    - **Isn't reindexing everything slow?** Took 5 minutes on my Raspberry Pi
      with a filled 4 TB USB disk. It's also very reliable.
    - **Will I need to rerun this every time I add or change media?** Yes.
    - **That's a backend.** True, but it is not exposed to the network and also
      only runs when you need it.
    - **Why is it called `ump`?** The whole project was called ump. I'm not
      good at naming things. UMP stood for universal media player. Which it
      sort of still is. Help.

3.  **Installing the frontend**  
    You'll probably also want to build and install the frontend:

    ```sh
    make frontend/dist/index.html
    cp frontend/dist/index.html /path/to/media/index.html
    ```

    This single file is the entire frontend/client.

4.  **Configure your web server**  
    Expose that folder with some web server. Apache, NGINX, Caddy, it doesn't
    matter. I won't help you with that. If you can't set up a web server, you
    are currently not the target audience. Sorry.
5.  Done.

### Why

The clients we use to consume media are getting more capable every year. In
terms of codecs, containers and even the raw processing power required to
efficiently use it all. Especially browsers. The `MediaSession` api makes it
possible to deeply integrate the playing media with your desktop or phone
interface. Firefox recently added support for the Matroska format, which is
what most of the files you'd actually want to consume are probably using.
Chrome has had it for ages at this point. Every mainstream audio format is
supported — you get the point.

(No LLM's were used in the production of the em dash above)

So why run bulky, buggy backends that seem to turn perfectly good OSS projects
into paid subscriptions every chance they get? All you actually need is a way
to get the content to your device and a way to consume it.

Netnix (btw, _please help me replace this awful placeholder name before I get
sued_)...

Ok let me start over. Netnix is basically three files and meant to be deployed
extremely easily, for those comfortable with running 3 commands. No Docker or
anything required.

The media server you end up with is a high-performance HTTP server. No
transcoding whatsoever. Streaming video and audio is done with the client,
which simply does HTTP range requests (i.e. does not download the whole file if
it's not necessary). Your browser handles decoding the files, and you expose
the least amount of attack surface on your server.

It also fully works 'offline'. That means that neither the indexer nor the
client require an internet connection to work. The client is 1 self-contained
file, and the indexer just pulls all the information it needs from the file
paths and metadata.

`netnix` is also not really the software you just installed. There's actually
both two other implementations of a client (`ump` and `tv`) and another
implementation of the backend (also somewhere in `ump`, slightly broken) in
this repository. The central idea is that you have media somewhere, and an
index (`.ump-library`) which can be consumed by a client.

### Goals, design decisions and development

- Reliable, resilient and independent media streaming
- Easily self-hostable on very limited hardware
- Leverage battle-tested and common dependencies

If you want to use this, help building it or something else, let me know. It's
an 'old' project, but I've been using it all these years to play my own media.

Currently it uses some heuristics for indexing that might not work well for
everyone. If you run into issues, let me know too.

### `ump` and `tv`

There's also `tv` and `ump`. Both are shell scripts that use MPV to play your
media directly from your comfy shell environment. Building instructions may
follow, but check the `Makefile`. Not really ready (if they even ever will be)
for everyone who is interested, but I use them.
