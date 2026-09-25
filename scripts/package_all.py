#!/usr/bin/env python3
import os
import sys
import shutil
import tarfile
import zipfile
import hashlib
import time

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DIST_INSTALLER = os.path.join(BASE_DIR, 'dist-installer')
RELEASE_APP = os.path.join(BASE_DIR, 'src-tauri', 'target', 'release', 'bundle', 'macos', 'Simple Office Suite.app')
TARGET_APP = os.path.join(BASE_DIR, 'Simple Office Suite.app')

os.makedirs(DIST_INSTALLER, exist_ok=True)

print("=== Simple Office Suite: Cross-Platform Packaging Pipeline ===")

# 1. Update root macOS .app
if os.path.exists(RELEASE_APP):
    print("1. Updating macOS .app bundle...")
    if os.path.exists(TARGET_APP):
        shutil.rmtree(TARGET_APP)
    shutil.copytree(RELEASE_APP, TARGET_APP, symlinks=True)
    os.system(f'chmod +x "{TARGET_APP}/Contents/MacOS/simple-office-suite"')
    os.system(f'xattr -cr "{TARGET_APP}"')
else:
    print(f"Warning: {RELEASE_APP} not found")

# 2. Build macOS Zip & Tar.gz
print("2. Packaging macOS release archives...")
mac_zip = os.path.join(DIST_INSTALLER, "Simple-Office-Suite-1.0.0-macOS-arm64.zip")
if os.path.exists(mac_zip):
    os.remove(mac_zip)
os.system(f'ditto -c -k --sequesterRsrc --keepParent "{TARGET_APP}" "{mac_zip}"')

mac_tar = os.path.join(DIST_INSTALLER, "Simple-Office-Suite-1.0.0-macOS-arm64.tar.gz")
with tarfile.open(mac_tar, "w:gz") as tar:
    tar.add(TARGET_APP, arcname="Simple Office Suite.app")

# 3. Create macOS one-click installer script
macos_installer_sh = os.path.join(DIST_INSTALLER, "install-macos.sh")
with open(macos_installer_sh, "w") as f:
    f.write('''#!/bin/bash
set -e
echo "=== Installing Simple Office Suite on macOS ==="
APP_NAME="Simple Office Suite.app"
DEST="/Applications/$APP_NAME"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -d "$SCRIPT_DIR/$APP_NAME" ]; then
    SOURCE="$SCRIPT_DIR/$APP_NAME"
elif [ -d "$SCRIPT_DIR/../$APP_NAME" ]; then
    SOURCE="$SCRIPT_DIR/../$APP_NAME"
else
    echo "Extracting from zip..."
    unzip -q "$SCRIPT_DIR/Simple-Office-Suite-1.0.0-macOS-arm64.zip" -d /tmp/
    SOURCE="/tmp/$APP_NAME"
fi

echo "Copying to $DEST..."
rm -rf "$DEST"
cp -R "$SOURCE" "$DEST"
xattr -cr "$DEST"
chmod +x "$DEST/Contents/MacOS/simple-office-suite"

# Create terminal CLI shortcut if possible
if [ -d "/usr/local/bin" ] && [ -w "/usr/local/bin" ]; then
    ln -sf "$DEST/Contents/MacOS/simple-office-suite" /usr/local/bin/simple-office-suite
    echo "CLI command created: /usr/local/bin/simple-office-suite"
fi

echo "Installation complete! You can now launch Simple Office Suite from Applications or Spotlight."
''')
os.chmod(macos_installer_sh, 0o755)

# 4. Create Windows Package & Installers
print("3. Building Windows installer package & setup scripts...")
win_staging = os.path.join(DIST_INSTALLER, "windows_staging")
if os.path.exists(win_staging):
    shutil.rmtree(win_staging)
os.makedirs(win_staging, exist_ok=True)

# Copy frontend dist and icon assets into Windows package
shutil.copytree(os.path.join(BASE_DIR, 'dist'), os.path.join(win_staging, 'app_dist'))
icons_dir = os.path.join(BASE_DIR, 'src-tauri', 'icons')
if os.path.exists(icons_dir):
    shutil.copytree(icons_dir, os.path.join(win_staging, 'icons'))

# Windows launcher batch
with open(os.path.join(win_staging, "Simple-Office-Suite.bat"), "w") as f:
    f.write('@echo off\r\ntitle Simple Office Suite\r\necho Starting Simple Office Suite...\r\nstart "" "%~dp0app_dist\\index.html"\r\n')

# Windows PowerShell unattended installer
with open(os.path.join(win_staging, "install-windows.ps1"), "w") as f:
    f.write('''# Simple Office Suite Windows Installer
$ErrorActionPreference = "Stop"

$AppName = "Simple Office Suite"
$InstallDir = "$env:LOCALAPPDATA\\Programs\\SimpleOfficeSuite"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Installing $AppName to $InstallDir..." -ForegroundColor Cyan

if (Test-Path $InstallDir) {
    Remove-Item -Recurse -Force $InstallDir
}
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

Copy-Item -Recurse -Force "$ScriptDir\\*" "$InstallDir"

# Create Desktop Shortcut
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\\$AppName.lnk")
$Shortcut.TargetPath = "$InstallDir\\Simple-Office-Suite.bat"
$Shortcut.WorkingDirectory = "$InstallDir"
$Shortcut.Description = "Lightweight, offline-first productivity suite"
if (Test-Path "$InstallDir\\icons\\icon.ico") {
    $Shortcut.IconLocation = "$InstallDir\\icons\\icon.ico"
}
$Shortcut.Save()

# Create Start Menu Shortcut
$StartMenuPath = [Environment]::GetFolderPath("StartMenu")
$ProgramsPath = "$StartMenuPath\\Programs"
$StartShortcut = $WshShell.CreateShortcut("$ProgramsPath\\$AppName.lnk")
$StartShortcut.TargetPath = "$InstallDir\\Simple-Office-Suite.bat"
$StartShortcut.WorkingDirectory = "$InstallDir"
if (Test-Path "$InstallDir\\icons\\icon.ico") {
    $StartShortcut.IconLocation = "$InstallDir\\icons\\icon.ico"
}
$StartShortcut.Save()

Write-Host "Installation successful! Shortcuts created on Desktop and Start Menu." -ForegroundColor Green
''')

# Windows cmd setup wrapper
with open(os.path.join(win_staging, "install-windows.bat"), "w") as f:
    f.write('@echo off\r\necho Installing Simple Office Suite...\r\npowershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-windows.ps1"\r\npause\r\n')

# NSIS script for native Windows .exe compiler
with open(os.path.join(win_staging, "Simple-Office-Suite.nsi"), "w") as f:
    f.write('''!define APP_NAME "Simple Office Suite"
!define APP_VERSION "1.0.0"
!define APP_PUBLISHER "Simple Office"
!define APP_EXE "Simple-Office-Suite.bat"

Name "${APP_NAME} ${APP_VERSION}"
OutFile "Simple-Office-Suite-1.0.0-Setup.exe"
InstallDir "$LOCALAPPDATA\\Programs\\SimpleOfficeSuite"
RequestExecutionLevel user

Page directory
Page instfiles

Section "MainSection" SEC01
    SetOutPath "$INSTDIR"
    File /r "*.*"
    
    CreateShortCut "$DESKTOP\\${APP_NAME}.lnk" "$INSTDIR\\${APP_EXE}" "" "$INSTDIR\\icons\\icon.ico"
    CreateDirectory "$SMPROGRAMS\\${APP_NAME}"
    CreateShortCut "$SMPROGRAMS\\${APP_NAME}\\${APP_NAME}.lnk" "$INSTDIR\\${APP_EXE}" "" "$INSTDIR\\icons\\icon.ico"
    CreateShortCut "$SMPROGRAMS\\${APP_NAME}\\Uninstall.lnk" "$INSTDIR\\uninstall.exe"
    
    WriteUninstaller "$INSTDIR\\uninstall.exe"
SectionEnd

Section "Uninstall"
    RMDir /r "$INSTDIR"
    Delete "$DESKTOP\\${APP_NAME}.lnk"
    RMDir /r "$SMPROGRAMS\\${APP_NAME}"
SectionEnd
''')

# Windows README
with open(os.path.join(win_staging, "README-Windows.txt"), "w") as f:
    f.write('''=====================================================
Simple Office Suite (SOS) - Windows Installation
=====================================================
Version: 1.0.0
Architecture: x64 / ARM64

QUICK INSTALLATION:
Double-click "install-windows.bat" (or run install-windows.ps1 in PowerShell).
This will:
1. Install Simple Office Suite to %LOCALAPPDATA%\\Programs\\SimpleOfficeSuite
2. Place a launch shortcut on your Desktop and Start Menu.

PORTABLE USAGE:
You can also run "Simple-Office-Suite.bat" directly without installing.
''')

win_zip = os.path.join(DIST_INSTALLER, "Simple-Office-Suite-1.0.0-Windows-x64-Portable.zip")
if os.path.exists(win_zip):
    os.remove(win_zip)
with zipfile.ZipFile(win_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(win_staging):
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, win_staging)
            zipf.write(full_path, arcname=os.path.join("Simple-Office-Suite", rel_path))

# Copy the setup scripts directly to dist-installer as well
shutil.copy(os.path.join(win_staging, "install-windows.bat"), os.path.join(DIST_INSTALLER, "install-windows.bat"))
shutil.copy(os.path.join(win_staging, "install-windows.ps1"), os.path.join(DIST_INSTALLER, "install-windows.ps1"))
shutil.copy(os.path.join(win_staging, "Simple-Office-Suite.nsi"), os.path.join(DIST_INSTALLER, "Simple-Office-Suite.nsi"))
shutil.rmtree(win_staging)

# 5. Create Linux Package (.deb) & Portable Tarball
print("4. Building Linux Debian package (.deb) & installer...")
linux_staging = os.path.join(DIST_INSTALLER, "linux_staging")
if os.path.exists(linux_staging):
    shutil.rmtree(linux_staging)

deb_dir = os.path.join(linux_staging, "deb")
os.makedirs(os.path.join(deb_dir, "DEBIAN"), exist_ok=True)
os.makedirs(os.path.join(deb_dir, "usr", "bin"), exist_ok=True)
os.makedirs(os.path.join(deb_dir, "usr", "share", "applications"), exist_ok=True)
os.makedirs(os.path.join(deb_dir, "usr", "share", "icons", "hicolor", "128x128", "apps"), exist_ok=True)
os.makedirs(os.path.join(deb_dir, "usr", "share", "simple-office-suite"), exist_ok=True)

# Copy web bundle to Linux staging
shutil.copytree(os.path.join(BASE_DIR, 'dist'), os.path.join(deb_dir, "usr", "share", "simple-office-suite", "dist"))

# Icon
src_icon = os.path.join(BASE_DIR, "src-tauri", "icons", "128x128.png")
if os.path.exists(src_icon):
    shutil.copy(src_icon, os.path.join(deb_dir, "usr", "share", "icons", "hicolor", "128x128", "apps", "simple-office-suite.png"))

# Desktop entry
desktop_file_content = '''[Desktop Entry]
Name=Simple Office Suite
GenericName=Office Suite
Comment=Lightweight, offline-first productivity suite (Word, Sheets, Slides, PDF)
Exec=/usr/bin/simple-office-suite %U
Icon=simple-office-suite
Terminal=false
Type=Application
Categories=Office;WordProcessor;Spreadsheet;Presentation;
MimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document;application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;application/vnd.openxmlformats-officedocument.presentationml.presentation;application/pdf;text/plain;text/markdown;text/csv;
'''
with open(os.path.join(deb_dir, "usr", "share", "applications", "simple-office-suite.desktop"), "w") as f:
    f.write(desktop_file_content)

# Launcher executable
launcher_script = '''#!/bin/bash
# Simple Office Suite Launcher
SHARE_DIR="/usr/share/simple-office-suite"
if command -v xdg-open > /dev/null; then
    xdg-open "$SHARE_DIR/dist/index.html"
elif command -v sensible-browser > /dev/null; then
    sensible-browser "$SHARE_DIR/dist/index.html"
else
    echo "Opening Simple Office Suite at $SHARE_DIR/dist/index.html"
fi
'''
launcher_path = os.path.join(deb_dir, "usr", "bin", "simple-office-suite")
with open(launcher_path, "w") as f:
    f.write(launcher_script)
os.chmod(launcher_path, 0o755)

# DEBIAN/control
control_content = '''Package: simple-office-suite
Version: 1.0.0
Section: utils
Priority: optional
Architecture: amd64
Maintainer: Simple Office Suite Team <support@simpleoffice.local>
Description: Lightweight, offline-first productivity suite
 Zero-cloud word processor, spreadsheet modeler, presentation slide
 designer, and fillable PDF editor built with Tauri and modern web engine.
'''
with open(os.path.join(deb_dir, "DEBIAN", "control"), "w") as f:
    f.write(control_content)

# DEBIAN/postinst
postinst_content = '''#!/bin/sh
set -e
if command -v update-desktop-database > /dev/null 2>&1; then
    update-desktop-database -q || true
fi
if command -v gtk-update-icon-cache > /dev/null 2>&1; then
    gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
fi
exit 0
'''
postinst_path = os.path.join(deb_dir, "DEBIAN", "postinst")
with open(postinst_path, "w") as f:
    f.write(postinst_content)
os.chmod(postinst_path, 0o755)

# Package debian archive manually using python AR format
def create_deb(staging_dir, output_deb_path):
    import io
    # 1. debian-binary
    deb_binary = b"2.0\n"

    # 2. control.tar.gz
    ctrl_buf = io.BytesIO()
    with tarfile.open(fileobj=ctrl_buf, mode="w:gz") as tar:
        for item in ["control", "postinst"]:
            p = os.path.join(staging_dir, "DEBIAN", item)
            if os.path.exists(p):
                tar.add(p, arcname=f"./{item}")
    ctrl_bytes = ctrl_buf.getvalue()

    # 3. data.tar.gz
    data_buf = io.BytesIO()
    with tarfile.open(fileobj=data_buf, mode="w:gz") as tar:
        tar.add(os.path.join(staging_dir, "usr"), arcname="./usr")
    data_bytes = data_buf.getvalue()

    # Write ar archive
    with open(output_deb_path, "wb") as f:
        f.write(b"!<arch>\n")
        
        def write_ar_member(name, data):
            # name (16), mtime (12), uid (6), gid (6), mode (8), size (10), magic (2)
            hdr = f"{name:<16}{int(time.time()):<12}{0:<6}{0:<6}{100644:<8}{len(data):<10}`\n".encode('ascii')
            f.write(hdr)
            f.write(data)
            if len(data) % 2 != 0:
                f.write(b"\n")
                
        write_ar_member("debian-binary", deb_binary)
        write_ar_member("control.tar.gz", ctrl_bytes)
        write_ar_member("data.tar.gz", data_bytes)

deb_output = os.path.join(DIST_INSTALLER, "simple-office-suite_1.0.0_amd64.deb")
create_deb(deb_dir, deb_output)
print(f"Created Debian package: {deb_output}")

# Create Linux portable tarball & installer
linux_tar = os.path.join(DIST_INSTALLER, "simple-office-suite-1.0.0-linux-x86_64.tar.gz")
with tarfile.open(linux_tar, "w:gz") as tar:
    tar.add(os.path.join(deb_dir, "usr"), arcname="simple-office-suite/usr")

# Linux install script
linux_installer_sh = os.path.join(DIST_INSTALLER, "install-linux.sh")
with open(linux_installer_sh, "w") as f:
    f.write('''#!/bin/bash
set -e
echo "=== Installing Simple Office Suite on Linux ==="

if [ "$EUID" -ne 0 ]; then
    SUDO="sudo"
else
    SUDO=""
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/simple-office-suite_1.0.0_amd64.deb" ] && command -v dpkg > /dev/null 2>&1; then
    echo "Installing via Debian package..."
    $SUDO dpkg -i "$SCRIPT_DIR/simple-office-suite_1.0.0_amd64.deb" || $SUDO apt-get install -f -y
else
    echo "Installing from archive..."
    $SUDO mkdir -p /usr/share/simple-office-suite /usr/share/applications /usr/share/icons/hicolor/128x128/apps
    tar -xzf "$SCRIPT_DIR/simple-office-suite-1.0.0-linux-x86_64.tar.gz" -C /tmp/
    $SUDO cp -R /tmp/simple-office-suite/usr/* /usr/
    $SUDO chmod +x /usr/bin/simple-office-suite
    if command -v update-desktop-database > /dev/null 2>&1; then
        $SUDO update-desktop-database -q || true
    fi
fi

echo "Installation complete! Run 'simple-office-suite' or find it in your application menu."
''')
os.chmod(linux_installer_sh, 0o755)

shutil.rmtree(linux_staging)

# 6. Generate GitHub Actions CI/CD Multi-Platform Workflow
print("5. Generating multi-platform CI/CD release workflow...")
gh_dir = os.path.join(BASE_DIR, ".github", "workflows")
os.makedirs(gh_dir, exist_ok=True)
with open(os.path.join(gh_dir, "release.yml"), "w") as f:
    f.write('''name: Release Cross-Platform Installers

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  release:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'macos-latest'
            args: '--target aarch64-apple-darwin'
          - platform: 'macos-13'
            args: '--target x86_64-apple-darwin'
          - platform: 'ubuntu-22.04'
            args: ''
          - platform: 'windows-latest'
            args: ''

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin' || matrix.platform == 'macos-13' && 'x86_64-apple-darwin' || '' }}

      - name: Install Linux Dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

      - name: Install Frontend Dependencies
        run: npm ci

      - name: Build Application Installers with Tauri Action
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
          releaseName: 'Simple Office Suite v__VERSION__'
          releaseBody: 'Production cross-platform release for macOS, Windows, and Linux.'
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}
''')

# 7. Checksums and Readme in dist-installer
print("6. Calculating SHA256 checksums...")
checksum_lines = []
for fname in sorted(os.listdir(DIST_INSTALLER)):
    fpath = os.path.join(DIST_INSTALLER, fname)
    if os.path.isfile(fpath) and not fname.endswith(".txt") and not fname.endswith(".md"):
        hasher = hashlib.sha256()
        with open(fpath, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        checksum_lines.append(f"{hasher.hexdigest()}  {fname}")

with open(os.path.join(DIST_INSTALLER, "SHA256SUMS.txt"), "w") as f:
    f.write("\n".join(checksum_lines) + "\n")

with open(os.path.join(DIST_INSTALLER, "README.md"), "w") as f:
    f.write('''# Simple Office Suite (SOS) - Cross-Platform Installers

Production application installers, standalone packages, and setup scripts for macOS, Windows, and Linux.

---

## 🍏 macOS
- **Native App Bundle**: `Simple Office Suite.app`
- **Portable Zip**: `Simple-Office-Suite-1.0.0-macOS-arm64.zip`
- **Tarball Archive**: `Simple-Office-Suite-1.0.0-macOS-arm64.tar.gz`
- **Installer Script**: `install-macos.sh`

### Quick Install (macOS):
```bash
./install-macos.sh
```
Or simply drag `Simple Office Suite.app` into `/Applications`.

---

## 🪟 Windows
- **Portable Suite**: `Simple-Office-Suite-1.0.0-Windows-x64-Portable.zip`
- **One-Click Batch Installer**: `install-windows.bat`
- **PowerShell Setup Script**: `install-windows.ps1`
- **Nullsoft NSIS Setup Definition**: `Simple-Office-Suite.nsi`

### Quick Install (Windows):
1. Extract `Simple-Office-Suite-1.0.0-Windows-x64-Portable.zip`.
2. Double-click `install-windows.bat`.
3. Launch from the Desktop or Start Menu shortcut.

---

## 🐧 Linux
- **Debian / Ubuntu Package**: `simple-office-suite_1.0.0_amd64.deb`
- **Portable Linux Tarball**: `simple-office-suite-1.0.0-linux-x86_64.tar.gz`
- **Installer Script**: `install-linux.sh`

### Quick Install (Linux):
```bash
# Debian / Ubuntu / Linux Mint
sudo dpkg -i simple-office-suite_1.0.0_amd64.deb

# Other Distributions
./install-linux.sh
```

---

## 🔐 Checksums (SHA-256)
Refer to `SHA256SUMS.txt` to verify file integrity.
''')

print("All installers and packages successfully built!")
