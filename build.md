# ./build.md
# Standalone Compilation & Developer Operations Guide

This guide provides step-by-step instructions on how to set up your local development environment and compile the **Switch SD Manager** application from scratch on Windows, macOS, and Linux systems.

---

## 🛠️ Prerequisites

Before you begin, ensure you have the following developer tools installed on your host system:

1. **Rust Toolchain**: Install the standard stable toolchain from [rustup.rs](https://rustup.rs/).
2. **Node.js (v24 or higher)**: Install the latest LTS version of Node from [nodejs.org](https://nodejs.org/).
3. **System Dependencies (Linux only)**:
   If compiling on Linux (Ubuntu/Debian), run:
   ```bash
   sudo apt-get update
   sudo apt-get install -y \
     libgtk-3-dev \
     libwebkit2gtk-4.1-dev \
     libappindicator3-dev \
     librsvg2-dev \
     patchelf
   ```

---

## 💻 Developer Operations

Follow these steps to launch the local hot-reloading development environment:

### 1. Install Node Dependencies
Run the clean-install command from the project root:
```bash
npm ci
```

### 2. Launch hot-reloading desktop window
Start the Vite frontend dev server and compile the Tauri backend in hot-reload mode:
```bash
npm run tauri dev
```
*This will open the Switch SD Manager desktop window immediately. Any edits to React code in `src/` or Rust code in `src-tauri/` will automatically refresh the application live!*

### 3. Run Test Suites
Verify codebase integrity before compiling:
```bash
# Windows (PowerShell)
powershell -ExecutionPolicy Bypass -File .\scripts\Run-Tests.ps1

# Cross-Platform (Rust only)
cargo test --lib --manifest-path src-tauri/Cargo.toml
```

---

## 📦 Standalone Building & Automation Pipeline

The repository provides automated scripts that bundle all compiled assets into a clean, standalone, portable release directory.

### Windows (PowerShell Builder)
Compile, package, and structure the portable Windows release:
```powershell
# Standard Release Build
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1

# Clean Release Build (clears intermediate build caches)
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1 -Mode Clean

# Full Production Build + Verification Smoke Test
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1 -Mode Smoke
```

### macOS & Linux (Unix Bash Sibling)
Compile and bundle the portable distribution on macOS (Apple Silicon or Intel) or Linux:
```bash
# 1. Allow execution permissions
chmod +x ./scripts/build.sh

# 2. Standard portable compilation
./scripts/build.sh

# 3. Clean mode compilation
./scripts/build.sh --mode clean

# 4. Production build + verification smoke test
./scripts/build.sh --mode smoke
```

---

## 📊 Verified Build Outputs

When you run the build pipeline in `-Mode Smoke` / `--mode smoke`, the scripts will output confirmation matching the validated logs below:

### Windows `build.ps1 -Mode Smoke` Output
```text
> switch-sd-mgr@7.0.0 build
> tsc && vite build

vite v8.0.14 building client environment for production...
transforming...✓ 1770 modules transformed.
dist/assets/index-CWkbXhWS.css   28.76 kB │ gzip:  6.03 kB
dist/assets/index-CoArwf7O.js   325.06 kB │ gzip: 93.87 kB
✓ built in 1.02s

   Compiling switch-sd-mgr v7.0.0 (C:\Users\Roy\Desktop\SD\06_SD_Updater_3-26-2026\src-tauri)
    Finished `release` profile [optimized] target(s) in 51.72s
       Built application at: C:\Users\Roy\Desktop\SD\06_SD_Updater_3-26-2026\src-tauri\target\release\switch-sd-mgr.exe
[SUCCESS] Portable workspace created at C:\Users\Roy\Desktop\SD\06_SD_Updater_3-26-2026\build_portable
--- Portable smoke test ---
[SUCCESS] Portable smoke test passed.
```

### macOS / Linux `build.sh --mode smoke` Output
```text
--- Syncing branding icon assets ---
--- Cleaning build outputs ---
--- Building portable SD Manager workspace ---
npm run build
npm run tauri build
[SUCCESS] Portable workspace created at /Users/Roy/Desktop/SD/06_SD_Updater_3-26-2026/build_portable
--- Running portable smoke test ---
[SUCCESS] Portable smoke test passed successfully.
```

---

## 💻 CLI Commands & Arguments

The compiled backend Rust executable also supports headless command-line arguments for scripts and automation tasks:

| Command | Action / Responsibility |
| :--- | :--- |
| `cargo run -- check` | Scan active SD target configurations and fetch latest online update catalog. |
| `cargo run -- update --all` | Immediately download, verify, and extract all updates onto the active SD target. |
| `cargo run -- sync` | Synchronize your custom configurations inside `Custom_stuff/` to your target. |
