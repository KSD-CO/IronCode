use std::ffi::{CStr, CString};
use std::os::raw::c_char;

pub mod glob;
pub mod grep;
pub mod ls;
pub mod read;
pub mod write;
pub mod stats;
pub mod types;

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
        Ok(output) => {
            match serde_json::to_string(&output) {
                Ok(json) => CString::new(json).unwrap().into_raw(),
                Err(_) => std::ptr::null_mut(),
            }
        }
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
            let json_str = CStr::from_ptr(ignore_patterns_json).to_str().unwrap_or("[]");
            serde_json::from_str(json_str).unwrap_or_else(|_| vec![])
        }
    };
    
    match ls::execute(path_str, ignore_patterns) {
        Ok(output) => {
            match serde_json::to_string(&output) {
                Ok(json) => CString::new(json).unwrap().into_raw(),
                Err(_) => std::ptr::null_mut(),
            }
        }
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
    
    let offset_opt = if offset >= 0 { Some(offset as usize) } else { None };
    let limit_opt = if limit >= 0 { Some(limit as usize) } else { None };
    
    match read::execute(filepath_str, offset_opt, limit_opt) {
        Ok(output) => {
            match serde_json::to_string(&output) {
                Ok(json) => CString::new(json).unwrap().into_raw(),
                Err(_) => std::ptr::null_mut(),
            }
        }
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn grep_ffi(pattern: *const c_char, search: *const c_char, include_glob: *const c_char) -> *mut c_char {
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
        Ok(output) => {
            match serde_json::to_string(&output) {
                Ok(json) => CString::new(json).unwrap().into_raw(),
                Err(_) => std::ptr::null_mut(),
            }
        }
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
        Ok(output) => {
            match serde_json::to_string(&output) {
                Ok(json) => CString::new(json).unwrap().into_raw(),
                Err(_) => std::ptr::null_mut(),
            }
        }
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn stats_ffi() -> *mut c_char {
    match stats::get_stats() {
        Ok(stats) => {
            match serde_json::to_string(&stats) {
                Ok(json) => CString::new(json).unwrap().into_raw(),
                Err(_) => std::ptr::null_mut(),
            }
        }
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
