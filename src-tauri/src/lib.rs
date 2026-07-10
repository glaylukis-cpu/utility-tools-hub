use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
      convert_excel_to_html_dev,
      select_excel_file_dev,
      select_converter_directory_dev,
      detect_converter_directory_dev,
      convert_excel_to_html_preview_dev,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

/* ── Phase 3: original dev bridge (unchanged) ── */

#[tauri::command]
fn convert_excel_to_html_dev(
  input_path: String,
  output_path: String,
  converter_dir: String,
  zip: Option<bool>,
) -> Result<String, String> {
  let conv = PathBuf::from(&converter_dir);
  if !conv.join("app").join("cli.py").exists() {
    return Err(format!("Converter CLI not found at app/cli.py inside {}", converter_dir));
  }
  if !input_path.ends_with(".xlsx") {
    return Err("input_path must end with .xlsx".into());
  }
  let is_zip = zip.unwrap_or(false);
  if is_zip && !output_path.ends_with(".zip") {
    return Err("zip mode requires output_path ending with .zip".into());
  }
  if !is_zip && !output_path.ends_with(".html") {
    return Err("html mode requires output_path ending with .html".into());
  }
  find_and_run_conversion(&converter_dir, &input_path, &output_path, is_zip)
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
      if stderr_str.is_empty() { "n/a" } else { &stderr_str }
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
  candidates.push(PathBuf::from("C:\\Users\\glayl\\projects\\excel-html-converter"));

  // USERPROFILE-based path (Windows)
  if let Ok(userprofile) = std::env::var("USERPROFILE") {
    candidates.push(
      PathBuf::from(&userprofile).join("projects").join("excel-html-converter"),
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

  let filename = if is_zip { format!("{}_{}.zip", stem, timestamp) } else { format!("{}_{}.html", stem, timestamp) };
  let mut out_dir = std::env::temp_dir();
  out_dir.push("utility-tools-hub");
  out_dir.push("excel-html-converter");
  fs::create_dir_all(&out_dir).map_err(|e| format!("Failed to create output dir: {}", e))?;
  Ok(out_dir.join(filename).to_string_lossy().into_owned())
}

#[tauri::command]
fn convert_excel_to_html_preview_dev(
  input_path: String,
  converter_dir: String,
  zip: Option<bool>,
) -> Result<ExcelConversionPreview, String> {
  // safety checks
  let conv = PathBuf::from(&converter_dir);
  if !conv.join("app").join("cli.py").exists() {
    return Err(format!("Converter CLI not found at app/cli.py inside {}", converter_dir));
  }
  if !input_path.ends_with(".xlsx") {
    return Err("input_path must end with .xlsx".into());
  }

  let is_zip = zip.unwrap_or(false);
  let output_path = generate_output_path(&input_path, is_zip)?;

  // run conversion (reuses existing logic)
  let cli_stdout = find_and_run_conversion(&converter_dir, &input_path, &output_path, is_zip)?;

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
  fn command_exists() {
    // just a sanity check that the module compiles
  }
}
