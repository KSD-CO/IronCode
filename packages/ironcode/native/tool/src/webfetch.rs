// EXPERIMENTAL Webfetch Implementation in Rust
//
// ⚠️ NOT RECOMMENDED FOR PRODUCTION USE
//
// Benchmark Results (see /tmp/compare_webfetch.ts):
//   - TypeScript average: 0.71ms processing time
//   - Network latency: 500-2000ms (95% of total time)
//   - Processing: 1-60ms (5% of total time)
//
// Why TypeScript is Better:
//   ✅ Bun's native fetch() is highly optimized (C++)
//   ✅ HTMLRewriter is native Bun API (very fast)
//   ✅ TurndownService is mature and well-tested
//   ✅ No FFI overhead
//   ✅ Simpler implementation (187 lines vs 250+ lines)
//
// Why This Doesn't Work:
//   ❌ Network is the bottleneck, not processing
//   ❌ FFI overhead (~50µs) significant for this use case
//   ❌ Complex dependencies (reqwest + scraper + html2md)
//   ❌ Potential gain: ~1.5x on processing = 2% overall improvement
//
// Comparison with Archive (successful migration):
//   Archive: Bottleneck was shell spawn (50-100ms)
//   Archive: Gained 3-5x speedup
//   Webfetch: Bottleneck is network (500-2000ms)
//   Webfetch: Would gain ~1.5x on 5% of time
//
// To enable (not recommended):
//   cargo build --release --features webfetch

use reqwest::blocking::Client;
use scraper::Html;
use std::time::Duration;

#[derive(Debug)]
pub enum WebFetchError {
    HttpError(String),
    ParseError(String),
    Timeout,
}

impl From<reqwest::Error> for WebFetchError {
    fn from(err: reqwest::Error) -> Self {
        WebFetchError::HttpError(err.to_string())
    }
}

pub enum ContentFormat {
    Text,
    Markdown,
    Html,
}

pub struct WebFetchResult {
    pub content: String,
    pub content_type: String,
}

pub fn fetch_url(
    url: &str,
    format: ContentFormat,
    timeout_secs: u64,
) -> Result<WebFetchResult, WebFetchError> {
    // Build HTTP client with timeout
    let client = Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36")
        .build()?;

    // Fetch the content
    let response = client.get(url).send()?;

    if !response.status().is_success() {
        return Err(WebFetchError::HttpError(format!(
            "Request failed with status code: {}",
            response.status()
        )));
    }

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let html_content = response.text()?;

    // Process based on format
    let content = match format {
        ContentFormat::Text => {
            if content_type.contains("text/html") {
                extract_text_from_html(&html_content)
            } else {
                html_content
            }
        }
        ContentFormat::Markdown => {
            if content_type.contains("text/html") {
                html2md::parse_html(&html_content)
            } else {
                html_content
            }
        }
        ContentFormat::Html => html_content,
    };

    Ok(WebFetchResult {
        content,
        content_type,
    })
}

fn extract_text_from_html(html: &str) -> String {
    let document = Html::parse_document(html);

    // Use a simple approach: get the root text
    document
        .root_element()
        .text()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}
