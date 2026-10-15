export interface FilesAdapter {
  /** Offers a text file to the user (download on web, share sheet on native). */
  save(name: string, text: string, mime: string): Promise<void>;
  /** Lets the user pick a file; resolves with its text, or `null` if cancelled. */
  open(accept: string): Promise<string | null>;
}
