use directories::ProjectDirs;
use serde::Serialize;
use std::env;
use std::path::{Component, Path, PathBuf};
use walkdir::WalkDir;

#[derive(Serialize)]
struct Item {
    path: String,
    r#type: Vec<String>,
}

fn get_type(path: &Path) -> Option<Vec<String>> {
    match path.extension()?.to_str()? {
        "aac" | "flac" | "mp3" | "wav" => Some(vec!["music".to_string()]),
        "mkv" | "mp4" | "webm" => path
            .components()
            .rev()
            .find_map(|x| {
                if let Component::Normal(os_str) = x {
                    match os_str.to_str()?.to_lowercase().as_str() {
                        "tv" | "series" | "tv series" => {
                            Some(vec!["video".to_string()])
                        }
                        "music" | "yt-lib" => Some(vec![
                            "music".to_string(),
                            "video".to_string(),
                        ]),
                        _ => None,
                    }
                } else {
                    None
                }
            })
            .or_else(|| Some(vec!["video".to_string()])),
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
    WalkDir::new(&root)
        .into_iter()
        .filter_map(|v| v.ok())
        .filter_map(|e| {
            let path = e.path();
            Some(Item {
                path: path.strip_prefix(&root).ok()?.to_str()?.to_string(),
                r#type: get_type(path)?,
            })
        })
        .filter(|x| !x.r#type.is_empty())
        .for_each(|x| println!("{}", serde_json::to_string(&x).unwrap()));
}
