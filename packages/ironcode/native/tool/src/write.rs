use std::fs;
use std::path::Path;
use crate::types::Output;

pub fn execute(filepath: &str, content: &str) -> Result<Output, String> {
    let path = Path::new(filepath);
    
    // Create parent directories if they don't exist
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directories: {}", e))?;
        }
    }

    // Write the file
    fs::write(path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(Output {
        title: filepath.to_string(),
        metadata: crate::types::Metadata {
            count: content.lines().count(),
            truncated: false,
        },
        output: format!("Successfully wrote {} bytes to file", content.len()),
    })
}
