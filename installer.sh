#!/usr/bin/env bash

{ # this ensures the entire script is downloaded #

REPO_URL="https://github.com/sammacbeth/dat-fox-helper/releases/download"
TAG="v0.2.0"
MANIFEST_URL="https://raw.githubusercontent.com/sammacbeth/dat-fox-helper/$TAG/dathelper.json"

if [[ "$OSTYPE" == "linux-gnu" ]]; then
    BINDIR_DEFAULT=$HOME/.local/datfox
    BIN_NAME="dat-fox-helper-linux"
    MANIFEST_PATH="$HOME/.mozilla/native-messaging-hosts/"
elif [[ `uname` == "Darwin" ]]; then
    BINDIR_DEFAULT="$HOME/Library/Application Support/datfox"
    BIN_NAME="dat-fox-helper-macos"
    MANIFEST_PATH="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts/"
fi

if [[ -z "$BIN_NAME" ]]; then
    echo "Unable to detect platform"
    exit 1
fi

echo "Installing dat-fox-helper"
read -p "dat-fox-helper install directory: [$BINDIR_DEFAULT] " BINDIR
if [[ -z "$BINDIR" ]]; then
    BINDIR=$BINDIR_DEFAULT
fi

# prepare bin dir
mkdir -p "$BINDIR/"
cd "$BINDIR"
echo "Downloading binary"
curl -L -o dat-fox-helper $REPO_URL/$TAG/$BIN_NAME
chmod +x "$BINDIR/dat-fox-helper"

# prepare native manifest
echo "Installing Firefox manifest to $MANIFEST_PATH"
mkdir -p "$MANIFEST_PATH"
curl -L -o "$MANIFEST_PATH/dathelper.json" $MANIFEST_URL
# set path in manifest
path1esc=$(echo "/path/to/dat-fox-helper/datfox-helper.js" | sed 's_/_\\/_g')
path2esc=$(echo "$BINDIR/dat-fox-helper" | sed 's_/_\\/_g')
if [[ `uname` == "Darwin" ]]; then
    sed -i "" -e "s/$path1esc/$path2esc/" "$MANIFEST_PATH/dathelper.json"
else
    sed -i "s/$path1esc/$path2esc/" "$MANIFEST_PATH/dathelper.json"
fi

echo "Done"

}
