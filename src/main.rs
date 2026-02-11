use directories::ProjectDirs;
use id3::{Tag as Id3Tag, TagLike};
use lazy_static::lazy_static;
use metaflac::{block::StreamInfo, Tag as FlacTag};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::HashMap;
use std::env;
use std::ffi::OsStr;
use std::fs::File;
use std::io::BufReader;
use std::path::{Component, Path, PathBuf};
use walkdir::WalkDir;

#[derive(PartialEq)]
enum FileType {
    Music,
    Episode,
    Film,
    Unknown,
}

#[derive(Serialize, Clone)]
#[serde(untagged)]
enum Metadata {
    Music {
        #[serde(skip_serializing_if = "Option::is_none")]
        artist: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        albumartist: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        album: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        discnumber: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tracknumber: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        title: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        genre: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        date: Option<String>,
    },
    Film {
        title: String,
    },
    Episode {
        #[serde(skip_serializing_if = "Option::is_none")]
        show: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        title: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        season: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        episode: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        language: Option<String>,
    },
    Unknown {},
}

#[derive(Serialize)]
struct Item {
    path: PathBuf,
    mime: String,
    meta: Metadata,
    #[serde(skip_serializing_if = "Option::is_none")]
    duration: Option<f64>,
}

#[derive(Serialize)]
struct Library {
    version: u8,
    items: Vec<Item>,
}

#[derive(Deserialize)]
struct YoutubeDl {
    categories: Vec<String>,
    title: String,
    artist: Option<String>,
    album: Option<String>,
    track: Option<String>,
    duration: Option<f64>,
    vcodec: String,
    acodec: String,
}

fn info_json_exists(path: &Path) -> Option<YoutubeDl> {
    let info = path
        .parent()?
        .join(".".to_string() + path.file_stem()?.to_str()? + ".info.json");
    let file = File::open(info).ok()?;
    let reader = BufReader::new(file);
    serde_json::from_reader(reader)
        .map_err(|x| {
            eprintln!("Warning: Could not read info for {path:?}: {x:?}")
        })
        .ok()
}

fn get_mime_type_from_path(path: &Path) -> &'static str {
    match path.extension().and_then(|x| x.to_str()) {
        Some("mkv") => "video/matroska",
        Some("mp4") => "video/mp4",
        Some("webm") => "video/webm",
        Some("aac") => "audio/aac",
        Some("flac") => "audio/flac",
        Some("m4a") => "audio/mp4",
        Some("mp3") => "audio/mpeg",
        Some("wav") => "audio/wav",
        Some("jpg") => "image/jpeg",
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        Some("srt") => "application/x-subrip",
        _ => "application/octet-stream",
    }
}

fn get_mime_type(
    path: &Path,
    vcodec: Option<&str>,
    acodec: Option<&str>,
) -> String {
    if vcodec.is_none() && acodec.is_none() {
        get_mime_type_from_path(path).to_owned()
    } else {
        format!(
            "{};codecs={}",
            get_mime_type_from_path(path),
            (vcodec.into_iter())
                .chain(acodec.into_iter())
                .filter(|x| *x != "none")
                .collect::<Vec<&str>>()
                .join(",")
        )
    }
}

fn get_file_type_from_path(path: &Path) -> FileType {
    env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(path)
        .components()
        .rev()
        .find_map(|x| {
            if let Component::Normal(os_str) = x {
                match os_str
                    .to_str()
                    .unwrap_or_default()
                    .to_lowercase()
                    .as_str()
                {
                    "tv" | "series" | "tv series" => Some(FileType::Episode),
                    "music" => Some(FileType::Music),
                    "films" | "movies" => Some(FileType::Film),
                    _ => None,
                }
            } else {
                None
            }
        })
        .unwrap_or(FileType::Unknown)
}

fn parse_song_title(fulltitle: &str) -> (Option<String>, Option<String>) {
    lazy_static! {
        static ref WORKABLE: Regex = Regex::new(" - ").unwrap();
        static ref EXTRACT: Regex = Regex::new("(.*) - (.*)").unwrap();
    };
    (WORKABLE.find_iter(fulltitle).count() == 1)
        .then(|| EXTRACT.captures_iter(fulltitle).next())
        .flatten()
        .map_or((None, None), |cap| {
            (Some((cap[1]).to_string()), Some((cap[2]).to_string()))
        })
}

fn parse_episode_title(path: &Path) -> Metadata {
    lazy_static! {
        static ref EXTRACT: Regex = Regex::new(concat!(
            r"(?:[Ss](?P<s1>[[:digit:]]{2})[Ee](?P<e1>[[:digit:]]{2}))|",
            r"(?:(?P<s2>[[:digit:]]{2})[Xx](?P<e2>[[:digit:]]{2}))|",
            r"(?:(?P<s3>[[:digit:]]{2})\.(?P<e3>[[:digit:]]{2}))",
            r" ?(?P<title>.*)"
        ))
        .unwrap();
    };
    let (language, stem) =
        if path.extension().and_then(|x| x.to_str()) == Some("srt") {
            (
                path.file_stem().and_then(|x| {
                    Some(Path::new(x).extension()?.to_str()?.to_string())
                }),
                path.file_stem().map(Path::new),
            )
        } else {
            (None, Some(path))
        };
    match stem.and_then(|stem| {
        EXTRACT.captures_iter(stem.file_stem()?.to_str()?).next()
    }) {
        Some(cap) => Metadata::Episode {
            show: path.canonicalize().ok().and_then(|x| {
                x.parent()
                    .and_then(|dir| dir.file_name()?.to_str())
                    .map(|x| x.to_string())
            }),
            season: cap
                .name("s1")
                .or_else(|| cap.name("s2"))
                .or_else(|| cap.name("s3"))
                .map(|x| x.as_str().to_string()),
            episode: cap
                .name("e1")
                .or_else(|| cap.name("e2"))
                .or_else(|| cap.name("e3"))
                .map(|x| x.as_str().to_string()),
            title: cap.name("title").map(|x| x.as_str().to_string()),
            language,
        },
        _ => Metadata::Unknown {},
    }
}

fn flac_get_tag(tag: &FlacTag, name: &str) -> Option<String> {
    Some(tag.get_vorbis(name)?.next()?.to_string())
}

fn get_type(
    path: PathBuf,
    folder_meta: &mut HashMap<PathBuf, Metadata>,
) -> Option<Item> {
    match path.extension()?.to_str()? {
        "aac" => {
            let mime = get_mime_type_from_path(&path).to_string();
            Some(Item {
                path,
                mime,
                meta: Metadata::Unknown {},
                duration: None,
            })
        }
        "flac" => {
            let tag = FlacTag::read_from_path(&path).ok()?;
            let duration = {
                if let Some(StreamInfo {
                    total_samples: samples,
                    sample_rate: rate,
                    ..
                }) = tag.get_streaminfo()
                {
                    let duration = (*samples as f64) / ((*rate) as f64);
                    if duration.is_nan() || duration == 0f64 {
                        None
                    } else {
                        Some(duration)
                    }
                } else {
                    Some(0f64)
                }
            };
            let artist = flac_get_tag(&tag, "artist");
            let albumartist = flac_get_tag(&tag, "albumartist");
            let album = flac_get_tag(&tag, "album");
            let discnumber = flac_get_tag(&tag, "discnumber");
            let tracknumber = flac_get_tag(&tag, "tracknumber");
            let title = flac_get_tag(&tag, "title");
            let genre = flac_get_tag(&tag, "genre");
            let date = flac_get_tag(&tag, "date");
            if let Some(parent) = path.parent() {
                folder_meta.entry(parent.to_owned()).or_insert_with(|| {
                    Metadata::Music {
                        artist: artist.clone(),
                        albumartist: albumartist.clone(),
                        album: album.clone(),
                        discnumber: None,
                        tracknumber: None,
                        title: None,
                        genre: None,
                        date: None,
                    }
                });
            }
            if let Some(parent) = path.parent().and_then(|x| x.parent()) {
                folder_meta.entry(parent.to_owned()).or_insert_with(|| {
                    Metadata::Music {
                        artist: artist.clone(),
                        albumartist: albumartist.clone(),
                        album: None,
                        discnumber: None,
                        tracknumber: None,
                        title: None,
                        genre: None,
                        date: None,
                    }
                });
            }
            let mime = get_mime_type_from_path(&path).to_string();
            Some(Item {
                path,
                mime,
                duration,
                meta: Metadata::Music {
                    artist,
                    albumartist,
                    album,
                    discnumber,
                    tracknumber,
                    title,
                    genre,
                    date,
                },
            })
        }
        "mp3" => {
            let tag = Id3Tag::read_from_path(&path).ok()?;
            let artist = tag.artist().map(|x| x.to_string());
            let albumartist = tag.album_artist().map(|x| x.to_string());
            let album = tag.album().map(|x| x.to_string());
            let discnumber = tag.disc().map(|x| x.to_string());
            let tracknumber = tag.track().map(|x| x.to_string());
            let title = tag.title().map(|x| x.to_string());
            let genre = tag.genre().map(|x| x.to_string());
            let date = tag
                .year()
                .map(|x| x.to_string())
                .or_else(|| tag.date_recorded().map(|x| x.to_string()));
            if let Some(parent) = path.parent() {
                folder_meta.entry(parent.to_owned()).or_insert_with(|| {
                    Metadata::Music {
                        artist: artist.clone(),
                        albumartist: albumartist.clone(),
                        album: album.clone(),
                        discnumber: None,
                        tracknumber: None,
                        title: None,
                        genre: None,
                        date: None,
                    }
                });
            }
            if let Some(parent) = path.parent().and_then(|x| x.parent()) {
                folder_meta.entry(parent.to_owned()).or_insert_with(|| {
                    Metadata::Music {
                        artist: artist.clone(),
                        albumartist: albumartist.clone(),
                        album: None,
                        discnumber: None,
                        tracknumber: None,
                        title: None,
                        genre: None,
                        date: None,
                    }
                });
            }
            let mime = get_mime_type_from_path(&path).to_string();
            Some(Item {
                path,
                mime,
                duration: None,
                meta: Metadata::Music {
                    artist,
                    albumartist,
                    album,
                    discnumber,
                    tracknumber,
                    title,
                    genre,
                    date,
                },
            })
        }
        "wav" => {
            let mime = get_mime_type_from_path(&path).to_string();
            Some(Item {
                path,
                mime,
                duration: None,
                meta: Metadata::Unknown {},
            })
        }
        "m4a" | "mkv" | "mp4" | "webm" => match info_json_exists(&path) {
            Some(yt_json)
                if yt_json.categories.iter().any(|x| x == "Music")
                    || get_file_type_from_path(&path) == FileType::Music =>
            {
                let (artist, title) = match (yt_json.artist, yt_json.track) {
                    (Some(artist), Some(title)) => (Some(artist), Some(title)),
                    (_, _) => parse_song_title(&yt_json.title),
                };
                let mime = get_mime_type(
                    &path,
                    Some(&yt_json.vcodec),
                    Some(&yt_json.acodec),
                );
                Some(Item {
                    path,
                    mime,
                    duration: yt_json.duration,
                    meta: Metadata::Music {
                        artist,
                        albumartist: None,
                        album: yt_json.album,
                        discnumber: None,
                        tracknumber: None,
                        title,
                        genre: None,
                        date: None,
                    },
                })
            }
            _ => {
                let mime = get_mime_type_from_path(&path).to_string();
                match get_file_type_from_path(&path) {
                    FileType::Music => {
                        let (artist, title) =
                            match path.file_stem().and_then(|x| x.to_str()) {
                                Some(fulltitle) => parse_song_title(fulltitle),
                                _ => (None, None),
                            };
                        Some(Item {
                            path,
                            mime,
                            duration: None,
                            meta: {
                                Metadata::Music {
                                    artist,
                                    albumartist: None,
                                    album: None,
                                    discnumber: None,
                                    tracknumber: None,
                                    title,
                                    genre: None,
                                    date: None,
                                }
                            },
                        })
                    }
                    FileType::Film => {
                        let title = path.file_stem()?.to_str()?.to_string();
                        Some(Item {
                            path,
                            mime,
                            duration: None,
                            meta: Metadata::Film { title },
                        })
                    }
                    FileType::Episode => {
                        let meta = parse_episode_title(&path);
                        if let (Some(parent), Metadata::Episode { show, .. }) =
                            (path.parent(), &meta)
                        {
                            folder_meta
                                .entry(parent.to_owned())
                                .or_insert_with(|| Metadata::Episode {
                                    show: show.clone(),
                                    title: None,
                                    season: None,
                                    episode: None,
                                    language: None,
                                });
                        }
                        Some(Item {
                            path,
                            mime,
                            duration: None,
                            meta,
                        })
                    }
                    FileType::Unknown => {
                        eprintln!("Info: Skipping, type unknown: {path:?}");
                        None
                    }
                }
            }
        },
        "srt" => {
            let mime = get_mime_type_from_path(&path).to_string();
            let meta = match get_file_type_from_path(&path) {
                FileType::Film => Metadata::Film {
                    title: path.file_stem()?.to_str()?.to_string(),
                },
                FileType::Episode => parse_episode_title(&path),
                _ => Metadata::Unknown {},
            };
            Some(Item {
                path,
                mime,
                duration: None,
                meta,
            })
        }
        "jpg" | "webp" | "png" => {
            let mime = get_mime_type_from_path(&path).to_string();
            if path.file_stem() == Some(OsStr::new("folder")) {
                if let Some(folder) = path.parent() {
                    if let Some(meta) = folder_meta.get(folder) {
                        return Some(Item {
                            path,
                            mime,
                            duration: None,
                            meta: meta.clone(),
                        });
                    }
                }
            }
            None
        }
        _ => None,
    }
}

fn main() {
    let root = env::args()
        .nth(1)
        .map(PathBuf::from)
        .or_else(|| Some(PathBuf::from(&env::var("UMP_DOWNLOADS").ok()?)))
        .or_else(|| {
            Some(
                ProjectDirs::from("nl", "milh", "ump")?
                    .cache_dir()
                    .to_path_buf()
                    .join("yt-lib"),
            )
        })
        .expect("Could not determine default library, provide one manually.");
    env::set_current_dir(&root).expect("Could not open library folder");
    let mut folder_meta = HashMap::<PathBuf, Metadata>::new();
    let library = Library {
        version: 0,
        items: WalkDir::new(&root)
            .contents_first(true)
            .sort_by(|a, b| {
                (match (
                    a.path().file_stem().and_then(|x| x.to_str()),
                    b.path().file_stem().and_then(|x| x.to_str()),
                ) {
                    (Some("folder"), Some("folder")) => Ordering::Equal,
                    (_, Some("folder")) => Ordering::Less,
                    (Some("folder"), _) => Ordering::Greater,
                    (_, _) => Ordering::Equal,
                })
                .then(
                    match (a.file_type().is_dir(), b.file_type().is_dir()) {
                        (false, false) => Ordering::Equal,
                        (true, false) => Ordering::Less,
                        (false, true) => Ordering::Greater,
                        (true, true) => Ordering::Equal,
                    },
                )
            })
            .into_iter()
            .filter_map(|v| v.ok())
            .filter_map(|x| {
                get_type(
                    x.path().strip_prefix(&root).ok()?.to_path_buf(),
                    &mut folder_meta,
                )
            })
            .collect(),
    };
    println!("{}", serde_json::to_string(&library).unwrap());
}
