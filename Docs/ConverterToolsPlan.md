# Converter Tools Plan

## v0.2.5 Converter Tools pack 1

v0.2.5 adds the first lightweight converter pack:

- JSON Formatter / Minifier
- CSV to JSON
- JSON to CSV
- Markdown to HTML
- Base64 Encode / Decode
- URL Encode / Decode

All conversions run locally in the React / TypeScript UI. The pack does not upload files, contact an external service, or store input values.

## UI and navigation

- Converter Tools is the entry point for lightweight data and text converters in the app's white card UI.
- Text converters includes a direct link to the existing Text Case Converter screen.
- Excel → HTML Converter remains the existing file converter and is linked from the Converter Tools screen.
- The Tools list separates Available tools from Planned / Pro tools without changing lock behavior.
- PDF tools remain planned for a later phase.

v0.2.6 polishes this structure with a white card-based UI and clearer file, data, and text converter navigation.

v0.2.7 clarifies the Available and Planned / Pro catalog groups and the navigation to Text Case Converter and Excel → HTML Converter without changing converter behavior.

This is a UI and navigation organization change; the converter implementations are unchanged.

The Tools catalog is organized into Converters, Editors, and Planned / Pro tools. Converter Tools stacks File, Data, and Text converter sections vertically: Data contains JSON and CSV / JSON, Text contains the Text Case link plus Markdown, Base64, and URL tools, and File contains the Excel → HTML link. This changes UI and navigation only; converter behavior is unchanged, and PDF tools remain planned for a later phase.

v0.2.8 records this catalog and vertical converter layout cleanup without changing converter logic or adding PDF tools, external communication, or package dependencies.

## Out of scope

- File upload and file save workflows
- Batch conversion
- PDF tools
- Paid-plan activation

## Future candidates

- File converter foundation
- Batch conversion
- PDF page tools
- Image to PDF
- PDF to image
