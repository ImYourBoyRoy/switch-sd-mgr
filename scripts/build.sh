#!/usr/bin/env bash
# ./scripts/build.sh
# Purpose: Build and verify the portable Switch SD Manager desktop bundle on macOS and Linux.
# How to run:
#   chmod +x ./scripts/build.sh
#   ./scripts/build.sh
#   ./scripts/build.sh --mode clean
#   ./scripts/build.sh --mode smoke
#   ./scripts/build.sh --mode purge
# Outputs: A clean portable bundle in ./build_portable plus optional smoke-test validation output.

set -e

# Terminal Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Determine Script Directory and Repo Root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration Directories
BUILD_DIR="$REPO_ROOT/build_portable"
ICONS_DIR="$REPO_ROOT/icons"
TAURI_ICONS_DIR="$REPO_ROOT/src-tauri/icons"

# Detect OS and Executable Extensions
OS_TYPE="$(uname -s)"
if [ "$OS_TYPE" = "Darwin" ] || [ "${OS_TYPE:0:5}" = "Linux" ]; then
    TAURI_EXE="$REPO_ROOT/src-tauri/target/release/switch-sd-mgr"
    PORTABLE_EXE="$BUILD_DIR/Switch_SD_Updater"
else
    TAURI_EXE="$REPO_ROOT/src-tauri/target/release/switch-sd-mgr.exe"
    PORTABLE_EXE="$BUILD_DIR/Switch_SD_Updater.exe"
fi

# Resolve Seed Source Directories defensively
if [ -d "$REPO_ROOT/configs" ]; then
    CONFIGS_DIR="$REPO_ROOT/configs"
else
    CONFIGS_DIR="$REPO_ROOT/build/configs"
fi

if [ -d "$REPO_ROOT/Custom_stuff" ]; then
    CUSTOM_DIR="$REPO_ROOT/Custom_stuff"
else
    CUSTOM_DIR="$REPO_ROOT/build/Custom_stuff"
fi

# Default parameter values
MODE="Build"
HELP=false

# Simple CLI Argument Parser
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -h|--help) HELP=true; shift ;;
        -m|--mode) MODE="$2"; shift 2 ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
done

if [ "$HELP" = true ]; then
    echo -e "${CYAN}Switch SD Manager portable Unix build script${NC}"
    echo -e "${GRAY}Usage:${NC}"
    echo -e "  ./scripts/build.sh"
    echo -e "  ./scripts/build.sh --mode clean"
    echo -e "  ./scripts/build.sh --mode smoke"
    echo -e "  ./scripts/build.sh --mode purge"
    exit 0
fi

# Sync Branding Icons to Tauri
sync_project_icons() {
    if [ -d "$ICONS_DIR" ]; then
        echo -e "${CYAN}--- Syncing branding icon assets ---${NC}"
        mkdir -p "$TAURI_ICONS_DIR"
        for icon in 32x32.png 128x128.png 128x128@2x.png icon.ico icon.png; do
            if [ -f "$ICONS_DIR/$icon" ]; then
                cp "$ICONS_DIR/$icon" "$TAURI_ICONS_DIR/$icon"
            fi
        done
    fi
}

# Reset Build Outputs
reset_build_output() {
    echo -e "${CYAN}--- Cleaning build outputs ---${NC}"
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"
}

# Assert Essential Seed Files Are Present
assert_portable_seed_files() {
    REQUIRED_SEEDS=(
        "config.json"
        "switch_configs.json"
        "hosts_config.json"
        "sources.json"
    )

    for seed in "${REQUIRED_SEEDS[@]}"; do
        if [ ! -f "$CONFIGS_DIR/$seed" ]; then
            echo -e "${RED}[ERROR] Portable seed file missing: $CONFIGS_DIR/$seed${NC}"
            exit 1
        fi
    done
}

# Execute Automated Smoke Test
invoke_smoke_test() {
    echo -e "${CYAN}--- Running portable smoke test ---${NC}"

    REQUIRED_PATHS=(
        "$PORTABLE_EXE"
        "$BUILD_DIR/configs"
        "$BUILD_DIR/Custom_stuff"
        "$BUILD_DIR/SD"
        "$BUILD_DIR/RCMLoader"
        "$BUILD_DIR/configs/manifest.lock"
    )

    for path in "${REQUIRED_PATHS[@]}"; do
        if [ ! -e "$path" ]; then
            echo -e "${RED}[ERROR] Smoke test failed. Missing expected path: $path${NC}"
            exit 1
        fi
    done

    # Verify manifest.lock is cleared to {}
    MANIFEST_CONTENT=$(cat "$BUILD_DIR/configs/manifest.lock" | xargs)
    if [ "$MANIFEST_CONTENT" != "{}" ]; then
        echo -e "${RED}[ERROR] Smoke test failed. Expected a reset manifest at $BUILD_DIR/configs/manifest.lock${NC}"
        exit 1
    fi

    # Verify no legacy files exist
    if [ -f "$BUILD_DIR/portable_settings.json" ]; then
        echo -e "${RED}[ERROR] Smoke test failed. Legacy portable_settings.json should not be shipped.${NC}"
        exit 1
    fi

    # Verify no duplicate nested directories
    if [ -d "$BUILD_DIR/configs/configs" ]; then
        echo -e "${RED}[ERROR] Smoke test failed. Nested configs/configs directory detected.${NC}"
        exit 1
    fi

    if [ -d "$BUILD_DIR/Custom_stuff/Custom_stuff" ]; then
        echo -e "${RED}[ERROR] Smoke test failed. Nested Custom_stuff/Custom_stuff directory detected.${NC}"
        exit 1
    fi

    echo -e "${GREEN}[SUCCESS] Portable smoke test passed successfully.${NC}"
}

# 1. Handle Purge Mode
if [ "$MODE" = "purge" ] || [ "$MODE" = "Purge" ]; then
    echo -e "${CYAN}--- Purging build output ---${NC}"
    rm -rf "$BUILD_DIR"
    echo -e "${GREEN}[SUCCESS] Removed build_portable output.${NC}"
    exit 0
fi

# 2. Handle Clean Mode
if [ "$MODE" = "clean" ] || [ "$MODE" = "Clean" ]; then
    echo -e "${CYAN}--- Running clean cargo build ---${NC}"
    cargo clean --manifest-path "$REPO_ROOT/src-tauri/Cargo.toml"
fi

# 3. Synchronize branding icons and prepare directories
sync_project_icons() {
    if [ -d "$ICONS_DIR" ]; then
        mkdir -p "$TAURI_ICONS_DIR"
        for icon in 32x32.png 128x128.png 128x128@2x.png icon.ico icon.png; do
            if [ -f "$ICONS_DIR/$icon" ]; then
                cp "$ICONS_DIR/$icon" "$TAURI_ICONS_DIR/$icon"
            fi
        done
    fi
}

sync_project_icons
reset_build_output
assert_portable_seed_files

# 4. Compile and Package Bundle
echo -e "${CYAN}--- Building portable SD Manager workspace ---${NC}"
npm run build
npm run tauri build

if [ ! -f "$TAURI_EXE" ]; then
    echo -e "${RED}[ERROR] Tauri desktop executable not found at $TAURI_EXE${NC}"
    exit 1
fi

# Copy executable and configuration seeds
cp "$TAURI_EXE" "$PORTABLE_EXE"

if [ ! -d "$CONFIGS_DIR" ]; then
    echo -e "${RED}[ERROR] Portable configs source not found at $CONFIGS_DIR${NC}"
    exit 1
fi
if [ ! -d "$CUSTOM_DIR" ]; then
    echo -e "${RED}[ERROR] Portable Custom_stuff source not found at $CUSTOM_DIR${NC}"
    exit 1
fi

cp -R "$CONFIGS_DIR" "$BUILD_DIR/configs"
cp -R "$CUSTOM_DIR" "$BUILD_DIR/Custom_stuff"
mkdir -p "$BUILD_DIR/SD"
mkdir -p "$BUILD_DIR/RCMLoader"

# Sync active configurations to default fallback positions
if [ -f "$BUILD_DIR/configs/sources.json" ]; then
    cp "$BUILD_DIR/configs/sources.json" "$BUILD_DIR/configs/sources.defaults.json"
fi

# Clean up legacy settings file and reset manifest
rm -f "$BUILD_DIR/portable_settings.json"
echo "{}" > "$BUILD_DIR/configs/manifest.lock"

# Clean up double-nested copy loops if any
rm -rf "$BUILD_DIR/configs/configs"
rm -rf "$BUILD_DIR/configs/data"
rm -rf "$BUILD_DIR/Custom_stuff/Custom_stuff"

echo -e "${GREEN}[SUCCESS] Portable workspace created at $BUILD_DIR${NC}"

# 5. Execute Smoke Test
if [ "$MODE" = "smoke" ] || [ "$MODE" = "Smoke" ]; then
    invoke_smoke_test
fi
