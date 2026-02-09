use crate::types::Output;
use std::fs;
use std::io::Read;
use std::path::Path;

const DEFAULT_READ_LIMIT: usize = 2000;
const MAX_LINE_LENGTH: usize = 2000;
const MAX_BYTES: usize = 50 * 1024;

pub fn execute(
    filepath: &str,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<Output, String> {
    let path = Path::new(filepath);

    if !path.exists() {
        return Err(format!("File not found: {}", filepath));
    }

    if is_binary_file(path)? {
        return Err(format!("Cannot read binary file: {}", filepath));
    }

    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))?;

    let lines: Vec<&str> = content.lines().collect();
    let total_lines = lines.len();
    let offset = offset.unwrap_or(0);
    let limit = limit.unwrap_or(DEFAULT_READ_LIMIT);

    let mut raw: Vec<String> = Vec::new();
    let mut bytes = 0;
    let mut truncated_by_bytes = false;

    for i in offset..std::cmp::min(total_lines, offset + limit) {
        let line = if lines[i].len() > MAX_LINE_LENGTH {
            format!("{}...", &lines[i][..MAX_LINE_LENGTH])
        } else {
            lines[i].to_string()
        };

        let size = line.as_bytes().len() + if raw.is_empty() { 0 } else { 1 };
        if bytes + size > MAX_BYTES {
            truncated_by_bytes = true;
            break;
        }
        raw.push(line);
        bytes += size;
    }

    let formatted: Vec<String> = raw
        .iter()
        .enumerate()
        .map(|(index, line)| format!("{:05}| {}", index + offset + 1, line))
        .collect();

    let _preview = raw.iter().take(20).cloned().collect::<Vec<_>>().join("\n");

    let mut output = String::from("<file>\n");
    output.push_str(&formatted.join("\n"));

    let last_read_line = offset + raw.len();
    let has_more_lines = total_lines > last_read_line;
    let truncated = has_more_lines || truncated_by_bytes;

    if truncated_by_bytes {
        output.push_str(&format!(
            "\n\n(Output truncated at {} bytes. Use 'offset' parameter to read beyond line {})",
            MAX_BYTES, last_read_line
        ));
    } else if has_more_lines {
        output.push_str(&format!(
            "\n\n(File has more lines. Use 'offset' parameter to read beyond line {})",
            last_read_line
        ));
    } else {
        output.push_str(&format!("\n\n(End of file - total {} lines)", total_lines));
    }
    output.push_str("\n</file>");

    Ok(Output {
        title: filepath.to_string(),
        metadata: crate::types::Metadata {
            count: raw.len(),
            truncated,
        },
        output,
    })
}

fn is_binary_file(path: &Path) -> Result<bool, String> {
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    // Check common binary extensions
    let binary_exts = [
        "zip", "tar", "gz", "exe", "dll", "so", "class", "jar", "war", "7z", "doc", "docx", "xls",
        "xlsx", "ppt", "pptx", "odt", "ods", "odp", "bin", "dat", "obj", "o", "a", "lib", "wasm",
        "pyc", "pyo",
    ];

    if binary_exts.contains(&ext.as_str()) {
        return Ok(true);
    }

    let metadata =
        fs::metadata(path).map_err(|e| format!("Failed to read file metadata: {}", e))?;
    let file_size = metadata.len();

    if file_size == 0 {
        return Ok(false);
    }

    let buffer_size = std::cmp::min(4096, file_size) as usize;
    let mut file = fs::File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut buffer = vec![0u8; buffer_size];
    let bytes_read = file
        .read(&mut buffer)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    if bytes_read == 0 {
        return Ok(false);
    }

    let mut non_printable_count = 0;
    for &byte in &buffer[..bytes_read] {
        if byte == 0 {
            return Ok(true);
        }
        if byte < 9 || (byte > 13 && byte < 32) {
            non_printable_count += 1;
        }
    }

    Ok((non_printable_count as f64 / bytes_read as f64) > 0.3)
}
