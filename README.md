# Simple Office Suite (SOS)

> **Alpha status:** this repository is an experimental Tauri 2 and Svelte desktop prototype. It is not a production office suite, a complete Microsoft Office replacement, or a security-audited communications product.

Simple Office Suite combines a Svelte interface with a Rust/Tauri shell. The desktop shell provides local file dialogs, local autosave snapshots, and system information. The workspace modules are intentionally presented as functional prototypes with explicit format and networking limits.

## Implemented modules

### Writer

Writer is a contenteditable document editor with headings, paragraph styles, lists, tables, dividers, links, local images, find and replace, undo and redo, and word and character counts. It can edit the in-memory document and print through the host print dialog.

### Sheets

Sheets provides a grid, formula bar, cell formatting, multiple sheet tabs, CSV and TSV import, and local workbook state. The formula engine includes arithmetic and functions such as `SUM`, `AVERAGE`, `COUNT`, `MIN`, `MAX`, `IF`, `COUNTIF`, `SUMIF`, and `VLOOKUP`. It is a small formula implementation, not a complete Excel calculation engine.

### Slides

Slides provides a 16:9 deck organizer, slide duplication and reordering, text and shape elements, local images, speaker notes, and a presenter view with a timer. The canvas is an interactive prototype rather than a full PowerPoint editor.

### PDF and forms

The PDF workspace is a local viewer and form-layout prototype. It can display its own document state, add text, checkbox, and signature fields, and export field values as JSON. It does not parse or render arbitrary binary PDF files. The print action calls the operating system or browser print dialog; it is not a native PDF generation library.

### Mail

Mail is a local demo client. Seeded messages, folders, search, starring, archive, trash, compose, reply, and draft flows are stored in browser or Tauri webview local storage. Account fields are sample data. There is no IMAP, SMTP, OAuth, or real attachment transport in this repository.

### Communicator

Communicator is a local seeded team-chat demo with channels, direct messages, reactions, simulated presence, a call dialog, and a detachable Tauri window. Messages and profiles are stored locally. There is no chat server, protocol, key exchange, or implemented end-to-end encryption. The encryption labels in the interface must not be treated as a security guarantee or as Microsoft Teams compatibility.

## File formats and interoperability

The file names below describe the current adapters, not guarantees of Office compatibility.

| Workspace | Read or import | Save or export | Important limitation |
| --- | --- | --- | --- |
| Writer | Markdown, text, HTML, simplified RTF text, suite JSON, and a limited DOCX archive reader | Markdown, text, HTML, RTF, suite JSON, and a `.docx`-named HTML adapter | The DOCX export is not a binary WordprocessingML package and does not provide a full Office round trip |
| Sheets | CSV, TSV, suite JSON, and a limited first-sheet XLSX archive reader | CSV, suite JSON, and a `.xlsx`-named XML adapter | The XLSX export is not a binary SpreadsheetML package; formatting and multi-sheet fidelity are limited |
| Slides | Suite JSON and a text-extracting PPTX archive reader | Suite JSON and a `.pptx`-named custom XML adapter | The PPTX export is not a binary PresentationML package; layout fidelity is limited |
| PDF and forms | Local demo state only | Form values as JSON and host print output | No general PDF parser or renderer is implemented |
| Mail and Communicator | Local demo state | Local browser or webview storage | No network mail or chat service is implemented |

The file dialog advertises legacy extensions such as `.doc`, `.xls`, `.odt`, and `.odp`, but those formats are not reliable inputs in this prototype. Binary files that are not DOCX, XLSX, or PPTX packages, including PDF files and images, are rejected with an explanation instead of being decoded into unreadable text. The `.sosw`, `.soss`, and `.sosp` names are suite-state conventions rather than published interchange standards.

## Optional AI

The AI assistant is optional. Its default `local` provider is a deterministic offline helper that returns templates and example text; it is not a local language model. Settings can select OpenAI, Anthropic, or an Ollama-compatible endpoint. Those providers make outbound requests only when explicitly configured. API keys are kept in web storage, so shared or managed machines require an appropriate secret-handling policy.

The project makes no zero-telemetry, zero-network, or encryption claim when a remote AI provider is selected.

## Requirements

- Node.js 20.19 or newer, or Node.js 22.12 or newer, for the current Vite toolchain
- npm
- Rust stable toolchain and `rustfmt` and `clippy` components for Rust checks
- macOS: Xcode Command Line Tools
- Linux: the Tauri WebKit and build packages, including `libwebkit2gtk-4.1-dev`, `build-essential`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, and `librsvg2-dev`
- Windows: Visual Studio C++ Build Tools, the Windows SDK, and WebView2

`package-lock.json` and `src-tauri/Cargo.lock` are intentionally not ignored. Commit both lockfiles so npm and Cargo resolve the same dependency graph in development and CI.

## Commands

Install the exact JavaScript dependency graph:

```bash
npm ci
```

Run the Vite browser harness:

```bash
npm run dev
```

Open `http://127.0.0.1:1420` in a browser. This is a frontend and local-storage demo mode. It is not the Tauri desktop application, does not provide the native file backend, and uses simulated browser metrics where native metrics are unavailable.

Run the native desktop development build:

```bash
npm run tauri dev
```

Build the frontend, run the Svelte type check, run the test command, and build the frontend bundle:

```bash
npm run build
npm run check
npm test
npm run validate
```

Build a native bundle for the current operating system:

```bash
npm run build:desktop
```

The equivalent Tauri command is `npm run tauri build`.

The optional verifier only checks files emitted by Tauri. It does not build an installer and does not accept browser output as a native artifact:

```bash
npm run package:verify
```

On Windows, invoke the same verifier with the available Python 3 executable if `python3` is not on `PATH`.

## CI and releases

`.github/workflows/ci.yml` runs `npm ci`, the frontend check, the test command, the frontend build, and the Rust format, check, test, and Clippy commands. The Rust job requires the committed Cargo lockfile and uses locked Cargo commands.

`.github/workflows/release.yml` runs the same checks before building a platform matrix with Tauri. It requests native bundles for macOS, Linux, and Windows, verifies that each expected bundle exists, uploads only the Tauri bundle directories, and publishes only recognized Tauri artifacts after every matrix job succeeds. A failed or empty build cannot create a release. The workflow does not use `scripts/package_all.py` to manufacture substitutes or browser wrappers.

## Privacy and data handling

Writer, Sheets, Slides, mail, and communicator state can remain in browser or webview local storage. Native document operations use the operating system file dialogs and the Rust file commands. The default local AI helper does not make a remote request. Remote AI providers, if enabled, receive the prompt and context sent to that provider. Mail and communicator data are demo data and are not synchronized between users or devices.

## Repository layout

- `src/`: Svelte components, workspace state, format adapters, and the optional AI helper
- `src-tauri/`: Tauri configuration, Rust commands, capabilities, and icons
- `scripts/package_all.py`: read-only Tauri artifact verifier
- `.github/workflows/`: CI and release definitions

## Contributing

Run the same checks used by CI before opening a pull request:

```bash
npm ci
npm run validate
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --manifest-path src-tauri/Cargo.toml --locked
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets --all-features -- -D warnings
```

Do not treat generated bundles, browser output, seeded mail, or communicator fixtures as release artifacts.

## License

Simple Office Suite is distributed under the MIT License. See [LICENSE](LICENSE).
