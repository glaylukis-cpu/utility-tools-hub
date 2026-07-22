use lopdf::{
    content::{Content, Operation},
    dictionary, Dictionary, Document, Object, ObjectId,
};
use serde::Serialize;
use std::collections::HashSet;
use std::error::Error;
use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PdfMergeResult {
    pub output_path: String,
    pub input_count: usize,
    pub page_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PdfSplitResult {
    pub output_paths: Vec<String>,
    pub input_path: String,
    pub page_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PdfExtractResult {
    pub output_path: String,
    pub input_path: String,
    pub selected_pages: Vec<usize>,
    pub page_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PdfRotateResult {
    pub output_path: String,
    pub input_path: String,
    pub rotated_pages: Vec<usize>,
    pub angle_degrees: i32,
    pub page_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PdfDeleteResult {
    pub output_path: String,
    pub input_path: String,
    pub deleted_pages: Vec<usize>,
    pub original_page_count: usize,
    pub remaining_page_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PdfReorderResult {
    pub input_path: String,
    pub output_path: String,
    pub page_order: Vec<usize>,
    pub page_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PdfTextWatermarkResult {
    pub input_path: String,
    pub output_path: String,
    pub text: String,
    pub pages: Vec<usize>,
    pub page_count: usize,
}

#[derive(Debug, Clone, Default)]
pub struct PdfTextWatermarkOptions {
    pub pages: Option<Vec<usize>>,
    pub opacity: Option<f32>,
    pub rotation_degrees: Option<f32>,
    pub font_size: Option<f32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PdfInspectResult {
    pub input_path: String,
    pub file_name: String,
    pub file_size_bytes: u64,
    pub pdf_version: String,
    pub page_count: usize,
    pub is_encrypted: bool,
    pub is_protected: bool,
    pub title: Option<String>,
    pub author: Option<String>,
    pub creator: Option<String>,
    pub producer: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PdfToolError {
    NotEnoughInputs,
    InvalidInputExtension,
    InvalidOutputExtension,
    InputNotFound,
    OutputDirectoryNotFound,
    OutputConflictsWithInput,
    InvalidOutputPrefix,
    EmptyPageSelection,
    InvalidPageNumber,
    PageOutOfRange,
    DuplicatePage,
    IncompletePageOrder,
    InvalidRotationAngle,
    EmptyWatermarkText,
    UnsupportedWatermarkText,
    InvalidWatermarkOpacity,
    InvalidWatermarkRotation,
    InvalidWatermarkFontSize,
    CannotDeleteAllPages,
    EncryptedPdfUnsupported,
    InvalidPdf,
    SaveFailed,
}

impl fmt::Display for PdfToolError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::NotEnoughInputs => "at least two input PDF files are required",
            Self::InvalidInputExtension => "every input file must use the .pdf extension",
            Self::InvalidOutputExtension => "the output file must use the .pdf extension",
            Self::InputNotFound => "an input PDF file does not exist",
            Self::OutputDirectoryNotFound => "the output directory does not exist",
            Self::OutputConflictsWithInput => "the output file must differ from every input file",
            Self::InvalidOutputPrefix => {
                "the output prefix must not be empty or contain path separators"
            }
            Self::EmptyPageSelection => "at least one page must be selected",
            Self::InvalidPageNumber => "page numbers must be one or greater",
            Self::PageOutOfRange => "a selected page is outside the input PDF page range",
            Self::DuplicatePage => "duplicate page numbers are not supported",
            Self::IncompletePageOrder => {
                "the page order must include every input PDF page exactly once"
            }
            Self::InvalidRotationAngle => "the rotation angle must be 90, 180, or 270 degrees",
            Self::EmptyWatermarkText => "watermark text must not be empty",
            Self::UnsupportedWatermarkText => {
                "watermark text currently supports printable ASCII characters only"
            }
            Self::InvalidWatermarkOpacity => {
                "watermark opacity must be greater than 0 and no greater than 1"
            }
            Self::InvalidWatermarkRotation => {
                "watermark rotation must be a finite value from -360 to 360 degrees"
            }
            Self::InvalidWatermarkFontSize => {
                "watermark font size must be a finite value from 8 to 200 points"
            }
            Self::CannotDeleteAllPages => "at least one page must remain after deletion",
            Self::EncryptedPdfUnsupported => {
                "encrypted or permission-protected PDF files are not supported yet"
            }
            Self::InvalidPdf => "an input file is not a supported PDF document",
            Self::SaveFailed => "the output PDF could not be saved",
        };

        formatter.write_str(message)
    }
}

impl Error for PdfToolError {}

pub fn inspect_pdf(input_path: PathBuf) -> Result<PdfInspectResult, PdfToolError> {
    if !has_pdf_extension(&input_path) {
        return Err(PdfToolError::InvalidInputExtension);
    }
    if !input_path.is_file() {
        return Err(PdfToolError::InputNotFound);
    }

    let file_size_bytes = fs::metadata(&input_path)
        .map_err(|_| PdfToolError::InputNotFound)?
        .len();
    let document = Document::load(&input_path).map_err(|_| PdfToolError::InvalidPdf)?;
    let is_encrypted = document.is_encrypted() || document.trailer.has(b"Encrypt");
    let is_protected = is_encrypted;
    let page_count = if is_protected {
        0
    } else {
        document.get_pages().len()
    };

    if !is_protected && page_count == 0 {
        return Err(PdfToolError::InvalidPdf);
    }

    let (title, author, creator, producer) = if is_protected {
        (None, None, None, None)
    } else {
        (
            read_document_info(&document, b"Title"),
            read_document_info(&document, b"Author"),
            read_document_info(&document, b"Creator"),
            read_document_info(&document, b"Producer"),
        )
    };

    Ok(PdfInspectResult {
        input_path: input_path.to_string_lossy().into_owned(),
        file_name: input_path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .ok_or(PdfToolError::InvalidPdf)?,
        file_size_bytes,
        pdf_version: document.version,
        page_count,
        is_encrypted,
        is_protected,
        title,
        author,
        creator,
        producer,
    })
}

fn read_document_info(document: &Document, key: &[u8]) -> Option<String> {
    let info = document.trailer.get_deref(b"Info", document).ok()?;
    let dictionary = info.as_dict().ok()?;
    let value = dictionary.get_deref(key, document).ok()?;
    let bytes = value.as_str().ok()?;
    decode_pdf_text(bytes)
}

fn decode_pdf_text(bytes: &[u8]) -> Option<String> {
    let decoded = if bytes.starts_with(&[0xfe, 0xff]) {
        let units = bytes[2..]
            .chunks_exact(2)
            .map(|pair| u16::from_be_bytes([pair[0], pair[1]]))
            .collect::<Vec<_>>();
        String::from_utf16(&units).ok()?
    } else if bytes.starts_with(&[0xff, 0xfe]) {
        let units = bytes[2..]
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect::<Vec<_>>();
        String::from_utf16(&units).ok()?
    } else {
        String::from_utf8_lossy(bytes).into_owned()
    };
    let decoded = decoded.trim_matches(['\0', ' ', '\t', '\r', '\n']);

    (!decoded.is_empty()).then(|| decoded.to_string())
}

pub fn merge_pdfs(
    input_paths: Vec<PathBuf>,
    output_path: PathBuf,
) -> Result<PdfMergeResult, PdfToolError> {
    validate_paths(&input_paths, &output_path)?;

    let input_count = input_paths.len();
    let mut merged_document = Document::with_version("1.5");
    let mut merged_page_ids = Vec::new();
    let mut next_object_id = 1;

    for input_path in &input_paths {
        let mut input_document =
            Document::load(input_path).map_err(|_| PdfToolError::InvalidPdf)?;

        if input_document.is_encrypted() {
            return Err(PdfToolError::EncryptedPdfUnsupported);
        }

        preserve_newer_pdf_version(&mut merged_document, &input_document);

        input_document.renumber_objects_with(next_object_id);
        next_object_id = input_document.max_id.saturating_add(1);

        let page_ids: Vec<ObjectId> = input_document.get_pages().into_values().collect();
        if page_ids.is_empty() {
            return Err(PdfToolError::InvalidPdf);
        }

        for page_id in &page_ids {
            materialize_inherited_page_attributes(&mut input_document, *page_id)?;
        }

        merged_page_ids.extend(page_ids);
        merged_document.objects.extend(input_document.objects);
    }

    merged_document.max_id = next_object_id.saturating_sub(1);
    let pages_id = merged_document.new_object_id();

    for page_id in &merged_page_ids {
        let page = merged_document
            .objects
            .get_mut(page_id)
            .ok_or(PdfToolError::InvalidPdf)?;
        let page_dictionary = page.as_dict_mut().map_err(|_| PdfToolError::InvalidPdf)?;
        page_dictionary.set("Parent", pages_id);
    }

    let kids = merged_page_ids
        .iter()
        .copied()
        .map(Object::Reference)
        .collect::<Vec<_>>();
    merged_document.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => kids,
            "Count" => merged_page_ids.len() as i64,
        }),
    );

    let catalog_id = merged_document.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id,
    });
    merged_document.trailer.set("Root", catalog_id);
    merged_document.prune_objects();
    merged_document.renumber_objects();
    merged_document
        .save(&output_path)
        .map_err(|_| PdfToolError::SaveFailed)?;

    Ok(PdfMergeResult {
        output_path: output_path.to_string_lossy().into_owned(),
        input_count,
        page_count: merged_page_ids.len(),
    })
}

fn preserve_newer_pdf_version(output_document: &mut Document, input_document: &Document) {
    let parse_version = |version: &str| {
        let (major, minor) = version.split_once('.')?;
        Some((major.parse::<u16>().ok()?, minor.parse::<u16>().ok()?))
    };

    if parse_version(&input_document.version) > parse_version(&output_document.version) {
        output_document.version.clone_from(&input_document.version);
    }
}

/// Splits an input PDF into one-page PDF files.
/// Existing files matching the generated output names are overwritten.
pub fn split_pdf(
    input_path: PathBuf,
    output_dir: PathBuf,
    output_prefix: String,
) -> Result<PdfSplitResult, PdfToolError> {
    if !output_dir.is_dir() {
        return Err(PdfToolError::OutputDirectoryNotFound);
    }
    if output_prefix.trim().is_empty()
        || output_prefix
            .chars()
            .any(|character| character == '/' || character == '\\')
    {
        return Err(PdfToolError::InvalidOutputPrefix);
    }

    let input_document = load_pdf_document(&input_path)?;
    let page_ids = input_document.get_pages().into_values().collect::<Vec<_>>();
    let page_count = page_ids.len();
    let mut output_paths = Vec::with_capacity(page_count);

    for (index, page_id) in page_ids.into_iter().enumerate() {
        let output_path = output_dir.join(format!(
            "{output_prefix}-page-{page_number:03}.pdf",
            page_number = index + 1
        ));
        if output_path == input_path {
            return Err(PdfToolError::OutputConflictsWithInput);
        }

        let mut output_document = document_with_selected_pages(input_document.clone(), &[page_id])?;
        output_document
            .save(&output_path)
            .map_err(|_| PdfToolError::SaveFailed)?;
        output_paths.push(output_path.to_string_lossy().into_owned());
    }

    Ok(PdfSplitResult {
        output_paths,
        input_path: input_path.to_string_lossy().into_owned(),
        page_count,
    })
}

/// Extracts selected one-based page numbers into one PDF in the supplied order.
/// An existing output file is overwritten.
pub fn extract_pdf_pages(
    input_path: PathBuf,
    output_path: PathBuf,
    pages: Vec<usize>,
) -> Result<PdfExtractResult, PdfToolError> {
    validate_output_path(&output_path)?;
    if input_path == output_path {
        return Err(PdfToolError::OutputConflictsWithInput);
    }

    let input_document = load_pdf_document(&input_path)?;
    let available_pages = input_document.get_pages();
    let selected_page_ids = validate_selected_pages(&pages, &available_pages)?;
    let page_count = selected_page_ids.len();
    let mut output_document = document_with_selected_pages(input_document, &selected_page_ids)?;
    output_document
        .save(&output_path)
        .map_err(|_| PdfToolError::SaveFailed)?;

    Ok(PdfExtractResult {
        output_path: output_path.to_string_lossy().into_owned(),
        input_path: input_path.to_string_lossy().into_owned(),
        selected_pages: pages,
        page_count,
    })
}

/// Rotates selected one-based page numbers by the supplied clockwise angle.
/// Existing page rotation is preserved by adding the new angle modulo 360.
/// An existing output file is overwritten.
pub fn rotate_pdf_pages(
    input_path: PathBuf,
    output_path: PathBuf,
    pages: Vec<usize>,
    angle_degrees: i32,
) -> Result<PdfRotateResult, PdfToolError> {
    validate_output_path(&output_path)?;
    if input_path == output_path {
        return Err(PdfToolError::OutputConflictsWithInput);
    }
    if !matches!(angle_degrees, 90 | 180 | 270) {
        return Err(PdfToolError::InvalidRotationAngle);
    }

    let mut document = load_pdf_document(&input_path)?;
    let available_pages = document.get_pages();
    let selected_page_ids = validate_selected_pages(&pages, &available_pages)?;
    let page_count = available_pages.len();

    for page_id in selected_page_ids {
        materialize_inherited_page_attributes(&mut document, page_id)?;
        let page = document
            .objects
            .get_mut(&page_id)
            .ok_or(PdfToolError::InvalidPdf)?;
        let page_dictionary = page.as_dict_mut().map_err(|_| PdfToolError::InvalidPdf)?;
        let existing_rotation = match page_dictionary.get(b"Rotate") {
            Ok(Object::Integer(value)) => *value,
            Err(_) => 0,
            Ok(_) => return Err(PdfToolError::InvalidPdf),
        };
        let rotation = (existing_rotation + i64::from(angle_degrees)).rem_euclid(360);
        page_dictionary.set("Rotate", rotation);
    }

    document
        .save(&output_path)
        .map_err(|_| PdfToolError::SaveFailed)?;

    Ok(PdfRotateResult {
        output_path: output_path.to_string_lossy().into_owned(),
        input_path: input_path.to_string_lossy().into_owned(),
        rotated_pages: pages,
        angle_degrees,
        page_count,
    })
}

/// Deletes selected one-based page numbers while preserving remaining page order.
/// An existing output file is overwritten.
pub fn delete_pdf_pages(
    input_path: PathBuf,
    output_path: PathBuf,
    pages: Vec<usize>,
) -> Result<PdfDeleteResult, PdfToolError> {
    validate_output_path(&output_path)?;
    if input_path == output_path {
        return Err(PdfToolError::OutputConflictsWithInput);
    }

    let document = load_pdf_document(&input_path)?;
    let available_pages = document.get_pages();
    let deleted_page_ids = validate_selected_pages(&pages, &available_pages)?
        .into_iter()
        .collect::<HashSet<_>>();
    let original_page_count = available_pages.len();
    if deleted_page_ids.len() == original_page_count {
        return Err(PdfToolError::CannotDeleteAllPages);
    }

    let remaining_page_ids = available_pages
        .into_values()
        .filter(|page_id| !deleted_page_ids.contains(page_id))
        .collect::<Vec<_>>();
    let remaining_page_count = remaining_page_ids.len();
    let mut output_document = document_with_selected_pages(document, &remaining_page_ids)?;
    output_document
        .save(&output_path)
        .map_err(|_| PdfToolError::SaveFailed)?;

    Ok(PdfDeleteResult {
        output_path: output_path.to_string_lossy().into_owned(),
        input_path: input_path.to_string_lossy().into_owned(),
        deleted_pages: pages,
        original_page_count,
        remaining_page_count,
    })
}

/// Writes a new PDF whose pages follow the supplied complete one-based page order.
/// The input PDF is never overwritten.
pub fn reorder_pdf_pages(
    input_path: PathBuf,
    output_path: PathBuf,
    page_order: Vec<usize>,
) -> Result<PdfReorderResult, PdfToolError> {
    validate_output_path(&output_path)?;
    if input_path == output_path {
        return Err(PdfToolError::OutputConflictsWithInput);
    }

    let input_document = load_pdf_document(&input_path)?;
    let available_pages = input_document.get_pages();
    let ordered_page_ids = validate_selected_pages(&page_order, &available_pages)?;
    let page_count = available_pages.len();
    if ordered_page_ids.len() != page_count {
        return Err(PdfToolError::IncompletePageOrder);
    }

    let mut output_document = document_with_selected_pages(input_document, &ordered_page_ids)?;
    output_document
        .save(&output_path)
        .map_err(|_| PdfToolError::SaveFailed)?;

    Ok(PdfReorderResult {
        input_path: input_path.to_string_lossy().into_owned(),
        output_path: output_path.to_string_lossy().into_owned(),
        page_order,
        page_count,
    })
}

/// Adds an ASCII text watermark as a new content stream and writes a new PDF.
/// Existing page content is not edited or removed, and the input PDF is never overwritten.
pub fn add_text_watermark(
    input_path: PathBuf,
    output_path: PathBuf,
    text: String,
    options: PdfTextWatermarkOptions,
) -> Result<PdfTextWatermarkResult, PdfToolError> {
    validate_output_path(&output_path)?;
    if input_path == output_path {
        return Err(PdfToolError::OutputConflictsWithInput);
    }
    validate_watermark_text(&text)?;

    let opacity = options.opacity.unwrap_or(0.18);
    if !opacity.is_finite() || opacity <= 0.0 || opacity > 1.0 {
        return Err(PdfToolError::InvalidWatermarkOpacity);
    }

    let rotation_degrees = options.rotation_degrees.unwrap_or(-35.0);
    if !rotation_degrees.is_finite() || !(-360.0..=360.0).contains(&rotation_degrees) {
        return Err(PdfToolError::InvalidWatermarkRotation);
    }

    let font_size = options.font_size.unwrap_or(48.0);
    if !font_size.is_finite() || !(8.0..=200.0).contains(&font_size) {
        return Err(PdfToolError::InvalidWatermarkFontSize);
    }

    let mut document = load_pdf_document(&input_path)?;
    let available_pages = document.get_pages();
    let page_count = available_pages.len();
    let pages = match options.pages {
        Some(pages) if !pages.is_empty() => pages,
        _ => (1..=page_count).collect(),
    };
    let selected_page_ids = validate_selected_pages(&pages, &available_pages)?;

    let font_id = document.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
        "Encoding" => "WinAnsiEncoding",
    });
    let graphics_state_id = document.add_object(dictionary! {
        "Type" => "ExtGState",
        "ca" => Object::Real(opacity),
        "CA" => Object::Real(opacity),
    });

    for page_id in selected_page_ids {
        materialize_inherited_page_attributes(&mut document, page_id)?;
        let (lower_left_x, lower_left_y, upper_right_x, upper_right_y) =
            resolved_page_box(&document, page_id)?;
        let (font_name, graphics_state_name) =
            install_watermark_resources(&mut document, page_id, font_id, graphics_state_id)?;
        let content = watermark_content(
            &text,
            &font_name,
            &graphics_state_name,
            font_size,
            rotation_degrees,
            lower_left_x,
            lower_left_y,
            upper_right_x,
            upper_right_y,
        )?;
        document
            .add_page_contents(page_id, content)
            .map_err(|_| PdfToolError::InvalidPdf)?;
    }

    document
        .save(&output_path)
        .map_err(|_| PdfToolError::SaveFailed)?;

    Ok(PdfTextWatermarkResult {
        input_path: input_path.to_string_lossy().into_owned(),
        output_path: output_path.to_string_lossy().into_owned(),
        text,
        pages,
        page_count,
    })
}

fn validate_watermark_text(text: &str) -> Result<(), PdfToolError> {
    if text.trim().is_empty() {
        return Err(PdfToolError::EmptyWatermarkText);
    }
    if text.len() > 128
        || !text
            .bytes()
            .all(|byte| byte == b' ' || byte.is_ascii_graphic())
    {
        return Err(PdfToolError::UnsupportedWatermarkText);
    }
    Ok(())
}

fn resolved_page_box(
    document: &Document,
    page_id: ObjectId,
) -> Result<(f32, f32, f32, f32), PdfToolError> {
    let page = document
        .get_object(page_id)
        .map_err(|_| PdfToolError::InvalidPdf)?
        .as_dict()
        .map_err(|_| PdfToolError::InvalidPdf)?;
    let page_box = page
        .get(b"CropBox")
        .or_else(|_| page.get(b"MediaBox"))
        .map_err(|_| PdfToolError::InvalidPdf)?;
    let page_box = resolve_object_clone(document, page_box)?;
    let values = page_box.as_array().map_err(|_| PdfToolError::InvalidPdf)?;
    if values.len() != 4 {
        return Err(PdfToolError::InvalidPdf);
    }

    let lower_left_x = resolved_number(document, &values[0])?;
    let lower_left_y = resolved_number(document, &values[1])?;
    let upper_right_x = resolved_number(document, &values[2])?;
    let upper_right_y = resolved_number(document, &values[3])?;
    if upper_right_x <= lower_left_x || upper_right_y <= lower_left_y {
        return Err(PdfToolError::InvalidPdf);
    }

    Ok((lower_left_x, lower_left_y, upper_right_x, upper_right_y))
}

fn resolved_number(document: &Document, object: &Object) -> Result<f32, PdfToolError> {
    match resolve_object_clone(document, object)? {
        Object::Integer(value) => Ok(value as f32),
        Object::Real(value) if value.is_finite() => Ok(value),
        _ => Err(PdfToolError::InvalidPdf),
    }
}

fn resolve_object_clone(document: &Document, object: &Object) -> Result<Object, PdfToolError> {
    let mut current = object.clone();
    for _ in 0..=document.objects.len() {
        match current {
            Object::Reference(object_id) => {
                current = document
                    .get_object(object_id)
                    .map_err(|_| PdfToolError::InvalidPdf)?
                    .clone();
            }
            _ => return Ok(current),
        }
    }
    Err(PdfToolError::InvalidPdf)
}

fn resolved_dictionary(document: &Document, object: &Object) -> Result<Dictionary, PdfToolError> {
    resolve_object_clone(document, object)?
        .as_dict()
        .map_err(|_| PdfToolError::InvalidPdf)
        .cloned()
}

fn install_watermark_resources(
    document: &mut Document,
    page_id: ObjectId,
    font_id: ObjectId,
    graphics_state_id: ObjectId,
) -> Result<(Vec<u8>, Vec<u8>), PdfToolError> {
    let resources_object = document
        .get_object(page_id)
        .map_err(|_| PdfToolError::InvalidPdf)?
        .as_dict()
        .map_err(|_| PdfToolError::InvalidPdf)?
        .get(b"Resources")
        .ok()
        .cloned();
    let mut resources = match resources_object {
        Some(object) => resolved_dictionary(document, &object)?,
        None => Dictionary::new(),
    };

    let mut fonts = match resources.get(b"Font") {
        Ok(object) => resolved_dictionary(document, object)?,
        Err(_) => Dictionary::new(),
    };
    let font_name = unique_resource_name(&fonts, b"UTHWatermarkFont");
    fonts.set(font_name.clone(), Object::Reference(font_id));
    resources.set("Font", Object::Dictionary(fonts));

    let mut graphics_states = match resources.get(b"ExtGState") {
        Ok(object) => resolved_dictionary(document, object)?,
        Err(_) => Dictionary::new(),
    };
    let graphics_state_name = unique_resource_name(&graphics_states, b"UTHWatermarkGS");
    graphics_states.set(
        graphics_state_name.clone(),
        Object::Reference(graphics_state_id),
    );
    resources.set("ExtGState", Object::Dictionary(graphics_states));

    document
        .get_object_mut(page_id)
        .map_err(|_| PdfToolError::InvalidPdf)?
        .as_dict_mut()
        .map_err(|_| PdfToolError::InvalidPdf)?
        .set("Resources", Object::Dictionary(resources));

    Ok((font_name, graphics_state_name))
}

fn unique_resource_name(dictionary: &Dictionary, base_name: &[u8]) -> Vec<u8> {
    if dictionary.get(base_name).is_err() {
        return base_name.to_vec();
    }

    for suffix in 1_u64.. {
        let candidate = format!("{}{}", String::from_utf8_lossy(base_name), suffix).into_bytes();
        if dictionary.get(&candidate).is_err() {
            return candidate;
        }
    }

    unreachable!("the resource-name suffix space cannot be exhausted")
}

#[allow(clippy::too_many_arguments)]
fn watermark_content(
    text: &str,
    font_name: &[u8],
    graphics_state_name: &[u8],
    font_size: f32,
    rotation_degrees: f32,
    lower_left_x: f32,
    lower_left_y: f32,
    upper_right_x: f32,
    upper_right_y: f32,
) -> Result<Vec<u8>, PdfToolError> {
    let radians = rotation_degrees.to_radians();
    let cosine = radians.cos();
    let sine = radians.sin();
    let center_x = lower_left_x + (upper_right_x - lower_left_x) / 2.0;
    let center_y = lower_left_y + (upper_right_y - lower_left_y) / 2.0;
    let estimated_width = text.len() as f32 * font_size * 0.5;
    let text_x = center_x - (estimated_width * cosine) / 2.0;
    let text_y = center_y - (estimated_width * sine) / 2.0;

    Content {
        operations: vec![
            Operation::new("q", vec![]),
            Operation::new("gs", vec![Object::Name(graphics_state_name.to_vec())]),
            Operation::new("BT", vec![]),
            Operation::new(
                "Tf",
                vec![Object::Name(font_name.to_vec()), Object::Real(font_size)],
            ),
            Operation::new("g", vec![Object::Real(0.45)]),
            Operation::new(
                "Tm",
                vec![
                    Object::Real(cosine),
                    Object::Real(sine),
                    Object::Real(-sine),
                    Object::Real(cosine),
                    Object::Real(text_x),
                    Object::Real(text_y),
                ],
            ),
            Operation::new("Tj", vec![Object::string_literal(text)]),
            Operation::new("ET", vec![]),
            Operation::new("Q", vec![]),
        ],
    }
    .encode()
    .map_err(|_| PdfToolError::InvalidPdf)
}

fn load_pdf_document(input_path: &Path) -> Result<Document, PdfToolError> {
    if !has_pdf_extension(input_path) {
        return Err(PdfToolError::InvalidInputExtension);
    }
    if !input_path.is_file() {
        return Err(PdfToolError::InputNotFound);
    }

    let document = Document::load(input_path).map_err(|_| PdfToolError::InvalidPdf)?;
    if document.is_encrypted() {
        return Err(PdfToolError::EncryptedPdfUnsupported);
    }
    if document.get_pages().is_empty() {
        return Err(PdfToolError::InvalidPdf);
    }

    Ok(document)
}

fn validate_output_path(output_path: &Path) -> Result<(), PdfToolError> {
    if !has_pdf_extension(output_path) {
        return Err(PdfToolError::InvalidOutputExtension);
    }

    let output_directory = output_path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    if !output_directory.is_dir() {
        return Err(PdfToolError::OutputDirectoryNotFound);
    }

    Ok(())
}

fn validate_selected_pages(
    pages: &[usize],
    available_pages: &std::collections::BTreeMap<u32, ObjectId>,
) -> Result<Vec<ObjectId>, PdfToolError> {
    if pages.is_empty() {
        return Err(PdfToolError::EmptyPageSelection);
    }

    let mut seen_pages = HashSet::with_capacity(pages.len());
    let mut selected_page_ids = Vec::with_capacity(pages.len());

    for &page_number in pages {
        if page_number == 0 {
            return Err(PdfToolError::InvalidPageNumber);
        }
        if !seen_pages.insert(page_number) {
            return Err(PdfToolError::DuplicatePage);
        }

        let page_number = u32::try_from(page_number).map_err(|_| PdfToolError::PageOutOfRange)?;
        let page_id = available_pages
            .get(&page_number)
            .copied()
            .ok_or(PdfToolError::PageOutOfRange)?;
        selected_page_ids.push(page_id);
    }

    Ok(selected_page_ids)
}

fn document_with_selected_pages(
    mut document: Document,
    selected_page_ids: &[ObjectId],
) -> Result<Document, PdfToolError> {
    for &page_id in selected_page_ids {
        materialize_inherited_page_attributes(&mut document, page_id)?;
    }

    let pages_id = document.new_object_id();
    for &page_id in selected_page_ids {
        let page = document
            .objects
            .get_mut(&page_id)
            .ok_or(PdfToolError::InvalidPdf)?;
        let page_dictionary = page.as_dict_mut().map_err(|_| PdfToolError::InvalidPdf)?;
        page_dictionary.set("Parent", pages_id);
    }

    let kids = selected_page_ids
        .iter()
        .copied()
        .map(Object::Reference)
        .collect::<Vec<_>>();
    document.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => kids,
            "Count" => selected_page_ids.len() as i64,
        }),
    );

    let catalog_id = document.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id,
    });
    document.trailer.set("Root", catalog_id);
    document.prune_objects();
    document.renumber_objects();
    Ok(document)
}

fn validate_paths(input_paths: &[PathBuf], output_path: &Path) -> Result<(), PdfToolError> {
    if input_paths.len() < 2 {
        return Err(PdfToolError::NotEnoughInputs);
    }

    if !has_pdf_extension(output_path) {
        return Err(PdfToolError::InvalidOutputExtension);
    }

    let output_directory = output_path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    if !output_directory.is_dir() {
        return Err(PdfToolError::OutputDirectoryNotFound);
    }

    for input_path in input_paths {
        if !has_pdf_extension(input_path) {
            return Err(PdfToolError::InvalidInputExtension);
        }
        if !input_path.is_file() {
            return Err(PdfToolError::InputNotFound);
        }
        if input_path == output_path {
            return Err(PdfToolError::OutputConflictsWithInput);
        }
    }

    Ok(())
}

fn has_pdf_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("pdf"))
}

fn materialize_inherited_page_attributes(
    document: &mut Document,
    page_id: ObjectId,
) -> Result<(), PdfToolError> {
    let mut page_dictionary = document
        .get_object(page_id)
        .map_err(|_| PdfToolError::InvalidPdf)?
        .as_dict()
        .map_err(|_| PdfToolError::InvalidPdf)?
        .clone();

    for key in [b"Resources".as_slice(), b"MediaBox", b"CropBox", b"Rotate"] {
        if page_dictionary.get(key).is_err() {
            if let Some(value) = find_inherited_page_attribute(document, page_id, key)? {
                page_dictionary.set(key, value);
            }
        }
    }

    document
        .objects
        .insert(page_id, Object::Dictionary(page_dictionary));
    Ok(())
}

fn find_inherited_page_attribute(
    document: &Document,
    page_id: ObjectId,
    key: &[u8],
) -> Result<Option<Object>, PdfToolError> {
    let mut current_id = page_id;

    for _ in 0..=document.objects.len() {
        let dictionary = document
            .get_object(current_id)
            .map_err(|_| PdfToolError::InvalidPdf)?
            .as_dict()
            .map_err(|_| PdfToolError::InvalidPdf)?;

        if let Ok(value) = dictionary.get(key) {
            return Ok(Some(value.clone()));
        }

        current_id = match dictionary.get(b"Parent") {
            Ok(Object::Reference(parent_id)) => *parent_id,
            Err(_) => return Ok(None),
            Ok(_) => return Err(PdfToolError::InvalidPdf),
        };
    }

    Err(PdfToolError::InvalidPdf)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        run_pdf_delete_bridge, run_pdf_extract_bridge, run_pdf_inspect_bridge,
        run_pdf_merge_bridge, run_pdf_reorder_bridge, run_pdf_rotate_bridge, run_pdf_split_bridge,
        run_pdf_text_watermark_bridge, PdfDeleteRequest, PdfExtractRequest, PdfInspectRequest,
        PdfMergeRequest, PdfReorderRequest, PdfRotateRequest, PdfSplitRequest,
        PdfTextWatermarkRequest,
    };
    use lopdf::Stream;
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEMP_DIRECTORY_COUNTER: AtomicU64 = AtomicU64::new(0);

    struct TestDirectory {
        path: PathBuf,
    }

    impl TestDirectory {
        fn new() -> Self {
            let unique = TEMP_DIRECTORY_COUNTER.fetch_add(1, Ordering::Relaxed);
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time should be after the Unix epoch")
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "utility-tools-hub-pdf-tests-{}-{timestamp}-{unique}",
                std::process::id()
            ));
            fs::create_dir_all(&path).expect("test directory should be created");
            Self { path }
        }

        fn path(&self, file_name: &str) -> PathBuf {
            self.path.join(file_name)
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    #[test]
    fn inspects_a_normal_pdf_with_file_and_document_metadata() {
        let directory = TestDirectory::new();
        let input = directory.path("inspect-fixture.pdf");
        create_pdf_with_metadata(&input);

        let result = inspect_pdf(input.clone()).expect("PDF inspection should succeed");

        assert_eq!(result.input_path, input.to_string_lossy());
        assert_eq!(result.file_name, "inspect-fixture.pdf");
        assert!(result.file_size_bytes > 0);
        assert_eq!(result.pdf_version, "1.5");
        assert_eq!(result.page_count, 1);
        assert!(!result.is_encrypted);
        assert!(!result.is_protected);
        assert_eq!(result.title.as_deref(), Some("Inspection fixture"));
        assert_eq!(result.author.as_deref(), Some("Utility Tools Hub"));
        assert_eq!(result.creator.as_deref(), Some("PDF inspection tests"));
        assert_eq!(result.producer.as_deref(), Some("lopdf"));
    }

    #[test]
    fn inspects_a_multi_page_pdf() {
        let directory = TestDirectory::new();
        let input = directory.path("multi-page.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q", b"q Q"]);

        let result = inspect_pdf(input).expect("multi-page inspection should succeed");

        assert_eq!(result.page_count, 3);
        assert_eq!(result.title, None);
        assert_eq!(result.author, None);
        assert_eq!(result.creator, None);
        assert_eq!(result.producer, None);
    }

    #[test]
    fn inspection_rejects_a_non_pdf_extension_and_missing_file() {
        let directory = TestDirectory::new();

        assert_eq!(
            inspect_pdf(directory.path("input.txt")).unwrap_err(),
            PdfToolError::InvalidInputExtension
        );
        assert_eq!(
            inspect_pdf(directory.path("missing.pdf")).unwrap_err(),
            PdfToolError::InputNotFound
        );
    }

    #[test]
    fn inspection_detects_a_protected_pdf_without_decrypting_it() {
        let directory = TestDirectory::new();
        let input = directory.path("protected.pdf");
        create_single_page_pdf(&input);

        let mut protected_document = Document::load(&input).expect("fixture should load");
        let encryption_id = protected_document.add_object(dictionary! {
            "Filter" => "Standard",
        });
        protected_document.trailer.set("Encrypt", encryption_id);
        protected_document
            .save(&input)
            .expect("protected marker should be saved");

        let result = inspect_pdf(input).expect("protected PDF should return safe partial details");

        assert!(result.is_encrypted);
        assert!(result.is_protected);
        assert_eq!(result.page_count, 0);
        assert_eq!(result.title, None);
    }

    #[test]
    fn pdf_inspect_bridge_returns_serializable_core_result() {
        let directory = TestDirectory::new();
        let input = directory.path("bridge-inspect.pdf");
        create_single_page_pdf(&input);

        let result = run_pdf_inspect_bridge(PdfInspectRequest {
            input_path: input.to_string_lossy().into_owned(),
        })
        .expect("PDF inspect bridge should succeed");

        assert_eq!(result.file_name, "bridge-inspect.pdf");
        assert_eq!(result.page_count, 1);
        assert!(!result.is_protected);
    }

    #[test]
    fn merges_two_pdf_files() {
        let directory = TestDirectory::new();
        let first = directory.path("first.pdf");
        let second = directory.path("second.pdf");
        let output = directory.path("merged.pdf");
        let first_content = b"q 1 0 0 1 10 10 cm Q";
        let second_content = b"q 1 0 0 1 20 20 cm Q";
        create_single_page_pdf_with_content(&first, first_content);
        create_single_page_pdf_with_content(&second, second_content);

        let result = merge_pdfs(vec![first, second], output.clone()).expect("merge should succeed");
        let merged_document = Document::load(output.clone()).expect("merged PDF should load");
        let merged_pages = merged_document.get_pages();

        assert!(output.is_file());
        assert_eq!(result.input_count, 2);
        assert_eq!(result.page_count, 2);
        assert_eq!(merged_pages.len(), 2);
        assert_eq!(
            merged_document
                .get_page_content(merged_pages[&1])
                .expect("first merged page content should load"),
            first_content
        );
        assert_eq!(
            merged_document
                .get_page_content(merged_pages[&2])
                .expect("second merged page content should load"),
            second_content
        );
    }

    #[test]
    fn merges_multi_page_pdfs_with_nested_page_trees_and_compressed_streams() {
        let directory = TestDirectory::new();
        let first = directory.path("browser-print-a.pdf");
        let second = directory.path("browser-print-b.pdf");
        let output = directory.path("browser-print-merged.pdf");
        let first_markers: [&[u8]; 2] = [b"FIRST-A ", b"FIRST-B "];
        let second_markers: [&[u8]; 3] = [b"SECOND-A ", b"SECOND-B ", b"SECOND-C "];
        create_nested_page_tree_pdf(&first, &first_markers);
        create_nested_page_tree_pdf(&second, &second_markers);

        let result = merge_pdfs(vec![first, second], output.clone()).expect("merge should succeed");
        let merged_document = Document::load(&output).expect("merged PDF should load");
        let merged_pages = merged_document.get_pages();
        let expected_markers = first_markers
            .into_iter()
            .chain(second_markers)
            .collect::<Vec<_>>();

        assert!(output.is_file());
        assert_eq!(result.input_count, 2);
        assert_eq!(result.page_count, 5);
        assert_eq!(merged_pages.len(), 5);
        assert_eq!(merged_document.version, "1.7");

        for (index, marker) in expected_markers.into_iter().enumerate() {
            assert_eq!(
                merged_document
                    .get_page_content(merged_pages[&((index + 1) as u32)])
                    .expect("merged page content should load"),
                marker.repeat(64)
            );
        }
    }

    #[test]
    fn rejects_a_single_input_pdf() {
        let directory = TestDirectory::new();
        let input = directory.path("input.pdf");
        create_single_page_pdf(&input);

        let error = merge_pdfs(vec![input], directory.path("merged.pdf")).unwrap_err();

        assert_eq!(error, PdfToolError::NotEnoughInputs);
    }

    #[test]
    fn rejects_non_pdf_input_extension() {
        let directory = TestDirectory::new();
        let first = directory.path("first.pdf");
        let second = directory.path("second.txt");
        create_single_page_pdf(&first);
        fs::write(&second, b"not a PDF").expect("test input should be written");

        let error = merge_pdfs(vec![first, second], directory.path("merged.pdf")).unwrap_err();

        assert_eq!(error, PdfToolError::InvalidInputExtension);
    }

    #[test]
    fn rejects_non_pdf_output_extension() {
        let directory = TestDirectory::new();
        let first = directory.path("first.pdf");
        let second = directory.path("second.pdf");
        create_single_page_pdf(&first);
        create_single_page_pdf(&second);

        let error = merge_pdfs(vec![first, second], directory.path("merged.txt")).unwrap_err();

        assert_eq!(error, PdfToolError::InvalidOutputExtension);
    }

    #[test]
    fn rejects_a_missing_input_pdf() {
        let directory = TestDirectory::new();
        let existing = directory.path("existing.pdf");
        create_single_page_pdf(&existing);

        let error = merge_pdfs(
            vec![existing, directory.path("missing.pdf")],
            directory.path("merged.pdf"),
        )
        .unwrap_err();

        assert_eq!(error, PdfToolError::InputNotFound);
    }

    #[test]
    fn rejects_a_missing_output_directory() {
        let directory = TestDirectory::new();
        let first = directory.path("first.pdf");
        let second = directory.path("second.pdf");
        create_single_page_pdf(&first);
        create_single_page_pdf(&second);

        let error = merge_pdfs(
            vec![first, second],
            directory.path("missing-output").join("merged.pdf"),
        )
        .unwrap_err();

        assert_eq!(error, PdfToolError::OutputDirectoryNotFound);
    }

    #[test]
    fn rejects_an_output_path_that_matches_an_input() {
        let directory = TestDirectory::new();
        let first = directory.path("first.pdf");
        let second = directory.path("second.pdf");
        create_single_page_pdf(&first);
        create_single_page_pdf(&second);

        let error = merge_pdfs(vec![first.clone(), second], first).unwrap_err();

        assert_eq!(error, PdfToolError::OutputConflictsWithInput);
    }

    #[test]
    fn rejects_a_corrupted_input_pdf() {
        let directory = TestDirectory::new();
        let corrupted = directory.path("corrupted.pdf");
        let valid = directory.path("valid.pdf");
        fs::write(&corrupted, b"%PDF-1.7\ncorrupted input")
            .expect("corrupted fixture should be written");
        create_single_page_pdf(&valid);

        let error = merge_pdfs(vec![corrupted, valid], directory.path("merged.pdf")).unwrap_err();

        assert_eq!(error, PdfToolError::InvalidPdf);
    }

    #[test]
    fn rejects_an_encrypted_input_pdf() {
        let directory = TestDirectory::new();
        let encrypted = directory.path("encrypted.pdf");
        let valid = directory.path("valid.pdf");
        create_single_page_pdf(&encrypted);
        create_single_page_pdf(&valid);

        let mut encrypted_document = Document::load(&encrypted).expect("fixture should load");
        let encryption_id = encrypted_document.add_object(dictionary! {
            "Filter" => "Standard",
        });
        encrypted_document.trailer.set("Encrypt", encryption_id);
        encrypted_document
            .save(&encrypted)
            .expect("encrypted marker should be saved");

        let error = merge_pdfs(vec![encrypted, valid], directory.path("merged.pdf")).unwrap_err();

        assert_eq!(error, PdfToolError::EncryptedPdfUnsupported);
        assert_eq!(
            error.to_string(),
            "encrypted or permission-protected PDF files are not supported yet"
        );
    }

    #[test]
    fn splits_a_three_page_pdf_into_single_page_files() {
        let directory = TestDirectory::new();
        let input = directory.path("split-input.pdf");
        let output_dir = directory.path("split-output");
        fs::create_dir_all(&output_dir).expect("split output directory should be created");
        let page_contents: [&[u8]; 3] = [
            b"q 1 0 0 1 10 10 cm Q",
            b"q 1 0 0 1 20 20 cm Q",
            b"q 1 0 0 1 30 30 cm Q",
        ];
        create_pdf_with_page_contents(&input, &page_contents);

        let result = split_pdf(input.clone(), output_dir, "section".to_string())
            .expect("split should succeed");

        assert_eq!(result.input_path, input.to_string_lossy());
        assert_eq!(result.output_paths.len(), 3);
        assert_eq!(result.page_count, 3);

        for (index, output_path) in result.output_paths.iter().enumerate() {
            let output_path = PathBuf::from(output_path);
            let output_document = Document::load(&output_path).expect("split PDF should load");
            let output_pages = output_document.get_pages();

            assert!(output_path.is_file());
            assert_eq!(output_pages.len(), 1);
            assert_eq!(
                output_document
                    .get_page_content(output_pages[&1])
                    .expect("split page content should load"),
                page_contents[index]
            );
        }

        assert!(result.output_paths[0].ends_with("section-page-001.pdf"));
        assert!(result.output_paths[2].ends_with("section-page-003.pdf"));
    }

    #[test]
    fn split_rejects_non_pdf_input_extension() {
        let directory = TestDirectory::new();
        let input = directory.path("split-input.txt");
        let output_dir = directory.path("split-output");
        fs::create_dir_all(&output_dir).expect("split output directory should be created");
        create_single_page_pdf(&input);

        let error = split_pdf(input, output_dir, "section".to_string()).unwrap_err();

        assert_eq!(error, PdfToolError::InvalidInputExtension);
    }

    #[test]
    fn split_rejects_missing_output_directory() {
        let directory = TestDirectory::new();
        let input = directory.path("split-input.pdf");
        create_single_page_pdf(&input);

        let error = split_pdf(
            input,
            directory.path("missing-output"),
            "section".to_string(),
        )
        .unwrap_err();

        assert_eq!(error, PdfToolError::OutputDirectoryNotFound);
    }

    #[test]
    fn split_rejects_empty_output_prefix() {
        let directory = TestDirectory::new();
        let input = directory.path("split-input.pdf");
        create_single_page_pdf(&input);

        let error = split_pdf(input, directory.path.clone(), "   ".to_string()).unwrap_err();

        assert_eq!(error, PdfToolError::InvalidOutputPrefix);
    }

    #[test]
    fn extracts_selected_pages_in_the_requested_order() {
        let directory = TestDirectory::new();
        let input = directory.path("extract-input.pdf");
        let output = directory.path("extracted.pdf");
        let page_contents: [&[u8]; 4] = [
            b"q 1 0 0 1 10 10 cm Q",
            b"q 1 0 0 1 20 20 cm Q",
            b"q 1 0 0 1 30 30 cm Q",
            b"q 1 0 0 1 40 40 cm Q",
        ];
        create_pdf_with_page_contents(&input, &page_contents);

        let result = extract_pdf_pages(input.clone(), output.clone(), vec![1, 3])
            .expect("extract should succeed");
        let output_document = Document::load(&output).expect("extracted PDF should load");
        let output_pages = output_document.get_pages();

        assert!(output.is_file());
        assert_eq!(result.input_path, input.to_string_lossy());
        assert_eq!(result.output_path, output.to_string_lossy());
        assert_eq!(result.selected_pages, vec![1, 3]);
        assert_eq!(result.page_count, 2);
        assert_eq!(output_pages.len(), 2);
        assert_eq!(
            output_document
                .get_page_content(output_pages[&1])
                .expect("first extracted page content should load"),
            page_contents[0]
        );
        assert_eq!(
            output_document
                .get_page_content(output_pages[&2])
                .expect("second extracted page content should load"),
            page_contents[2]
        );
    }

    #[test]
    fn extract_rejects_empty_page_selection() {
        let directory = TestDirectory::new();
        let input = directory.path("extract-input.pdf");
        create_single_page_pdf(&input);

        let error = extract_pdf_pages(input, directory.path("extracted.pdf"), vec![]).unwrap_err();

        assert_eq!(error, PdfToolError::EmptyPageSelection);
    }

    #[test]
    fn extract_rejects_zero_page_number() {
        let directory = TestDirectory::new();
        let input = directory.path("extract-input.pdf");
        create_single_page_pdf(&input);

        let error = extract_pdf_pages(input, directory.path("extracted.pdf"), vec![0]).unwrap_err();

        assert_eq!(error, PdfToolError::InvalidPageNumber);
    }

    #[test]
    fn extract_rejects_page_out_of_range() {
        let directory = TestDirectory::new();
        let input = directory.path("extract-input.pdf");
        create_single_page_pdf(&input);

        let error = extract_pdf_pages(input, directory.path("extracted.pdf"), vec![2]).unwrap_err();

        assert_eq!(error, PdfToolError::PageOutOfRange);
    }

    #[test]
    fn extract_rejects_duplicate_page_numbers() {
        let directory = TestDirectory::new();
        let input = directory.path("extract-input.pdf");
        create_single_page_pdf(&input);

        let error =
            extract_pdf_pages(input, directory.path("extracted.pdf"), vec![1, 1]).unwrap_err();

        assert_eq!(error, PdfToolError::DuplicatePage);
    }

    #[test]
    fn extract_rejects_non_pdf_input_extension() {
        let directory = TestDirectory::new();
        let input = directory.path("extract-input.txt");
        create_single_page_pdf(&input);

        let error = extract_pdf_pages(input, directory.path("extracted.pdf"), vec![1]).unwrap_err();

        assert_eq!(error, PdfToolError::InvalidInputExtension);
    }

    #[test]
    fn extract_rejects_non_pdf_output_extension() {
        let directory = TestDirectory::new();
        let input = directory.path("extract-input.pdf");
        create_single_page_pdf(&input);

        let error = extract_pdf_pages(input, directory.path("extracted.txt"), vec![1]).unwrap_err();

        assert_eq!(error, PdfToolError::InvalidOutputExtension);
    }

    #[test]
    fn extract_rejects_missing_output_directory() {
        let directory = TestDirectory::new();
        let input = directory.path("extract-input.pdf");
        create_single_page_pdf(&input);

        let error = extract_pdf_pages(
            input,
            directory.path("missing-output").join("extracted.pdf"),
            vec![1],
        )
        .unwrap_err();

        assert_eq!(error, PdfToolError::OutputDirectoryNotFound);
    }

    #[test]
    fn rotates_selected_pages() {
        let directory = TestDirectory::new();
        let input = directory.path("rotate-input.pdf");
        let output = directory.path("rotated.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q 1 0 0 1 2 2 cm Q", b"q Q"]);

        let result = rotate_pdf_pages(input.clone(), output.clone(), vec![1, 3], 90)
            .expect("rotation should succeed");
        let output_document = Document::load(&output).expect("rotated PDF should load");

        assert!(output.is_file());
        assert_eq!(result.input_path, input.to_string_lossy());
        assert_eq!(result.output_path, output.to_string_lossy());
        assert_eq!(result.rotated_pages, vec![1, 3]);
        assert_eq!(result.angle_degrees, 90);
        assert_eq!(result.page_count, 3);
        assert_eq!(page_rotation(&output_document, 1), Some(90));
        assert_eq!(page_rotation(&output_document, 2), None);
        assert_eq!(page_rotation(&output_document, 3), Some(90));
    }

    #[test]
    fn rotate_adds_to_existing_rotation_and_normalizes() {
        let directory = TestDirectory::new();
        let input = directory.path("rotate-existing-input.pdf");
        let output = directory.path("rotate-existing-output.pdf");
        create_single_page_pdf(&input);

        let mut input_document = Document::load(&input).expect("input PDF should load");
        let page_id = input_document.get_pages()[&1];
        input_document
            .get_object_mut(page_id)
            .expect("page should exist")
            .as_dict_mut()
            .expect("page should be a dictionary")
            .set("Rotate", 270_i64);
        input_document
            .save(&input)
            .expect("input PDF with rotation should be saved");

        rotate_pdf_pages(input, output.clone(), vec![1], 180).expect("rotation should succeed");
        let output_document = Document::load(output).expect("rotated PDF should load");

        assert_eq!(page_rotation(&output_document, 1), Some(90));
    }

    #[test]
    fn rotate_rejects_invalid_angle() {
        let directory = TestDirectory::new();
        let input = directory.path("rotate-input.pdf");
        create_single_page_pdf(&input);

        for angle in [0, 45, 360, -90] {
            let error =
                rotate_pdf_pages(input.clone(), directory.path("rotated.pdf"), vec![1], angle)
                    .unwrap_err();
            assert_eq!(error, PdfToolError::InvalidRotationAngle);
        }
    }

    #[test]
    fn rotate_rejects_invalid_page_selections() {
        let directory = TestDirectory::new();
        let input = directory.path("rotate-input.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q"]);

        let cases = [
            (vec![], PdfToolError::EmptyPageSelection),
            (vec![0], PdfToolError::InvalidPageNumber),
            (vec![3], PdfToolError::PageOutOfRange),
            (vec![1, 1], PdfToolError::DuplicatePage),
        ];
        for (pages, expected_error) in cases {
            let error = rotate_pdf_pages(input.clone(), directory.path("rotated.pdf"), pages, 90)
                .unwrap_err();
            assert_eq!(error, expected_error);
        }
    }

    #[test]
    fn rotate_rejects_non_pdf_extensions() {
        let directory = TestDirectory::new();
        let invalid_input = directory.path("rotate-input.txt");
        create_single_page_pdf(&invalid_input);

        let input_error =
            rotate_pdf_pages(invalid_input, directory.path("rotated.pdf"), vec![1], 90)
                .unwrap_err();
        assert_eq!(input_error, PdfToolError::InvalidInputExtension);

        let input = directory.path("rotate-input.pdf");
        create_single_page_pdf(&input);
        let output_error =
            rotate_pdf_pages(input, directory.path("rotated.txt"), vec![1], 90).unwrap_err();
        assert_eq!(output_error, PdfToolError::InvalidOutputExtension);
    }

    #[test]
    fn rotate_rejects_missing_input_and_output_directory() {
        let directory = TestDirectory::new();
        let missing_input_error = rotate_pdf_pages(
            directory.path("missing.pdf"),
            directory.path("rotated.pdf"),
            vec![1],
            90,
        )
        .unwrap_err();
        assert_eq!(missing_input_error, PdfToolError::InputNotFound);

        let input = directory.path("rotate-input.pdf");
        create_single_page_pdf(&input);
        let missing_output_error = rotate_pdf_pages(
            input,
            directory.path("missing-output").join("rotated.pdf"),
            vec![1],
            90,
        )
        .unwrap_err();
        assert_eq!(missing_output_error, PdfToolError::OutputDirectoryNotFound);
    }

    #[test]
    fn deletes_selected_pages_and_preserves_order() {
        let directory = TestDirectory::new();
        let input = directory.path("delete-input.pdf");
        let output = directory.path("deleted.pdf");
        let page_contents: [&[u8]; 4] = [
            b"q 1 0 0 1 10 10 cm Q",
            b"q 1 0 0 1 20 20 cm Q",
            b"q 1 0 0 1 30 30 cm Q",
            b"q 1 0 0 1 40 40 cm Q",
        ];
        create_pdf_with_page_contents(&input, &page_contents);

        let result = delete_pdf_pages(input.clone(), output.clone(), vec![2, 4])
            .expect("deletion should succeed");
        let output_document = Document::load(&output).expect("deleted-page PDF should load");
        let output_pages = output_document.get_pages();

        assert!(output.is_file());
        assert_eq!(result.input_path, input.to_string_lossy());
        assert_eq!(result.output_path, output.to_string_lossy());
        assert_eq!(result.deleted_pages, vec![2, 4]);
        assert_eq!(result.original_page_count, 4);
        assert_eq!(result.remaining_page_count, 2);
        assert_eq!(output_pages.len(), 2);
        assert_eq!(
            output_document
                .get_page_content(output_pages[&1])
                .expect("first remaining page content should load"),
            page_contents[0]
        );
        assert_eq!(
            output_document
                .get_page_content(output_pages[&2])
                .expect("second remaining page content should load"),
            page_contents[2]
        );
    }

    #[test]
    fn delete_rejects_invalid_page_selections() {
        let directory = TestDirectory::new();
        let input = directory.path("delete-input.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q"]);

        let cases = [
            (vec![], PdfToolError::EmptyPageSelection),
            (vec![0], PdfToolError::InvalidPageNumber),
            (vec![3], PdfToolError::PageOutOfRange),
            (vec![1, 1], PdfToolError::DuplicatePage),
        ];
        for (pages, expected_error) in cases {
            let error =
                delete_pdf_pages(input.clone(), directory.path("deleted.pdf"), pages).unwrap_err();
            assert_eq!(error, expected_error);
        }
    }

    #[test]
    fn delete_rejects_all_pages() {
        let directory = TestDirectory::new();
        let input = directory.path("delete-input.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q"]);

        let error = delete_pdf_pages(input, directory.path("deleted.pdf"), vec![1, 2]).unwrap_err();

        assert_eq!(error, PdfToolError::CannotDeleteAllPages);
    }

    #[test]
    fn delete_rejects_non_pdf_extensions() {
        let directory = TestDirectory::new();
        let invalid_input = directory.path("delete-input.txt");
        create_pdf_with_page_contents(&invalid_input, &[b"q Q", b"q Q"]);

        let input_error =
            delete_pdf_pages(invalid_input, directory.path("deleted.pdf"), vec![1]).unwrap_err();
        assert_eq!(input_error, PdfToolError::InvalidInputExtension);

        let input = directory.path("delete-input.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q"]);
        let output_error =
            delete_pdf_pages(input, directory.path("deleted.txt"), vec![1]).unwrap_err();
        assert_eq!(output_error, PdfToolError::InvalidOutputExtension);
    }

    #[test]
    fn delete_rejects_missing_input_and_output_directory() {
        let directory = TestDirectory::new();
        let missing_input_error = delete_pdf_pages(
            directory.path("missing.pdf"),
            directory.path("deleted.pdf"),
            vec![1],
        )
        .unwrap_err();
        assert_eq!(missing_input_error, PdfToolError::InputNotFound);

        let input = directory.path("delete-input.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q"]);
        let missing_output_error = delete_pdf_pages(
            input,
            directory.path("missing-output").join("deleted.pdf"),
            vec![1],
        )
        .unwrap_err();
        assert_eq!(missing_output_error, PdfToolError::OutputDirectoryNotFound);
    }

    #[test]
    fn reorders_all_pages_in_the_requested_order() {
        let directory = TestDirectory::new();
        let input = directory.path("reorder-input.pdf");
        let output = directory.path("reordered.pdf");
        let page_contents: [&[u8]; 3] = [
            b"q 1 0 0 1 10 10 cm Q",
            b"q 1 0 0 1 20 20 cm Q",
            b"q 1 0 0 1 30 30 cm Q",
        ];
        create_pdf_with_page_contents(&input, &page_contents);

        let result = reorder_pdf_pages(input.clone(), output.clone(), vec![3, 1, 2])
            .expect("reorder should succeed");
        let output_document = Document::load(&output).expect("reordered PDF should load");
        let output_pages = output_document.get_pages();
        let input_document = Document::load(&input).expect("input PDF should remain readable");
        let input_pages = input_document.get_pages();

        assert!(output.is_file());
        assert_eq!(result.input_path, input.to_string_lossy());
        assert_eq!(result.output_path, output.to_string_lossy());
        assert_eq!(result.page_order, vec![3, 1, 2]);
        assert_eq!(result.page_count, 3);
        assert_eq!(output_pages.len(), 3);
        assert_eq!(
            output_document
                .get_page_content(output_pages[&1])
                .expect("first reordered page content should load"),
            page_contents[2]
        );
        assert_eq!(
            output_document
                .get_page_content(output_pages[&2])
                .expect("second reordered page content should load"),
            page_contents[0]
        );
        assert_eq!(
            output_document
                .get_page_content(output_pages[&3])
                .expect("third reordered page content should load"),
            page_contents[1]
        );
        assert_eq!(input_pages.len(), 3);
        assert_eq!(
            input_document
                .get_page_content(input_pages[&1])
                .expect("original first page content should load"),
            page_contents[0]
        );
    }

    #[test]
    fn reorder_rejects_invalid_page_orders() {
        let directory = TestDirectory::new();
        let input = directory.path("reorder-input.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q", b"q Q"]);

        let cases = [
            (vec![], PdfToolError::EmptyPageSelection),
            (vec![0, 1, 2], PdfToolError::InvalidPageNumber),
            (vec![1, 2, 4], PdfToolError::PageOutOfRange),
            (vec![1, 2, 2], PdfToolError::DuplicatePage),
            (vec![1, 2], PdfToolError::IncompletePageOrder),
        ];
        for (page_order, expected_error) in cases {
            let error =
                reorder_pdf_pages(input.clone(), directory.path("reordered.pdf"), page_order)
                    .unwrap_err();
            assert_eq!(error, expected_error);
        }
    }

    #[test]
    fn reorder_rejects_non_pdf_extensions() {
        let directory = TestDirectory::new();
        let invalid_input = directory.path("reorder-input.txt");
        create_pdf_with_page_contents(&invalid_input, &[b"q Q", b"q Q"]);

        let input_error =
            reorder_pdf_pages(invalid_input, directory.path("reordered.pdf"), vec![2, 1])
                .unwrap_err();
        assert_eq!(input_error, PdfToolError::InvalidInputExtension);

        let input = directory.path("reorder-input.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q"]);
        let output_error =
            reorder_pdf_pages(input, directory.path("reordered.txt"), vec![2, 1]).unwrap_err();
        assert_eq!(output_error, PdfToolError::InvalidOutputExtension);
    }

    #[test]
    fn reorder_rejects_missing_paths_and_input_overwrite() {
        let directory = TestDirectory::new();
        let missing_input_error = reorder_pdf_pages(
            directory.path("missing.pdf"),
            directory.path("reordered.pdf"),
            vec![1],
        )
        .unwrap_err();
        assert_eq!(missing_input_error, PdfToolError::InputNotFound);

        let input = directory.path("reorder-input.pdf");
        create_single_page_pdf(&input);
        let missing_output_error = reorder_pdf_pages(
            input.clone(),
            directory.path("missing-output").join("reordered.pdf"),
            vec![1],
        )
        .unwrap_err();
        assert_eq!(missing_output_error, PdfToolError::OutputDirectoryNotFound);

        let overwrite_error = reorder_pdf_pages(input.clone(), input, vec![1]).unwrap_err();
        assert_eq!(overwrite_error, PdfToolError::OutputConflictsWithInput);
    }

    #[test]
    fn reorder_rejects_a_protected_pdf_without_decrypting_it() {
        let directory = TestDirectory::new();
        let input = directory.path("protected-reorder-input.pdf");
        let output = directory.path("reordered.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q"]);

        let mut protected_document = Document::load(&input).expect("fixture should load");
        let encryption_id = protected_document.add_object(dictionary! {
            "Filter" => "Standard",
            "V" => 1,
        });
        protected_document.trailer.set("Encrypt", encryption_id);
        protected_document
            .save(&input)
            .expect("protected marker should be saved");

        let error = reorder_pdf_pages(input, output.clone(), vec![2, 1]).unwrap_err();

        assert_eq!(error, PdfToolError::EncryptedPdfUnsupported);
        assert!(!output.exists());
    }

    #[test]
    fn reorder_bridge_reorders_all_pages() {
        let directory = TestDirectory::new();
        let input = directory.path("reorder-bridge-input.pdf");
        let output = directory.path("reorder-bridge-output.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q 1 0 0 1 2 2 cm Q", b"q Q"]);

        let result =
            run_pdf_reorder_bridge(pdf_reorder_request(input, output.clone(), vec![3, 1, 2]))
                .expect("reorder bridge should succeed");

        assert!(output.is_file());
        assert_eq!(result.page_order, vec![3, 1, 2]);
        assert_eq!(result.page_count, 3);
        assert_eq!(
            Document::load(output)
                .expect("bridge output PDF should load")
                .get_pages()
                .len(),
            3
        );
    }

    #[test]
    fn adds_text_watermark_to_all_pages_and_preserves_source() {
        let directory = TestDirectory::new();
        let input = directory.path("watermark-input.pdf");
        let output = directory.path("watermark-output.pdf");
        create_pdf_with_page_contents(
            &input,
            &[b"q % SOURCE-1 Q", b"q % SOURCE-2 Q", b"q % SOURCE-3 Q"],
        );
        let original_bytes = fs::read(&input).expect("source PDF should be readable");

        let result = add_text_watermark(
            input.clone(),
            output.clone(),
            "DRAFT".to_string(),
            PdfTextWatermarkOptions::default(),
        )
        .expect("text watermark should be added");

        assert_eq!(result.text, "DRAFT");
        assert_eq!(result.pages, vec![1, 2, 3]);
        assert_eq!(result.page_count, 3);
        assert_eq!(
            fs::read(&input).expect("source PDF should remain readable"),
            original_bytes
        );

        let output_document = Document::load(&output).expect("watermarked PDF should reload");
        let output_pages = output_document.get_pages();
        assert_eq!(output_pages.len(), 3);
        for page_id in output_pages.values() {
            let content = output_document
                .get_page_content(*page_id)
                .expect("watermarked page content should be readable");
            assert!(contains_bytes(&content, b"DRAFT"));
            assert!(contains_bytes(&content, b"SOURCE-"));
        }

        let empty_pages_output = directory.path("empty-pages-watermark-output.pdf");
        let empty_pages_result = add_text_watermark(
            input,
            empty_pages_output,
            "DRAFT".to_string(),
            PdfTextWatermarkOptions {
                pages: Some(vec![]),
                ..PdfTextWatermarkOptions::default()
            },
        )
        .expect("an empty page list should target every page");
        assert_eq!(empty_pages_result.pages, vec![1, 2, 3]);
    }

    #[test]
    fn adds_text_watermark_only_to_selected_pages() {
        let directory = TestDirectory::new();
        let input = directory.path("selected-watermark-input.pdf");
        let output = directory.path("selected-watermark-output.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q", b"q Q"]);

        let result = add_text_watermark(
            input,
            output.clone(),
            "SAMPLE".to_string(),
            PdfTextWatermarkOptions {
                pages: Some(vec![1, 3]),
                opacity: Some(0.25),
                rotation_degrees: Some(-30.0),
                font_size: Some(42.0),
            },
        )
        .expect("selected pages should be watermarked");

        assert_eq!(result.pages, vec![1, 3]);
        let output_document = Document::load(output).expect("watermarked PDF should reload");
        for (page_number, page_id) in output_document.get_pages() {
            let content = output_document
                .get_page_content(page_id)
                .expect("page content should be readable");
            assert_eq!(
                contains_bytes(&content, b"SAMPLE"),
                page_number == 1 || page_number == 3
            );
        }
    }

    #[test]
    fn text_watermark_preserves_inherited_page_resources() {
        let directory = TestDirectory::new();
        let input = directory.path("nested-watermark-input.pdf");
        let output = directory.path("nested-watermark-output.pdf");
        create_nested_page_tree_pdf(&input, &[b"NESTED-1", b"NESTED-2"]);

        add_text_watermark(
            input,
            output.clone(),
            "DRAFT".to_string(),
            PdfTextWatermarkOptions::default(),
        )
        .expect("inherited resources should be preserved");

        let output_document = Document::load(output).expect("watermarked PDF should reload");
        assert_eq!(output_document.get_pages().len(), 2);
        for page_id in output_document.get_pages().values() {
            let fonts = output_document
                .get_page_fonts(*page_id)
                .expect("page fonts should remain readable");
            assert!(fonts.contains_key(b"F1".as_slice()));
            assert!(fonts.contains_key(b"UTHWatermarkFont".as_slice()));
            let content = output_document
                .get_page_content(*page_id)
                .expect("page content should remain readable");
            assert!(contains_bytes(&content, b"NESTED-"));
            assert!(contains_bytes(&content, b"DRAFT"));
        }
    }

    #[test]
    fn text_watermark_validates_text_and_page_selection() {
        let directory = TestDirectory::new();
        let input = directory.path("watermark-validation-input.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q"]);

        let cases = [
            ("   ", None, PdfToolError::EmptyWatermarkText, "empty.pdf"),
            (
                "日本語",
                None,
                PdfToolError::UnsupportedWatermarkText,
                "unsupported.pdf",
            ),
            (
                "DRAFT",
                Some(vec![0]),
                PdfToolError::InvalidPageNumber,
                "zero.pdf",
            ),
            (
                "DRAFT",
                Some(vec![3]),
                PdfToolError::PageOutOfRange,
                "range.pdf",
            ),
            (
                "DRAFT",
                Some(vec![1, 1]),
                PdfToolError::DuplicatePage,
                "duplicate.pdf",
            ),
        ];

        for (text, pages, expected_error, output_name) in cases {
            let error = add_text_watermark(
                input.clone(),
                directory.path(output_name),
                text.to_string(),
                PdfTextWatermarkOptions {
                    pages,
                    ..PdfTextWatermarkOptions::default()
                },
            )
            .unwrap_err();
            assert_eq!(error, expected_error);
        }
    }

    #[test]
    fn text_watermark_validates_opacity_rotation_and_font_size() {
        let directory = TestDirectory::new();
        let input = directory.path("watermark-style-input.pdf");
        create_single_page_pdf(&input);

        for opacity in [0.0, -0.1, 1.1, f32::NAN] {
            let error = add_text_watermark(
                input.clone(),
                directory.path("opacity.pdf"),
                "DRAFT".to_string(),
                PdfTextWatermarkOptions {
                    opacity: Some(opacity),
                    ..PdfTextWatermarkOptions::default()
                },
            )
            .unwrap_err();
            assert_eq!(error, PdfToolError::InvalidWatermarkOpacity);
        }

        for font_size in [7.9, 200.1, f32::INFINITY] {
            let error = add_text_watermark(
                input.clone(),
                directory.path("font-size.pdf"),
                "DRAFT".to_string(),
                PdfTextWatermarkOptions {
                    font_size: Some(font_size),
                    ..PdfTextWatermarkOptions::default()
                },
            )
            .unwrap_err();
            assert_eq!(error, PdfToolError::InvalidWatermarkFontSize);
        }

        let rotation_error = add_text_watermark(
            input,
            directory.path("rotation.pdf"),
            "DRAFT".to_string(),
            PdfTextWatermarkOptions {
                rotation_degrees: Some(f32::NAN),
                ..PdfTextWatermarkOptions::default()
            },
        )
        .unwrap_err();
        assert_eq!(rotation_error, PdfToolError::InvalidWatermarkRotation);
    }

    #[test]
    fn text_watermark_rejects_invalid_paths_and_source_overwrite() {
        let directory = TestDirectory::new();
        let input = directory.path("watermark-path-input.pdf");
        create_single_page_pdf(&input);

        assert_eq!(
            add_text_watermark(
                directory.path("input.txt"),
                directory.path("output.pdf"),
                "DRAFT".to_string(),
                PdfTextWatermarkOptions::default(),
            )
            .unwrap_err(),
            PdfToolError::InvalidInputExtension
        );
        assert_eq!(
            add_text_watermark(
                input.clone(),
                directory.path("output.txt"),
                "DRAFT".to_string(),
                PdfTextWatermarkOptions::default(),
            )
            .unwrap_err(),
            PdfToolError::InvalidOutputExtension
        );
        assert_eq!(
            add_text_watermark(
                directory.path("missing.pdf"),
                directory.path("missing-output.pdf"),
                "DRAFT".to_string(),
                PdfTextWatermarkOptions::default(),
            )
            .unwrap_err(),
            PdfToolError::InputNotFound
        );
        assert_eq!(
            add_text_watermark(
                input.clone(),
                directory.path("missing-directory").join("output.pdf"),
                "DRAFT".to_string(),
                PdfTextWatermarkOptions::default(),
            )
            .unwrap_err(),
            PdfToolError::OutputDirectoryNotFound
        );
        assert_eq!(
            add_text_watermark(
                input.clone(),
                input,
                "DRAFT".to_string(),
                PdfTextWatermarkOptions::default(),
            )
            .unwrap_err(),
            PdfToolError::OutputConflictsWithInput
        );
    }

    #[test]
    fn text_watermark_rejects_a_protected_pdf_without_decrypting_it() {
        let directory = TestDirectory::new();
        let input = directory.path("protected-watermark-input.pdf");
        let output = directory.path("protected-watermark-output.pdf");
        create_single_page_pdf(&input);

        let mut protected_document = Document::load(&input).expect("fixture should load");
        let encryption_id = protected_document.add_object(dictionary! {
            "Filter" => "Standard",
            "V" => 1,
        });
        protected_document.trailer.set("Encrypt", encryption_id);
        protected_document
            .save(&input)
            .expect("protected marker should be saved");

        let error = add_text_watermark(
            input,
            output.clone(),
            "DRAFT".to_string(),
            PdfTextWatermarkOptions::default(),
        )
        .unwrap_err();

        assert_eq!(error, PdfToolError::EncryptedPdfUnsupported);
        assert!(!output.exists());
    }

    #[test]
    fn text_watermark_bridge_writes_a_new_pdf() {
        let directory = TestDirectory::new();
        let input = directory.path("watermark-bridge-input.pdf");
        let output = directory.path("watermark-bridge-output.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q", b"q Q"]);

        let result = run_pdf_text_watermark_bridge(pdf_text_watermark_request(
            input,
            output.clone(),
            "CONFIDENTIAL",
            Some(vec![1, 3]),
        ))
        .expect("text watermark bridge should succeed");

        assert!(output.is_file());
        assert_eq!(result.text, "CONFIDENTIAL");
        assert_eq!(result.pages, vec![1, 3]);
        assert_eq!(result.page_count, 3);
    }

    #[test]
    fn split_bridge_splits_a_three_page_pdf() {
        let directory = TestDirectory::new();
        let input = directory.path("split-bridge-input.pdf");
        let output_dir = directory.path("split-bridge-output");
        fs::create_dir_all(&output_dir).expect("split bridge output directory should be created");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q 1 0 0 1 2 2 cm Q", b"q Q"]);

        let result = run_pdf_split_bridge(pdf_split_request(input, output_dir, "bridge-section"))
            .expect("split bridge should succeed");

        assert_eq!(result.page_count, 3);
        assert_eq!(result.output_paths.len(), 3);
        assert!(result
            .output_paths
            .iter()
            .all(|output_path| Path::new(output_path).is_file()));
    }

    #[test]
    fn split_bridge_rejects_non_pdf_input_extension() {
        let directory = TestDirectory::new();
        let input = directory.path("split-bridge-input.txt");
        create_single_page_pdf(&input);

        let error = run_pdf_split_bridge(pdf_split_request(
            input,
            directory.path.clone(),
            "bridge-section",
        ))
        .unwrap_err();

        assert_eq!(error, PdfToolError::InvalidInputExtension.to_string());
    }

    #[test]
    fn split_bridge_rejects_empty_output_prefix() {
        let directory = TestDirectory::new();
        let input = directory.path("split-bridge-input.pdf");
        create_single_page_pdf(&input);

        let error = run_pdf_split_bridge(pdf_split_request(input, directory.path.clone(), "   "))
            .unwrap_err();

        assert_eq!(error, PdfToolError::InvalidOutputPrefix.to_string());
    }

    #[test]
    fn extract_bridge_extracts_selected_pages() {
        let directory = TestDirectory::new();
        let input = directory.path("extract-bridge-input.pdf");
        let output = directory.path("extract-bridge-output.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q 1 0 0 1 2 2 cm Q", b"q Q", b"q Q"]);

        let result = run_pdf_extract_bridge(pdf_extract_request(input, output.clone(), vec![1, 3]))
            .expect("extract bridge should succeed");

        assert!(output.is_file());
        assert_eq!(result.selected_pages, vec![1, 3]);
        assert_eq!(result.page_count, 2);
    }

    #[test]
    fn extract_bridge_rejects_empty_page_selection() {
        let directory = TestDirectory::new();
        let input = directory.path("extract-bridge-input.pdf");
        create_single_page_pdf(&input);

        let error = run_pdf_extract_bridge(pdf_extract_request(
            input,
            directory.path("extract-bridge-output.pdf"),
            vec![],
        ))
        .unwrap_err();

        assert_eq!(error, PdfToolError::EmptyPageSelection.to_string());
    }

    #[test]
    fn extract_bridge_rejects_zero_page_number() {
        let directory = TestDirectory::new();
        let input = directory.path("extract-bridge-input.pdf");
        create_single_page_pdf(&input);

        let error = run_pdf_extract_bridge(pdf_extract_request(
            input,
            directory.path("extract-bridge-output.pdf"),
            vec![0],
        ))
        .unwrap_err();

        assert_eq!(error, PdfToolError::InvalidPageNumber.to_string());
    }

    #[test]
    fn extract_bridge_rejects_non_pdf_output_extension() {
        let directory = TestDirectory::new();
        let input = directory.path("extract-bridge-input.pdf");
        create_single_page_pdf(&input);

        let error = run_pdf_extract_bridge(pdf_extract_request(
            input,
            directory.path("extract-bridge-output.txt"),
            vec![1],
        ))
        .unwrap_err();

        assert_eq!(error, PdfToolError::InvalidOutputExtension.to_string());
    }

    #[test]
    fn rotate_bridge_rotates_selected_pages() {
        let directory = TestDirectory::new();
        let input = directory.path("rotate-bridge-input.pdf");
        let output = directory.path("rotate-bridge-output.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q 1 0 0 1 2 2 cm Q", b"q Q"]);

        let result =
            run_pdf_rotate_bridge(pdf_rotate_request(input, output.clone(), vec![1, 3], 90))
                .expect("rotate bridge should succeed");

        assert!(output.is_file());
        assert_eq!(result.rotated_pages, vec![1, 3]);
        assert_eq!(result.angle_degrees, 90);
        assert_eq!(result.page_count, 3);
    }

    #[test]
    fn rotate_bridge_rejects_invalid_angle() {
        let directory = TestDirectory::new();
        let input = directory.path("rotate-bridge-input.pdf");
        create_single_page_pdf(&input);

        let error = run_pdf_rotate_bridge(pdf_rotate_request(
            input,
            directory.path("rotate-bridge-output.pdf"),
            vec![1],
            45,
        ))
        .unwrap_err();

        assert_eq!(error, PdfToolError::InvalidRotationAngle.to_string());
    }

    #[test]
    fn rotate_bridge_rejects_empty_and_zero_page_selections() {
        let directory = TestDirectory::new();
        let input = directory.path("rotate-bridge-input.pdf");
        create_single_page_pdf(&input);

        let empty_error = run_pdf_rotate_bridge(pdf_rotate_request(
            input.clone(),
            directory.path("rotate-bridge-output.pdf"),
            vec![],
            90,
        ))
        .unwrap_err();
        assert_eq!(empty_error, PdfToolError::EmptyPageSelection.to_string());

        let zero_error = run_pdf_rotate_bridge(pdf_rotate_request(
            input,
            directory.path("rotate-bridge-output.pdf"),
            vec![0],
            90,
        ))
        .unwrap_err();
        assert_eq!(zero_error, PdfToolError::InvalidPageNumber.to_string());
    }

    #[test]
    fn rotate_bridge_rejects_non_pdf_output_extension() {
        let directory = TestDirectory::new();
        let input = directory.path("rotate-bridge-input.pdf");
        create_single_page_pdf(&input);

        let error = run_pdf_rotate_bridge(pdf_rotate_request(
            input,
            directory.path("rotate-bridge-output.txt"),
            vec![1],
            90,
        ))
        .unwrap_err();

        assert_eq!(error, PdfToolError::InvalidOutputExtension.to_string());
    }

    #[test]
    fn delete_bridge_deletes_selected_pages() {
        let directory = TestDirectory::new();
        let input = directory.path("delete-bridge-input.pdf");
        let output = directory.path("delete-bridge-output.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q", b"q Q", b"q Q"]);

        let result = run_pdf_delete_bridge(pdf_delete_request(input, output.clone(), vec![2, 4]))
            .expect("delete bridge should succeed");

        assert!(output.is_file());
        assert_eq!(result.deleted_pages, vec![2, 4]);
        assert_eq!(result.original_page_count, 4);
        assert_eq!(result.remaining_page_count, 2);
    }

    #[test]
    fn delete_bridge_rejects_empty_and_zero_page_selections() {
        let directory = TestDirectory::new();
        let input = directory.path("delete-bridge-input.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q"]);

        let empty_error = run_pdf_delete_bridge(pdf_delete_request(
            input.clone(),
            directory.path("delete-bridge-output.pdf"),
            vec![],
        ))
        .unwrap_err();
        assert_eq!(empty_error, PdfToolError::EmptyPageSelection.to_string());

        let zero_error = run_pdf_delete_bridge(pdf_delete_request(
            input,
            directory.path("delete-bridge-output.pdf"),
            vec![0],
        ))
        .unwrap_err();
        assert_eq!(zero_error, PdfToolError::InvalidPageNumber.to_string());
    }

    #[test]
    fn delete_bridge_rejects_non_pdf_output_extension() {
        let directory = TestDirectory::new();
        let input = directory.path("delete-bridge-input.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q"]);

        let error = run_pdf_delete_bridge(pdf_delete_request(
            input,
            directory.path("delete-bridge-output.txt"),
            vec![1],
        ))
        .unwrap_err();

        assert_eq!(error, PdfToolError::InvalidOutputExtension.to_string());
    }

    #[test]
    fn delete_bridge_rejects_all_pages() {
        let directory = TestDirectory::new();
        let input = directory.path("delete-bridge-input.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q"]);

        let error = run_pdf_delete_bridge(pdf_delete_request(
            input,
            directory.path("delete-bridge-output.pdf"),
            vec![1, 2],
        ))
        .unwrap_err();

        assert_eq!(error, PdfToolError::CannotDeleteAllPages.to_string());
    }

    #[test]
    fn bridge_merges_two_pdf_files() {
        let directory = TestDirectory::new();
        let first = directory.path("bridge-first.pdf");
        let second = directory.path("bridge-second.pdf");
        let output = directory.path("bridge-merged.pdf");
        create_single_page_pdf(&first);
        create_single_page_pdf(&second);

        let result = run_pdf_merge_bridge(pdf_merge_request(vec![first, second], output.clone()))
            .expect("bridge merge should succeed");

        assert!(output.is_file());
        assert_eq!(result.input_count, 2);
        assert_eq!(result.page_count, 2);
    }

    #[test]
    fn bridge_rejects_a_single_input_pdf() {
        let directory = TestDirectory::new();
        let input = directory.path("bridge-input.pdf");
        create_single_page_pdf(&input);

        let error = run_pdf_merge_bridge(pdf_merge_request(
            vec![input],
            directory.path("bridge-merged.pdf"),
        ))
        .unwrap_err();

        assert_eq!(error, PdfToolError::NotEnoughInputs.to_string());
    }

    #[test]
    fn bridge_rejects_non_pdf_input_extension() {
        let directory = TestDirectory::new();
        let first = directory.path("bridge-first.pdf");
        let second = directory.path("bridge-second.txt");
        create_single_page_pdf(&first);
        fs::write(&second, b"not a PDF").expect("test input should be written");

        let error = run_pdf_merge_bridge(pdf_merge_request(
            vec![first, second],
            directory.path("bridge-merged.pdf"),
        ))
        .unwrap_err();

        assert_eq!(error, PdfToolError::InvalidInputExtension.to_string());
    }

    #[test]
    fn bridge_rejects_non_pdf_output_extension() {
        let directory = TestDirectory::new();
        let first = directory.path("bridge-first.pdf");
        let second = directory.path("bridge-second.pdf");
        create_single_page_pdf(&first);
        create_single_page_pdf(&second);

        let error = run_pdf_merge_bridge(pdf_merge_request(
            vec![first, second],
            directory.path("bridge-merged.txt"),
        ))
        .unwrap_err();

        assert_eq!(error, PdfToolError::InvalidOutputExtension.to_string());
    }

    fn pdf_split_request(
        input_path: PathBuf,
        output_dir: PathBuf,
        output_prefix: &str,
    ) -> PdfSplitRequest {
        PdfSplitRequest {
            input_path: input_path.to_string_lossy().into_owned(),
            output_dir: output_dir.to_string_lossy().into_owned(),
            output_prefix: output_prefix.to_string(),
        }
    }

    fn pdf_extract_request(
        input_path: PathBuf,
        output_path: PathBuf,
        pages: Vec<usize>,
    ) -> PdfExtractRequest {
        PdfExtractRequest {
            input_path: input_path.to_string_lossy().into_owned(),
            output_path: output_path.to_string_lossy().into_owned(),
            pages,
        }
    }

    fn pdf_rotate_request(
        input_path: PathBuf,
        output_path: PathBuf,
        pages: Vec<usize>,
        angle_degrees: i32,
    ) -> PdfRotateRequest {
        PdfRotateRequest {
            input_path: input_path.to_string_lossy().into_owned(),
            output_path: output_path.to_string_lossy().into_owned(),
            pages,
            angle_degrees,
        }
    }

    fn pdf_delete_request(
        input_path: PathBuf,
        output_path: PathBuf,
        pages: Vec<usize>,
    ) -> PdfDeleteRequest {
        PdfDeleteRequest {
            input_path: input_path.to_string_lossy().into_owned(),
            output_path: output_path.to_string_lossy().into_owned(),
            pages,
        }
    }

    fn pdf_reorder_request(
        input_path: PathBuf,
        output_path: PathBuf,
        page_order: Vec<usize>,
    ) -> PdfReorderRequest {
        PdfReorderRequest {
            input_path: input_path.to_string_lossy().into_owned(),
            output_path: output_path.to_string_lossy().into_owned(),
            page_order,
        }
    }

    fn pdf_text_watermark_request(
        input_path: PathBuf,
        output_path: PathBuf,
        text: &str,
        pages: Option<Vec<usize>>,
    ) -> PdfTextWatermarkRequest {
        PdfTextWatermarkRequest {
            input_path: input_path.to_string_lossy().into_owned(),
            output_path: output_path.to_string_lossy().into_owned(),
            text: text.to_string(),
            pages,
            opacity: Some(0.18),
            rotation_degrees: Some(-35.0),
            font_size: Some(48.0),
        }
    }

    fn pdf_merge_request(input_paths: Vec<PathBuf>, output_path: PathBuf) -> PdfMergeRequest {
        PdfMergeRequest {
            input_paths: input_paths
                .into_iter()
                .map(|path| path.to_string_lossy().into_owned())
                .collect(),
            output_path: output_path.to_string_lossy().into_owned(),
        }
    }

    fn create_single_page_pdf(path: &Path) {
        create_single_page_pdf_with_content(path, b"q Q");
    }

    fn contains_bytes(haystack: &[u8], needle: &[u8]) -> bool {
        haystack
            .windows(needle.len())
            .any(|window| window == needle)
    }

    fn create_single_page_pdf_with_content(path: &Path, content: &[u8]) {
        create_pdf_with_page_contents(path, &[content]);
    }

    fn create_pdf_with_page_contents(path: &Path, page_contents: &[&[u8]]) {
        assert!(!page_contents.is_empty());
        let mut document = Document::with_version("1.5");
        let pages_id = document.new_object_id();
        let mut kids = Vec::with_capacity(page_contents.len());

        for content in page_contents {
            let content_id = document.add_object(Stream::new(dictionary! {}, content.to_vec()));
            let page_id = document.add_object(dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "Contents" => content_id,
            });
            kids.push(Object::Reference(page_id));
        }

        document.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => kids,
                "Count" => page_contents.len() as i64,
                "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
            }),
        );
        let catalog_id = document.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        document.trailer.set("Root", catalog_id);
        document.save(path).expect("test PDF should be saved");
    }

    fn create_pdf_with_metadata(path: &Path) {
        create_single_page_pdf(path);
        let mut document = Document::load(path).expect("metadata fixture should load");
        let info_id = document.add_object(dictionary! {
            "Title" => Object::string_literal("Inspection fixture"),
            "Author" => Object::string_literal("Utility Tools Hub"),
            "Creator" => Object::string_literal("PDF inspection tests"),
            "Producer" => Object::string_literal("lopdf"),
        });
        document.trailer.set("Info", info_id);
        document
            .save(path)
            .expect("metadata fixture should be saved");
    }

    fn create_nested_page_tree_pdf(path: &Path, page_markers: &[&[u8]]) {
        assert!(!page_markers.is_empty());
        let mut document = Document::with_version("1.7");
        let root_pages_id = document.new_object_id();
        let nested_pages_id = document.new_object_id();
        let font_id = document.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica",
        });
        let resources_id = document.add_object(dictionary! {
            "Font" => dictionary! {
                "F1" => font_id,
            },
        });
        let mut kids = Vec::with_capacity(page_markers.len());

        for marker in page_markers {
            let mut content = Stream::new(dictionary! {}, marker.repeat(64));
            content.compress().expect("content stream should compress");
            let content_id = document.add_object(content);
            let page_id = document.add_object(dictionary! {
                "Type" => "Page",
                "Parent" => nested_pages_id,
                "Contents" => content_id,
            });
            kids.push(Object::Reference(page_id));
        }

        document.objects.insert(
            nested_pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Parent" => root_pages_id,
                "Kids" => kids,
                "Count" => page_markers.len() as i64,
                "CropBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
            }),
        );
        document.objects.insert(
            root_pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => vec![Object::Reference(nested_pages_id)],
                "Count" => page_markers.len() as i64,
                "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
                "Resources" => resources_id,
            }),
        );
        let catalog_id = document.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => root_pages_id,
        });
        document.trailer.set("Root", catalog_id);
        document.save(path).expect("test PDF should be saved");
    }

    fn page_rotation(document: &Document, page_number: u32) -> Option<i64> {
        let page_id = document.get_pages()[&page_number];
        let page_dictionary = document
            .get_object(page_id)
            .expect("page should exist")
            .as_dict()
            .expect("page should be a dictionary");
        match page_dictionary.get(b"Rotate") {
            Ok(Object::Integer(value)) => Some(*value),
            Err(_) => None,
            Ok(_) => panic!("page rotation should be an integer"),
        }
    }
}
