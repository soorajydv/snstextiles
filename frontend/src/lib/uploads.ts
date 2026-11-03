export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export const DESIGN_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf', '.ai', '.eps', '.svg', '.psd', '.cdr'];
export const JERSEY_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf'];
export const AVATAR_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
export const PLAYER_LIST_EXTENSIONS = AVATAR_EXTENSIONS;

export function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 1)} MB`;
}

export function validateUploadFile(file: File, options: { maxBytes?: number; extensions: string[]; label?: string }) {
  const label = options.label ?? 'File';
  if (file.size > (options.maxBytes ?? MAX_UPLOAD_BYTES)) {
    return `${label} is too large. Maximum size is ${formatBytes(options.maxBytes ?? MAX_UPLOAD_BYTES)}.`;
  }
  const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
  if (!options.extensions.includes(extension)) {
    return `${label} type ${extension === '.' ? 'unknown' : extension} is not allowed.`;
  }
  return '';
}
