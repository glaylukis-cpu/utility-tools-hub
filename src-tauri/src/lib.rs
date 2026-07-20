pub mod pdf_tools;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(Arc::new(JobManager::default()))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            select_excel_file_dev,
            select_converter_directory_dev,
            detect_converter_directory_dev,
            execute_tool,
            get_job_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

const EXCEL_HTML_CONVERTER_TOOL_ID: &str = "excel_html_converter";
const TEXT_CASE_CONVERTER_TOOL_ID: &str = "text_case_converter";
const PDF_MERGE_TOOL_ID: &str = "pdf_merge";
const PDF_SPLIT_TOOL_ID: &str = "pdf_split";
const PDF_EXTRACT_TOOL_ID: &str = "pdf_extract";
const PDF_ROTATE_TOOL_ID: &str = "pdf_rotate";
const PDF_DELETE_TOOL_ID: &str = "pdf_delete";
const PDF_INSPECT_TOOL_ID: &str = "pdf_inspect";

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ToolRequest {
    tool_id: String,
    input: Value,
    #[serde(default)]
    options: Value,
}

impl ToolRequest {
    fn validate_shape(&self) -> Result<(), String> {
        if self.tool_id.trim().is_empty() {
            return Err("tool_id must not be empty".into());
        }
        if !self.input.is_object() {
            return Err("input must be an object".into());
        }
        if !self.options.is_null() && !self.options.is_object() {
            return Err("options must be an object".into());
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ExcelHtmlConverterInput {
    input_path: String,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct ExcelHtmlConverterOptions {
    zip: Option<bool>,
    converter_dir: Option<String>,
}

struct ExcelHtmlConverterRequest {
    input_path: String,
    zip: Option<bool>,
    converter_dir: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct TextCaseConverterInput {
    text: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct TextCaseConverterOptions {
    mode: String,
}

struct TextCaseConverterRequest {
    text: String,
    mode: TextCaseMode,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct PdfMergeInput {
    input_paths: Vec<String>,
    output_path: String,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct PdfMergeOptions {}

pub(crate) struct PdfMergeRequest {
    input_paths: Vec<String>,
    output_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct PdfSplitInput {
    input_path: String,
    output_dir: String,
    output_prefix: String,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct PdfSplitOptions {}

pub(crate) struct PdfSplitRequest {
    input_path: String,
    output_dir: String,
    output_prefix: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct PdfExtractInput {
    input_path: String,
    output_path: String,
    pages: Vec<usize>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct PdfExtractOptions {}

pub(crate) struct PdfExtractRequest {
    input_path: String,
    output_path: String,
    pages: Vec<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct PdfRotateInput {
    input_path: String,
    output_path: String,
    pages: Vec<usize>,
    angle_degrees: i32,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct PdfRotateOptions {}

pub(crate) struct PdfRotateRequest {
    input_path: String,
    output_path: String,
    pages: Vec<usize>,
    angle_degrees: i32,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct PdfDeleteInput {
    input_path: String,
    output_path: String,
    pages: Vec<usize>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct PdfDeleteOptions {}

pub(crate) struct PdfDeleteRequest {
    input_path: String,
    output_path: String,
    pages: Vec<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct PdfInspectInput {
    input_path: String,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct PdfInspectOptions {}

pub(crate) struct PdfInspectRequest {
    input_path: String,
}

#[derive(Clone, Copy)]
enum TextCaseMode {
    Uppercase,
    Lowercase,
    TitleCase,
    SnakeCase,
    KebabCase,
}

impl TextCaseMode {
    fn parse(mode: &str) -> Result<Self, String> {
        match mode {
            "uppercase" => Ok(Self::Uppercase),
            "lowercase" => Ok(Self::Lowercase),
            "title_case" => Ok(Self::TitleCase),
            "snake_case" => Ok(Self::SnakeCase),
            "kebab_case" => Ok(Self::KebabCase),
            _ => Err(format!("Unknown text case mode: {}", mode)),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Uppercase => "uppercase",
            Self::Lowercase => "lowercase",
            Self::TitleCase => "title_case",
            Self::SnakeCase => "snake_case",
            Self::KebabCase => "kebab_case",
        }
    }
}

enum RegisteredTool {
    ExcelHtmlConverter,
    TextCaseConverter,
    PdfMerge,
    PdfSplit,
    PdfExtract,
    PdfRotate,
    PdfDelete,
    PdfInspect,
}

struct ToolRegistry;

impl ToolRegistry {
    fn resolve(tool_id: &str) -> Result<RegisteredTool, String> {
        match tool_id {
            EXCEL_HTML_CONVERTER_TOOL_ID => Ok(RegisteredTool::ExcelHtmlConverter),
            TEXT_CASE_CONVERTER_TOOL_ID => Ok(RegisteredTool::TextCaseConverter),
            PDF_MERGE_TOOL_ID => Ok(RegisteredTool::PdfMerge),
            PDF_SPLIT_TOOL_ID => Ok(RegisteredTool::PdfSplit),
            PDF_EXTRACT_TOOL_ID => Ok(RegisteredTool::PdfExtract),
            PDF_ROTATE_TOOL_ID => Ok(RegisteredTool::PdfRotate),
            PDF_DELETE_TOOL_ID => Ok(RegisteredTool::PdfDelete),
            PDF_INSPECT_TOOL_ID => Ok(RegisteredTool::PdfInspect),
            _ => Err(format!("Unknown tool_id: {}", tool_id)),
        }
    }
}

impl RegisteredTool {
    fn parse_request(self, request: ToolRequest) -> Result<ValidatedToolRequest, String> {
        match self {
            RegisteredTool::ExcelHtmlConverter => {
                let input: ExcelHtmlConverterInput = serde_json::from_value(request.input)
                    .map_err(|e| format!("Invalid input for {}: {}", request.tool_id, e))?;
                let options = if request.options.is_null() {
                    ExcelHtmlConverterOptions::default()
                } else {
                    serde_json::from_value(request.options)
                        .map_err(|e| format!("Invalid options for {}: {}", request.tool_id, e))?
                };

                if !input.input_path.ends_with(".xlsx") {
                    return Err("input_path must end with .xlsx".into());
                }

                Ok(ValidatedToolRequest::ExcelHtmlConverter(
                    ExcelHtmlConverterRequest {
                        input_path: input.input_path,
                        zip: options.zip,
                        converter_dir: options.converter_dir.unwrap_or_default(),
                    },
                ))
            }
            RegisteredTool::TextCaseConverter => {
                let input: TextCaseConverterInput = serde_json::from_value(request.input)
                    .map_err(|e| format!("Invalid input for {}: {}", request.tool_id, e))?;
                let options: TextCaseConverterOptions = serde_json::from_value(request.options)
                    .map_err(|e| format!("Invalid options for {}: {}", request.tool_id, e))?;

                if input.text.trim().is_empty() {
                    return Err("text must not be empty".into());
                }

                Ok(ValidatedToolRequest::TextCaseConverter(
                    TextCaseConverterRequest {
                        text: input.text,
                        mode: TextCaseMode::parse(&options.mode)?,
                    },
                ))
            }
            RegisteredTool::PdfMerge => {
                let input: PdfMergeInput = serde_json::from_value(request.input)
                    .map_err(|e| format!("Invalid input for {}: {}", request.tool_id, e))?;
                if request.options.is_null() {
                    PdfMergeOptions::default()
                } else {
                    serde_json::from_value::<PdfMergeOptions>(request.options)
                        .map_err(|e| format!("Invalid options for {}: {}", request.tool_id, e))?
                };

                Ok(ValidatedToolRequest::PdfMerge(PdfMergeRequest {
                    input_paths: input.input_paths,
                    output_path: input.output_path,
                }))
            }
            RegisteredTool::PdfSplit => {
                let input: PdfSplitInput = serde_json::from_value(request.input)
                    .map_err(|e| format!("Invalid input for {}: {}", request.tool_id, e))?;
                if request.options.is_null() {
                    PdfSplitOptions::default()
                } else {
                    serde_json::from_value::<PdfSplitOptions>(request.options)
                        .map_err(|e| format!("Invalid options for {}: {}", request.tool_id, e))?
                };

                Ok(ValidatedToolRequest::PdfSplit(PdfSplitRequest {
                    input_path: input.input_path,
                    output_dir: input.output_dir,
                    output_prefix: input.output_prefix,
                }))
            }
            RegisteredTool::PdfExtract => {
                let input: PdfExtractInput = serde_json::from_value(request.input)
                    .map_err(|e| format!("Invalid input for {}: {}", request.tool_id, e))?;
                if request.options.is_null() {
                    PdfExtractOptions::default()
                } else {
                    serde_json::from_value::<PdfExtractOptions>(request.options)
                        .map_err(|e| format!("Invalid options for {}: {}", request.tool_id, e))?
                };

                Ok(ValidatedToolRequest::PdfExtract(PdfExtractRequest {
                    input_path: input.input_path,
                    output_path: input.output_path,
                    pages: input.pages,
                }))
            }
            RegisteredTool::PdfRotate => {
                let input: PdfRotateInput = serde_json::from_value(request.input)
                    .map_err(|e| format!("Invalid input for {}: {}", request.tool_id, e))?;
                if request.options.is_null() {
                    PdfRotateOptions::default()
                } else {
                    serde_json::from_value::<PdfRotateOptions>(request.options)
                        .map_err(|e| format!("Invalid options for {}: {}", request.tool_id, e))?
                };

                Ok(ValidatedToolRequest::PdfRotate(PdfRotateRequest {
                    input_path: input.input_path,
                    output_path: input.output_path,
                    pages: input.pages,
                    angle_degrees: input.angle_degrees,
                }))
            }
            RegisteredTool::PdfDelete => {
                let input: PdfDeleteInput = serde_json::from_value(request.input)
                    .map_err(|e| format!("Invalid input for {}: {}", request.tool_id, e))?;
                if request.options.is_null() {
                    PdfDeleteOptions::default()
                } else {
                    serde_json::from_value::<PdfDeleteOptions>(request.options)
                        .map_err(|e| format!("Invalid options for {}: {}", request.tool_id, e))?
                };

                Ok(ValidatedToolRequest::PdfDelete(PdfDeleteRequest {
                    input_path: input.input_path,
                    output_path: input.output_path,
                    pages: input.pages,
                }))
            }
            RegisteredTool::PdfInspect => {
                let input: PdfInspectInput = serde_json::from_value(request.input)
                    .map_err(|e| format!("Invalid input for {}: {}", request.tool_id, e))?;
                if request.options.is_null() {
                    PdfInspectOptions::default()
                } else {
                    serde_json::from_value::<PdfInspectOptions>(request.options)
                        .map_err(|e| format!("Invalid options for {}: {}", request.tool_id, e))?
                };

                Ok(ValidatedToolRequest::PdfInspect(PdfInspectRequest {
                    input_path: input.input_path,
                }))
            }
        }
    }
}

enum ValidatedToolRequest {
    ExcelHtmlConverter(ExcelHtmlConverterRequest),
    TextCaseConverter(TextCaseConverterRequest),
    PdfMerge(PdfMergeRequest),
    PdfSplit(PdfSplitRequest),
    PdfExtract(PdfExtractRequest),
    PdfRotate(PdfRotateRequest),
    PdfDelete(PdfDeleteRequest),
    PdfInspect(PdfInspectRequest),
}

impl ValidatedToolRequest {
    fn tool_id(&self) -> &'static str {
        match self {
            ValidatedToolRequest::ExcelHtmlConverter(_) => EXCEL_HTML_CONVERTER_TOOL_ID,
            ValidatedToolRequest::TextCaseConverter(_) => TEXT_CASE_CONVERTER_TOOL_ID,
            ValidatedToolRequest::PdfMerge(_) => PDF_MERGE_TOOL_ID,
            ValidatedToolRequest::PdfSplit(_) => PDF_SPLIT_TOOL_ID,
            ValidatedToolRequest::PdfExtract(_) => PDF_EXTRACT_TOOL_ID,
            ValidatedToolRequest::PdfRotate(_) => PDF_ROTATE_TOOL_ID,
            ValidatedToolRequest::PdfDelete(_) => PDF_DELETE_TOOL_ID,
            ValidatedToolRequest::PdfInspect(_) => PDF_INSPECT_TOOL_ID,
        }
    }

    async fn execute(self, app: tauri::AppHandle) -> Result<Value, String> {
        match self {
            ValidatedToolRequest::ExcelHtmlConverter(request) => {
                ExcelHtmlConverterHandler.execute(app, request).await
            }
            ValidatedToolRequest::TextCaseConverter(request) => {
                TextCaseConverterHandler.execute(app, request).await
            }
            ValidatedToolRequest::PdfMerge(request) => PdfMergeHandler.execute(app, request).await,
            ValidatedToolRequest::PdfSplit(request) => PdfSplitHandler.execute(app, request).await,
            ValidatedToolRequest::PdfExtract(request) => {
                PdfExtractHandler.execute(app, request).await
            }
            ValidatedToolRequest::PdfRotate(request) => {
                PdfRotateHandler.execute(app, request).await
            }
            ValidatedToolRequest::PdfDelete(request) => {
                PdfDeleteHandler.execute(app, request).await
            }
            ValidatedToolRequest::PdfInspect(request) => {
                PdfInspectHandler.execute(app, request).await
            }
        }
    }
}

type ToolExecutionFuture = Pin<Box<dyn Future<Output = Result<Value, String>> + Send>>;

trait ToolHandler {
    type Request;

    fn execute(&self, app: tauri::AppHandle, request: Self::Request) -> ToolExecutionFuture;
}

struct ExcelHtmlConverterHandler;

impl ToolHandler for ExcelHtmlConverterHandler {
    type Request = ExcelHtmlConverterRequest;

    fn execute(&self, app: tauri::AppHandle, request: Self::Request) -> ToolExecutionFuture {
        Box::pin(async move {
            let result = run_excel_conversion_preview(
                app,
                request.input_path,
                request.converter_dir,
                request.zip,
            )
            .await?;
            serde_json::to_value(result)
                .map_err(|e| format!("Failed to serialize tool result: {}", e))
        })
    }
}

struct TextCaseConverterHandler;

impl ToolHandler for TextCaseConverterHandler {
    type Request = TextCaseConverterRequest;

    fn execute(&self, _app: tauri::AppHandle, request: Self::Request) -> ToolExecutionFuture {
        Box::pin(async move {
            let result = convert_text_case(request)?;
            serde_json::to_value(result)
                .map_err(|e| format!("Failed to serialize tool result: {}", e))
        })
    }
}

struct PdfMergeHandler;

impl ToolHandler for PdfMergeHandler {
    type Request = PdfMergeRequest;

    fn execute(&self, _app: tauri::AppHandle, request: Self::Request) -> ToolExecutionFuture {
        Box::pin(async move {
            let result =
                tauri::async_runtime::spawn_blocking(move || run_pdf_merge_bridge(request))
                    .await
                    .map_err(|_| "PDF merge task could not be completed".to_string())??;

            serde_json::to_value(result)
                .map_err(|e| format!("Failed to serialize tool result: {}", e))
        })
    }
}

pub(crate) fn run_pdf_merge_bridge(
    request: PdfMergeRequest,
) -> Result<pdf_tools::PdfMergeResult, String> {
    let input_paths = request.input_paths.into_iter().map(PathBuf::from).collect();
    pdf_tools::merge_pdfs(input_paths, PathBuf::from(request.output_path))
        .map_err(|error| error.to_string())
}

struct PdfSplitHandler;

impl ToolHandler for PdfSplitHandler {
    type Request = PdfSplitRequest;

    fn execute(&self, _app: tauri::AppHandle, request: Self::Request) -> ToolExecutionFuture {
        Box::pin(async move {
            let result =
                tauri::async_runtime::spawn_blocking(move || run_pdf_split_bridge(request))
                    .await
                    .map_err(|_| "PDF split task could not be completed".to_string())??;

            serde_json::to_value(result)
                .map_err(|e| format!("Failed to serialize tool result: {}", e))
        })
    }
}

pub(crate) fn run_pdf_split_bridge(
    request: PdfSplitRequest,
) -> Result<pdf_tools::PdfSplitResult, String> {
    pdf_tools::split_pdf(
        PathBuf::from(request.input_path),
        PathBuf::from(request.output_dir),
        request.output_prefix,
    )
    .map_err(|error| error.to_string())
}

struct PdfExtractHandler;

impl ToolHandler for PdfExtractHandler {
    type Request = PdfExtractRequest;

    fn execute(&self, _app: tauri::AppHandle, request: Self::Request) -> ToolExecutionFuture {
        Box::pin(async move {
            let result =
                tauri::async_runtime::spawn_blocking(move || run_pdf_extract_bridge(request))
                    .await
                    .map_err(|_| "PDF extract task could not be completed".to_string())??;

            serde_json::to_value(result)
                .map_err(|e| format!("Failed to serialize tool result: {}", e))
        })
    }
}

pub(crate) fn run_pdf_extract_bridge(
    request: PdfExtractRequest,
) -> Result<pdf_tools::PdfExtractResult, String> {
    pdf_tools::extract_pdf_pages(
        PathBuf::from(request.input_path),
        PathBuf::from(request.output_path),
        request.pages,
    )
    .map_err(|error| error.to_string())
}

struct PdfRotateHandler;

impl ToolHandler for PdfRotateHandler {
    type Request = PdfRotateRequest;

    fn execute(&self, _app: tauri::AppHandle, request: Self::Request) -> ToolExecutionFuture {
        Box::pin(async move {
            let result =
                tauri::async_runtime::spawn_blocking(move || run_pdf_rotate_bridge(request))
                    .await
                    .map_err(|_| "PDF rotate task could not be completed".to_string())??;

            serde_json::to_value(result)
                .map_err(|e| format!("Failed to serialize tool result: {}", e))
        })
    }
}

pub(crate) fn run_pdf_rotate_bridge(
    request: PdfRotateRequest,
) -> Result<pdf_tools::PdfRotateResult, String> {
    pdf_tools::rotate_pdf_pages(
        PathBuf::from(request.input_path),
        PathBuf::from(request.output_path),
        request.pages,
        request.angle_degrees,
    )
    .map_err(|error| error.to_string())
}

struct PdfDeleteHandler;

impl ToolHandler for PdfDeleteHandler {
    type Request = PdfDeleteRequest;

    fn execute(&self, _app: tauri::AppHandle, request: Self::Request) -> ToolExecutionFuture {
        Box::pin(async move {
            let result =
                tauri::async_runtime::spawn_blocking(move || run_pdf_delete_bridge(request))
                    .await
                    .map_err(|_| "PDF delete task could not be completed".to_string())??;

            serde_json::to_value(result)
                .map_err(|e| format!("Failed to serialize tool result: {}", e))
        })
    }
}

pub(crate) fn run_pdf_delete_bridge(
    request: PdfDeleteRequest,
) -> Result<pdf_tools::PdfDeleteResult, String> {
    pdf_tools::delete_pdf_pages(
        PathBuf::from(request.input_path),
        PathBuf::from(request.output_path),
        request.pages,
    )
    .map_err(|error| error.to_string())
}

struct PdfInspectHandler;

impl ToolHandler for PdfInspectHandler {
    type Request = PdfInspectRequest;

    fn execute(&self, _app: tauri::AppHandle, request: Self::Request) -> ToolExecutionFuture {
        Box::pin(async move {
            let result =
                tauri::async_runtime::spawn_blocking(move || run_pdf_inspect_bridge(request))
                    .await
                    .map_err(|_| "PDF inspect task could not be completed".to_string())??;

            serde_json::to_value(result)
                .map_err(|e| format!("Failed to serialize tool result: {}", e))
        })
    }
}

pub(crate) fn run_pdf_inspect_bridge(
    request: PdfInspectRequest,
) -> Result<pdf_tools::PdfInspectResult, String> {
    pdf_tools::inspect_pdf(PathBuf::from(request.input_path)).map_err(|error| error.to_string())
}

#[derive(Debug, Serialize)]
struct TextCaseConversionResult {
    ok: bool,
    mode: String,
    input_text: String,
    output_text: String,
}

fn convert_text_case(
    request: TextCaseConverterRequest,
) -> Result<TextCaseConversionResult, String> {
    if request.text.trim().is_empty() {
        return Err("text must not be empty".into());
    }

    let output_text = match request.mode {
        TextCaseMode::Uppercase => request.text.to_uppercase(),
        TextCaseMode::Lowercase => request.text.to_lowercase(),
        TextCaseMode::TitleCase => to_title_case(&request.text),
        TextCaseMode::SnakeCase => join_ascii_words(&request.text, "_"),
        TextCaseMode::KebabCase => join_ascii_words(&request.text, "-"),
    };

    Ok(TextCaseConversionResult {
        ok: true,
        mode: request.mode.as_str().to_string(),
        input_text: request.text,
        output_text,
    })
}

fn to_title_case(text: &str) -> String {
    text.split_whitespace()
        .map(|word| {
            let mut characters = word.chars();
            match characters.next() {
                Some(first) => first
                    .to_uppercase()
                    .chain(characters.flat_map(|character| character.to_lowercase()))
                    .collect::<String>(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn join_ascii_words(text: &str, separator: &str) -> String {
    text.split(|character: char| !character.is_ascii_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(str::to_ascii_lowercase)
        .collect::<Vec<_>>()
        .join(separator)
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
enum JobStatus {
    Queued,
    Running,
    Succeeded,
    Failed,
}

#[derive(Clone, Debug, Serialize)]
struct JobRecord {
    job_id: String,
    tool_id: String,
    status: JobStatus,
    created_at: u64,
    result: Option<Value>,
    error: Option<String>,
}

#[derive(Default)]
struct JobManager {
    jobs: Mutex<HashMap<String, JobRecord>>,
    next_job_id: AtomicU64,
}

impl JobManager {
    fn enqueue(&self, tool_id: String) -> Result<String, String> {
        let sequence = self.next_job_id.fetch_add(1, Ordering::Relaxed);
        let created_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis() as u64)
            .unwrap_or(0);
        let job_id = format!("job-{}-{}", created_at, sequence);
        let job = JobRecord {
            job_id: job_id.clone(),
            tool_id,
            status: JobStatus::Queued,
            created_at,
            result: None,
            error: None,
        };

        self.lock_jobs()?.insert(job_id.clone(), job);
        Ok(job_id)
    }

    fn get(&self, job_id: &str) -> Result<JobRecord, String> {
        self.lock_jobs()?
            .get(job_id)
            .cloned()
            .ok_or_else(|| format!("Job not found: {}", job_id))
    }

    fn mark_running(&self, job_id: &str) -> Result<(), String> {
        let mut jobs = self.lock_jobs()?;
        let job = jobs
            .get_mut(job_id)
            .ok_or_else(|| format!("Job not found: {}", job_id))?;
        job.status = JobStatus::Running;
        Ok(())
    }

    fn mark_succeeded(&self, job_id: &str, result: Value) -> Result<(), String> {
        let mut jobs = self.lock_jobs()?;
        let job = jobs
            .get_mut(job_id)
            .ok_or_else(|| format!("Job not found: {}", job_id))?;
        job.status = JobStatus::Succeeded;
        job.result = Some(result);
        job.error = None;
        Ok(())
    }

    fn mark_failed(&self, job_id: &str, error: String) -> Result<(), String> {
        let mut jobs = self.lock_jobs()?;
        let job = jobs
            .get_mut(job_id)
            .ok_or_else(|| format!("Job not found: {}", job_id))?;
        job.status = JobStatus::Failed;
        job.result = None;
        job.error = Some(error);
        Ok(())
    }

    fn lock_jobs(&self) -> Result<std::sync::MutexGuard<'_, HashMap<String, JobRecord>>, String> {
        self.jobs
            .lock()
            .map_err(|_| "JobManager lock is poisoned".to_string())
    }
}

#[tauri::command]
async fn execute_tool(
    app: tauri::AppHandle,
    manager: tauri::State<'_, Arc<JobManager>>,
    request: ToolRequest,
) -> Result<String, String> {
    request.validate_shape()?;
    let registered_tool = ToolRegistry::resolve(&request.tool_id)?;
    let validated_request = registered_tool.parse_request(request)?;
    let job_id = manager.enqueue(validated_request.tool_id().to_string())?;
    let task_job_id = job_id.clone();
    let task_manager = Arc::clone(manager.inner());

    tauri::async_runtime::spawn(async move {
        if let Err(error) = task_manager.mark_running(&task_job_id) {
            let _ = task_manager.mark_failed(&task_job_id, error);
            return;
        }

        match validated_request.execute(app).await {
            Ok(result) => {
                let _ = task_manager.mark_succeeded(&task_job_id, result);
            }
            Err(error) => {
                let _ = task_manager.mark_failed(&task_job_id, error);
            }
        }
    });

    Ok(job_id)
}

#[tauri::command]
fn get_job_status(
    manager: tauri::State<'_, Arc<JobManager>>,
    job_id: String,
) -> Result<JobRecord, String> {
    manager.get(&job_id)
}

fn find_and_run_conversion(
    converter_dir: &str,
    input_path: &str,
    output_path: &str,
    use_zip: bool,
) -> Result<String, String> {
    let candidates: &[&str] = if cfg!(target_os = "windows") {
        &["python", "py"]
    } else {
        &["python3", "python"]
    };
    let mut py_err: Option<String> = None;
    for &cmd in candidates {
        match Command::new(cmd).arg("--version").status() {
            Ok(s) if s.success() => {
                return run_conversion(cmd, converter_dir, input_path, output_path, use_zip);
            }
            Ok(_) => {}
            Err(_) => continue,
        }
        py_err = Some(format!("{} failed", cmd));
    }
    Err(format!(
        "No Python interpreter found. Tried: {:?}. {}",
        candidates,
        py_err.unwrap_or_else(|| "All attempts failed".into())
    ))
}

fn run_conversion(
    python_cmd: &str,
    converter_dir: &str,
    input_path: &str,
    output_path: &str,
    use_zip: bool,
) -> Result<String, String> {
    let args: Vec<&str> = if use_zip {
        vec!["-m", "app.cli", input_path, "--out", output_path, "--zip"]
    } else {
        vec!["-m", "app.cli", input_path, "--out", output_path]
    };

    let output = Command::new(python_cmd)
        .current_dir(converter_dir)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to run {}: {}", python_cmd, e))?;

    let stdout_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr_str = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() {
        Ok(stdout_str)
    } else {
        Err(format!(
            "Converter exited with code {:?}. Stderr: {}",
            output.status.code(),
            if stderr_str.is_empty() {
                "n/a"
            } else {
                &stderr_str
            }
        ))
    }
}

/* ── Phase 4: File picker + preview prototype ── */

#[tauri::command]
fn select_excel_file_dev() -> Result<Option<String>, String> {
    let picked = rfd::FileDialog::new()
        .add_filter("Excel", &["xlsx"])
        .set_title("Select Excel file (.xlsx)")
        .pick_file();

    match picked {
        Some(p) => Ok(Some(p.to_string_lossy().into_owned())),
        None => Ok(None),
    }
}

#[tauri::command]
fn select_converter_directory_dev() -> Result<Option<String>, String> {
    let picked = rfd::FileDialog::new()
        .set_title("Select converter directory")
        .pick_folder();

    match picked {
        Some(p) => Ok(Some(p.to_string_lossy().into_owned())),
        None => Ok(None),
    }
}

fn is_converter_dir(path: &Path) -> bool {
    path.join("app").join("cli.py").exists()
}

#[tauri::command]
fn detect_converter_directory_dev() -> Result<Option<String>, String> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    // relative paths from current working directory
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("..").join("excel-html-converter"));
        candidates.push(cwd.join("..").join("..").join("excel-html-converter"));
    }

    // absolute paths
    candidates.push(PathBuf::from("/workspace/project/excel-html-converter"));
    candidates.push(PathBuf::from(
        "C:\\Users\\glayl\\projects\\excel-html-converter",
    ));

    // USERPROFILE-based path (Windows)
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        candidates.push(
            PathBuf::from(&userprofile)
                .join("projects")
                .join("excel-html-converter"),
        );
    }

    for candidate in candidates {
        if is_converter_dir(&candidate) {
            let resolved = candidate.canonicalize().unwrap_or(candidate);
            return Ok(Some(resolved.to_string_lossy().into_owned()));
        }
    }

    Ok(None)
}

#[derive(Serialize)]
struct ExcelConversionPreview {
    ok: bool,
    mode: String,
    input: String,
    output: String,
    preview_html: Option<String>,
    cli_stdout: String,
}

fn generate_output_path(input_path: &str, is_zip: bool) -> Result<String, String> {
    let stem = Path::new(input_path)
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "converted".to_string());

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let filename = if is_zip {
        format!("{}_{}.zip", stem, timestamp)
    } else {
        format!("{}_{}.html", stem, timestamp)
    };
    let mut out_dir = std::env::temp_dir();
    out_dir.push("utility-tools-hub");
    out_dir.push("excel-html-converter");
    fs::create_dir_all(&out_dir).map_err(|e| format!("Failed to create output dir: {}", e))?;
    Ok(out_dir.join(filename).to_string_lossy().into_owned())
}

async fn run_sidecar_conversion(
    app: &tauri::AppHandle,
    input_path: &str,
    output_path: &str,
    use_zip: bool,
) -> Result<String, String> {
    let mut args = vec![
        input_path.to_string(),
        "--out".to_string(),
        output_path.to_string(),
    ];

    if use_zip {
        args.push("--zip".to_string());
    }

    let output = app
        .shell()
        .sidecar("excel-html-converter")
        .map_err(|e| format!("Excel converter sidecar is not available: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run Excel converter sidecar: {}", e))?;

    let stdout_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr_str = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() {
        Ok(stdout_str)
    } else {
        Err(format!(
            "Excel converter sidecar exited with code {:?}. Stderr: {}",
            output.status.code(),
            if stderr_str.is_empty() {
                "n/a"
            } else {
                &stderr_str
            }
        ))
    }
}

async fn run_excel_conversion_preview(
    app: tauri::AppHandle,
    input_path: String,
    converter_dir: String,
    zip: Option<bool>,
) -> Result<ExcelConversionPreview, String> {
    if !input_path.ends_with(".xlsx") {
        return Err("input_path must end with .xlsx".into());
    }

    let is_zip = zip.unwrap_or(false);
    let output_path = generate_output_path(&input_path, is_zip)?;

    // try sidecar first; fall back to Python CLI if sidecar fails
    let cli_stdout = match run_sidecar_conversion(&app, &input_path, &output_path, is_zip).await {
        Ok(stdout) => stdout,
        Err(sidecar_err) => {
            let conv = PathBuf::from(&converter_dir);
            if !conv.join("app").join("cli.py").exists() {
                return Err(format!(
          "Excel converter sidecar failed: {}. Dev fallback also unavailable: Converter CLI not found at app/cli.py inside {}",
          sidecar_err,
          converter_dir
        ));
            }
            find_and_run_conversion(&converter_dir, &input_path, &output_path, is_zip).map_err(
                |fallback_err| {
                    format!(
                        "Excel converter sidecar failed: {}. Dev fallback also failed: {}",
                        sidecar_err, fallback_err
                    )
                },
            )?
        }
    };

    // optionally read preview HTML for html mode
    let preview_html: Option<String> = if !is_zip {
        Some(
            fs::read_to_string(&output_path)
                .map_err(|e| format!("Failed to read output file: {}", e))?,
        )
    } else {
        None
    };

    let mode_str = if is_zip { "zip" } else { "html" };

    Ok(ExcelConversionPreview {
        ok: true,
        mode: mode_str.to_string(),
        input: input_path,
        output: output_path,
        preview_html,
        cli_stdout,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_resolves_known_tool_id() {
        assert!(matches!(
            ToolRegistry::resolve(EXCEL_HTML_CONVERTER_TOOL_ID),
            Ok(RegisteredTool::ExcelHtmlConverter)
        ));
    }

    #[test]
    fn registry_resolves_text_case_converter_tool_id() {
        assert!(matches!(
            ToolRegistry::resolve(TEXT_CASE_CONVERTER_TOOL_ID),
            Ok(RegisteredTool::TextCaseConverter)
        ));
    }

    #[test]
    fn registry_resolves_pdf_merge_tool_id() {
        assert!(matches!(
            ToolRegistry::resolve(PDF_MERGE_TOOL_ID),
            Ok(RegisteredTool::PdfMerge)
        ));
    }

    #[test]
    fn registry_resolves_pdf_split_tool_id() {
        assert!(matches!(
            ToolRegistry::resolve(PDF_SPLIT_TOOL_ID),
            Ok(RegisteredTool::PdfSplit)
        ));
    }

    #[test]
    fn registry_resolves_pdf_extract_tool_id() {
        assert!(matches!(
            ToolRegistry::resolve(PDF_EXTRACT_TOOL_ID),
            Ok(RegisteredTool::PdfExtract)
        ));
    }

    #[test]
    fn registry_resolves_pdf_rotate_tool_id() {
        assert!(matches!(
            ToolRegistry::resolve(PDF_ROTATE_TOOL_ID),
            Ok(RegisteredTool::PdfRotate)
        ));
    }

    #[test]
    fn registry_resolves_pdf_delete_tool_id() {
        assert!(matches!(
            ToolRegistry::resolve(PDF_DELETE_TOOL_ID),
            Ok(RegisteredTool::PdfDelete)
        ));
    }

    #[test]
    fn registry_resolves_pdf_inspect_tool_id() {
        assert!(matches!(
            ToolRegistry::resolve(PDF_INSPECT_TOOL_ID),
            Ok(RegisteredTool::PdfInspect)
        ));
    }

    #[test]
    fn text_case_converter_rejects_unknown_mode() {
        let error = TextCaseMode::parse("unknown").err().unwrap();
        assert!(error.contains("Unknown text case mode"));
    }

    #[test]
    fn text_case_converter_converts_uppercase() {
        let result =
            convert_text_case(text_case_request("Hello World", TextCaseMode::Uppercase)).unwrap();
        assert_eq!(result.output_text, "HELLO WORLD");
    }

    #[test]
    fn text_case_converter_converts_lowercase() {
        let result =
            convert_text_case(text_case_request("Hello WORLD", TextCaseMode::Lowercase)).unwrap();
        assert_eq!(result.output_text, "hello world");
    }

    #[test]
    fn text_case_converter_converts_title_case() {
        let result =
            convert_text_case(text_case_request("hELLO wORLD", TextCaseMode::TitleCase)).unwrap();
        assert_eq!(result.output_text, "Hello World");
    }

    #[test]
    fn text_case_converter_converts_snake_case() {
        let result = convert_text_case(text_case_request(
            "  Hello--WORLD___again!! ",
            TextCaseMode::SnakeCase,
        ))
        .unwrap();
        assert_eq!(result.output_text, "hello_world_again");
    }

    #[test]
    fn text_case_converter_converts_kebab_case() {
        let result = convert_text_case(text_case_request(
            "  Hello--WORLD___again!! ",
            TextCaseMode::KebabCase,
        ))
        .unwrap();
        assert_eq!(result.output_text, "hello-world-again");
    }

    #[test]
    fn text_case_converter_rejects_empty_text() {
        let error = convert_text_case(text_case_request("   ", TextCaseMode::Uppercase))
            .err()
            .unwrap();
        assert_eq!(error, "text must not be empty");
    }

    #[test]
    fn text_case_converter_rejects_non_string_text() {
        let input = serde_json::json!({ "text": 123 });
        assert!(serde_json::from_value::<TextCaseConverterInput>(input).is_err());
    }

    #[test]
    fn text_case_converter_rejects_unknown_input_field() {
        let input = serde_json::json!({ "text": "hello", "command": "ignored" });
        assert!(serde_json::from_value::<TextCaseConverterInput>(input).is_err());
    }

    #[test]
    fn text_case_converter_rejects_unknown_options_field() {
        let options = serde_json::json!({ "mode": "uppercase", "sidecar": "ignored" });
        assert!(serde_json::from_value::<TextCaseConverterOptions>(options).is_err());
    }

    fn text_case_request(text: &str, mode: TextCaseMode) -> TextCaseConverterRequest {
        TextCaseConverterRequest {
            text: text.to_string(),
            mode,
        }
    }

    #[test]
    fn registry_rejects_unknown_tool_id() {
        let error = ToolRegistry::resolve("unknown_tool").err().unwrap();
        assert!(error.contains("Unknown tool_id"));
    }

    #[test]
    fn job_manager_enqueues_and_gets_job() {
        let manager = JobManager::default();
        let job_id = manager
            .enqueue(EXCEL_HTML_CONVERTER_TOOL_ID.to_string())
            .unwrap();
        let job = manager.get(&job_id).unwrap();

        assert_eq!(job.job_id, job_id);
        assert_eq!(job.tool_id, EXCEL_HTML_CONVERTER_TOOL_ID);
        assert_eq!(job.status, JobStatus::Queued);
    }

    #[test]
    fn job_manager_marks_job_running() {
        let manager = JobManager::default();
        let job_id = manager
            .enqueue(EXCEL_HTML_CONVERTER_TOOL_ID.to_string())
            .unwrap();

        manager.mark_running(&job_id).unwrap();

        assert_eq!(manager.get(&job_id).unwrap().status, JobStatus::Running);
    }

    #[test]
    fn job_manager_stores_success_result() {
        let manager = JobManager::default();
        let job_id = manager
            .enqueue(EXCEL_HTML_CONVERTER_TOOL_ID.to_string())
            .unwrap();
        let result = serde_json::json!({ "output": "result.html" });

        manager.mark_succeeded(&job_id, result.clone()).unwrap();
        let job = manager.get(&job_id).unwrap();

        assert_eq!(job.status, JobStatus::Succeeded);
        assert_eq!(job.result, Some(result));
        assert_eq!(job.error, None);
    }

    #[test]
    fn job_manager_stores_failure_error() {
        let manager = JobManager::default();
        let job_id = manager
            .enqueue(EXCEL_HTML_CONVERTER_TOOL_ID.to_string())
            .unwrap();

        manager
            .mark_failed(&job_id, "conversion failed".into())
            .unwrap();
        let job = manager.get(&job_id).unwrap();

        assert_eq!(job.status, JobStatus::Failed);
        assert_eq!(job.result, None);
        assert_eq!(job.error.as_deref(), Some("conversion failed"));
    }

    #[test]
    fn job_status_serializes_as_snake_case() {
        assert_eq!(
            serde_json::to_string(&JobStatus::Queued).unwrap(),
            "\"queued\""
        );
        assert_eq!(
            serde_json::to_string(&JobStatus::Running).unwrap(),
            "\"running\""
        );
        assert_eq!(
            serde_json::to_string(&JobStatus::Succeeded).unwrap(),
            "\"succeeded\""
        );
        assert_eq!(
            serde_json::to_string(&JobStatus::Failed).unwrap(),
            "\"failed\""
        );
    }

    #[test]
    fn job_ids_are_unique() {
        let manager = JobManager::default();
        let first = manager
            .enqueue(EXCEL_HTML_CONVERTER_TOOL_ID.to_string())
            .unwrap();
        let second = manager
            .enqueue(EXCEL_HTML_CONVERTER_TOOL_ID.to_string())
            .unwrap();

        assert_ne!(first, second);
    }
}
