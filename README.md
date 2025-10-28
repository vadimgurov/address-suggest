## Address Suggest - Build & Usage

### Requirements
- Linux with bash
- Node.js 18+ and npm

### Install
```bash
npm install
```

### Build minified JS
Outputs `dist/address-suggest.min.js`.
```bash
npm run build
```

### Use via jsDelivr (GitHub)
Prefer immutable versions (tags) for reliable caching and rollbacks:
```html
<script src="https://cdn.jsdelivr.net/gh/vadimgurov/address-suggest@v1.0.0/dist/address-suggest.min.js"></script>
```

If you keep using the `@main` branch, be aware it may be cached by browsers/CDN. See cache busting below.

### Cache busting strategies on jsDelivr
- Recommended: **versioned tags**. Create a git tag for each release and update the script URL:
  - Tag and push: `git tag v1.0.1 && git push --tags`
  - Use: `...@v1.0.1/dist/df-addr.min.js`
- Alternative: **commit hash** for a specific build (immutable):
  - Use: `...@<GIT_COMMIT_SHA>/dist/address-suggest.min.js`
- If you must use `@main`, change the URL so clients fetch a new resource:
  - Append a version query (client cache buster):
    ```html
    <script src="https://cdn.jsdelivr.net/gh/vadimgurov/address-suggest@main/dist/address-suggest.min.js?v=20251028"></script>
    ```
    Updating `v=...` forces browsers to bypass their cached copy.

Note: jsDelivr itself keys CDN cache by the path; query parameters are generally respected by browsers as separate URLs. For guaranteed immutability and instant propagation, prefer tags or commit SHAs.

### Local config & delivery polygons
- Do not commit keys. Use `config.local.js` (ignored by git):
```html
<script src="/config.local.js"></script>
```
- Large delivery polygons are served via `delivery-fc.js` defining `window.DELIVERY_FC`.

### Build outputs
- `dist/address-suggest.min.js` — minified library for CDN usage.
