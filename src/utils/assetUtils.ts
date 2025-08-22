/**
 * Utility functions for handling static assets with proper GitHub Pages support
 */

/**
 * Get the correct asset path for the current environment.
 * In development, assets are served from the root.
 * In production (GitHub Pages), assets need the base path prefix.
 * 
 * @param assetPath - The path to the asset relative to the public directory (e.g., "assets/image.png")
 * @returns The correct full path to the asset
 */
export function getAssetPath(assetPath: string): string {
  // Remove leading slash if present to normalize the path
  const normalizedPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
  
  // In development, use the direct path
  if (import.meta.env.DEV) {
    return `/${normalizedPath}`;
  }
  
  // In production, use the base path configured in vite.config.ts
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${normalizedPath}`;
}

/**
 * Get the full URL for an asset (useful for sharing or external references)
 * 
 * @param assetPath - The path to the asset relative to the public directory
 * @returns The complete URL including the current origin
 */
export function getAssetUrl(assetPath: string): string {
  return new URL(getAssetPath(assetPath), window.location.origin).href;
}
