use std::path::PathBuf;
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
    .invoke_handler(tauri::generate_handler![convert_excel_to_html_dev])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[tauri::command]
fn convert_excel_to_html_dev(
  input_path: String,
  output_path: String,
  converter_dir: String,
  zip: Option<bool>,
) -> Result<String, String> {
  // --- safety checks ---
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

  // --- find python executable ---
  let candidates: &[&str] = if cfg!(target_os = "windows") {
    &["python", "py"]
  } else {
    &["python3", "python"]
  };

  let mut py_err: Option<String> = None;
  for &cmd in candidates {
      let status = Command::new(cmd).arg("--version").status();
      if let Ok(s) = status {
          if s.success() {
              return run_conversion(cmd, &converter_dir, &input_path, &output_path, is_zip);
          } else if s.code().map_or(false, |c| c == 127) {
              continue; // command not found
          }
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

  let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
  let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

  if output.status.success() {
    Ok(stdout)
  } else {
    Err(format!(
      "Converter exited with code {:?}. Stderr: {}",
      output.status.code(),
      if stderr.is_empty() { "n/a" } else { &stderr }
    ))
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn command_exists() {
    // just a sanity check that the module compiles
  }
}
