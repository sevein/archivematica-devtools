# Local Dev Shortcut Injector

Minimal Chrome extension skeleton that injects a keyboard shortcut only on:

- `http://127.0.0.1:62080`

## What it does

- Loads a content script on `http://127.0.0.1/*`
- Checks for port `62080` at runtime
- Registers shortcut `Ctrl+Shift+S`
- Runs the happy-path transfer automation flow in `#transfer-browser`
- Logs a clear `console.error` message when any step fails

## Local testing (no publishing)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `chrome-local-shortcut-extension`
5. Visit `http://127.0.0.1:62080`
6. Press `Ctrl+Shift+S`

After code changes, click **Reload** on the extension card.

## Customize

- Edit selectors and path segments in `content.js` to match your environment
