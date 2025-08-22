# Static Assets Configuration

This project is configured to handle static assets correctly for both development and GitHub Pages deployment.

## Directory Structure

```
public/
└── assets/
    ├── example-image.svg
    ├── example-audio.mp3
    └── (other static assets)
```

## Usage

### 1. Add assets to `public/assets/`

Place your static files (images, audio, data files, etc.) in the `public/assets/` directory.

### 2. Use the asset utilities

Import and use the asset utility functions to get the correct paths:

```typescript
import { getAssetPath, getAssetUrl } from '../utils/assetUtils';

// Get the correct path for any environment
const imagePath = getAssetPath('assets/my-image.png');

// Use in JSX for images
<img src={getAssetPath('assets/example-image.svg')} alt="Example" />

// Use in JSX for audio
<audio controls>
  <source src={getAssetPath('assets/example-audio.mp3')} type="audio/mpeg" />
</audio>

// Get full URL (for sharing or external references)
const fullUrl = getAssetUrl('assets/my-image.png');
```

### 3. Why use utility functions?

The utility functions automatically handle the base path differences between environments:

- **Development**: Assets served from root (`/assets/image.png`)
- **GitHub Pages**: Assets served with base path (`/apogee/assets/image.png`)

## Configuration Details

### Vite Configuration

The build is configured in `vite.config.ts`:

- `publicDir: 'public'` - Explicitly sets the public directory
- `assetsDir: 'assets'` - Ensures built assets go to the assets folder
- `base: '/apogee/'` - GitHub Pages base path in production

### Build Output

When you run `npm run build`, assets are copied to:

```
dist/
├── assets/
│   ├── example-image.svg  (copied from public/assets/)
│   ├── example-audio.mp3  (copied from public/assets/)
│   ├── index.css         (generated)
│   └── automerge_wasm_bg.wasm (generated)
├── index.html
└── index.js
```

## GitHub Pages Deployment

The configuration automatically handles GitHub Pages deployment:

1. In production, the base path `/apogee/` is automatically prepended
2. Assets are accessible at `https://username.github.io/apogee/assets/filename`
3. The utility functions handle this automatically

## Example Implementation

See `src/components/AssetExample.tsx` and the Settings page for a working example of how to load static assets correctly.

## Best Practices

1. **Always use `getAssetPath()`** instead of hardcoding paths
2. **Place assets in `public/assets/`** to keep them organized
3. **Use descriptive filenames** for better maintainability
4. **Optimize images** before adding them to keep bundle size reasonable

## Supported File Types

All static file types are supported, including:
- Images: `.svg`, `.png`, `.jpg`, `.gif`, `.webp`
- Audio: `.mp3`, `.wav`, `.ogg`
- Data: `.json`, `.xml`, `.txt`
- Documents: `.pdf`
- Any other static files you need
