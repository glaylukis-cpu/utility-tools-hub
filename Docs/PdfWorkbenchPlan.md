# PDF Workbench Plan

## 1. Current status

Utility Tools Hub v0.3.4では、次のPDFページ操作を利用できます。

- Merge PDFs
- Split PDF
- Extract pages
- Rotate pages
- Delete pages

すべてのPDF処理は端末内でローカル実行されます。Python sidecarは使用していません。

暗号化または権限制限付きPDFは、復号、権限制限の解除、回避を試みず、未対応の入力として明確に拒否します。通常の未保護PDFは既存のページ操作で処理できます。Delete pagesはページ単位の削除であり、墨消しではありません。

## 2. Product direction

PDF Toolsを個別操作の一覧から、ファイルの状態確認、ページ操作、プレビュー、並び替え、書き込み、結果確認、QA、安全上の注意を一つの流れで扱えるPDF Workbenchへ発展させます。

Utility Tools Hub全体は、PDF、Excel、HTMLを扱うローカル資料作成ワークベンチとして育てます。短期間で機能数を増やすことより、既存処理の品質、検証可能性、実用性、安全なエラー表示を優先します。

PDF本文編集、OCR、安全な墨消しは長期的な研究対象です。これらは誤った実装が文書の破損、情報漏えい、誤認につながるため、機能実装より先に安全仕様、制限、検証方法を定義します。

## 3. Workbench UI concept

将来のPDF Workbenchは、次のような画面構成を候補とします。

- **Left panel:** 選択ファイル、ファイル概要、ページ数、保護状態の警告
- **Center panel:** ページ一覧、サムネイル、選択状態、プレビュー
- **Right panel:** 操作、オプション、出力先、処理結果、安全上の注意
- **Bottom or side area:** ログ、QAヒント、次に実行できる操作

UIは、入力、対象ページ、操作、出力先、結果を明確に分離します。危険な状態や未対応入力は、ユーザーが処理を開始する前に理解できる形で表示します。

この文書ではUI構成だけを定義し、プレビュー、並び替え、書き込みなどの実装は行いません。

## 4. PDF capability levels

### Level 1: Page operations

ページ構造を対象とする基本操作です。

- Merge
- Split
- Extract
- Rotate
- Delete
- Reorder

Merge、Split、Extract、Rotate、Deleteはv0.3.4までに実装済みです。Reorderは今後のMVP候補です。すべての操作で元ファイルを既定では上書きせず、新しいPDFとして保存します。

### Level 2: Page preview and thumbnails

操作対象を実行前に確認するための表示機能です。

- page count
- page thumbnails
- selected page state
- preview quality limitations

ページ数と選択状態を正確に表示し、サムネイルと実際の出力品質が異なる可能性を明記します。プレビューは処理結果の完全な保証には使用せず、実ファイルQAを補助する位置づけとします。

### Level 3: Overlay writing

元のページ内容を直接編集せず、上に新しい描画要素を追加する機能です。

- text stamp
- image stamp
- watermark
- page numbers
- rectangles / shapes
- annotation-like overlays

埋め込みフォント、座標、回転、ページサイズ、透明度、印刷結果を考慮します。見た目を覆う矩形や画像は安全な墨消しとして扱いません。

### Level 4: Project state

操作を非破壊で組み立て、出力前に確認できる編集モデルです。

- non-destructive edit model
- operation history
- save as new PDF
- no overwrite by default

プロジェクト状態は、元PDFと操作指示を分離して保持する設計を優先します。操作履歴から対象ページや設定を確認できるようにし、出力は常に新しいPDFを既定とします。

### Level 5: Safe redaction research

安全な墨消しは、黒い矩形などで見た目だけを覆う処理ではありません。対象情報が基礎データから取り除かれていることが必要です。

調査対象には次を含みます。

- underlying contentの削除
- text objects
- images
- annotations
- metadata
- hidden text
- incremental updatesや残存オブジェクト

出力後の再抽出、コピー、検索、オブジェクト検査を含む安全性検証が必要です。確実に除去できない場合は安全な墨消しとして提供しません。

### Level 6: OCR workflow

画像PDFやスキャン文書を対象とした、OCR支援ワークフローです。

- image PDFs
- OCR-assisted text detection
- searchable PDF
- OCR accuracy limitations
- Japanese OCR considerations

OCR結果は誤認識を含む前提で扱い、原文との比較、信頼度、手動確認を必要とします。日本語では縦書き、ルビ、複雑な段組み、旧字体、低解像度、混在言語を考慮します。OCR結果を無条件に正しい本文として扱いません。

### Level 7: Direct PDF text editing research

既存PDFの本文を直接編集する機能は、次の技術的リスクを伴います。

- glyph-level placement
- embedded fonts
- subset fonts
- Japanese text complexity
- text extraction mismatch
- layout破損の可能性

PDF内の文字コード、表示グリフ、抽出テキストが一致しない場合があります。置換後のフォント、字幅、改行、段組み、縦書き、描画順序を維持できない可能性があるため、十分な研究と実ファイル検証なしに一般機能として提供しません。

## 5. Proposed v0.4.x milestones

### v0.4.0 PDF Workbench foundation

- 既存PDF ToolsをWorkbench構成へ整理
- ファイル、操作、出力、結果、安全情報を分離
- Merge / Split / Extract / Rotate / Deleteを維持
- 新しいPDF処理は追加しない

### v0.4.1 PDF file summary / protected PDF detection UI

- 選択ファイルの概要表示
- ファイル数と基本情報の表示
- 暗号化・権限制限状態の警告
- 未対応理由と安全な次の行動を表示

### v0.4.2 Page count and document metadata

- ページ数表示
- PDF versionなど安全に取得できる文書情報
- メタデータの表示範囲とプライバシー方針の整理
- 表示値と実処理結果の整合性テスト

### v0.4.3 Page preview research spike

- ローカルページ描画方式の調査
- サムネイル品質とパフォーマンスの測定
- 大容量PDFのメモリ使用量確認
- プレビューと出力結果の違いを明示

### v0.4.4 Reorder MVP

- ページ順序の明示的な指定
- 重複、欠落、範囲外指定の検証
- 出力前の順序確認
- 新しいPDFとして保存

### v0.4.5 QA sample set and manual QA guide

- 小さな非機密PDFによる再現可能なQAセット
- ページサイズ、回転、圧縮、複数PDF versionの確認
- 保護PDF、破損PDF、境界値の拒否確認
- 手動QA結果の記録方法

## 6. Proposed v0.5.x milestones

v0.5.xでは、非破壊のoverlay writingを段階的に検討します。

- watermark
- page numbers
- text stamp
- image stamp
- shape overlay
- save as new PDF
- overlay QA

各機能は座標、ページ回転、用紙サイズ、フォント、透明度、印刷結果を検証します。元PDFの上書きは既定で行わず、overlayを墨消しとして扱いません。

## 7. Proposed v0.6.x Excel to Web connection

PDF Workbenchと並行して、ExcelからWeb向け資料を作る流れを強化します。

- Excel HTML Converter強化
- HTML Editorへの取り込み
- 料金表テンプレート
- 比較表テンプレート
- 業務表テンプレート
- ZIP出力
- GitHub Pages想定出力

Excelデータをローカルで変換し、HTML Editorで調整して、静的サイトとして出力できる一連のワークフローを目指します。

## 8. Proposed v0.7.x HTML Editor / Site Builder

HTML Editorを小規模な静的サイト制作に使えるSite Builderへ段階的に発展させます。

- Studio Note以外のテンプレート
- 小規模事業サイト
- landing page
- portfolio
- service page
- local preview
- publish guide

生成物は静的HTMLを基本とし、利用者が内容と公開先を確認できるローカルファーストの流れを維持します。

## 9. Safety principles

- PDF files stay on this device.
- Never overwrite original files by default.
- Protected PDFs are rejected unless explicitly supported in the future.
- No decryption or permission bypass.
- Delete pages is not redaction.
- Visual masks are not safe redaction.
- Redaction must remove underlying content.
- OCR and direct editing must be labeled experimental until reliable.
- QA checklist is required for every PDF feature.

安全性を説明できない機能は実装を急ぎません。入力ファイル、対象ページ、出力先、処理結果、既知の制限をUIとDocsの両方で明示します。

## 10. Engineering principles

- 1 task = 1 clear completion condition.
- Tests before release.
- Real-file QA is required.
- Do not add large binary fixtures to the repository.
- No external communication unless explicitly designed and reviewed.
- Do not place secrets or sensitive paths in logs.
- Keep the Rust core and UI bridge separated.
- Surface safe, understandable errors in the UI.
- Treat version bump and release as separate tasks.

単体テストだけでなく、既知のページ数と内容を持つ非機密の実PDFで出力を確認します。失敗時は内部情報を露出せず、原因と次の行動が理解できるエラーを返します。

## 11. Non-goals for immediate v0.4.0

- No direct text editing
- No OCR
- No safe redaction
- No encrypted PDF decryption
- No permission bypass
- No cloud upload
- No paid feature unlock

v0.4.0では、既存機能をWorkbenchとして整理することに集中します。未検証の高度な処理を同時に追加しません。

## 12. Next implementation step

**v0.4.0 Step 3A - PDF inspect core and bridge**

`inspect_pdf`と既存の`execute_tool`経路に`pdf_inspect`を追加し、ファイル情報、PDF version、ページ数、保護状態、安全に取得できる文書メタデータを返します。UI接続、プレビュー、復号、権限制限回避はこのステップには含みません。

**v0.4.0 Step 3B - PDF file summary UI**

`pdf_inspect`をPDF Workbenchのfile summary UIへ接続し、ファイル名、サイズ、ページ数、PDF version、メタデータ、保護状態を表示します。プレビュー、サムネイル、並び替え、新しいPDF処理は追加しません。

**v0.4.0 Step 4A - Single-PDF operation summaries**

Split、Extract、Rotate、Deleteの入力PDF選択後に`pdf_inspect`を自動実行し、サイズ、ページ数、PDF version、保護状態を各カードへ表示します。Mergeの複数ファイルsummary、プレビュー、サムネイル、並び替えは引き続き予定機能です。
