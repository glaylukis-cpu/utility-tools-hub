use lopdf::{
    content::{Content, Operation},
    dictionary, Dictionary, Document, Object, ObjectId, StringFormat,
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

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PdfTextStampResult {
    pub input_path: String,
    pub output_path: String,
    pub text: String,
    pub pages: Vec<usize>,
    pub page_count: usize,
    pub position: String,
    pub font_size: f32,
    pub opacity: f32,
    pub rotation_degrees: f32,
    pub color: String,
    pub border_enabled: bool,
    pub border_color: Option<String>,
    pub border_width: Option<f32>,
    pub border_opacity: Option<f32>,
    pub background_enabled: bool,
    pub background_color: Option<String>,
    pub background_opacity: Option<f32>,
    pub padding: f32,
}

#[derive(Debug, Clone, Default)]
pub struct PdfTextStampOptions {
    pub pages: Option<Vec<usize>>,
    pub position: Option<String>,
    pub margin_x: Option<f32>,
    pub margin_y: Option<f32>,
    pub font_size: Option<f32>,
    pub opacity: Option<f32>,
    pub rotation_degrees: Option<f32>,
    pub color: Option<String>,
    pub border_enabled: Option<bool>,
    pub border_color: Option<String>,
    pub border_width: Option<f32>,
    pub border_opacity: Option<f32>,
    pub background_enabled: Option<bool>,
    pub background_color: Option<String>,
    pub background_opacity: Option<f32>,
    pub padding: Option<f32>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PdfImageWatermarkResult {
    pub input_path: String,
    pub output_path: String,
    pub image_path: String,
    pub pages: Vec<usize>,
    pub page_count: usize,
    pub position: String,
    pub width: f32,
    pub height: f32,
    pub opacity: f32,
    pub rotation_degrees: f32,
}

#[derive(Debug, Clone, Default)]
pub struct PdfImageWatermarkOptions {
    pub pages: Option<Vec<usize>>,
    pub width: Option<f32>,
    pub opacity: Option<f32>,
    pub rotation_degrees: Option<f32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PdfPageNumbersResult {
    pub input_path: String,
    pub output_path: String,
    pub pages: Vec<usize>,
    pub page_count: usize,
    pub start_number: usize,
    pub format: String,
    pub position: String,
}

#[derive(Debug, Clone, Default)]
pub struct PdfPageNumbersOptions {
    pub pages: Option<Vec<usize>>,
    pub start_number: Option<usize>,
    pub format: Option<String>,
    pub position: Option<String>,
    pub margin_x: Option<f32>,
    pub margin_y: Option<f32>,
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
    EmptyTextStampText,
    UnsupportedTextStampText,
    InvalidTextStampPosition,
    InvalidTextStampMargin,
    InvalidTextStampFontSize,
    InvalidTextStampOpacity,
    InvalidTextStampRotation,
    InvalidTextStampColor,
    InvalidTextStampBorderColor,
    InvalidTextStampBorderWidth,
    InvalidTextStampBorderOpacity,
    InvalidTextStampBackgroundColor,
    InvalidTextStampBackgroundOpacity,
    InvalidTextStampPadding,
    InvalidImageExtension,
    ImageNotFound,
    ImageFileTooLarge,
    InvalidJpeg,
    UnsupportedJpegEncoding,
    UnsupportedJpegComponents,
    InvalidJpegDimensions,
    InvalidImageWatermarkWidth,
    InvalidImageWatermarkOpacity,
    InvalidImageWatermarkRotation,
    ImageWatermarkDoesNotFitPage,
    InvalidPageNumberStart,
    InvalidPageNumberFormat,
    InvalidPageNumberPosition,
    InvalidPageNumberMargin,
    InvalidPageNumberFontSize,
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
            Self::EmptyTextStampText => "text stamp text must not be empty",
            Self::UnsupportedTextStampText => {
                "text stamp text must be a single line of at most 64 printable ASCII or Latin-1 characters"
            }
            Self::InvalidTextStampPosition => "the text stamp position is not supported",
            Self::InvalidTextStampMargin => {
                "text stamp margins must be finite values from 0 to 144 points and fit the page"
            }
            Self::InvalidTextStampFontSize => {
                "text stamp font size must be a finite value from 8 to 144 points"
            }
            Self::InvalidTextStampOpacity => {
                "text stamp opacity must be greater than 0 and no greater than 1"
            }
            Self::InvalidTextStampRotation => {
                "text stamp rotation must be a finite value from -360 to 360 degrees"
            }
            Self::InvalidTextStampColor => "the text stamp color is not supported",
            Self::InvalidTextStampBorderColor => {
                "the text stamp border color is not supported"
            }
            Self::InvalidTextStampBorderWidth => {
                "text stamp border width must be a finite value from 0.5 to 6 points"
            }
            Self::InvalidTextStampBorderOpacity => {
                "text stamp border opacity must be greater than 0 and no greater than 1"
            }
            Self::InvalidTextStampBackgroundColor => {
                "the text stamp background color is not supported"
            }
            Self::InvalidTextStampBackgroundOpacity => {
                "text stamp background opacity must be greater than 0 and no greater than 1"
            }
            Self::InvalidTextStampPadding => {
                "text stamp padding must be a finite value from 0 to 36 points and fit the page"
            }
            Self::InvalidImageExtension => {
                "the watermark image must use the .jpg or .jpeg extension"
            }
            Self::ImageNotFound => "the watermark image file does not exist",
            Self::ImageFileTooLarge => "the watermark JPEG file is too large",
            Self::InvalidJpeg => "the watermark image is not a valid baseline JPEG file",
            Self::UnsupportedJpegEncoding => {
                "the watermark JPEG must use 8-bit baseline sequential encoding"
            }
            Self::UnsupportedJpegComponents => {
                "the watermark JPEG must use grayscale or three-component color"
            }
            Self::InvalidJpegDimensions => {
                "the watermark JPEG dimensions are zero or exceed the supported limit"
            }
            Self::InvalidImageWatermarkWidth => {
                "image watermark width must be a finite value from 8 to 1440 points"
            }
            Self::InvalidImageWatermarkOpacity => {
                "image watermark opacity must be greater than 0 and no greater than 1"
            }
            Self::InvalidImageWatermarkRotation => {
                "image watermark rotation must be a finite value from -360 to 360 degrees"
            }
            Self::ImageWatermarkDoesNotFitPage => {
                "the image watermark does not fit inside a selected PDF page"
            }
            Self::InvalidPageNumberStart => "page number start must be one or greater",
            Self::InvalidPageNumberFormat => "the page number format is not supported",
            Self::InvalidPageNumberPosition => "the page number position is not supported",
            Self::InvalidPageNumberMargin => {
                "page number margins must be finite values from 0 to 144 points and fit the page"
            }
            Self::InvalidPageNumberFontSize => {
                "page number font size must be a finite value from 6 to 72 points"
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

const DEFAULT_TEXT_STAMP_MARGIN: f32 = 36.0;
const DEFAULT_TEXT_STAMP_FONT_SIZE: f32 = 24.0;
const DEFAULT_TEXT_STAMP_OPACITY: f32 = 0.85;
const MIN_TEXT_STAMP_FONT_SIZE: f32 = 8.0;
const MAX_TEXT_STAMP_FONT_SIZE: f32 = 144.0;
const MAX_TEXT_STAMP_MARGIN: f32 = 144.0;
const MAX_TEXT_STAMP_LENGTH: usize = 64;
const DEFAULT_TEXT_STAMP_BORDER_WIDTH: f32 = 1.0;
const MIN_TEXT_STAMP_BORDER_WIDTH: f32 = 0.5;
const MAX_TEXT_STAMP_BORDER_WIDTH: f32 = 6.0;
const DEFAULT_TEXT_STAMP_BACKGROUND_OPACITY: f32 = 0.2;
const DEFAULT_TEXT_STAMP_PADDING: f32 = 4.0;
const MAX_TEXT_STAMP_PADDING: f32 = 36.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TextStampPosition {
    Center,
    BottomCenter,
    BottomRight,
    BottomLeft,
    TopCenter,
    TopRight,
    TopLeft,
}

impl TextStampPosition {
    fn parse(value: &str) -> Result<Self, PdfToolError> {
        match value {
            "center" => Ok(Self::Center),
            "bottom-center" => Ok(Self::BottomCenter),
            "bottom-right" => Ok(Self::BottomRight),
            "bottom-left" => Ok(Self::BottomLeft),
            "top-center" => Ok(Self::TopCenter),
            "top-right" => Ok(Self::TopRight),
            "top-left" => Ok(Self::TopLeft),
            _ => Err(PdfToolError::InvalidTextStampPosition),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Center => "center",
            Self::BottomCenter => "bottom-center",
            Self::BottomRight => "bottom-right",
            Self::BottomLeft => "bottom-left",
            Self::TopCenter => "top-center",
            Self::TopRight => "top-right",
            Self::TopLeft => "top-left",
        }
    }

    fn is_top(self) -> bool {
        matches!(self, Self::TopCenter | Self::TopRight | Self::TopLeft)
    }

    fn is_bottom(self) -> bool {
        matches!(
            self,
            Self::BottomCenter | Self::BottomRight | Self::BottomLeft
        )
    }

    fn is_left(self) -> bool {
        matches!(self, Self::BottomLeft | Self::TopLeft)
    }

    fn is_right(self) -> bool {
        matches!(self, Self::BottomRight | Self::TopRight)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TextStampColor {
    Black,
    Red,
    Gray,
}

impl TextStampColor {
    fn parse(value: &str) -> Result<Self, PdfToolError> {
        match value {
            "black" => Ok(Self::Black),
            "red" => Ok(Self::Red),
            "gray" => Ok(Self::Gray),
            _ => Err(PdfToolError::InvalidTextStampColor),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Black => "black",
            Self::Red => "red",
            Self::Gray => "gray",
        }
    }

    fn rgb(self) -> (f32, f32, f32) {
        match self {
            Self::Black => (0.0, 0.0, 0.0),
            Self::Red => (0.8, 0.0, 0.0),
            Self::Gray => (0.4, 0.4, 0.4),
        }
    }

    fn parse_border(value: &str) -> Result<Self, PdfToolError> {
        match value {
            "black" => Ok(Self::Black),
            "red" => Ok(Self::Red),
            "gray" => Ok(Self::Gray),
            _ => Err(PdfToolError::InvalidTextStampBorderColor),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TextStampBackgroundColor {
    White,
    Yellow,
    Red,
    Gray,
}

impl TextStampBackgroundColor {
    fn parse(value: &str) -> Result<Self, PdfToolError> {
        match value {
            "white" => Ok(Self::White),
            "yellow" => Ok(Self::Yellow),
            "red" => Ok(Self::Red),
            "gray" => Ok(Self::Gray),
            _ => Err(PdfToolError::InvalidTextStampBackgroundColor),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::White => "white",
            Self::Yellow => "yellow",
            Self::Red => "red",
            Self::Gray => "gray",
        }
    }

    fn rgb(self) -> (f32, f32, f32) {
        match self {
            Self::White => (1.0, 1.0, 1.0),
            Self::Yellow => (1.0, 0.9, 0.2),
            Self::Red => (0.8, 0.0, 0.0),
            Self::Gray => (0.7, 0.7, 0.7),
        }
    }
}

/// Adds a short additive text stamp to all or selected pages and writes a new PDF.
/// Existing text, images, page numbers, and watermarks are not edited or removed.
pub fn add_text_stamp(
    input_path: PathBuf,
    output_path: PathBuf,
    text: String,
    options: PdfTextStampOptions,
) -> Result<PdfTextStampResult, PdfToolError> {
    validate_output_path(&output_path)?;
    if input_path == output_path {
        return Err(PdfToolError::OutputConflictsWithInput);
    }
    let encoded_text = encode_text_stamp_text(&text)?;

    let position = TextStampPosition::parse(options.position.as_deref().unwrap_or("top-right"))?;
    let margin_x = options.margin_x.unwrap_or(DEFAULT_TEXT_STAMP_MARGIN);
    let margin_y = options.margin_y.unwrap_or(DEFAULT_TEXT_STAMP_MARGIN);
    if !margin_x.is_finite()
        || !margin_y.is_finite()
        || !(0.0..=MAX_TEXT_STAMP_MARGIN).contains(&margin_x)
        || !(0.0..=MAX_TEXT_STAMP_MARGIN).contains(&margin_y)
    {
        return Err(PdfToolError::InvalidTextStampMargin);
    }

    let font_size = options.font_size.unwrap_or(DEFAULT_TEXT_STAMP_FONT_SIZE);
    if !font_size.is_finite()
        || !(MIN_TEXT_STAMP_FONT_SIZE..=MAX_TEXT_STAMP_FONT_SIZE).contains(&font_size)
    {
        return Err(PdfToolError::InvalidTextStampFontSize);
    }

    let opacity = options.opacity.unwrap_or(DEFAULT_TEXT_STAMP_OPACITY);
    if !opacity.is_finite() || opacity <= 0.0 || opacity > 1.0 {
        return Err(PdfToolError::InvalidTextStampOpacity);
    }

    let rotation_degrees = options.rotation_degrees.unwrap_or(0.0);
    if !rotation_degrees.is_finite() || !(-360.0..=360.0).contains(&rotation_degrees) {
        return Err(PdfToolError::InvalidTextStampRotation);
    }

    let color = TextStampColor::parse(options.color.as_deref().unwrap_or("red"))?;
    let border_enabled = options.border_enabled.unwrap_or(false);
    let border_color = TextStampColor::parse_border(
        options
            .border_color
            .as_deref()
            .unwrap_or_else(|| color.as_str()),
    )?;
    let border_width = options
        .border_width
        .unwrap_or(DEFAULT_TEXT_STAMP_BORDER_WIDTH);
    if !border_width.is_finite()
        || !(MIN_TEXT_STAMP_BORDER_WIDTH..=MAX_TEXT_STAMP_BORDER_WIDTH).contains(&border_width)
    {
        return Err(PdfToolError::InvalidTextStampBorderWidth);
    }
    let border_opacity = options.border_opacity.unwrap_or(opacity);
    if !border_opacity.is_finite() || border_opacity <= 0.0 || border_opacity > 1.0 {
        return Err(PdfToolError::InvalidTextStampBorderOpacity);
    }

    let background_enabled = options.background_enabled.unwrap_or(false);
    let background_color =
        TextStampBackgroundColor::parse(options.background_color.as_deref().unwrap_or("yellow"))?;
    let background_opacity = options
        .background_opacity
        .unwrap_or(DEFAULT_TEXT_STAMP_BACKGROUND_OPACITY);
    if !background_opacity.is_finite() || background_opacity <= 0.0 || background_opacity > 1.0 {
        return Err(PdfToolError::InvalidTextStampBackgroundOpacity);
    }

    let padding = options.padding.unwrap_or(DEFAULT_TEXT_STAMP_PADDING);
    if !padding.is_finite() || !(0.0..=MAX_TEXT_STAMP_PADDING).contains(&padding) {
        return Err(PdfToolError::InvalidTextStampPadding);
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
    let border_graphics_state_id = if border_enabled {
        Some(document.add_object(dictionary! {
            "Type" => "ExtGState",
            "ca" => Object::Real(border_opacity),
            "CA" => Object::Real(border_opacity),
        }))
    } else {
        None
    };
    let background_graphics_state_id = if background_enabled {
        Some(document.add_object(dictionary! {
            "Type" => "ExtGState",
            "ca" => Object::Real(background_opacity),
            "CA" => Object::Real(background_opacity),
        }))
    } else {
        None
    };

    for page_id in selected_page_ids {
        materialize_inherited_page_attributes(&mut document, page_id)?;
        let (lower_left_x, lower_left_y, upper_right_x, upper_right_y) =
            resolved_page_box(&document, page_id)?;
        let (
            font_name,
            graphics_state_name,
            border_graphics_state_name,
            background_graphics_state_name,
        ) = install_text_stamp_resources(
            &mut document,
            page_id,
            font_id,
            graphics_state_id,
            border_graphics_state_id,
            background_graphics_state_id,
        )?;
        let content = text_stamp_content(
            &encoded_text,
            &font_name,
            &graphics_state_name,
            border_graphics_state_name.as_deref(),
            background_graphics_state_name.as_deref(),
            position,
            margin_x,
            margin_y,
            font_size,
            rotation_degrees,
            color,
            border_enabled,
            border_color,
            border_width,
            background_enabled,
            background_color,
            padding,
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

    Ok(PdfTextStampResult {
        input_path: input_path.to_string_lossy().into_owned(),
        output_path: output_path.to_string_lossy().into_owned(),
        text,
        pages,
        page_count,
        position: position.as_str().to_string(),
        font_size,
        opacity,
        rotation_degrees,
        color: color.as_str().to_string(),
        border_enabled,
        border_color: border_enabled.then(|| border_color.as_str().to_string()),
        border_width: border_enabled.then_some(border_width),
        border_opacity: border_enabled.then_some(border_opacity),
        background_enabled,
        background_color: background_enabled.then(|| background_color.as_str().to_string()),
        background_opacity: background_enabled.then_some(background_opacity),
        padding,
    })
}

const MAX_JPEG_FILE_SIZE_BYTES: u64 = 20 * 1024 * 1024;
const MAX_JPEG_DIMENSION: u32 = 20_000;
const MAX_JPEG_PIXELS: u64 = 100_000_000;
const DEFAULT_IMAGE_WATERMARK_WIDTH: f32 = 180.0;
const MIN_IMAGE_WATERMARK_WIDTH: f32 = 8.0;
const MAX_IMAGE_WATERMARK_WIDTH: f32 = 1440.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct JpegMetadata {
    width: u32,
    height: u32,
    components: u8,
}

/// Adds one shared baseline JPEG Image XObject to all or selected pages.
/// The operation is additive, writes a new PDF, and does not edit existing content.
pub fn add_image_watermark(
    input_path: PathBuf,
    output_path: PathBuf,
    image_path: PathBuf,
    options: PdfImageWatermarkOptions,
) -> Result<PdfImageWatermarkResult, PdfToolError> {
    validate_output_path(&output_path)?;
    if input_path == output_path {
        return Err(PdfToolError::OutputConflictsWithInput);
    }

    let width = options.width.unwrap_or(DEFAULT_IMAGE_WATERMARK_WIDTH);
    if !width.is_finite()
        || !(MIN_IMAGE_WATERMARK_WIDTH..=MAX_IMAGE_WATERMARK_WIDTH).contains(&width)
    {
        return Err(PdfToolError::InvalidImageWatermarkWidth);
    }

    let opacity = options.opacity.unwrap_or(0.25);
    if !opacity.is_finite() || opacity <= 0.0 || opacity > 1.0 {
        return Err(PdfToolError::InvalidImageWatermarkOpacity);
    }

    let rotation_degrees = options.rotation_degrees.unwrap_or(0.0);
    if !rotation_degrees.is_finite() || !(-360.0..=360.0).contains(&rotation_degrees) {
        return Err(PdfToolError::InvalidImageWatermarkRotation);
    }

    let (jpeg_bytes, jpeg_metadata) = read_jpeg_watermark(&image_path)?;
    let height = width * jpeg_metadata.height as f32 / jpeg_metadata.width as f32;
    if !height.is_finite() || height <= 0.0 || height > MAX_IMAGE_WATERMARK_WIDTH {
        return Err(PdfToolError::InvalidImageWatermarkWidth);
    }

    let mut document = load_pdf_document(&input_path)?;
    let available_pages = document.get_pages();
    let page_count = available_pages.len();
    let pages = match options.pages {
        Some(pages) if !pages.is_empty() => pages,
        _ => (1..=page_count).collect(),
    };
    let selected_page_ids = validate_selected_pages(&pages, &available_pages)?;

    let color_space = if jpeg_metadata.components == 1 {
        "DeviceGray"
    } else {
        "DeviceRGB"
    };
    let image_stream = lopdf::Stream::new(
        dictionary! {
            "Type" => "XObject",
            "Subtype" => "Image",
            "Width" => i64::from(jpeg_metadata.width),
            "Height" => i64::from(jpeg_metadata.height),
            "ColorSpace" => color_space,
            "BitsPerComponent" => 8,
            "Filter" => "DCTDecode",
        },
        jpeg_bytes,
    )
    .with_compression(false);
    let image_id = document.add_object(image_stream);
    let graphics_state_id = document.add_object(dictionary! {
        "Type" => "ExtGState",
        "ca" => Object::Real(opacity),
        "CA" => Object::Real(opacity),
    });

    for page_id in selected_page_ids {
        materialize_inherited_page_attributes(&mut document, page_id)?;
        let (lower_left_x, lower_left_y, upper_right_x, upper_right_y) =
            resolved_page_box(&document, page_id)?;
        let (image_name, graphics_state_name) =
            install_image_watermark_resources(&mut document, page_id, image_id, graphics_state_id)?;
        let content = image_watermark_content(
            &image_name,
            &graphics_state_name,
            width,
            height,
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

    Ok(PdfImageWatermarkResult {
        input_path: input_path.to_string_lossy().into_owned(),
        output_path: output_path.to_string_lossy().into_owned(),
        image_path: image_path.to_string_lossy().into_owned(),
        pages,
        page_count,
        position: "center".to_string(),
        width,
        height,
        opacity,
        rotation_degrees,
    })
}

fn read_jpeg_watermark(image_path: &Path) -> Result<(Vec<u8>, JpegMetadata), PdfToolError> {
    if !has_jpeg_extension(image_path) {
        return Err(PdfToolError::InvalidImageExtension);
    }
    let file_metadata = fs::metadata(image_path).map_err(|_| PdfToolError::ImageNotFound)?;
    if !file_metadata.is_file() {
        return Err(PdfToolError::ImageNotFound);
    }
    if file_metadata.len() > MAX_JPEG_FILE_SIZE_BYTES {
        return Err(PdfToolError::ImageFileTooLarge);
    }

    let bytes = fs::read(image_path).map_err(|_| PdfToolError::InvalidJpeg)?;
    let metadata = parse_jpeg_metadata(&bytes)?;
    Ok((bytes, metadata))
}

fn has_jpeg_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            extension.eq_ignore_ascii_case("jpg") || extension.eq_ignore_ascii_case("jpeg")
        })
}

fn parse_jpeg_metadata(bytes: &[u8]) -> Result<JpegMetadata, PdfToolError> {
    if bytes.len() as u64 > MAX_JPEG_FILE_SIZE_BYTES {
        return Err(PdfToolError::ImageFileTooLarge);
    }
    if bytes.len() < 4 || !bytes.starts_with(&[0xff, 0xd8]) || !bytes.ends_with(&[0xff, 0xd9]) {
        return Err(PdfToolError::InvalidJpeg);
    }

    let mut cursor = 2_usize;
    let mut metadata = None;
    let mut found_scan = false;

    while cursor < bytes.len() - 2 {
        if bytes[cursor] != 0xff {
            return Err(PdfToolError::InvalidJpeg);
        }
        while cursor < bytes.len() && bytes[cursor] == 0xff {
            cursor += 1;
        }
        let marker = *bytes.get(cursor).ok_or(PdfToolError::InvalidJpeg)?;
        cursor += 1;

        match marker {
            0x00 => return Err(PdfToolError::InvalidJpeg),
            0xd8 | 0x01 | 0xd0..=0xd7 => continue,
            0xd9 => break,
            _ => {}
        }

        let length_bytes = bytes
            .get(cursor..cursor + 2)
            .ok_or(PdfToolError::InvalidJpeg)?;
        let segment_length = u16::from_be_bytes([length_bytes[0], length_bytes[1]]) as usize;
        if segment_length < 2 {
            return Err(PdfToolError::InvalidJpeg);
        }
        let segment_end = cursor
            .checked_add(segment_length)
            .filter(|end| *end <= bytes.len())
            .ok_or(PdfToolError::InvalidJpeg)?;

        if marker == 0xda {
            if metadata.is_none() {
                return Err(PdfToolError::InvalidJpeg);
            }
            found_scan = true;
            break;
        }

        if is_start_of_frame_marker(marker) {
            if marker != 0xc0 {
                return Err(PdfToolError::UnsupportedJpegEncoding);
            }
            if metadata.is_some() || segment_length < 8 {
                return Err(PdfToolError::InvalidJpeg);
            }

            let precision = bytes[cursor + 2];
            if precision != 8 {
                return Err(PdfToolError::UnsupportedJpegEncoding);
            }
            let height = u16::from_be_bytes([bytes[cursor + 3], bytes[cursor + 4]]) as u32;
            let width = u16::from_be_bytes([bytes[cursor + 5], bytes[cursor + 6]]) as u32;
            let components = bytes[cursor + 7];
            let expected_length = 8_usize
                .checked_add(usize::from(components) * 3)
                .ok_or(PdfToolError::InvalidJpeg)?;
            if segment_length != expected_length {
                return Err(PdfToolError::InvalidJpeg);
            }
            if components != 1 && components != 3 {
                return Err(PdfToolError::UnsupportedJpegComponents);
            }
            let pixels = u64::from(width) * u64::from(height);
            if width == 0
                || height == 0
                || width > MAX_JPEG_DIMENSION
                || height > MAX_JPEG_DIMENSION
                || pixels > MAX_JPEG_PIXELS
            {
                return Err(PdfToolError::InvalidJpegDimensions);
            }
            metadata = Some(JpegMetadata {
                width,
                height,
                components,
            });
        }

        cursor = segment_end;
    }

    if !found_scan {
        return Err(PdfToolError::InvalidJpeg);
    }
    metadata.ok_or(PdfToolError::InvalidJpeg)
}

fn is_start_of_frame_marker(marker: u8) -> bool {
    matches!(
        marker,
        0xc0..=0xc3 | 0xc5..=0xc7 | 0xc9..=0xcb | 0xcd..=0xcf
    )
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PageNumberFormat {
    Number,
    PageNumber,
    PageNumberOfTotal,
    NumberSlashTotal,
    DashNumber,
}

impl PageNumberFormat {
    fn parse(value: &str) -> Result<Self, PdfToolError> {
        match value {
            "number" => Ok(Self::Number),
            "page-number" => Ok(Self::PageNumber),
            "page-number-of-total" => Ok(Self::PageNumberOfTotal),
            "number-slash-total" => Ok(Self::NumberSlashTotal),
            "dash-number" => Ok(Self::DashNumber),
            _ => Err(PdfToolError::InvalidPageNumberFormat),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Number => "number",
            Self::PageNumber => "page-number",
            Self::PageNumberOfTotal => "page-number-of-total",
            Self::NumberSlashTotal => "number-slash-total",
            Self::DashNumber => "dash-number",
        }
    }

    fn render(self, number: usize, total: usize) -> String {
        match self {
            Self::Number => number.to_string(),
            Self::PageNumber => format!("Page {number}"),
            Self::PageNumberOfTotal => format!("Page {number} of {total}"),
            Self::NumberSlashTotal => format!("{number} / {total}"),
            Self::DashNumber => format!("- {number} -"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PageNumberPosition {
    BottomCenter,
    BottomRight,
    BottomLeft,
    TopCenter,
    TopRight,
    TopLeft,
}

impl PageNumberPosition {
    fn parse(value: &str) -> Result<Self, PdfToolError> {
        match value {
            "bottom-center" => Ok(Self::BottomCenter),
            "bottom-right" => Ok(Self::BottomRight),
            "bottom-left" => Ok(Self::BottomLeft),
            "top-center" => Ok(Self::TopCenter),
            "top-right" => Ok(Self::TopRight),
            "top-left" => Ok(Self::TopLeft),
            _ => Err(PdfToolError::InvalidPageNumberPosition),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::BottomCenter => "bottom-center",
            Self::BottomRight => "bottom-right",
            Self::BottomLeft => "bottom-left",
            Self::TopCenter => "top-center",
            Self::TopRight => "top-right",
            Self::TopLeft => "top-left",
        }
    }

    fn is_top(self) -> bool {
        matches!(self, Self::TopCenter | Self::TopRight | Self::TopLeft)
    }

    fn is_left(self) -> bool {
        matches!(self, Self::BottomLeft | Self::TopLeft)
    }

    fn is_right(self) -> bool {
        matches!(self, Self::BottomRight | Self::TopRight)
    }
}

pub fn add_page_numbers(
    input_path: PathBuf,
    output_path: PathBuf,
    options: PdfPageNumbersOptions,
) -> Result<PdfPageNumbersResult, PdfToolError> {
    const DEFAULT_MARGIN_X: f32 = 36.0;
    const DEFAULT_MARGIN_Y: f32 = 24.0;
    const DEFAULT_FONT_SIZE: f32 = 12.0;

    validate_output_path(&output_path)?;
    if input_path == output_path {
        return Err(PdfToolError::OutputConflictsWithInput);
    }

    let start_number = options.start_number.unwrap_or(1);
    if start_number == 0 {
        return Err(PdfToolError::InvalidPageNumberStart);
    }

    let format = PageNumberFormat::parse(options.format.as_deref().unwrap_or("number"))?;
    let position =
        PageNumberPosition::parse(options.position.as_deref().unwrap_or("bottom-center"))?;

    let margin_x = options.margin_x.unwrap_or(DEFAULT_MARGIN_X);
    let margin_y = options.margin_y.unwrap_or(DEFAULT_MARGIN_Y);
    if !margin_x.is_finite()
        || !margin_y.is_finite()
        || !(0.0..=144.0).contains(&margin_x)
        || !(0.0..=144.0).contains(&margin_y)
    {
        return Err(PdfToolError::InvalidPageNumberMargin);
    }

    let font_size = options.font_size.unwrap_or(DEFAULT_FONT_SIZE);
    if !font_size.is_finite() || !(6.0..=72.0).contains(&font_size) {
        return Err(PdfToolError::InvalidPageNumberFontSize);
    }

    let mut document = load_pdf_document(&input_path)?;
    let available_pages = document.get_pages();
    let page_count = available_pages.len();
    let mut pages = match options.pages {
        Some(pages) if !pages.is_empty() => pages,
        _ => (1..=page_count).collect(),
    };
    pages.sort_unstable();
    let selected_page_ids = validate_selected_pages(&pages, &available_pages)?;

    let font_id = document.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
        "Encoding" => "WinAnsiEncoding",
    });

    for (sequence_index, page_id) in selected_page_ids.into_iter().enumerate() {
        let display_number = start_number
            .checked_add(sequence_index)
            .ok_or(PdfToolError::InvalidPageNumberStart)?;
        let text = format.render(display_number, page_count);

        materialize_inherited_page_attributes(&mut document, page_id)?;
        let (lower_left_x, lower_left_y, upper_right_x, upper_right_y) =
            resolved_page_box(&document, page_id)?;
        let font_name = install_page_number_font(&mut document, page_id, font_id)?;
        let content = page_number_content(
            &text,
            &font_name,
            position,
            margin_x,
            margin_y,
            font_size,
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

    Ok(PdfPageNumbersResult {
        input_path: input_path.to_string_lossy().into_owned(),
        output_path: output_path.to_string_lossy().into_owned(),
        pages,
        page_count,
        start_number,
        format: format.as_str().to_string(),
        position: position.as_str().to_string(),
    })
}

fn install_page_number_font(
    document: &mut Document,
    page_id: ObjectId,
    font_id: ObjectId,
) -> Result<Vec<u8>, PdfToolError> {
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
    let font_name = unique_resource_name(&fonts, b"UTHPageNumberFont");
    fonts.set(font_name.clone(), Object::Reference(font_id));
    resources.set("Font", Object::Dictionary(fonts));

    document
        .get_object_mut(page_id)
        .map_err(|_| PdfToolError::InvalidPdf)?
        .as_dict_mut()
        .map_err(|_| PdfToolError::InvalidPdf)?
        .set("Resources", Object::Dictionary(resources));

    Ok(font_name)
}

#[allow(clippy::too_many_arguments)]
fn page_number_content(
    text: &str,
    font_name: &[u8],
    position: PageNumberPosition,
    margin_x: f32,
    margin_y: f32,
    font_size: f32,
    lower_left_x: f32,
    lower_left_y: f32,
    upper_right_x: f32,
    upper_right_y: f32,
) -> Result<Vec<u8>, PdfToolError> {
    let estimated_width = text.len() as f32 * font_size * 0.5;
    let page_width = upper_right_x - lower_left_x;
    let text_x = if position.is_left() {
        lower_left_x + margin_x
    } else if position.is_right() {
        upper_right_x - margin_x - estimated_width
    } else {
        lower_left_x + (page_width - estimated_width) / 2.0
    };
    let text_y = if position.is_top() {
        upper_right_y - margin_y - font_size
    } else {
        lower_left_y + margin_y
    };

    if text_x < lower_left_x
        || text_y < lower_left_y
        || text_x + estimated_width > upper_right_x
        || text_y + font_size > upper_right_y
    {
        return Err(PdfToolError::InvalidPageNumberMargin);
    }

    // Coordinates use the effective CropBox/MediaBox. Existing page rotation is
    // preserved; viewer-facing rotation placement requires a later QA/polish step.
    Content {
        operations: vec![
            Operation::new("q", vec![]),
            Operation::new("BT", vec![]),
            Operation::new(
                "Tf",
                vec![Object::Name(font_name.to_vec()), Object::Real(font_size)],
            ),
            Operation::new("g", vec![Object::Real(0.15)]),
            Operation::new(
                "Tm",
                vec![
                    Object::Real(1.0),
                    Object::Real(0.0),
                    Object::Real(0.0),
                    Object::Real(1.0),
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

fn encode_text_stamp_text(text: &str) -> Result<Vec<u8>, PdfToolError> {
    if text.trim().is_empty() {
        return Err(PdfToolError::EmptyTextStampText);
    }
    if text.chars().count() > MAX_TEXT_STAMP_LENGTH {
        return Err(PdfToolError::UnsupportedTextStampText);
    }

    text.chars()
        .map(|character| match character as u32 {
            0x20..=0x7e | 0xa0..=0xff => Ok(character as u8),
            _ => Err(PdfToolError::UnsupportedTextStampText),
        })
        .collect()
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

fn install_text_stamp_resources(
    document: &mut Document,
    page_id: ObjectId,
    font_id: ObjectId,
    graphics_state_id: ObjectId,
    border_graphics_state_id: Option<ObjectId>,
    background_graphics_state_id: Option<ObjectId>,
) -> Result<(Vec<u8>, Vec<u8>, Option<Vec<u8>>, Option<Vec<u8>>), PdfToolError> {
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
    let font_name = unique_resource_name(&fonts, b"UTHTextStampFont");
    fonts.set(font_name.clone(), Object::Reference(font_id));
    resources.set("Font", Object::Dictionary(fonts));

    let mut graphics_states = match resources.get(b"ExtGState") {
        Ok(object) => resolved_dictionary(document, object)?,
        Err(_) => Dictionary::new(),
    };
    let graphics_state_name = unique_resource_name(&graphics_states, b"UTHTextStampGS");
    graphics_states.set(
        graphics_state_name.clone(),
        Object::Reference(graphics_state_id),
    );
    let border_graphics_state_name =
        if let Some(border_graphics_state_id) = border_graphics_state_id {
            let name = unique_resource_name(&graphics_states, b"UTHTextStampBorderGS");
            graphics_states.set(name.clone(), Object::Reference(border_graphics_state_id));
            Some(name)
        } else {
            None
        };
    let background_graphics_state_name =
        if let Some(background_graphics_state_id) = background_graphics_state_id {
            let name = unique_resource_name(&graphics_states, b"UTHTextStampBackgroundGS");
            graphics_states.set(
                name.clone(),
                Object::Reference(background_graphics_state_id),
            );
            Some(name)
        } else {
            None
        };
    resources.set("ExtGState", Object::Dictionary(graphics_states));

    document
        .get_object_mut(page_id)
        .map_err(|_| PdfToolError::InvalidPdf)?
        .as_dict_mut()
        .map_err(|_| PdfToolError::InvalidPdf)?
        .set("Resources", Object::Dictionary(resources));

    Ok((
        font_name,
        graphics_state_name,
        border_graphics_state_name,
        background_graphics_state_name,
    ))
}

fn install_image_watermark_resources(
    document: &mut Document,
    page_id: ObjectId,
    image_id: ObjectId,
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

    let mut xobjects = match resources.get(b"XObject") {
        Ok(object) => resolved_dictionary(document, object)?,
        Err(_) => Dictionary::new(),
    };
    let image_name = unique_resource_name(&xobjects, b"UTHImageWatermark");
    xobjects.set(image_name.clone(), Object::Reference(image_id));
    resources.set("XObject", Object::Dictionary(xobjects));

    let mut graphics_states = match resources.get(b"ExtGState") {
        Ok(object) => resolved_dictionary(document, object)?,
        Err(_) => Dictionary::new(),
    };
    let graphics_state_name = unique_resource_name(&graphics_states, b"UTHImageWatermarkGS");
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

    Ok((image_name, graphics_state_name))
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

#[allow(clippy::too_many_arguments)]
fn text_stamp_content(
    encoded_text: &[u8],
    font_name: &[u8],
    graphics_state_name: &[u8],
    border_graphics_state_name: Option<&[u8]>,
    background_graphics_state_name: Option<&[u8]>,
    position: TextStampPosition,
    margin_x: f32,
    margin_y: f32,
    font_size: f32,
    rotation_degrees: f32,
    color: TextStampColor,
    border_enabled: bool,
    border_color: TextStampColor,
    border_width: f32,
    background_enabled: bool,
    background_color: TextStampBackgroundColor,
    padding: f32,
    lower_left_x: f32,
    lower_left_y: f32,
    upper_right_x: f32,
    upper_right_y: f32,
) -> Result<Vec<u8>, PdfToolError> {
    let estimated_width = encoded_text.len() as f32 * font_size * 0.5;
    let estimated_height = font_size;
    let decoration_padding = if border_enabled || background_enabled {
        padding
    } else {
        0.0
    };
    let rectangle_width = estimated_width + decoration_padding * 2.0;
    let rectangle_height = estimated_height + decoration_padding * 2.0;
    let stroke_extent = if border_enabled { border_width } else { 0.0 };
    let outer_width = rectangle_width + stroke_extent;
    let outer_height = rectangle_height + stroke_extent;
    let radians = rotation_degrees.to_radians();
    let cosine = radians.cos();
    let sine = radians.sin();
    let rotated_width = outer_width * cosine.abs() + outer_height * sine.abs();
    let rotated_height = outer_width * sine.abs() + outer_height * cosine.abs();
    let page_width = upper_right_x - lower_left_x;
    let page_height = upper_right_y - lower_left_y;

    let center_x = if position.is_left() {
        lower_left_x + margin_x + rotated_width / 2.0
    } else if position.is_right() {
        upper_right_x - margin_x - rotated_width / 2.0
    } else {
        lower_left_x + page_width / 2.0
    };
    let center_y = if position.is_top() {
        upper_right_y - margin_y - rotated_height / 2.0
    } else if position.is_bottom() {
        lower_left_y + margin_y + rotated_height / 2.0
    } else {
        lower_left_y + page_height / 2.0
    };

    if center_x - rotated_width / 2.0 < lower_left_x
        || center_x + rotated_width / 2.0 > upper_right_x
        || center_y - rotated_height / 2.0 < lower_left_y
        || center_y + rotated_height / 2.0 > upper_right_y
    {
        return Err(PdfToolError::InvalidTextStampMargin);
    }

    let translate_x = center_x - cosine * estimated_width / 2.0 + sine * estimated_height / 2.0;
    let translate_y = center_y - sine * estimated_width / 2.0 - cosine * estimated_height / 2.0;
    let (red, green, blue) = color.rgb();

    // Placement uses the effective CropBox/MediaBox and rotates around the
    // estimated stamp center. Existing page rotation is preserved; complete
    // viewer-facing rotation compensation remains a later QA/polish step.
    let mut operations = Vec::new();

    if background_enabled {
        let background_graphics_state_name =
            background_graphics_state_name.ok_or(PdfToolError::InvalidPdf)?;
        let (background_red, background_green, background_blue) = background_color.rgb();
        operations.extend([
            Operation::new("q", vec![]),
            Operation::new(
                "gs",
                vec![Object::Name(background_graphics_state_name.to_vec())],
            ),
            Operation::new(
                "rg",
                vec![
                    Object::Real(background_red),
                    Object::Real(background_green),
                    Object::Real(background_blue),
                ],
            ),
            Operation::new(
                "cm",
                vec![
                    Object::Real(cosine),
                    Object::Real(sine),
                    Object::Real(-sine),
                    Object::Real(cosine),
                    Object::Real(translate_x),
                    Object::Real(translate_y),
                ],
            ),
            Operation::new(
                "re",
                vec![
                    Object::Real(-decoration_padding),
                    Object::Real(-decoration_padding),
                    Object::Real(rectangle_width),
                    Object::Real(rectangle_height),
                ],
            ),
            Operation::new("f", vec![]),
            Operation::new("Q", vec![]),
        ]);
    }

    if border_enabled {
        let border_graphics_state_name =
            border_graphics_state_name.ok_or(PdfToolError::InvalidPdf)?;
        let (border_red, border_green, border_blue) = border_color.rgb();
        operations.extend([
            Operation::new("q", vec![]),
            Operation::new(
                "gs",
                vec![Object::Name(border_graphics_state_name.to_vec())],
            ),
            Operation::new(
                "RG",
                vec![
                    Object::Real(border_red),
                    Object::Real(border_green),
                    Object::Real(border_blue),
                ],
            ),
            Operation::new("w", vec![Object::Real(border_width)]),
            Operation::new(
                "cm",
                vec![
                    Object::Real(cosine),
                    Object::Real(sine),
                    Object::Real(-sine),
                    Object::Real(cosine),
                    Object::Real(translate_x),
                    Object::Real(translate_y),
                ],
            ),
            Operation::new(
                "re",
                vec![
                    Object::Real(-decoration_padding),
                    Object::Real(-decoration_padding),
                    Object::Real(rectangle_width),
                    Object::Real(rectangle_height),
                ],
            ),
            Operation::new("S", vec![]),
            Operation::new("Q", vec![]),
        ]);
    }

    operations.extend([
        Operation::new("q", vec![]),
        Operation::new("gs", vec![Object::Name(graphics_state_name.to_vec())]),
        Operation::new("BT", vec![]),
        Operation::new(
            "Tf",
            vec![Object::Name(font_name.to_vec()), Object::Real(font_size)],
        ),
        Operation::new(
            "rg",
            vec![Object::Real(red), Object::Real(green), Object::Real(blue)],
        ),
        Operation::new(
            "Tm",
            vec![
                Object::Real(cosine),
                Object::Real(sine),
                Object::Real(-sine),
                Object::Real(cosine),
                Object::Real(translate_x),
                Object::Real(translate_y),
            ],
        ),
        Operation::new(
            "Tj",
            vec![Object::String(encoded_text.to_vec(), StringFormat::Literal)],
        ),
        Operation::new("ET", vec![]),
        Operation::new("Q", vec![]),
    ]);

    Content { operations }
        .encode()
        .map_err(|_| PdfToolError::InvalidPdf)
}

#[allow(clippy::too_many_arguments)]
fn image_watermark_content(
    image_name: &[u8],
    graphics_state_name: &[u8],
    width: f32,
    height: f32,
    rotation_degrees: f32,
    lower_left_x: f32,
    lower_left_y: f32,
    upper_right_x: f32,
    upper_right_y: f32,
) -> Result<Vec<u8>, PdfToolError> {
    let radians = rotation_degrees.to_radians();
    let cosine = radians.cos();
    let sine = radians.sin();
    let rotated_width = width * cosine.abs() + height * sine.abs();
    let rotated_height = width * sine.abs() + height * cosine.abs();
    let page_width = upper_right_x - lower_left_x;
    let page_height = upper_right_y - lower_left_y;
    if rotated_width > page_width || rotated_height > page_height {
        return Err(PdfToolError::ImageWatermarkDoesNotFitPage);
    }

    let center_x = lower_left_x + page_width / 2.0;
    let center_y = lower_left_y + page_height / 2.0;
    let a = width * cosine;
    let b = width * sine;
    let c = -height * sine;
    let d = height * cosine;
    let translate_x = center_x - (a + c) / 2.0;
    let translate_y = center_y - (b + d) / 2.0;

    // Placement uses the effective CropBox/MediaBox. Existing page rotation is
    // preserved; viewer-facing rotation compensation remains a later QA step.
    Content {
        operations: vec![
            Operation::new("q", vec![]),
            Operation::new("gs", vec![Object::Name(graphics_state_name.to_vec())]),
            Operation::new(
                "cm",
                vec![
                    Object::Real(a),
                    Object::Real(b),
                    Object::Real(c),
                    Object::Real(d),
                    Object::Real(translate_x),
                    Object::Real(translate_y),
                ],
            ),
            Operation::new("Do", vec![Object::Name(image_name.to_vec())]),
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
        run_pdf_delete_bridge, run_pdf_extract_bridge, run_pdf_image_watermark_bridge,
        run_pdf_inspect_bridge, run_pdf_merge_bridge, run_pdf_page_numbers_bridge,
        run_pdf_reorder_bridge, run_pdf_rotate_bridge, run_pdf_split_bridge,
        run_pdf_text_stamp_bridge, run_pdf_text_watermark_bridge, PdfDeleteRequest,
        PdfExtractRequest, PdfImageWatermarkRequest, PdfInspectRequest, PdfMergeRequest,
        PdfPageNumbersRequest, PdfReorderRequest, PdfRotateRequest, PdfSplitRequest,
        PdfTextStampRequest, PdfTextWatermarkRequest,
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
    fn adds_page_numbers_to_all_pages_and_preserves_source() {
        let directory = TestDirectory::new();
        let input = directory.path("page-numbers-all-input.pdf");
        let output = directory.path("page-numbers-all-output.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q", b"q Q"]);

        let result = add_page_numbers(
            input.clone(),
            output.clone(),
            PdfPageNumbersOptions::default(),
        )
        .expect("page numbers should be added to all pages");

        let source = Document::load(&input).expect("source PDF should remain readable");
        let numbered = Document::load(&output).expect("numbered PDF should be readable");
        assert_eq!(source.get_pages().len(), 3);
        assert_eq!(numbered.get_pages().len(), 3);
        assert_eq!(result.pages, vec![1, 2, 3]);
        assert_eq!(result.page_count, 3);
        assert_eq!(result.start_number, 1);
        assert_eq!(result.format, "number");
        assert_eq!(result.position, "bottom-center");
        assert_eq!(page_text_strings(&numbered, 1), vec!["1"]);
        assert_eq!(page_text_strings(&numbered, 2), vec!["2"]);
        assert_eq!(page_text_strings(&numbered, 3), vec!["3"]);
        assert!(page_text_strings(&source, 1).is_empty());

        let empty_pages_output = directory.path("page-numbers-empty-pages-output.pdf");
        let empty_pages_result = add_page_numbers(
            input,
            empty_pages_output,
            PdfPageNumbersOptions {
                pages: Some(Vec::new()),
                ..PdfPageNumbersOptions::default()
            },
        )
        .expect("an empty page list should target all pages");
        assert_eq!(empty_pages_result.pages, vec![1, 2, 3]);
    }

    #[test]
    fn adds_page_numbers_to_selected_pages_in_document_order() {
        let directory = TestDirectory::new();
        let input = directory.path("page-numbers-selected-input.pdf");
        let output = directory.path("page-numbers-selected-output.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q", b"q Q"]);

        let result = add_page_numbers(
            input,
            output.clone(),
            PdfPageNumbersOptions {
                pages: Some(vec![3, 1]),
                start_number: Some(10),
                format: Some("page-number".to_string()),
                position: Some("top-right".to_string()),
                ..PdfPageNumbersOptions::default()
            },
        )
        .expect("selected pages should be numbered");

        let numbered = Document::load(output).expect("numbered PDF should load");
        assert_eq!(result.pages, vec![1, 3]);
        assert_eq!(result.start_number, 10);
        assert_eq!(result.format, "page-number");
        assert_eq!(result.position, "top-right");
        assert_eq!(page_text_strings(&numbered, 1), vec!["Page 10"]);
        assert!(page_text_strings(&numbered, 2).is_empty());
        assert_eq!(page_text_strings(&numbered, 3), vec!["Page 11"]);
    }

    #[test]
    fn page_numbers_supports_every_format() {
        let directory = TestDirectory::new();
        let input = directory.path("page-number-formats-input.pdf");
        create_single_page_pdf(&input);
        let cases = [
            ("number", "1"),
            ("page-number", "Page 1"),
            ("page-number-of-total", "Page 1 of 1"),
            ("number-slash-total", "1 / 1"),
            ("dash-number", "- 1 -"),
        ];

        for (index, (format, expected)) in cases.into_iter().enumerate() {
            let output = directory.path(&format!("page-number-format-{index}.pdf"));
            let result = add_page_numbers(
                input.clone(),
                output.clone(),
                PdfPageNumbersOptions {
                    format: Some(format.to_string()),
                    ..PdfPageNumbersOptions::default()
                },
            )
            .expect("supported format should succeed");
            let numbered = Document::load(output).expect("formatted output should load");
            assert_eq!(result.format, format);
            assert_eq!(page_text_strings(&numbered, 1), vec![expected]);
        }
    }

    #[test]
    fn page_numbers_supports_every_position() {
        let directory = TestDirectory::new();
        let input = directory.path("page-number-positions-input.pdf");
        create_single_page_pdf(&input);
        let positions = [
            "bottom-center",
            "bottom-right",
            "bottom-left",
            "top-center",
            "top-right",
            "top-left",
        ];

        for (index, position) in positions.into_iter().enumerate() {
            let result = add_page_numbers(
                input.clone(),
                directory.path(&format!("page-number-position-{index}.pdf")),
                PdfPageNumbersOptions {
                    position: Some(position.to_string()),
                    ..PdfPageNumbersOptions::default()
                },
            )
            .expect("supported position should succeed");
            assert_eq!(result.position, position);
        }
    }

    #[test]
    fn page_numbers_rejects_unsupported_format_and_position() {
        let directory = TestDirectory::new();
        let input = directory.path("page-number-choice-input.pdf");
        create_single_page_pdf(&input);

        let format_error = add_page_numbers(
            input.clone(),
            directory.path("unsupported-format.pdf"),
            PdfPageNumbersOptions {
                format: Some("roman".to_string()),
                ..PdfPageNumbersOptions::default()
            },
        )
        .unwrap_err();
        assert_eq!(format_error, PdfToolError::InvalidPageNumberFormat);

        let position_error = add_page_numbers(
            input,
            directory.path("unsupported-position.pdf"),
            PdfPageNumbersOptions {
                position: Some("middle-center".to_string()),
                ..PdfPageNumbersOptions::default()
            },
        )
        .unwrap_err();
        assert_eq!(position_error, PdfToolError::InvalidPageNumberPosition);
    }

    #[test]
    fn page_numbers_validates_pages_and_start_number() {
        let directory = TestDirectory::new();
        let input = directory.path("page-number-selection-input.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q", b"q Q"]);
        let cases = [
            (Some(vec![0]), None, PdfToolError::InvalidPageNumber),
            (Some(vec![4]), None, PdfToolError::PageOutOfRange),
            (Some(vec![1, 1]), None, PdfToolError::DuplicatePage),
            (None, Some(0), PdfToolError::InvalidPageNumberStart),
        ];

        for (index, (pages, start_number, expected)) in cases.into_iter().enumerate() {
            let error = add_page_numbers(
                input.clone(),
                directory.path(&format!("invalid-page-number-{index}.pdf")),
                PdfPageNumbersOptions {
                    pages,
                    start_number,
                    ..PdfPageNumbersOptions::default()
                },
            )
            .unwrap_err();
            assert_eq!(error, expected);
        }
    }

    #[test]
    fn page_numbers_validates_margins_and_font_size() {
        let directory = TestDirectory::new();
        let input = directory.path("page-number-style-input.pdf");
        create_single_page_pdf(&input);

        for (index, (margin_x, margin_y)) in
            [(-1.0, 24.0), (145.0, 24.0), (36.0, -1.0), (36.0, f32::NAN)]
                .into_iter()
                .enumerate()
        {
            let error = add_page_numbers(
                input.clone(),
                directory.path(&format!("invalid-margin-{index}.pdf")),
                PdfPageNumbersOptions {
                    margin_x: Some(margin_x),
                    margin_y: Some(margin_y),
                    ..PdfPageNumbersOptions::default()
                },
            )
            .unwrap_err();
            assert_eq!(error, PdfToolError::InvalidPageNumberMargin);
        }

        for (index, font_size) in [5.9, 72.1, f32::INFINITY].into_iter().enumerate() {
            let error = add_page_numbers(
                input.clone(),
                directory.path(&format!("invalid-font-size-{index}.pdf")),
                PdfPageNumbersOptions {
                    font_size: Some(font_size),
                    ..PdfPageNumbersOptions::default()
                },
            )
            .unwrap_err();
            assert_eq!(error, PdfToolError::InvalidPageNumberFontSize);
        }
    }

    #[test]
    fn page_numbers_rejects_invalid_paths_and_source_overwrite() {
        let directory = TestDirectory::new();
        let input = directory.path("page-number-path-input.pdf");
        create_single_page_pdf(&input);

        let cases = [
            (
                directory.path("input.txt"),
                directory.path("output.pdf"),
                PdfToolError::InvalidInputExtension,
            ),
            (
                input.clone(),
                directory.path("output.txt"),
                PdfToolError::InvalidOutputExtension,
            ),
            (
                directory.path("missing.pdf"),
                directory.path("missing-output.pdf"),
                PdfToolError::InputNotFound,
            ),
            (
                input.clone(),
                directory.path("missing-directory").join("output.pdf"),
                PdfToolError::OutputDirectoryNotFound,
            ),
            (
                input.clone(),
                input.clone(),
                PdfToolError::OutputConflictsWithInput,
            ),
        ];

        for (input_path, output_path, expected) in cases {
            let error = add_page_numbers(input_path, output_path, PdfPageNumbersOptions::default())
                .unwrap_err();
            assert_eq!(error, expected);
        }
    }

    #[test]
    fn page_numbers_rejects_a_protected_pdf_without_decrypting_it() {
        let directory = TestDirectory::new();
        let input = directory.path("protected-page-number-input.pdf");
        let output = directory.path("protected-page-number-output.pdf");
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

        let error =
            add_page_numbers(input, output.clone(), PdfPageNumbersOptions::default()).unwrap_err();
        assert_eq!(error, PdfToolError::EncryptedPdfUnsupported);
        assert!(!output.exists());
    }

    #[test]
    fn page_numbers_bridge_writes_a_new_pdf() {
        let directory = TestDirectory::new();
        let input = directory.path("page-number-bridge-input.pdf");
        let output = directory.path("page-number-bridge-output.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q", b"q Q"]);

        let result = run_pdf_page_numbers_bridge(pdf_page_numbers_request(
            input,
            output.clone(),
            Some(vec![3, 1]),
        ))
        .expect("page numbers bridge should succeed");

        let numbered = Document::load(&output).expect("bridge output PDF should load");
        assert!(output.is_file());
        assert_eq!(numbered.get_pages().len(), 3);
        assert_eq!(result.pages, vec![1, 3]);
        assert_eq!(result.start_number, 5);
        assert_eq!(result.format, "page-number-of-total");
        assert_eq!(page_text_strings(&numbered, 1), vec!["Page 5 of 3"]);
        assert_eq!(page_text_strings(&numbered, 3), vec!["Page 6 of 3"]);
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
    fn text_stamp_adds_short_text_to_all_pages_and_preserves_source() {
        let directory = TestDirectory::new();
        let input = directory.path("text-stamp-all-input.pdf");
        let output = directory.path("text-stamp-all-output.pdf");
        create_pdf_with_page_contents(
            &input,
            &[b"q % SOURCE-1 Q", b"q % SOURCE-2 Q", b"q % SOURCE-3 Q"],
        );
        let original_bytes = fs::read(&input).expect("source PDF should be readable");

        let result = add_text_stamp(
            input.clone(),
            output.clone(),
            "APPROVED".to_string(),
            PdfTextStampOptions::default(),
        )
        .expect("text stamp should be added to every page");

        assert_eq!(result.text, "APPROVED");
        assert_eq!(result.pages, vec![1, 2, 3]);
        assert_eq!(result.page_count, 3);
        assert_eq!(result.position, "top-right");
        assert_eq!(result.font_size, 24.0);
        assert_eq!(result.opacity, 0.85);
        assert_eq!(result.rotation_degrees, 0.0);
        assert_eq!(result.color, "red");
        assert!(!result.border_enabled);
        assert_eq!(result.border_color, None);
        assert_eq!(result.border_width, None);
        assert_eq!(result.border_opacity, None);
        assert!(!result.background_enabled);
        assert_eq!(result.background_color, None);
        assert_eq!(result.background_opacity, None);
        assert_eq!(result.padding, DEFAULT_TEXT_STAMP_PADDING);
        assert_eq!(
            fs::read(&input).expect("source PDF should remain readable"),
            original_bytes
        );

        let source = Document::load(input).expect("source PDF should reload");
        let stamped = Document::load(output).expect("stamped PDF should reload");
        assert_eq!(source.get_pages().len(), stamped.get_pages().len());
        for (page_number, page_id) in stamped.get_pages() {
            assert_eq!(page_text_strings(&stamped, page_number), vec!["APPROVED"]);
            let content = stamped
                .get_page_content(page_id)
                .expect("stamped content should be readable");
            assert!(contains_bytes(&content, b"SOURCE-"));
            assert!(page_has_operator(&stamped, page_id, "gs"));
            assert!(page_has_operator(&stamped, page_id, "rg"));
            assert!(page_has_operator(&stamped, page_id, "Tm"));
            assert!(!page_has_operator(&stamped, page_id, "re"));
            assert!(!page_has_operator(&stamped, page_id, "S"));
            assert!(!page_has_operator(&stamped, page_id, "f"));
        }
        assert!(page_text_strings(&source, 1).is_empty());
    }

    #[test]
    fn text_stamp_targets_selected_pages_and_accepts_empty_pages_as_all() {
        let directory = TestDirectory::new();
        let input = directory.path("text-stamp-selected-input.pdf");
        let output = directory.path("text-stamp-selected-output.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q", b"q Q"]);

        let result = add_text_stamp(
            input.clone(),
            output.clone(),
            "REVIEWED".to_string(),
            PdfTextStampOptions {
                pages: Some(vec![1, 3]),
                position: Some("bottom-left".to_string()),
                margin_x: Some(24.0),
                margin_y: Some(18.0),
                font_size: Some(20.0),
                opacity: Some(0.6),
                rotation_degrees: Some(15.0),
                color: Some("black".to_string()),
                ..PdfTextStampOptions::default()
            },
        )
        .expect("selected pages should be stamped");

        let stamped = Document::load(output).expect("selected output should reload");
        assert_eq!(result.pages, vec![1, 3]);
        assert_eq!(result.position, "bottom-left");
        assert_eq!(result.color, "black");
        assert_eq!(page_text_strings(&stamped, 1), vec!["REVIEWED"]);
        assert!(page_text_strings(&stamped, 2).is_empty());
        assert_eq!(page_text_strings(&stamped, 3), vec!["REVIEWED"]);

        let all_result = add_text_stamp(
            input,
            directory.path("text-stamp-empty-pages-output.pdf"),
            "COPY".to_string(),
            PdfTextStampOptions {
                pages: Some(Vec::new()),
                ..PdfTextStampOptions::default()
            },
        )
        .expect("an empty page list should target every page");
        assert_eq!(all_result.pages, vec![1, 2, 3]);
    }

    #[test]
    fn text_stamp_supports_every_position_and_color() {
        let directory = TestDirectory::new();
        let input = directory.path("text-stamp-presets-input.pdf");
        create_single_page_pdf(&input);
        let positions = [
            "center",
            "bottom-center",
            "bottom-right",
            "bottom-left",
            "top-center",
            "top-right",
            "top-left",
        ];

        for (index, position) in positions.into_iter().enumerate() {
            let result = add_text_stamp(
                input.clone(),
                directory.path(&format!("text-stamp-position-{index}.pdf")),
                "PAID".to_string(),
                PdfTextStampOptions {
                    position: Some(position.to_string()),
                    ..PdfTextStampOptions::default()
                },
            )
            .expect("supported position should succeed");
            assert_eq!(result.position, position);
        }

        for (index, color) in ["black", "red", "gray"].into_iter().enumerate() {
            let output = directory.path(&format!("text-stamp-color-{index}.pdf"));
            let result = add_text_stamp(
                input.clone(),
                output.clone(),
                "VOID".to_string(),
                PdfTextStampOptions {
                    color: Some(color.to_string()),
                    ..PdfTextStampOptions::default()
                },
            )
            .expect("supported color should succeed");
            assert_eq!(result.color, color);
            let document = Document::load(output).expect("color output should reload");
            assert!(page_has_operator(&document, document.get_pages()[&1], "rg"));
        }
    }

    #[test]
    fn text_stamp_adds_border_and_background_in_visual_order() {
        let directory = TestDirectory::new();
        let input = directory.path("text-stamp-decoration-input.pdf");
        let output = directory.path("text-stamp-decoration-output.pdf");
        create_pdf_with_page_contents(&input, &[b"q SOURCE-1 Q", b"q SOURCE-2 Q", b"q SOURCE-3 Q"]);

        let result = add_text_stamp(
            input,
            output.clone(),
            "REVIEWED".to_string(),
            PdfTextStampOptions {
                pages: Some(vec![1, 3]),
                position: Some("bottom-left".to_string()),
                margin_x: Some(24.0),
                margin_y: Some(24.0),
                rotation_degrees: Some(18.0),
                border_enabled: Some(true),
                border_color: Some("red".to_string()),
                border_width: Some(2.0),
                border_opacity: Some(0.7),
                background_enabled: Some(true),
                background_color: Some("yellow".to_string()),
                background_opacity: Some(0.25),
                padding: Some(6.0),
                ..PdfTextStampOptions::default()
            },
        )
        .expect("border and background should be added");

        assert_eq!(result.pages, vec![1, 3]);
        assert!(result.border_enabled);
        assert_eq!(result.border_color.as_deref(), Some("red"));
        assert_eq!(result.border_width, Some(2.0));
        assert_eq!(result.border_opacity, Some(0.7));
        assert!(result.background_enabled);
        assert_eq!(result.background_color.as_deref(), Some("yellow"));
        assert_eq!(result.background_opacity, Some(0.25));
        assert_eq!(result.padding, 6.0);

        let document = Document::load(output).expect("decorated output should reload");
        assert_eq!(document.get_pages().len(), 3);
        assert_eq!(page_text_strings(&document, 1), vec!["REVIEWED"]);
        assert!(page_text_strings(&document, 2).is_empty());
        assert_eq!(page_text_strings(&document, 3), vec!["REVIEWED"]);

        let page_id = document.get_pages()[&1];
        let bytes = document
            .get_page_content(page_id)
            .expect("decorated page content should load");
        let operations = Content::decode(&bytes)
            .expect("decorated page content should decode")
            .operations;
        let fill_index = operations
            .iter()
            .position(|operation| operation.operator == "f")
            .expect("background fill should be present");
        let stroke_index = operations
            .iter()
            .position(|operation| operation.operator == "S")
            .expect("border stroke should be present");
        let text_index = operations
            .iter()
            .position(|operation| operation.operator == "Tj")
            .expect("stamp text should be present");
        assert!(fill_index < stroke_index && stroke_index < text_index);
        assert_eq!(
            operations
                .iter()
                .filter(|operation| operation.operator == "re")
                .count(),
            2
        );
        assert_eq!(
            operations
                .iter()
                .filter(|operation| operation.operator == "gs")
                .count(),
            3
        );
        assert!(operations
            .iter()
            .any(|operation| operation.operator == "RG"));
        assert!(operations.iter().any(|operation| operation.operator == "w"));
    }

    #[test]
    fn text_stamp_supports_border_and_background_color_presets() {
        let directory = TestDirectory::new();
        let input = directory.path("text-stamp-decoration-colors-input.pdf");
        create_single_page_pdf(&input);

        for (index, color) in ["black", "red", "gray"].into_iter().enumerate() {
            let output = directory.path(&format!("text-stamp-border-color-{index}.pdf"));
            let result = add_text_stamp(
                input.clone(),
                output.clone(),
                "APPROVED".to_string(),
                PdfTextStampOptions {
                    border_enabled: Some(true),
                    border_color: Some(color.to_string()),
                    ..PdfTextStampOptions::default()
                },
            )
            .expect("supported border color should succeed");
            assert_eq!(result.border_color.as_deref(), Some(color));
            let document = Document::load(output).expect("border output should reload");
            let page_id = document.get_pages()[&1];
            assert!(page_has_operator(&document, page_id, "S"));
            assert!(!page_has_operator(&document, page_id, "f"));
        }

        for (index, color) in ["white", "yellow", "red", "gray"].into_iter().enumerate() {
            let output = directory.path(&format!("text-stamp-background-color-{index}.pdf"));
            let result = add_text_stamp(
                input.clone(),
                output.clone(),
                "APPROVED".to_string(),
                PdfTextStampOptions {
                    background_enabled: Some(true),
                    background_color: Some(color.to_string()),
                    ..PdfTextStampOptions::default()
                },
            )
            .expect("supported background color should succeed");
            assert_eq!(result.background_color.as_deref(), Some(color));
            let document = Document::load(output).expect("background output should reload");
            let page_id = document.get_pages()[&1];
            assert!(page_has_operator(&document, page_id, "f"));
            assert!(!page_has_operator(&document, page_id, "S"));
        }
    }

    #[test]
    fn text_stamp_validates_border_background_and_padding() {
        let directory = TestDirectory::new();
        let input = directory.path("text-stamp-decoration-validation-input.pdf");
        create_single_page_pdf(&input);

        let check_error = |name: &str, options: PdfTextStampOptions, expected: PdfToolError| {
            let error = add_text_stamp(
                input.clone(),
                directory.path(name),
                "APPROVED".to_string(),
                options,
            )
            .unwrap_err();
            assert_eq!(error, expected);
        };

        check_error(
            "invalid-border-color.pdf",
            PdfTextStampOptions {
                border_color: Some("blue".to_string()),
                ..PdfTextStampOptions::default()
            },
            PdfToolError::InvalidTextStampBorderColor,
        );
        check_error(
            "invalid-background-color.pdf",
            PdfTextStampOptions {
                background_color: Some("black".to_string()),
                ..PdfTextStampOptions::default()
            },
            PdfToolError::InvalidTextStampBackgroundColor,
        );

        for (index, value) in [0.0, 0.49, 6.01, f32::NAN].into_iter().enumerate() {
            check_error(
                &format!("invalid-border-width-{index}.pdf"),
                PdfTextStampOptions {
                    border_width: Some(value),
                    ..PdfTextStampOptions::default()
                },
                PdfToolError::InvalidTextStampBorderWidth,
            );
        }
        for (index, value) in [0.0, -0.1, 1.01, f32::NAN].into_iter().enumerate() {
            check_error(
                &format!("invalid-border-opacity-{index}.pdf"),
                PdfTextStampOptions {
                    border_opacity: Some(value),
                    ..PdfTextStampOptions::default()
                },
                PdfToolError::InvalidTextStampBorderOpacity,
            );
            check_error(
                &format!("invalid-background-opacity-{index}.pdf"),
                PdfTextStampOptions {
                    background_opacity: Some(value),
                    ..PdfTextStampOptions::default()
                },
                PdfToolError::InvalidTextStampBackgroundOpacity,
            );
        }
        for (index, value) in [-0.1, 36.01, f32::NAN].into_iter().enumerate() {
            check_error(
                &format!("invalid-padding-{index}.pdf"),
                PdfTextStampOptions {
                    padding: Some(value),
                    ..PdfTextStampOptions::default()
                },
                PdfToolError::InvalidTextStampPadding,
            );
        }

        let fit_error = add_text_stamp(
            input,
            directory.path("padding-does-not-fit.pdf"),
            "A".repeat(MAX_TEXT_STAMP_LENGTH),
            PdfTextStampOptions {
                position: Some("center".to_string()),
                font_size: Some(18.0),
                background_enabled: Some(true),
                padding: Some(MAX_TEXT_STAMP_PADDING),
                ..PdfTextStampOptions::default()
            },
        )
        .unwrap_err();
        assert_eq!(fit_error, PdfToolError::InvalidTextStampMargin);
    }

    #[test]
    fn text_stamp_validates_text_and_page_selection() {
        let directory = TestDirectory::new();
        let input = directory.path("text-stamp-validation-input.pdf");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q"]);
        let text_cases = [
            ("", PdfToolError::EmptyTextStampText),
            ("   ", PdfToolError::EmptyTextStampText),
            ("日本語", PdfToolError::UnsupportedTextStampText),
            ("APPROVED\nCOPY", PdfToolError::UnsupportedTextStampText),
        ];

        for (index, (text, expected)) in text_cases.into_iter().enumerate() {
            let error = add_text_stamp(
                input.clone(),
                directory.path(&format!("invalid-text-{index}.pdf")),
                text.to_string(),
                PdfTextStampOptions::default(),
            )
            .unwrap_err();
            assert_eq!(error, expected);
        }

        let long_error = add_text_stamp(
            input.clone(),
            directory.path("long-text.pdf"),
            "A".repeat(MAX_TEXT_STAMP_LENGTH + 1),
            PdfTextStampOptions::default(),
        )
        .unwrap_err();
        assert_eq!(long_error, PdfToolError::UnsupportedTextStampText);

        let latin_result = add_text_stamp(
            input.clone(),
            directory.path("latin-text.pdf"),
            "PAYÉ".to_string(),
            PdfTextStampOptions::default(),
        )
        .expect("printable Latin-1 text should succeed");
        assert_eq!(latin_result.text, "PAYÉ");

        for (index, (pages, expected)) in [
            (vec![0], PdfToolError::InvalidPageNumber),
            (vec![3], PdfToolError::PageOutOfRange),
            (vec![1, 1], PdfToolError::DuplicatePage),
        ]
        .into_iter()
        .enumerate()
        {
            let error = add_text_stamp(
                input.clone(),
                directory.path(&format!("invalid-pages-{index}.pdf")),
                "APPROVED".to_string(),
                PdfTextStampOptions {
                    pages: Some(pages),
                    ..PdfTextStampOptions::default()
                },
            )
            .unwrap_err();
            assert_eq!(error, expected);
        }
    }

    #[test]
    fn text_stamp_validates_position_style_and_fit() {
        let directory = TestDirectory::new();
        let input = directory.path("text-stamp-style-input.pdf");
        create_single_page_pdf(&input);

        let position_error = add_text_stamp(
            input.clone(),
            directory.path("invalid-position.pdf"),
            "APPROVED".to_string(),
            PdfTextStampOptions {
                position: Some("middle-right".to_string()),
                ..PdfTextStampOptions::default()
            },
        )
        .unwrap_err();
        assert_eq!(position_error, PdfToolError::InvalidTextStampPosition);

        let color_error = add_text_stamp(
            input.clone(),
            directory.path("invalid-color.pdf"),
            "APPROVED".to_string(),
            PdfTextStampOptions {
                color: Some("blue".to_string()),
                ..PdfTextStampOptions::default()
            },
        )
        .unwrap_err();
        assert_eq!(color_error, PdfToolError::InvalidTextStampColor);

        for (index, font_size) in [7.9, 144.1, f32::INFINITY].into_iter().enumerate() {
            let error = add_text_stamp(
                input.clone(),
                directory.path(&format!("invalid-stamp-font-{index}.pdf")),
                "APPROVED".to_string(),
                PdfTextStampOptions {
                    font_size: Some(font_size),
                    ..PdfTextStampOptions::default()
                },
            )
            .unwrap_err();
            assert_eq!(error, PdfToolError::InvalidTextStampFontSize);
        }

        for (index, opacity) in [0.0, 1.1, f32::NAN].into_iter().enumerate() {
            let error = add_text_stamp(
                input.clone(),
                directory.path(&format!("invalid-stamp-opacity-{index}.pdf")),
                "APPROVED".to_string(),
                PdfTextStampOptions {
                    opacity: Some(opacity),
                    ..PdfTextStampOptions::default()
                },
            )
            .unwrap_err();
            assert_eq!(error, PdfToolError::InvalidTextStampOpacity);
        }

        for (index, rotation) in [-360.1, 360.1, f32::NAN].into_iter().enumerate() {
            let error = add_text_stamp(
                input.clone(),
                directory.path(&format!("invalid-stamp-rotation-{index}.pdf")),
                "APPROVED".to_string(),
                PdfTextStampOptions {
                    rotation_degrees: Some(rotation),
                    ..PdfTextStampOptions::default()
                },
            )
            .unwrap_err();
            assert_eq!(error, PdfToolError::InvalidTextStampRotation);
        }

        for (index, (margin_x, margin_y)) in [(-1.0, 36.0), (145.0, 36.0), (36.0, f32::NAN)]
            .into_iter()
            .enumerate()
        {
            let error = add_text_stamp(
                input.clone(),
                directory.path(&format!("invalid-stamp-margin-{index}.pdf")),
                "APPROVED".to_string(),
                PdfTextStampOptions {
                    margin_x: Some(margin_x),
                    margin_y: Some(margin_y),
                    ..PdfTextStampOptions::default()
                },
            )
            .unwrap_err();
            assert_eq!(error, PdfToolError::InvalidTextStampMargin);
        }

        let fit_error = add_text_stamp(
            input,
            directory.path("stamp-does-not-fit.pdf"),
            "A".repeat(MAX_TEXT_STAMP_LENGTH),
            PdfTextStampOptions {
                font_size: Some(MAX_TEXT_STAMP_FONT_SIZE),
                ..PdfTextStampOptions::default()
            },
        )
        .unwrap_err();
        assert_eq!(fit_error, PdfToolError::InvalidTextStampMargin);
    }

    #[test]
    fn text_stamp_rejects_invalid_paths_and_protected_pdf() {
        let directory = TestDirectory::new();
        let input = directory.path("text-stamp-path-input.pdf");
        create_single_page_pdf(&input);
        let cases = [
            (
                directory.path("input.txt"),
                directory.path("output.pdf"),
                PdfToolError::InvalidInputExtension,
            ),
            (
                input.clone(),
                directory.path("output.txt"),
                PdfToolError::InvalidOutputExtension,
            ),
            (
                directory.path("missing.pdf"),
                directory.path("missing-output.pdf"),
                PdfToolError::InputNotFound,
            ),
            (
                input.clone(),
                directory.path("missing-directory").join("output.pdf"),
                PdfToolError::OutputDirectoryNotFound,
            ),
            (
                input.clone(),
                input.clone(),
                PdfToolError::OutputConflictsWithInput,
            ),
        ];

        for (input_path, output_path, expected) in cases {
            let error = add_text_stamp(
                input_path,
                output_path,
                "APPROVED".to_string(),
                PdfTextStampOptions::default(),
            )
            .unwrap_err();
            assert_eq!(error, expected);
        }

        let protected_input = directory.path("protected-text-stamp-input.pdf");
        let protected_output = directory.path("protected-text-stamp-output.pdf");
        create_single_page_pdf(&protected_input);
        let mut protected_document =
            Document::load(&protected_input).expect("protected fixture should load");
        let encryption_id = protected_document.add_object(dictionary! {
            "Filter" => "Standard",
            "V" => 1,
        });
        protected_document.trailer.set("Encrypt", encryption_id);
        protected_document
            .save(&protected_input)
            .expect("protected marker should be saved");

        let error = add_text_stamp(
            protected_input,
            protected_output.clone(),
            "APPROVED".to_string(),
            PdfTextStampOptions {
                border_enabled: Some(true),
                background_enabled: Some(true),
                ..PdfTextStampOptions::default()
            },
        )
        .unwrap_err();
        assert_eq!(error, PdfToolError::EncryptedPdfUnsupported);
        assert!(!protected_output.exists());
    }

    #[test]
    fn text_stamp_preserves_inherited_resources_and_bridge_writes_output() {
        let directory = TestDirectory::new();
        let input = directory.path("nested-text-stamp-input.pdf");
        let output = directory.path("nested-text-stamp-output.pdf");
        create_nested_page_tree_pdf(&input, &[b"NESTED-1", b"NESTED-2"]);

        let mut request = pdf_text_stamp_request(input, output.clone(), "APPROVED", Some(vec![2]));
        request.border_enabled = Some(true);
        request.border_color = Some("gray".to_string());
        request.border_width = Some(1.5);
        request.border_opacity = Some(0.65);
        request.background_enabled = Some(true);
        request.background_color = Some("white".to_string());
        request.background_opacity = Some(0.3);
        request.padding = Some(5.0);
        let result = run_pdf_text_stamp_bridge(request).expect("text stamp bridge should succeed");

        assert!(output.is_file());
        assert_eq!(result.pages, vec![2]);
        assert_eq!(result.text, "APPROVED");
        assert_eq!(result.position, "top-right");
        assert!(result.border_enabled);
        assert_eq!(result.border_color.as_deref(), Some("gray"));
        assert!(result.background_enabled);
        assert_eq!(result.background_color.as_deref(), Some("white"));
        let document = Document::load(output).expect("bridge output should reload");
        assert_eq!(document.get_pages().len(), 2);
        assert!(page_text_strings(&document, 1).is_empty());
        assert_eq!(page_text_strings(&document, 2), vec!["APPROVED"]);
        for page_id in document.get_pages().values() {
            let fonts = document
                .get_page_fonts(*page_id)
                .expect("page fonts should remain readable");
            assert!(fonts.contains_key(b"F1".as_slice()));
            let content = document
                .get_page_content(*page_id)
                .expect("page content should remain readable");
            assert!(contains_bytes(&content, b"NESTED-"));
        }
        let stamped_page_id = document.get_pages()[&2];
        let stamped_fonts = document
            .get_page_fonts(stamped_page_id)
            .expect("stamped page fonts should load");
        assert!(stamped_fonts.contains_key(b"UTHTextStampFont".as_slice()));
        assert!(page_has_operator(&document, stamped_page_id, "S"));
        assert!(page_has_operator(&document, stamped_page_id, "f"));
    }

    #[test]
    fn jpeg_parser_reads_rgb_and_grayscale_baseline_dimensions() {
        let rgb = jpeg_fixture(320, 160, 3, 0xc0);
        let grayscale = jpeg_fixture(48, 96, 1, 0xc0);

        assert_eq!(
            parse_jpeg_metadata(&rgb).expect("RGB JPEG metadata should parse"),
            JpegMetadata {
                width: 320,
                height: 160,
                components: 3,
            }
        );
        assert_eq!(
            parse_jpeg_metadata(&grayscale).expect("grayscale JPEG metadata should parse"),
            JpegMetadata {
                width: 48,
                height: 96,
                components: 1,
            }
        );
    }

    #[test]
    fn jpeg_parser_rejects_invalid_progressive_cmyk_and_extreme_images() {
        assert_eq!(
            parse_jpeg_metadata(&[0xff, 0xd8, 0xff, 0xd9]).unwrap_err(),
            PdfToolError::InvalidJpeg
        );
        assert_eq!(
            parse_jpeg_metadata(&jpeg_fixture(100, 50, 3, 0xc2)).unwrap_err(),
            PdfToolError::UnsupportedJpegEncoding
        );
        assert_eq!(
            parse_jpeg_metadata(&jpeg_fixture(100, 50, 4, 0xc0)).unwrap_err(),
            PdfToolError::UnsupportedJpegComponents
        );
        assert_eq!(
            parse_jpeg_metadata(&jpeg_fixture(0, 50, 3, 0xc0)).unwrap_err(),
            PdfToolError::InvalidJpegDimensions
        );
        assert_eq!(
            parse_jpeg_metadata(&jpeg_fixture(20_001, 50, 3, 0xc0)).unwrap_err(),
            PdfToolError::InvalidJpegDimensions
        );
    }

    #[test]
    fn image_watermark_adds_one_shared_jpeg_to_all_pages_and_preserves_source() {
        let directory = TestDirectory::new();
        let input = directory.path("image-watermark-input.pdf");
        let output = directory.path("image-watermark-output.pdf");
        let image = directory.path("logo.jpg");
        create_pdf_with_page_contents(
            &input,
            &[b"q % SOURCE-1 Q", b"q % SOURCE-2 Q", b"q % SOURCE-3 Q"],
        );
        write_jpeg_fixture(&image, 320, 160, 3);
        let source_bytes = fs::read(&input).expect("source PDF should be readable");

        let result = add_image_watermark(
            input.clone(),
            output.clone(),
            image.clone(),
            PdfImageWatermarkOptions::default(),
        )
        .expect("JPEG watermark should be added to all pages");

        assert_eq!(result.pages, vec![1, 2, 3]);
        assert_eq!(result.page_count, 3);
        assert_eq!(result.position, "center");
        assert_eq!(result.width, 180.0);
        assert_eq!(result.height, 90.0);
        assert_eq!(result.opacity, 0.25);
        assert_eq!(result.rotation_degrees, 0.0);
        assert_eq!(
            fs::read(&input).expect("source PDF should remain readable"),
            source_bytes
        );

        let output_document = Document::load(&output).expect("watermarked PDF should reload");
        assert_eq!(output_document.get_pages().len(), 3);
        let mut image_ids = HashSet::new();
        for page_id in output_document.get_pages().values() {
            let images = output_document
                .get_page_images(*page_id)
                .expect("page Image XObjects should be readable");
            assert_eq!(images.len(), 1);
            assert_eq!(images[0].width, 320);
            assert_eq!(images[0].height, 160);
            assert_eq!(images[0].color_space.as_deref(), Some("DeviceRGB"));
            assert!(images[0]
                .filters
                .as_ref()
                .is_some_and(|filters| filters.iter().any(|filter| filter == "DCTDecode")));
            image_ids.insert(images[0].id);
            assert!(page_has_operator(&output_document, *page_id, "Do"));
            let content = output_document
                .get_page_content(*page_id)
                .expect("page content should remain readable");
            assert!(contains_bytes(&content, b"SOURCE-"));
        }
        assert_eq!(
            image_ids.len(),
            1,
            "target pages should share one image object"
        );

        let empty_pages_result = add_image_watermark(
            input,
            directory.path("empty-pages-image-watermark-output.pdf"),
            image,
            PdfImageWatermarkOptions {
                pages: Some(vec![]),
                ..PdfImageWatermarkOptions::default()
            },
        )
        .expect("an empty page list should target every page");
        assert_eq!(empty_pages_result.pages, vec![1, 2, 3]);
    }

    #[test]
    fn image_watermark_targets_selected_pages_and_accepts_jpeg_extension() {
        let directory = TestDirectory::new();
        let input = directory.path("selected-image-watermark-input.pdf");
        let output = directory.path("selected-image-watermark-output.pdf");
        let image = directory.path("gray.jpeg");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q", b"q Q"]);
        write_jpeg_fixture(&image, 100, 50, 1);

        let result = add_image_watermark(
            input,
            output.clone(),
            image,
            PdfImageWatermarkOptions {
                pages: Some(vec![1, 3]),
                width: Some(80.0),
                opacity: Some(0.4),
                rotation_degrees: Some(30.0),
            },
        )
        .expect("selected pages should receive a grayscale JPEG watermark");

        assert_eq!(result.pages, vec![1, 3]);
        assert_eq!(result.height, 40.0);
        let output_document = Document::load(output).expect("watermarked PDF should reload");
        for (page_number, page_id) in output_document.get_pages() {
            assert_eq!(
                page_has_operator(&output_document, page_id, "Do"),
                page_number == 1 || page_number == 3
            );
            if page_number == 1 || page_number == 3 {
                let images = output_document
                    .get_page_images(page_id)
                    .expect("selected page image should be readable");
                assert_eq!(images[0].color_space.as_deref(), Some("DeviceGray"));
            }
        }
    }

    #[test]
    fn image_watermark_preserves_inherited_resources() {
        let directory = TestDirectory::new();
        let input = directory.path("nested-image-watermark-input.pdf");
        let output = directory.path("nested-image-watermark-output.pdf");
        let image = directory.path("nested-logo.jpg");
        create_nested_page_tree_pdf(&input, &[b"NESTED-1", b"NESTED-2"]);
        write_jpeg_fixture(&image, 100, 50, 3);

        add_image_watermark(
            input,
            output.clone(),
            image,
            PdfImageWatermarkOptions::default(),
        )
        .expect("inherited resources should be preserved");

        let output_document = Document::load(output).expect("watermarked PDF should reload");
        for page_id in output_document.get_pages().values() {
            let fonts = output_document
                .get_page_fonts(*page_id)
                .expect("inherited page fonts should remain readable");
            assert!(fonts.contains_key(b"F1".as_slice()));
            assert_eq!(
                output_document
                    .get_page_images(*page_id)
                    .expect("image resource should remain readable")
                    .len(),
                1
            );
            assert!(page_has_operator(&output_document, *page_id, "Do"));
        }
    }

    #[test]
    fn image_watermark_rejects_unsupported_image_extensions_and_invalid_jpeg() {
        let directory = TestDirectory::new();
        let input = directory.path("image-format-input.pdf");
        create_single_page_pdf(&input);

        for extension in ["png", "webp", "svg"] {
            let image = directory.path(&format!("image.{extension}"));
            fs::write(&image, jpeg_fixture(100, 50, 3, 0xc0))
                .expect("unsupported image fixture should be written");
            let error = add_image_watermark(
                input.clone(),
                directory.path(&format!("{extension}-output.pdf")),
                image,
                PdfImageWatermarkOptions::default(),
            )
            .unwrap_err();
            assert_eq!(error, PdfToolError::InvalidImageExtension);
        }

        let broken = directory.path("broken.jpg");
        fs::write(&broken, [0xff, 0xd8, 0xff, 0xd9])
            .expect("broken JPEG fixture should be written");
        assert_eq!(
            add_image_watermark(
                input.clone(),
                directory.path("broken-output.pdf"),
                broken,
                PdfImageWatermarkOptions::default(),
            )
            .unwrap_err(),
            PdfToolError::InvalidJpeg
        );

        for (name, marker, components, expected) in [
            (
                "progressive.jpg",
                0xc2,
                3,
                PdfToolError::UnsupportedJpegEncoding,
            ),
            ("cmyk.jpg", 0xc0, 4, PdfToolError::UnsupportedJpegComponents),
        ] {
            let image = directory.path(name);
            fs::write(&image, jpeg_fixture(100, 50, components, marker))
                .expect("unsupported JPEG fixture should be written");
            assert_eq!(
                add_image_watermark(
                    input.clone(),
                    directory.path(&format!("{name}.pdf")),
                    image,
                    PdfImageWatermarkOptions::default(),
                )
                .unwrap_err(),
                expected
            );
        }
    }

    #[test]
    fn image_watermark_validates_pages_and_style() {
        let directory = TestDirectory::new();
        let input = directory.path("image-validation-input.pdf");
        let image = directory.path("validation.jpg");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q"]);
        write_jpeg_fixture(&image, 100, 50, 3);

        for (pages, expected, name) in [
            (vec![0], PdfToolError::InvalidPageNumber, "zero"),
            (vec![3], PdfToolError::PageOutOfRange, "range"),
            (vec![1, 1], PdfToolError::DuplicatePage, "duplicate"),
        ] {
            assert_eq!(
                add_image_watermark(
                    input.clone(),
                    directory.path(&format!("{name}.pdf")),
                    image.clone(),
                    PdfImageWatermarkOptions {
                        pages: Some(pages),
                        ..PdfImageWatermarkOptions::default()
                    },
                )
                .unwrap_err(),
                expected
            );
        }

        for width in [0.0, 7.9, 1440.1, f32::INFINITY] {
            assert_eq!(
                add_image_watermark(
                    input.clone(),
                    directory.path("invalid-width.pdf"),
                    image.clone(),
                    PdfImageWatermarkOptions {
                        width: Some(width),
                        ..PdfImageWatermarkOptions::default()
                    },
                )
                .unwrap_err(),
                PdfToolError::InvalidImageWatermarkWidth
            );
        }
        for opacity in [0.0, -0.1, 1.1, f32::NAN] {
            assert_eq!(
                add_image_watermark(
                    input.clone(),
                    directory.path("invalid-opacity.pdf"),
                    image.clone(),
                    PdfImageWatermarkOptions {
                        opacity: Some(opacity),
                        ..PdfImageWatermarkOptions::default()
                    },
                )
                .unwrap_err(),
                PdfToolError::InvalidImageWatermarkOpacity
            );
        }
        for rotation_degrees in [-360.1, 360.1, f32::NAN] {
            assert_eq!(
                add_image_watermark(
                    input.clone(),
                    directory.path("invalid-rotation.pdf"),
                    image.clone(),
                    PdfImageWatermarkOptions {
                        rotation_degrees: Some(rotation_degrees),
                        ..PdfImageWatermarkOptions::default()
                    },
                )
                .unwrap_err(),
                PdfToolError::InvalidImageWatermarkRotation
            );
        }

        assert_eq!(
            add_image_watermark(
                input,
                directory.path("does-not-fit.pdf"),
                image,
                PdfImageWatermarkOptions {
                    width: Some(600.0),
                    ..PdfImageWatermarkOptions::default()
                },
            )
            .unwrap_err(),
            PdfToolError::ImageWatermarkDoesNotFitPage
        );
    }

    #[test]
    fn image_watermark_rejects_invalid_paths_and_source_overwrite() {
        let directory = TestDirectory::new();
        let input = directory.path("image-path-input.pdf");
        let image = directory.path("path-logo.jpg");
        create_single_page_pdf(&input);
        write_jpeg_fixture(&image, 100, 50, 3);

        let cases = [
            (
                directory.path("input.txt"),
                directory.path("non-pdf-input.pdf"),
                image.clone(),
                PdfToolError::InvalidInputExtension,
            ),
            (
                input.clone(),
                directory.path("output.txt"),
                image.clone(),
                PdfToolError::InvalidOutputExtension,
            ),
            (
                directory.path("missing.pdf"),
                directory.path("missing-input.pdf"),
                image.clone(),
                PdfToolError::InputNotFound,
            ),
            (
                input.clone(),
                directory.path("missing-directory").join("output.pdf"),
                image.clone(),
                PdfToolError::OutputDirectoryNotFound,
            ),
            (
                input.clone(),
                directory.path("missing-image-output.pdf"),
                directory.path("missing.jpg"),
                PdfToolError::ImageNotFound,
            ),
            (
                input.clone(),
                input.clone(),
                image,
                PdfToolError::OutputConflictsWithInput,
            ),
        ];

        for (input_path, output_path, image_path, expected) in cases {
            assert_eq!(
                add_image_watermark(
                    input_path,
                    output_path,
                    image_path,
                    PdfImageWatermarkOptions::default(),
                )
                .unwrap_err(),
                expected
            );
        }
    }

    #[test]
    fn image_watermark_rejects_a_protected_pdf_without_decrypting_it() {
        let directory = TestDirectory::new();
        let input = directory.path("protected-image-watermark-input.pdf");
        let output = directory.path("protected-image-watermark-output.pdf");
        let image = directory.path("protected-logo.jpg");
        create_single_page_pdf(&input);
        write_jpeg_fixture(&image, 100, 50, 3);

        let mut protected_document = Document::load(&input).expect("fixture should load");
        let encryption_id = protected_document.add_object(dictionary! {
            "Filter" => "Standard",
            "V" => 1,
        });
        protected_document.trailer.set("Encrypt", encryption_id);
        protected_document
            .save(&input)
            .expect("protected marker should be saved");

        assert_eq!(
            add_image_watermark(
                input,
                output.clone(),
                image,
                PdfImageWatermarkOptions::default(),
            )
            .unwrap_err(),
            PdfToolError::EncryptedPdfUnsupported
        );
        assert!(!output.exists());
    }

    #[test]
    fn image_watermark_bridge_writes_a_new_pdf() {
        let directory = TestDirectory::new();
        let input = directory.path("image-watermark-bridge-input.pdf");
        let output = directory.path("image-watermark-bridge-output.pdf");
        let image = directory.path("bridge-logo.jpg");
        create_pdf_with_page_contents(&input, &[b"q Q", b"q Q", b"q Q"]);
        write_jpeg_fixture(&image, 200, 100, 3);

        let result = run_pdf_image_watermark_bridge(pdf_image_watermark_request(
            input,
            output.clone(),
            image,
            Some(vec![2, 3]),
        ))
        .expect("image watermark bridge should succeed");

        assert!(output.is_file());
        assert_eq!(result.pages, vec![2, 3]);
        assert_eq!(result.page_count, 3);
        assert_eq!(result.position, "center");
        let output_document = Document::load(output).expect("bridge output PDF should load");
        assert_eq!(output_document.get_pages().len(), 3);
        assert!(!page_has_operator(
            &output_document,
            output_document.get_pages()[&1],
            "Do"
        ));
        assert!(page_has_operator(
            &output_document,
            output_document.get_pages()[&2],
            "Do"
        ));
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

    fn pdf_text_stamp_request(
        input_path: PathBuf,
        output_path: PathBuf,
        text: &str,
        pages: Option<Vec<usize>>,
    ) -> PdfTextStampRequest {
        PdfTextStampRequest {
            input_path: input_path.to_string_lossy().into_owned(),
            output_path: output_path.to_string_lossy().into_owned(),
            text: text.to_string(),
            pages,
            position: Some("top-right".to_string()),
            margin_x: Some(36.0),
            margin_y: Some(36.0),
            font_size: Some(24.0),
            opacity: Some(0.85),
            rotation_degrees: Some(0.0),
            color: Some("red".to_string()),
            border_enabled: None,
            border_color: None,
            border_width: None,
            border_opacity: None,
            background_enabled: None,
            background_color: None,
            background_opacity: None,
            padding: None,
        }
    }

    fn pdf_image_watermark_request(
        input_path: PathBuf,
        output_path: PathBuf,
        image_path: PathBuf,
        pages: Option<Vec<usize>>,
    ) -> PdfImageWatermarkRequest {
        PdfImageWatermarkRequest {
            input_path: input_path.to_string_lossy().into_owned(),
            output_path: output_path.to_string_lossy().into_owned(),
            image_path: image_path.to_string_lossy().into_owned(),
            pages,
            width: Some(120.0),
            opacity: Some(0.3),
            rotation_degrees: Some(15.0),
        }
    }

    fn pdf_page_numbers_request(
        input_path: PathBuf,
        output_path: PathBuf,
        pages: Option<Vec<usize>>,
    ) -> PdfPageNumbersRequest {
        PdfPageNumbersRequest {
            input_path: input_path.to_string_lossy().into_owned(),
            output_path: output_path.to_string_lossy().into_owned(),
            pages,
            start_number: Some(5),
            format: Some("page-number-of-total".to_string()),
            position: Some("bottom-center".to_string()),
            margin_x: Some(36.0),
            margin_y: Some(24.0),
            font_size: Some(12.0),
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

    fn page_has_operator(document: &Document, page_id: ObjectId, operator: &str) -> bool {
        let bytes = document
            .get_page_content(page_id)
            .expect("page content should load");
        Content::decode(&bytes)
            .expect("page content should decode")
            .operations
            .iter()
            .any(|operation| operation.operator == operator)
    }

    fn write_jpeg_fixture(path: &Path, width: u16, height: u16, components: u8) {
        fs::write(path, jpeg_fixture(width, height, components, 0xc0))
            .expect("JPEG fixture should be written");
    }

    fn jpeg_fixture(width: u16, height: u16, components: u8, sof_marker: u8) -> Vec<u8> {
        let mut bytes = vec![0xff, 0xd8];
        let sof_length = 8_u16 + u16::from(components) * 3;
        bytes.extend_from_slice(&[0xff, sof_marker]);
        bytes.extend_from_slice(&sof_length.to_be_bytes());
        bytes.push(8);
        bytes.extend_from_slice(&height.to_be_bytes());
        bytes.extend_from_slice(&width.to_be_bytes());
        bytes.push(components);
        for component in 0..components {
            bytes.extend_from_slice(&[component + 1, 0x11, 0]);
        }

        let scan_length = 6_u16 + u16::from(components) * 2;
        bytes.extend_from_slice(&[0xff, 0xda]);
        bytes.extend_from_slice(&scan_length.to_be_bytes());
        bytes.push(components);
        for component in 0..components {
            bytes.extend_from_slice(&[component + 1, 0]);
        }
        bytes.extend_from_slice(&[0, 63, 0, 0, 0xff, 0xd9]);
        bytes
    }

    fn page_text_strings(document: &Document, page_number: u32) -> Vec<String> {
        let page_id = document.get_pages()[&page_number];
        let bytes = document
            .get_page_content(page_id)
            .expect("page content should load");
        let content = Content::decode(&bytes).expect("page content should decode");
        content
            .operations
            .into_iter()
            .filter_map(|operation| {
                if operation.operator != "Tj" {
                    return None;
                }
                match operation.operands.first() {
                    Some(Object::String(bytes, _)) => {
                        Some(String::from_utf8_lossy(bytes).into_owned())
                    }
                    _ => None,
                }
            })
            .collect()
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
