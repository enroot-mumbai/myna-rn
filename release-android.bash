#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
KEYSTORE_PROPS="$ANDROID_DIR/keystore.properties"
KEYSTORE_FILE="$ANDROID_DIR/keystore/myna-keystore.keystore"
GRADLE_FILE="$ANDROID_DIR/app/build.gradle"

if [ ! -f "$KEYSTORE_PROPS" ]; then
  echo "Error: $KEYSTORE_PROPS not found."
  echo "Copy android/keystore.properties.example to android/keystore.properties and fill in your credentials."
  exit 1
fi

if [ ! -f "$KEYSTORE_FILE" ]; then
  echo "Error: keystore not found at $KEYSTORE_FILE"
  echo "Move myna-keystore.keystore from Downloads to android/keystore/"
  exit 1
fi

VERSION_NAME=$(grep 'versionName' "$GRADLE_FILE" | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
VERSION_CODE=$(grep 'versionCode' "$GRADLE_FILE" | head -1 | sed -E 's/.*versionCode[[:space:]]+([0-9]+).*/\1/')

echo "Building release AAB (v${VERSION_NAME}, code ${VERSION_CODE})..."
cd "$ANDROID_DIR"
./gradlew bundleRelease

AAB_SRC="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
OUTPUT_DIR="$ROOT_DIR/release"
OUTPUT_FILE="$OUTPUT_DIR/myna-v${VERSION_NAME}-${VERSION_CODE}.aab"

if [ ! -f "$AAB_SRC" ]; then
  echo "Error: AAB not found at $AAB_SRC"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
cp "$AAB_SRC" "$OUTPUT_FILE"

echo ""
echo "Release AAB ready:"
echo "  $OUTPUT_FILE"
echo ""
echo "Upload this file to Google Play Console, then delete android/keystore/myna-keystore.keystore."
