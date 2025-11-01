use directories::ProjectDirs;
use id3::{Tag as Id3Tag, TagLike};
use lazy_static::lazy_static;
use metaflac::Tag as FlacTag;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::env;
use std::fs::File;
use std::io::BufReader;
use std::path::{Component, Path, PathBuf};
use walkdir::WalkDir;

enum FileType {
    Music,
    Episode,
    Film,
    Unknown,
}

#[derive(Serialize)]
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
        date: Option<String>,
    },
    Film {
        title: String,
    },
    Episode {
        show: Option<String>,
        title: Option<String>,
        season: Option<String>,
        episode: Option<String>,
        language: Option<String>,
    },
    Unknown {},
}

#[derive(Serialize)]
struct Item {
    path: PathBuf,
    r#type: Vec<String>,
    meta: Metadata,
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
}

fn info_json_exists(path: &Path) -> Option<YoutubeDl> {
    let path = path
        .parent()?
        .join(".".to_string() + path.file_stem()?.to_str()? + ".info.json");
    let file = File::open(path).ok()?;
    let reader = BufReader::new(file);
    serde_json::from_reader(reader).ok()
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
            (Some((&cap[1]).to_string()), Some((&cap[2]).to_string()))
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
            show: path
                .parent()
                .and_then(|dir| dir.file_name()?.to_str())
                .map(|x| x.to_string()),
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

fn get_type(path: PathBuf) -> Option<Item> {
    match path.extension()?.to_str()? {
        "aac" => Some(Item {
            path,
            r#type: vec!["music".to_string()],
            meta: Metadata::Unknown {},
        }),
        "flac" => {
            let tag = FlacTag::read_from_path(&path).ok()?;
            let artist = flac_get_tag(&tag, "artist");
            let albumartist = flac_get_tag(&tag, "albumartist");
            let album = flac_get_tag(&tag, "album");
            let discnumber = flac_get_tag(&tag, "discnumber");
            let tracknumber = flac_get_tag(&tag, "tracknumber");
            let title = flac_get_tag(&tag, "title");
            let date = flac_get_tag(&tag, "date");
            Some(Item {
                path,
                r#type: vec!["music".to_string()],
                meta: Metadata::Music {
                    artist: artist,
                    albumartist: albumartist,
                    album: album,
                    discnumber: discnumber,
                    tracknumber,
                    title,
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
            let date = tag
                .year()
                .map(|x| x.to_string())
                .or_else(|| tag.date_recorded().map(|x| x.to_string()));
            Some(Item {
                path,
                r#type: vec!["music".to_string()],
                meta: Metadata::Music {
                    artist,
                    albumartist,
                    album,
                    discnumber,
                    tracknumber,
                    title,
                    date,
                },
            })
        }
        "wav" => Some(Item {
            path,
            r#type: vec!["music".to_string()],
            meta: Metadata::Unknown {},
        }),
        "mkv" | "mp4" | "webm" => match info_json_exists(&path) {
            Some(yt_json)
                if yt_json.categories.iter().any(|x| x == "Music") =>
            {
                let (artist, title) = match (yt_json.artist, yt_json.track) {
                    (Some(artist), Some(title)) => (Some(artist), Some(title)),
                    (_, _) => parse_song_title(&yt_json.title),
                };
                Some(Item {
                    path,
                    r#type: vec!["music".to_string(), "video".to_string()],
                    meta: Metadata::Music {
                        artist,
                        albumartist: None,
                        album: yt_json.album,
                        discnumber: None,
                        tracknumber: None,
                        title,
                        date: None,
                    },
                })
            }
            _ => match get_file_type_from_path(&path) {
                FileType::Music => Some(Item {
                    path: path.clone(),
                    r#type: vec!["music".to_string(), "video".to_string()],
                    meta: {
                        let (artist, title) =
                            match path.file_stem().and_then(|x| x.to_str()) {
                                Some(fulltitle) => parse_song_title(fulltitle),
                                _ => (None, None),
                            };
                        Metadata::Music {
                            artist,
                            albumartist: None,
                            album: None,
                            discnumber: None,
                            tracknumber: None,
                            title,
                            date: None,
                        }
                    },
                }),
                FileType::Film => Some(Item {
                    path: path.clone(),
                    r#type: vec!["video".to_string()],
                    meta: Metadata::Film {
                        title: path.file_stem()?.to_str()?.to_string(),
                    },
                }),
                FileType::Episode => Some(Item {
                    path: path.clone(),
                    r#type: vec!["video".to_string()],
                    meta: parse_episode_title(&path),
                }),
                FileType::Unknown => {
                    eprintln!("Skipping, type unknown: {}", path.to_str()?);
                    None
                }
            },
        },
        "srt" => match get_file_type_from_path(&path) {
            FileType::Film => Some(Item {
                path: path.clone(),
                r#type: vec!["subtitle".to_string()],
                meta: Metadata::Film {
                    title: path.file_stem()?.to_str()?.to_string(),
                },
            }),
            FileType::Episode => Some(Item {
                path: path.clone(),
                r#type: vec!["subtitle".to_string()],
                meta: parse_episode_title(&path),
            }),
            _ => None,
        },
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
    let library = Library {
        version: 0,
        items: WalkDir::new(&root)
            .into_iter()
            .filter_map(|v| v.ok())
            .filter_map(|x| {
                get_type(x.path().strip_prefix(&root).ok()?.to_path_buf())
            })
            .collect(),
    };
    println!("{}", serde_json::to_string(&library).unwrap());
}
