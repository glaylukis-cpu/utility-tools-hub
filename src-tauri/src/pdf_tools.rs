use lopdf::{dictionary, Document, Object, ObjectId};
use serde::Serialize;
use std::collections::HashSet;
use std::error::Error;
use std::fmt;
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
            Self::EncryptedPdfUnsupported => "encrypted PDF files are not supported",
            Self::InvalidPdf => "an input file is not a supported PDF document",
            Self::SaveFailed => "the output PDF could not be saved",
        };

        formatter.write_str(message)
    }
}

impl Error for PdfToolError {}

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
        run_pdf_extract_bridge, run_pdf_merge_bridge, run_pdf_split_bridge, PdfExtractRequest,
        PdfMergeRequest, PdfSplitRequest,
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
}
