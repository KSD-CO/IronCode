use serde::Serialize;

#[derive(Serialize)]
pub struct Metadata {
    pub count: usize,
    pub truncated: bool,
}

#[derive(Serialize)]
pub struct Output {
    pub title: String,
    pub metadata: Metadata,
    pub output: String,
}
