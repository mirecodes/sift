import type { FilesAdapter } from './index';

export function createWebFiles(): FilesAdapter {
  return {
    async save(name, text, mime) {
      const url = URL.createObjectURL(new Blob([text], { type: mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url));
    },
    open(accept) {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.addEventListener('change', () => {
          const file = input.files?.[0];
          if (file) file.text().then(resolve, () => resolve(null));
          else resolve(null);
        });
        input.addEventListener('cancel', () => resolve(null));
        input.click();
      });
    },
  };
}
