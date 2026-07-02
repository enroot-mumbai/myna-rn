# Android Play Store release (CLI)

## One-time setup

1. Copy the keystore into the project:
   ```bash
   mkdir -p android/keystore
   cp ~/Downloads/myna-keystore.keystore android/keystore/
   ```

2. Create signing credentials file:
   ```bash
   cp android/keystore.properties.example android/keystore.properties
   ```
   Edit `android/keystore.properties` and set your store password, key alias, and key password.

## Before each release

1. Bump version in `android/app/build.gradle`:
   - `versionCode` — must increase for every Play Store upload
   - `versionName` — user-visible version (e.g. `1.5.3`)

## Build the AAB

From the `myna-rn` folder:

```bash
npm run release:android
```

This runs `./gradlew bundleRelease` and copies the signed AAB to:

```
release/myna-v{versionName}-{versionCode}.aab
```

Upload that `.aab` file in [Google Play Console](https://play.google.com/console).

## After release

Delete the keystore from the project (keep your backup elsewhere):

```bash
rm android/keystore/myna-keystore.keystore
```

`keystore.properties` can stay locally for the next release — it is gitignored.
