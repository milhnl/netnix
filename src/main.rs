use directories::ProjectDirs;
use serde::Serialize;
use std::env;
use std::path::{Component, Path, PathBuf};
use walkdir::WalkDir;

enum FileType {
    Music,
    Episode,
    Film,
    Unknown,
}

#[derive(Serialize)]
struct Item {
    path: PathBuf,
    r#type: Vec<String>,
}

fn get_video_type_from_path(path: &Path) -> FileType {
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
                    "music" | "yt-lib" => Some(FileType::Music),
                    "films" | "movies" => Some(FileType::Film),
                    _ => None,
                }
            } else {
                None
            }
        })
        .unwrap_or(FileType::Unknown)
}

fn get_type(path: PathBuf) -> Option<Item> {
    match path.extension()?.to_str()? {
        "aac" | "flac" | "mp3" | "wav" => Some(Item {
            path,
            r#type: vec!["music".to_string()],
        }),
        "mkv" | "mp4" | "webm"
            if matches!(get_video_type_from_path(&path), FileType::Music) =>
        {
            Some(Item {
                path,
                r#type: vec!["music".to_string(), "video".to_string()],
            })
        }
        "mkv" | "mp4" | "webm"
            if matches!(get_video_type_from_path(&path), FileType::Film) =>
        {
            Some(Item {
                path,
                r#type: vec!["video".to_string()],
            })
        }
        "mkv" | "mp4" | "webm"
            if matches!(
                get_video_type_from_path(&path),
                FileType::Episode
            ) =>
        {
            Some(Item {
                path,
                r#type: vec!["video".to_string()],
            })
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
    WalkDir::new(&root)
        .into_iter()
        .filter_map(|v| v.ok())
        .filter_map(|x| {
            get_type(x.path().strip_prefix(&root).ok()?.to_path_buf())
        })
        .for_each(|x| println!("{}", serde_json::to_string(&x).unwrap()));
}
