# SOS

> **Alpha status:** this repository is an experimental Tauri 2 and Svelte desktop prototype. It is not a production office suite or a complete Microsoft Office replacement.

SOS combines a Svelte interface with a Rust/Tauri shell. The desktop shell provides local file dialogs, local autosave snapshots, and system information. The workspace modules are intentionally presented as functional prototypes with explicit format and networking limits.

## Implemented modules

### Writer

Writer is a contenteditable document editor with headings, paragraph styles, lists, tables, dividers, links, local images, find and replace, undo and redo, and word and character counts. It can edit the in-memory document and print through the host print dialog.

### Sheets

Sheets provides a grid, formula bar, cell formatting, multiple sheet tabs, CSV and TSV import, and local workbook state. The formula engine includes arithmetic and functions such as `SUM`, `AVERAGE`, `COUNT`, `MIN`, `MAX`, `IF`, `COUNTIF`, `SUMIF`, and `VLOOKUP`. It is a small formula implementation, not a complete Excel calculation engine.

### Slides

Slides provides a 16:9 deck organizer, slide duplication and reordering, text and shape elements, local images, speaker notes, and a presenter view with a timer. The canvas is an interactive prototype rather than a full PowerPoint editor.

## File formats and interoperability

The file names below describe the current adapters, not guarantees of Office compatibility.

| Workspace | Read or import | Save or export | Important limitation |
| --- | --- | --- | --- |
| Writer | Markdown, text, HTML, simplified RTF text, suite JSON, and a limited DOCX archive reader | Markdown, text, HTML, RTF, suite JSON, a `.docx`-named HTML adapter, and print to PDF through the host print dialog | The DOCX export is not a binary WordprocessingML package and does not provide a full Office round trip; print output is whatever the host print dialog produces |
| Sheets | CSV, TSV, suite JSON, and a limited first-sheet XLSX archive reader | CSV, suite JSON, and a `.xlsx`-named XML adapter | The XLSX export is not a binary SpreadsheetML package; formatting and multi-sheet fidelity are limited |
| Slides | Suite JSON and a text-extracting PPTX archive reader | Suite JSON and a `.pptx`-named custom XML adapter | The PPTX export is not a binary PresentationML package; layout fidelity is limited |

The file dialog advertises legacy extensions such as `.doc`, `.xls`, `.odt`, and `.odp`, but those formats are not reliable inputs in this prototype. Binary files that are not DOCX, XLSX, or PPTX packages, including PDF files and images, are rejected with an explanation instead of being decoded into unreadable text. The `.sosw`, `.soss`, and `.sosp` names are suite-state conventions rather than published interchange standards.

## Optional AI

The AI assistant is optional. Its default `local` provider is a deterministic offline helper that returns templates and example text; it is not a local language model. Settings can select OpenAI, Anthropic, or an Ollama-compatible endpoint. Those providers make outbound requests only when explicitly configured. API keys are kept in web storage, so shared or managed machines require an appropriate secret-handling policy.

The project makes no zero-telemetry, zero-network, or encryption claim when a remote AI provider is selected.

## Platform requirements for people using the app

End users do not install drivers, runtimes, or extra services. There is no separate database, no bundled server to start, and no vendor graphics driver requirement.

| Platform | What the user installs | What is handled for the user |
| --- | --- | --- |
| macOS 10.15 or newer | Nothing | The system WebKit view is used directly. The bundle is code signed at build time. |
| Windows 10/11 x64 | Nothing | WebView2 is shipped inside the installer as an offline installer, so no runtime download is needed. NSIS and MSI bundles are produced. |
| Debian/Ubuntu x64 | Nothing | The `.deb` declares its WebKit and GTK dependencies, so the package manager resolves them. AppImage is also produced. |

Notes and honest limits:

- The WebView is the operating system's own engine (WebKit on macOS and Linux, WebView2 on Windows). That is a property of the toolkit, not a driver you install per machine.
- On Linux the WebKitGTK libraries are a toolkit requirement. The `.deb` declares them so `apt` installs them automatically; the AppImage expects them to be present on the host.
- No application code shells out to external binaries such as LibreOffice, `pdftotext`, ImageMagick, or OnlyOffice, so there is no hidden external program dependency.
- Fonts fall back to whatever the host provides. The app never downloads fonts or assets at runtime, so it works with the network disconnected.
- Cloud AI is optional. When no provider is configured, nothing is sent anywhere.

## Requirements for people building from source

- Node.js 20.19 or newer, or Node.js 22.12 or newer, for the current Vite toolchain
- npm
- Rust stable toolchain and `rustfmt` and `clippy` components for Rust checks
- macOS: Xcode Command Line Tools
- Linux: the Tauri WebKit and build packages, including `libwebkit2gtk-4.1-dev`, `build-essential`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, and `librsvg2-dev`
- Windows: Visual Studio C++ Build Tools and the Windows SDK

These are build-time toolchains only. They are not needed to run the shipped app.

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

## App icon

`assets/icon/sos-icon.svg` is the editable master. `assets/icon/sos-icon.png` is the 1024×1024
render used as the Tauri input; it is the same artwork with the rounded corners knocked out to
alpha, which is what macOS expects. `public/logo.svg` and `public/logo.png` are copies used for
the in-app favicon.

After editing the master, re-export the 1024×1024 PNG and regenerate every platform asset:

```bash
npx tauri icon assets/icon/sos-icon.png
```

Do not hand-edit anything in `src-tauri/icons/`, `src-tauri/icons/icon.iconset`, or the generated
`ios/` and `android/` trees; they are all overwritten by that command.

## CI and releases

`.github/workflows/ci.yml` runs `npm ci`, the frontend check, the test command, the frontend build, and the Rust format, check, test, and Clippy commands. The Rust job requires the committed Cargo lockfile and uses locked Cargo commands.

`.github/workflows/release.yml` runs the same checks before building a platform matrix with Tauri. It requests native bundles for macOS, Linux, and Windows, verifies that each expected bundle exists, uploads only the Tauri bundle directories, and publishes only recognized Tauri artifacts after every matrix job succeeds. A failed or empty build cannot create a release. The workflow does not use `scripts/package_all.py` to manufacture substitutes or browser wrappers.

## Privacy and data handling

Writer, Sheets, and Slides state can remain in browser or webview local storage. Native document operations use the operating system file dialogs and the Rust file commands. Settings and API keys are stored in that local storage without encryption, so a shared or managed machine needs an appropriate secret-handling policy. The default local AI helper does not make a remote request. Remote AI providers are contacted only when they are explicitly configured, and they receive the prompt and context sent to that provider.

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

Do not treat generated bundles or browser output as release artifacts.

## License

SOS is distributed under the MIT License. See [LICENSE](LICENSE).
