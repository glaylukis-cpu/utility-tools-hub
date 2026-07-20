# PDF Preview Research Spike

## 1. Purpose

PDF Workbenchに将来追加するページプレビューについて、実装方式、配布への影響、安全上の注意、段階的な導入手順を整理します。

v0.4.2では調査と設計のみを行います。PDF描画、サムネイル、ページ並び替え、OCR、墨消し、PDF本文編集は実装しません。

## 2. Current PDF Workbench status

現在のPDF Workbenchでは、次の機能をローカルで利用できます。

- PDFファイルの概要確認（ファイル名、サイズ、ページ数、PDF version、保護状態）
- Merge PDFsの選択順、合計ページ数、保護PDF警告
- Merge / Split / Extract / Rotate / Delete
- Split / Extract / Rotate / Deleteの入力PDF概要
- loading / success / error表示

Page list and preview領域は将来用の非操作エリアです。ページ画像の生成や表示は行っていません。Delete pagesはページ単位の削除であり、墨消しではありません。暗号化PDFの復号、権限制限回避、パスワード処理も行いません。

## 3. Preview goals

将来のプレビューは、見た目だけを表示するのではなく、PDF操作の対象と結果を安全に確認するための補助UIとします。

- 選択したPDFとページ数を視覚的に対応付ける
- Mergeの入力順と出力順を確認できる
- Split / Extract / Rotate / Deleteの対象ページを確認できる
- Normal / Protected状態と未対応理由を見失わない
- 大きなPDFでもUI全体を固めない
- 元ファイルを上書きせず、ローカル処理方針を維持する
- 実描画を導入する場合は、表示結果と出力結果が同一とは限らないことを明示する

## 4. Non-goals for v0.4.2

- PDFページのラスタライズまたはCanvas描画
- サムネイル生成、ズーム、ページ送り
- ドラッグ＆ドロップによるページ並び替え
- Watermark、page numbers、overlay writing
- OCR、safe redaction、direct PDF text editing
- 暗号化PDFの復号、権限制限回避、パスワード入力
- 外部サービスへのPDFアップロード
- 新しいnpm / Cargo依存、Tauri command、permissionの追加

## 5. Candidate approaches

### A. Rust-side rendering

Rust側でPDFページをビットマップへ描画し、フロントエンドへ画像データまたは一時ファイル参照を返す方式です。

- 長所: ファイルアクセスと描画処理をRust側に閉じやすく、フロントエンドは通常の画像として扱える
- 短所: 現在のPDF操作ライブラリとは別に描画エンジンが必要になる可能性が高い
- 配布: ネイティブライブラリを使う場合はWindows installerへの同梱、アーキテクチャ別成果物、更新手順が必要
- 性能: DPI、画像形式、同時描画数、キャッシュ上限を設計しないとメモリ使用量が大きくなる
- 安全性: 壊れたPDFや巨大ページをRust側で扱うため、サイズ上限、タイムアウト、キャンセル、エラー境界が必要

### B. PDFium-based rendering

PDFiumをRust bindingなどから利用し、ページをビットマップへ変換する方式です。PDFium公式のテストプログラムもページのラスタライズを扱いますが、PDFium自体はChromiumと同系統のビルドツールを使用します。`pdfium-render`もPDFium本体を同梱しないため、動的または静的ライブラリの準備が別途必要です。

- 長所: 実ページ描画、将来のサムネイル、部分描画へ発展しやすい
- 短所: native binary、binding、更新追従、脆弱性対応の運用負荷がある
- 配布: PDFium DLLの同梱方法、Windows x64以外の扱い、ライセンス表記、署名対象を確認する必要がある
- 性能: 高品質な描画が期待できる一方、大量ページの並列描画やキャッシュは明示的に制御する必要がある
- 安全性: JavaScript / XFA対応の要否を含め、不要機能を有効にしない構成と、未信頼PDFの回帰テストが必要

参考: [PDFium公式リポジトリ](https://pdfium.googlesource.com/pdfium/)、[pdfium-render documentation](https://docs.rs/pdfium-render/latest/pdfium_render/)

### C. pdf.js frontend

PDF.jsのDisplay layerでページをCanvasへ描画する方式です。公式構成には本体、worker、character maps、viewer assetsなどが含まれます。

- 長所: React / WebView側でページ描画とサムネイルUIを組み立てやすく、OS間でUIをそろえやすい
- 短所: 新しいフロントエンド依存とworker資産が増え、既存のRust PDF処理とは別のPDF解析系統を持つ
- 配布: CDNを使わず全資産をアプリへ同梱し、worker、font / CMap、Vite build、ライセンスを確認する必要がある
- 性能: Canvas解像度、表示中ページだけの遅延描画、破棄、キャッシュ上限が必要
- 安全性: PDF bytesの受け渡し、workerのCSP、blob URLの破棄、エラー内容の無害化が必要

PDF.js公式ガイドではworkerを含む構成が示され、`file://` URLではworkerが有効にならない注意があります。Tauriではローカルファイルを直接URLとして渡すのではなく、権限を限定して読み込んだbytesを渡す試作を優先します。

参考: [PDF.js Getting Started](https://mozilla.github.io/pdf.js/getting_started/?lang=en)、[PDF.js examples](https://mozilla.github.io/pdf.js/examples/)

### D. Tauri WebView with iframe / object / embed

WebViewの組み込みPDF readerへローカルPDFを渡す方式です。WindowsのWebView2はローカルPDFへのfile URL navigationをサポートします。

- 長所: 専用レンダラーを追加せず、短期間でページ表示を試せる可能性がある
- 短所: 表示UI、ページ選択、サムネイル、エラー制御をアプリ側で統一しにくい
- 配布: TauriはOSのWebViewを利用するため、OS、WebView runtime、policyによる差を検証する必要がある
- 性能: browser内蔵viewerに依存し、ページ単位のキャッシュ制御や操作計画との連携が弱い
- 安全性: ローカルパス露出、navigation、CSP、asset scopeを厳しく制限する必要がある。未信頼コンテンツを広い権限のWebViewへ読み込ませない

参考: [WebView2 local content](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/working-with-local-content)、[Tauri CSP](https://v2.tauri.app/security/csp/)、[Tauri security](https://v2.tauri.app/security/)

### E. OS default viewer / open externally

選択したPDFをOS既定のPDF viewerで開く方式です。Tauriのopener APIは、ファイルを既定アプリで開く機能とパスscopeを提供します。

- 長所: アプリ内描画依存が不要で、利用者は普段のviewerを使える
- 短所: アプリ内プレビューではなく、操作対象ページとの同期もできない
- 配布: renderer同梱は不要だが、対応viewerの有無とopener permission / scopeの設計が必要
- 性能: アプリ側の描画負荷は小さいが、外部アプリ起動の待ち時間と画面遷移が発生する
- 安全性: 利用者が明示的に選んだローカルPDFだけを開き、任意パスやURLを渡せないscopeにする必要がある

参考: [Tauri opener API](https://v2.tauri.app/ja/reference/javascript/opener/)、[Windows ShellExecute](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shellexecutea)

### F. Lightweight pseudo-preview first

実ページを描画せず、既存inspect情報からページ番号ブロック、選択範囲、Merge順、回転角度、削除対象、Protected表示を可視化する方式です。

- 長所: 新規依存、native binary、PDF bytesの追加受け渡しが不要で、現在の安全境界を維持できる
- 短所: PDF本文やレイアウトは確認できず、「preview」という名称だけでは誤解される可能性がある
- 配布: 既存のReact / CSSだけで構成でき、installerへの影響が小さい
- 性能: 数千ページでは仮想化または表示件数制限が必要だが、画像描画より軽量
- 安全性: 内容を描画しないため攻撃面は比較的小さい。必ず「Operation plan」「No page rendering」と表示する

## 6. Comparison table

| Approach | What it enables | Implementation difficulty | Dependency impact | Packaging risk | Security risk | Fit for v0.4.x | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rust-side rendering | In-app page images | High | High | High | Medium | Medium | Renderer選定後の長期候補 |
| PDFium-based rendering | High-fidelity rasterization and thumbnails | High | High | High | Medium–High | Medium | Native binaryと更新運用が必要 |
| pdf.js frontend | Canvas preview and thumbnail UI | Medium–High | High | Medium | Medium | Medium–High | worker / CSP / memory検証が必要 |
| WebView iframe / object / embed | Built-in viewer display | Medium | Low | Medium | Medium–High | Low–Medium | 環境差と制御不足が大きい |
| OS default viewer | External full-document viewing | Low | Low | Low | Low–Medium | Medium | Workbench内previewにはならない |
| Lightweight pseudo-preview | Page operation plan visualization | Low–Medium | None | Low | Low | High | v0.4.3の推奨候補 |

難易度とリスクは本リポジトリのWindows向けTauri配布、既存依存、ローカル処理方針を前提にした相対評価です。

## 7. Recommended staged path

### v0.4.2: Research only

- 本ドキュメントで候補、非目標、リスク、QA条件を固定する
- UIはPreviewが未実装であることだけを明確にする
- 依存、command、permission、PDF処理ロジックを変更しない

### v0.4.3: Lightweight pseudo-preview / operation plan

- ページ番号ブロックを表示するが、PDF本文は描画しない
- Merge order、Extract / Rotate / Delete対象、Split後の構成を視覚化する
- Protected状態と実行不可理由を同じ領域に表示する
- 大量ページ向けに表示上限または仮想化方針を先に決める

### v0.4.4 or later: Experimental renderer prototype

- pdf.jsとPDFiumを小さな非公開fixtureで比較する
- 最初は1ページだけを低解像度で描画し、メモリ、速度、installer、CSP、エラーを測定する
- 実験機能として明示し、既存操作の必須経路にしない
- 採用前にライセンス、更新運用、脆弱性対応、Windows packagingを確認する

### Later phases

- 表示中ページだけのサムネイル生成とキャッシュ
- ページ選択と既存操作の連携
- Reorderの操作計画と出力確認
- Watermark / page numbers / overlay writing
- OCR、safe redaction、direct PDF text editingは別の安全性研究として扱う

## 8. Risks

- 未信頼PDF: 壊れたxref、巨大オブジェクト、異常なページサイズ、深い構造でparserやrendererが停止・大量消費する可能性
- メモリ: 高DPI画像と多数サムネイルを同時保持すると急増する
- 表示と出力の差: rendererと既存PDF操作coreが異なる解釈をする可能性
- Protected PDF: previewできても操作できない状態を作ると誤解を招くため、同じ判定と警告を維持する
- パスと一時ファイル: フルパスをUIやログへ出さず、一時画像を使う場合は権限、名前、削除時期を定義する
- WebView境界: blob URL、worker、asset protocol、iframe navigation、CSPを必要最小限にする
- 配布: native binaryや追加assetがinstallerサイズ、署名、updater artifact、アーキテクチャ対応へ影響する
- アクセシビリティ: 画像だけに依存せず、ページ番号、状態、操作対象をテキストでも提供する

## 9. QA checklist

- [ ] Preview / thumbnails / reorderが未実装と明記されている
- [ ] OCR / redaction / direct PDF text editingがResearchまたは未実装と明記されている
- [ ] Delete pagesがredactionではないことを維持している
- [ ] 暗号化PDFの復号、権限制限回避、パスワード処理を示唆していない
- [ ] PDFファイルが端末外へ送信されない設計になっている
- [ ] フルパス、PDF内容、内部エラーを画面やログへ不要に露出しない
- [ ] Merge / Split / Extract / Rotate / Deleteの既存操作を妨げない
- [ ] 疑似プレビューを実ページ画像と誤認させない
- [ ] 実描画prototypeでは通常、破損、大容量、Protected PDFを個別に検証する
- [ ] 1280 / 1600 / 1920 / mobile幅とkeyboard操作を確認する
- [ ] renderer導入前にライセンス、依存、installer、updaterへの影響を確認する

## 10. Next implementation step

次の安全な実装候補は、実ページを描画しない「Operation plan」です。既存inspectのページ数からページ番号ブロックを作り、Merge順、抽出対象、回転角、削除対象を状態として重ねます。

実装に着手する前に、数千ページ時の表示上限、選択状態モデル、Protected PDF時の表示、スクリーンリーダー向けラベルを決めます。実描画backendの追加は、この疑似プレビューをQAした後に別タスクとして判断します。
