# View documents in a browser tab

Add a "View" (eye) action next to Download and Delete in the Documents tab, so a file can be opened directly in a new browser tab instead of only being downloaded.

## Behaviour

- Each document row gets an eye icon button, placed before Download.
- Clicking it creates a short-lived signed link for the file and opens it in a new tab.
- Files the browser can render (PDF, images, text) display inline; other types fall back to the browser's normal handling.
- Errors show a toast, same as the existing download action.

## Technical notes

- File: `src/components/workspace/tabs.tsx`, `DocumentsTab`.
- New `handleView(path)` using `supabase.storage.from("crm-documents").createSignedUrl(path, 60)`, then `window.open(url, "_blank", "noopener")`.
- Import `Eye` from `lucide-react`; button styled like the existing icon buttons in the actions cell.
