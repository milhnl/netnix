# Netnix

Not a media server, maybe two and a half clients. Very alpha-level quality, but
I think the concept has merits.

### Why

The clients we use to consume media are getting more capable every year. In
terms of codecs, containers and even the raw processing power required to
efficiently use it all. Especially browsers. The `MediaSession` api makes it
possible to deeply integrate the playing media with your desktop or phone
interface. Firefox is almost done with their integration of the Matroska
format, which is what most of the files you'd actually want to consume are
using. Chrome has supported it for ages at this point. Every mainstream audio
format is supported — you get the point.

(No LLM's were used in the production of the em dash above)

So why run bulky, buggy backends that seem to turn perfectly good OSS projects
into paid subscriptions every chance they get? All you actually need is a way
to get the content to your device and a way to consume it.

### Goals

- Reliable, resilient and independent media streaming
- Easily self-hostable on very limited hardware
- Leverage battle-tested and common dependencies

### How, and other advantages

Netnix (btw, _please help me replace this awful placeholder name before I get
sued_)...

Ok let me start over. Netnix is basically three files and meant to be deployed
extremely easily, for those comfortable with running 3 commands. No Docker or
anything required. Currently none of these claims are true, but let me paint
the basic picture:

You might have a folder (structure) containing some media files. Let's call
that `/path/to/media`.

1.  Expose that folder with some web server. Apache, NGINX, Caddy, it doesn't
    matter. I won't help you with that. If you can't set up a web server, you
    are not the target audience. Sorry.
2.  Build the _indexer_, which is not yet in this repository. Maybe alpha level
    is too generous a term for this project.
3.  Run the indexer on `/path/to/media`, and redirect the output to
    `/path/to/media/.ump-library.json`. Yes, questions:
    - **Why is it called `ump`?** The whole project was called ump. I'm not
      good at naming things. UMP stood for universal media player. Which it
      sort of still is. Help.
    - **Isn't one big JSON file slow?** You'd think that, but not in my
      experience. It should be cached, compresses quite well, and is just _so_
      easy to work with.
    - **Where is the indexer?** In a repo that's somehow private. It should end
      up in this repository. There's still a shell script that also works
      somewhere in here, but I don't recommend using it.
    - **Isn't reindexing everything slow?** Took 5 minutes on my Raspberry Pi
      with a filled 4 TB USB disk. It's also very reliable.
    - **That's a backend.** True, but it is not exposed to the network and also
      only runs when you need it.
4.  Build the `index.html` file and also plop it in `/path/to/media`. You now
    have a frontend/client.
5.  Done.

When you add new files or change your media folder in any way, redo step 3.

The media server you end up with is a high-performance HTTP server. No
transcoding whatsoever. Streaming video and audio is done with the client,
which simply does HTTP range requests (i.e. does not download the whole file if
it's not necessary). Your browser handles decoding the files, and you expose
the least amount of attack surface on your server.

It also fully works 'offline'. That means that neither the indexer nor the
client require an internet connection to work. The client is 1 self-contained
file, and the indexer just pulls all the information it needs from the file
paths and metadata.

### Some other things in here

There's also `tv` and `ump`. Both are shell scripts that use MPV to play your
media directly from your comfy shell environment. Building instructions may
follow, but check the `Makefile`.

### Interested?

If you want to use this, help building it or something else, let me know. It's
an 'old' project, but I've been using it all these years to play my own media.
It might soon be time to share this.

### Installation

If you put your binaries in `~/.local/bin`:

    PREFIX="$HOME/.local" make install

This will install the indexer as a `netnix` executable. You can then run it
like:

```sh
netnix /path/to/media >/path/to/media/.ump-library.json
```

You'll probably also want to build the frontend:

```sh
make frontend/dist/index.html
cp frontend/dist/index.html /path/to/media/index.html
```

Now you're done.
