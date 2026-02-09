use std::ffi::{CStr, CString};
use std::os::raw::c_char;

pub mod archive;
pub mod edit;
pub mod glob;
pub mod grep;
pub mod ls;
pub mod read;
pub mod stats;
pub mod terminal;
pub mod types;
pub mod vcs;
#[cfg(feature = "webfetch")]
pub mod webfetch;
pub mod write;

#[no_mangle]
pub extern "C" fn glob_ffi(pattern: *const c_char, search: *const c_char) -> *mut c_char {
    let pattern_str = unsafe {
        if pattern.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(pattern).to_str().unwrap_or("")
    };

    let search_str = unsafe {
        if search.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(search).to_str().unwrap_or(".")
    };

    match glob::execute(pattern_str, search_str) {
        Ok(output) => match serde_json::to_string(&output) {
            Ok(json) => CString::new(json).unwrap().into_raw(),
            Err(_) => std::ptr::null_mut(),
        },
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn ls_ffi(path: *const c_char, ignore_patterns_json: *const c_char) -> *mut c_char {
    let path_str = unsafe {
        if path.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(path).to_str().unwrap_or(".")
    };

    let ignore_patterns = unsafe {
        if ignore_patterns_json.is_null() {
            vec![]
        } else {
            let json_str = CStr::from_ptr(ignore_patterns_json)
                .to_str()
                .unwrap_or("[]");
            serde_json::from_str(json_str).unwrap_or_else(|_| vec![])
        }
    };

    match ls::execute(path_str, ignore_patterns) {
        Ok(output) => match serde_json::to_string(&output) {
            Ok(json) => CString::new(json).unwrap().into_raw(),
            Err(_) => std::ptr::null_mut(),
        },
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn read_ffi(filepath: *const c_char, offset: i32, limit: i32) -> *mut c_char {
    let filepath_str = unsafe {
        if filepath.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(filepath).to_str().unwrap_or("")
    };

    let offset_opt = if offset >= 0 {
        Some(offset as usize)
    } else {
        None
    };
    let limit_opt = if limit >= 0 {
        Some(limit as usize)
    } else {
        None
    };

    match read::execute(filepath_str, offset_opt, limit_opt) {
        Ok(output) => match serde_json::to_string(&output) {
            Ok(json) => CString::new(json).unwrap().into_raw(),
            Err(_) => std::ptr::null_mut(),
        },
        Err(_) => std::ptr::null_mut(),
    }
}

// Optimized read that returns raw content without JSON serialization
#[no_mangle]
pub extern "C" fn read_raw_ffi(filepath: *const c_char) -> *mut c_char {
    let filepath_str = unsafe {
        if filepath.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(filepath).to_str().unwrap_or("")
    };

    match std::fs::read_to_string(filepath_str) {
        Ok(content) => match CString::new(content) {
            Ok(cstring) => cstring.into_raw(),
            Err(_) => std::ptr::null_mut(),
        },
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn grep_ffi(
    pattern: *const c_char,
    search: *const c_char,
    include_glob: *const c_char,
) -> *mut c_char {
    let pattern_str = unsafe {
        if pattern.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(pattern).to_str().unwrap_or("")
    };

    let search_str = unsafe {
        if search.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(search).to_str().unwrap_or(".")
    };

    let include_glob_opt = unsafe {
        if include_glob.is_null() {
            None
        } else {
            Some(CStr::from_ptr(include_glob).to_str().unwrap_or(""))
        }
    };

    match grep::execute(pattern_str, search_str, include_glob_opt) {
        Ok(output) => match serde_json::to_string(&output) {
            Ok(json) => CString::new(json).unwrap().into_raw(),
            Err(_) => std::ptr::null_mut(),
        },
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn write_ffi(filepath: *const c_char, content: *const c_char) -> *mut c_char {
    let filepath_str = unsafe {
        if filepath.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(filepath).to_str().unwrap_or("")
    };

    let content_str = unsafe {
        if content.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(content).to_str().unwrap_or("")
    };

    match write::execute(filepath_str, content_str) {
        Ok(output) => match serde_json::to_string(&output) {
            Ok(json) => CString::new(json).unwrap().into_raw(),
            Err(_) => std::ptr::null_mut(),
        },
        Err(_) => std::ptr::null_mut(),
    }
}

// Optimized write that returns success code instead of JSON
#[no_mangle]
pub extern "C" fn write_raw_ffi(filepath: *const c_char, content: *const c_char) -> i32 {
    let filepath_str = unsafe {
        if filepath.is_null() {
            return -1;
        }
        CStr::from_ptr(filepath).to_str().unwrap_or("")
    };

    let content_str = unsafe {
        if content.is_null() {
            return -1;
        }
        CStr::from_ptr(content).to_str().unwrap_or("")
    };

    match std::fs::write(filepath_str, content_str) {
        Ok(_) => 0,   // Success
        Err(_) => -1, // Error
    }
}

#[no_mangle]
pub extern "C" fn stats_ffi() -> *mut c_char {
    match stats::get_stats() {
        Ok(stats) => match serde_json::to_string(&stats) {
            Ok(json) => CString::new(json).unwrap().into_raw(),
            Err(_) => std::ptr::null_mut(),
        },
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe {
            let _ = CString::from_raw(s);
        }
    }
}

// Terminal FFI functions
#[no_mangle]
pub extern "C" fn terminal_create(
    id: *const c_char,
    cwd: *const c_char,
    rows: u16,
    cols: u16,
) -> *mut c_char {
    let id_str = unsafe {
        if id.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(id).to_str().unwrap_or("")
    };

    let cwd_str = unsafe {
        if cwd.is_null() {
            None
        } else {
            Some(CStr::from_ptr(cwd).to_str().unwrap_or("."))
        }
    };

    match terminal::create(id_str, cwd_str, rows, cols) {
        Ok(info) => match serde_json::to_string(&info) {
            Ok(json) => CString::new(json).unwrap().into_raw(),
            Err(_) => std::ptr::null_mut(),
        },
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn terminal_write(id: *const c_char, data: *const c_char) -> bool {
    let id_str = unsafe {
        if id.is_null() {
            return false;
        }
        CStr::from_ptr(id).to_str().unwrap_or("")
    };

    let data_str = unsafe {
        if data.is_null() {
            return false;
        }
        CStr::from_ptr(data).to_str().unwrap_or("")
    };

    terminal::write(id_str, data_str).is_ok()
}

#[no_mangle]
pub extern "C" fn terminal_read(id: *const c_char) -> *mut c_char {
    let id_str = unsafe {
        if id.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(id).to_str().unwrap_or("")
    };

    match terminal::read(id_str) {
        Ok(output) => match serde_json::to_string(&output) {
            Ok(json) => CString::new(json).unwrap().into_raw(),
            Err(_) => std::ptr::null_mut(),
        },
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn terminal_resize(id: *const c_char, rows: u16, cols: u16) -> bool {
    let id_str = unsafe {
        if id.is_null() {
            return false;
        }
        CStr::from_ptr(id).to_str().unwrap_or("")
    };

    terminal::resize(id_str, rows, cols).is_ok()
}

#[no_mangle]
pub extern "C" fn terminal_close(id: *const c_char) -> bool {
    let id_str = unsafe {
        if id.is_null() {
            return false;
        }
        CStr::from_ptr(id).to_str().unwrap_or("")
    };

    terminal::close(id_str).is_ok()
}

// VCS FFI function
#[no_mangle]
pub extern "C" fn vcs_info_ffi(cwd: *const c_char) -> *mut c_char {
    let cwd_str = unsafe {
        if cwd.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(cwd).to_str().unwrap_or(".")
    };

    match vcs::get_info(cwd_str) {
        Ok(info) => match serde_json::to_string(&info) {
            Ok(json) => CString::new(json).unwrap().into_raw(),
            Err(_) => std::ptr::null_mut(),
        },
        Err(_) => std::ptr::null_mut(),
    }
}

// Edit FFI function
#[no_mangle]
pub extern "C" fn edit_replace_ffi(
    content: *const c_char,
    old_string: *const c_char,
    new_string: *const c_char,
    replace_all: bool,
) -> *mut c_char {
    let content_str = unsafe {
        if content.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(content).to_str().unwrap_or("")
    };

    let old_str = unsafe {
        if old_string.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(old_string).to_str().unwrap_or("")
    };

    let new_str = unsafe {
        if new_string.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(new_string).to_str().unwrap_or("")
    };

    #[derive(serde::Serialize)]
    struct Response {
        success: bool,
        content: Option<String>,
        error: Option<String>,
    }

    let response = match edit::replace(content_str, old_str, new_str, replace_all) {
        Ok(result) => Response {
            success: true,
            content: Some(result),
            error: None,
        },
        Err(edit::ReplaceError::NotFound) => Response {
            success: false,
            content: None,
            error: Some("oldString not found in content".to_string()),
        },
        Err(edit::ReplaceError::MultipleMatches) => Response {
            success: false,
            content: None,
            error: Some(
                "Found multiple matches for oldString. Provide more surrounding lines in oldString to identify the correct match.".to_string(),
            ),
        },
        Err(edit::ReplaceError::SameStrings) => Response {
            success: false,
            content: None,
            error: Some("oldString and newString must be different".to_string()),
        },
    };

    match serde_json::to_string(&response) {
        Ok(json) => CString::new(json).unwrap().into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}

// File existence check
#[no_mangle]
pub extern "C" fn file_exists_ffi(filepath: *const c_char) -> i32 {
    let path_str = unsafe {
        if filepath.is_null() {
            return 0;
        }
        CStr::from_ptr(filepath).to_str().unwrap_or("")
    };

    if std::path::Path::new(path_str).exists() {
        1
    } else {
        0
    }
}

// Get file metadata (size, modified time, etc)
#[no_mangle]
pub extern "C" fn file_stat_ffi(filepath: *const c_char) -> *mut c_char {
    let path_str = unsafe {
        if filepath.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(filepath).to_str().unwrap_or("")
    };

    #[derive(serde::Serialize)]
    struct FileStat {
        exists: bool,
        size: u64,
        modified: u64,
        is_file: bool,
        is_dir: bool,
    }

    let stat = match std::fs::metadata(path_str) {
        Ok(meta) => {
            let modified = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);

            FileStat {
                exists: true,
                size: meta.len(),
                modified,
                is_file: meta.is_file(),
                is_dir: meta.is_dir(),
            }
        }
        Err(_) => FileStat {
            exists: false,
            size: 0,
            modified: 0,
            is_file: false,
            is_dir: false,
        },
    };

    match serde_json::to_string(&stat) {
        Ok(json) => CString::new(json).unwrap().into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}

// Archive extraction
#[no_mangle]
pub extern "C" fn extract_zip_ffi(zip_path: *const c_char, dest_dir: *const c_char) -> i32 {
    let zip_path_str = unsafe {
        if zip_path.is_null() {
            return -1;
        }
        CStr::from_ptr(zip_path).to_str().unwrap_or("")
    };

    let dest_dir_str = unsafe {
        if dest_dir.is_null() {
            return -1;
        }
        CStr::from_ptr(dest_dir).to_str().unwrap_or("")
    };

    match archive::extract_zip(zip_path_str, dest_dir_str) {
        Ok(_) => 0,   // Success
        Err(_) => -1, // Error
    }
}

// Web fetch (EXPERIMENTAL - NOT RECOMMENDED FOR PRODUCTION)
// Benchmark results: TypeScript is better for this use case (0.71ms avg processing)
// Network latency (500-2000ms) >> Processing time (1-60ms)
// To enable: cargo build --release --features webfetch
#[cfg(feature = "webfetch")]
#[no_mangle]
pub extern "C" fn webfetch_ffi(
    url: *const c_char,
    format: *const c_char,
    timeout_secs: u64,
) -> *mut c_char {
    let url_str = unsafe {
        if url.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(url).to_str().unwrap_or("")
    };

    let format_str = unsafe {
        if format.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(format).to_str().unwrap_or("markdown")
    };

    let content_format = match format_str {
        "text" => webfetch::ContentFormat::Text,
        "html" => webfetch::ContentFormat::Html,
        _ => webfetch::ContentFormat::Markdown,
    };

    match webfetch::fetch_url(url_str, content_format, timeout_secs) {
        Ok(result) => {
            #[derive(serde::Serialize)]
            struct Response {
                content: String,
                content_type: String,
            }

            let response = Response {
                content: result.content,
                content_type: result.content_type,
            };

            match serde_json::to_string(&response) {
                Ok(json) => CString::new(json).unwrap().into_raw(),
                Err(_) => std::ptr::null_mut(),
            }
        }
        Err(_) => std::ptr::null_mut(),
    }
}
