let pendingVisitPhotoPath: string | null = null;

/** Stash a captured visit photo so View Details can pick it up after goBack. */
export function setPendingVisitPhoto(path: string): void {
  pendingVisitPhotoPath = path;
}

/** Read and clear the pending visit photo path (one-shot). */
export function consumePendingVisitPhoto(): string | null {
  const path = pendingVisitPhotoPath;
  pendingVisitPhotoPath = null;
  return path;
}
