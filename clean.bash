#!/bin/bash
echo "Cleaning node_modules... "
rm -rf node_modules
echo "Removed node_modules"
echo "Cleaning android build... "
rm -rf android/build android/app/build
echo "Removed android build"
echo "Cleaning tmp... "
rm -rf /tmp/metro-* /tmp/haste-map-*
echo "Removed tmp"
echo "Cleaning watchman... "
watchman watch-del-all
echo "Cleaned watchman"
echo "Installing node_modules... "
npm install
echo "Installed node_modules"
echo "Cleaning android build... "
cd android && ./gradlew clean && cd ..
echo "Cleaned android build"
echo "Resetting cache... "
npx react-native start --reset-cache
echo "Reset cache"
