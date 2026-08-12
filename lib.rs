//! NAPI-rs bindings for vect-or-engine (Phase 2).
//! Exposes the core Rust engine functions to Node.js as a native addon.

#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

use napi::bindgen_prelude::*;
use once_cell::sync::Lazy;
use std::sync::Arc;
use tokio::sync::RwLock;
use vect_or_engine_lib::{
    KnowledgeStore, Profile, SearchResult, Validator, ValidationMarker, ValidationResult,
};

// --- Global Engine State ---
static ENGINE: Lazy<Arc<RwLock<KnowledgeStore>>> =
    Lazy::new(|| Arc::new(RwLock::new(KnowledgeStore::new())));
/// A simple ping function to verify the NAPI setup.
#[napi]
pub fn ping(name: String) -> String {
  format!("pong from rust: {name}!")
}

// --- N-API Data Structures ---
// These structs mirror the internal engine structs but are annotated for NAPI.

#[napi(object)]
pub struct JsValidationMarker {
  pub line: u32,
  pub cols: Vec<u32>,
  pub rule_id: String,
  pub message: String,
}

#[napi(object)]
pub struct JsValidationResult {
  pub is_valid: bool,
  pub markers: Vec<JsValidationMarker>,
}

#[napi(object)]
pub struct JsSearchResult {
    pub idx: u32,
    pub score: f32,
    pub id: Option<String>,
    pub metadata: serde_json::Value,
}

impl From<&SearchResult> for JsSearchResult {
    fn from(r: &SearchResult) -> Self {
        Self {
            idx: r.idx as u32,
            score: r.score,
            id: r.id.clone(),
            metadata: serde_json::Value::Object(r.metadata.clone()),
        }
    }
}

#[napi(object)]
pub struct JsKbInfo {
    pub count: u32,
    pub dim: u32,
    #[napi(js_name = "hnswReady")]
    pub hnsw_ready: bool,
}

// --- Conversion Implementations ---
// Convert from internal engine types to N-API JS types.

impl From<ValidationMarker> for JsValidationMarker {
    fn from(marker: ValidationMarker) -> Self {
        Self {
            // Safe cast, line numbers won't exceed u32::MAX
            line: marker.line as u32,
            cols: marker.cols.iter().map(|&c| c as u32).collect(),
            rule_id: marker.rule_id,
            message: marker.message,
        }
    }
}

impl From<ValidationResult> for JsValidationResult {
    fn from(result: ValidationResult) -> Self {
        Self {
            is_valid: result.is_valid,
            markers: result.markers.into_iter().map(Into::into).collect(),
        }
    }
}

// --- Exposed N-API Functions ---

/// Validates a document using the default profile.
#[napi]
pub fn validate_sync(text: String) -> Result<JsValidationResult> {
    let profile = Profile::default();
    let validator = Validator::new(&profile);
    let result = validator.validate(&text);
    Ok(result.into())
}

#[napi(task)]
pub async fn load_knowledge_base(path: String) -> Result<u32> {
    let mut store = ENGINE.write().await;
    let count = store
        .load_from_path(&path)
        .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
    Ok(count as u32)
}

#[napi(task)]
pub async fn load_kb_cache(path: String) -> Result<u32> {
    let mut store = ENGINE.write().await;
    let count = store
        .load_from_sqlite(&path)
        .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
    Ok(count as u32)
}

#[napi(task)]
pub async fn save_kb_cache(path: String) -> Result<()> {
    let store = ENGINE.read().await;
    store
        .save_to_sqlite(&path)
        .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
}

#[napi(task)]
pub async fn build_index() -> Result<u32> {
    // Clone Arc to move it into the blocking task for CPU-intensive work.
    let engine = ENGINE.clone();
    tokio::task::spawn_blocking(move || {
        // Re-lock inside the new thread.
        let mut store = engine.blocking_write();
        if store.is_empty() {
            return Err("Knowledge base is empty.".to_string());
        }
        store.build_index();
        Ok(store.len() as u32)
    })
    .await
    .map_err(|e| Error::new(Status::JoinError, e.to_string()))? // Handle task join error
    .map_err(|e| Error::new(Status::GenericFailure, e)) // Handle our custom error
}

#[napi(ts_args_type = "query: Float32Array, topK: number")]
#[napi(task)]
pub async fn search(query: Float32Array, top_k: u32) -> Result<Vec<JsSearchResult>> {
    let store = ENGINE.read().await;
    let results = store.search(&query.to_vec(), top_k as usize);
    Ok(results.iter().map(Into::into).collect())
}

#[napi(task)]
pub async fn kb_info() -> Result<JsKbInfo> {
    let store = ENGINE.read().await;
    Ok(JsKbInfo {
        count: store.len() as u32,
        dim: store.dim as u32,
        hnsw_ready: store.has_index(),
    })
}