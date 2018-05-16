# Dat-fox Helper

A bridge to the Dat network for use by browsers. Provides:

 * A HTTP proxy to load content from Dat (using [dat-gateway](https://github.com/sammacbeth/dat-gateway))
 * [Native messaging](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Native_messaging) enabling compatible browser extensions to control this process,
 for example implementing the [DatArchive API](https://beakerbrowser.com/docs/apis/dat.html), or requesting certain Dats to be seeded
 locally.

This bridge is intended to run with the [dat-fox](https://github.com/sammacbeth/dat-fox)
prototype webextension for Firefox.


## Installing

### Installer (Linux and Mac only)

The helper can be automatically configured for use in Firefox with the `installer.sh` script by running the following in a terminal:

```bash
curl -o- https://raw.githubusercontent.com/sammacbeth/dat-fox-helper/master/installer.sh | bash
```

### Manual install

To install manually, first download the latest binary release for your OS from [here](https://github.com/sammacbeth/dat-fox-helper/releases). You should create a folder for the binary as it will place dat files in the `library` folder relative to its location. Usual locations are:
 * Linux `~/.local/datfox/`
 * Mac `~/Library/Application Support/datfox/`
 * Windows `C:\Users\{Your User}\AppData\Roaming\datfox\`

On Mac and Linux you will also have to make the binary executable.
```bash
# Linux
chmod +x ~/.local/datfox/dat-fox-helper-linux
# Mac
chmod +x ~/.local/datfox/dat-fox-helper-macos
```

Now we need to make Firefox aware of the binary, using a [Native Manifest](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Native_manifests#Native_messaging_manifests). Create a JSON file with the following contents:
```json
{
    "name": "dathelper",
    "description": "Dat helper daemon",
    "path": "/home/user/.local/datfox/dat-fox-helper-linux",
    "type": "stdio",
    "allowed_extensions": [
      "{e992d888-6346-4e09-98b5-8c61307970e6}",
      "{acc91f3f-2194-4f88-b25a-84ec4ea65683}"
    ]
}
```

Update the `"path"` value to match the absolute path to the dat-fox-helper binary. Save this file to:
 * Linux: `~/.mozilla/native-messaging-hosts/dathelper.json`
 * Mac: `~/Library/Application Support/Mozilla/NativeMessagingHosts/dathelper.json`
 * Windows: The same directory as the binary.
 
### Windows only: Add registry key

 1. Open the start menu and type `regedit` to open the registry editor.
 2. On the menu on the left, navigation to `HKEY_CURRENT_USER\Software\Mozilla\NativeMessagingHosts`.
 3. Right click on `NativeMessagingHosts` and choose `New` -> `Key`.
 4. Give the name as `dathelper`
 5. With `dathelper` selected, choose the `(Default)` entry on the right pane and set the value to be the path to your `dathelper.json`.
 
### Verifying the install

The [dat-fox](https://github.com/sammacbeth/dat-fox) extension will automatically verify if the binary can be automatically launched when it starts up.

## Running from source

On Linux and Mac Firefox can also launch the helper from source. Check out this repository and install dependencies:
```bash
git clone git@github.com:sammacbeth/dat-fox-helper.git
cd dat-fox-helper
npm install
```

Make sure the first line of `datfox-helper.js` points to your `node` binary. You can check this with `which node` in a terminal:
```sh
#!/path/to/node
```

Now complete the steps from the previous section, but instead of using the binary, set the `"path"` to point to `datfox-helper.js`.
