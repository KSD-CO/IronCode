use std::fs;
use std::io;
use std::path::Path;

#[derive(Debug)]
pub enum ArchiveError {
    IoError(io::Error),
    ZipError(String),
}

impl From<io::Error> for ArchiveError {
    fn from(err: io::Error) -> Self {
        ArchiveError::IoError(err)
    }
}

impl From<s_zip::SZipError> for ArchiveError {
    fn from(err: s_zip::SZipError) -> Self {
        ArchiveError::ZipError(err.to_string())
    }
}

pub fn extract_zip(zip_path: &str, dest_dir: &str) -> Result<(), ArchiveError> {
    let dest_dir = Path::new(dest_dir);

    // Create destination directory if it doesn't exist
    fs::create_dir_all(dest_dir)?;

    // Open the ZIP file
    let mut reader = s_zip::StreamingZipReader::open(zip_path)?;

    // Collect entry names first to avoid borrow checker issues
    let entry_names: Vec<String> = reader.entries().iter().map(|e| e.name.clone()).collect();

    // Extract each entry
    for entry_name in entry_names {
        let entry_path = dest_dir.join(&entry_name);

        // Create parent directories if needed
        if let Some(parent) = entry_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Read and write the entry data
        let data = reader.read_entry_by_name(&entry_name)?;
        fs::write(&entry_path, data)?;
    }

    Ok(())
}
