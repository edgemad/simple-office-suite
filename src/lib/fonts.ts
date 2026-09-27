export interface FontOption {
  label: string;
  value: string;
  category: 'sans-serif' | 'serif' | 'monospace' | 'display' | 'handwriting';
}

export const OFFICE_FONTS: FontOption[] = [
  // --- Modern & Sans-Serif ---
  { label: 'Inter (Default)', value: 'Inter, system-ui, -apple-system, sans-serif', category: 'sans-serif' },
  { label: 'Roboto', value: 'Roboto, "Segoe UI", Arial, sans-serif', category: 'sans-serif' },
  { label: 'Open Sans', value: '"Open Sans", Helvetica, Arial, sans-serif', category: 'sans-serif' },
  { label: 'Lato', value: 'Lato, "Helvetica Neue", Arial, sans-serif', category: 'sans-serif' },
  { label: 'Montserrat', value: 'Montserrat, "Trebuchet MS", sans-serif', category: 'sans-serif' },
  { label: 'Poppins', value: 'Poppins, "Segoe UI", sans-serif', category: 'sans-serif' },
  { label: 'Nunito', value: 'Nunito, "Segoe UI", sans-serif', category: 'sans-serif' },
  { label: 'Raleway', value: 'Raleway, Helvetica, sans-serif', category: 'sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif', category: 'sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", Helvetica, sans-serif', category: 'sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif', category: 'sans-serif' },
  { label: 'Oswald', value: 'Oswald, "Arial Narrow", sans-serif', category: 'sans-serif' },

  // --- Serif & Editorial ---
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif', category: 'serif' },
  { label: 'Georgia', value: 'Georgia, Cambria, serif', category: 'serif' },
  { label: 'Merriweather', value: 'Merriweather, Georgia, serif', category: 'serif' },
  { label: 'Playfair Display', value: '"Playfair Display", Georgia, serif', category: 'serif' },
  { label: 'Lora', value: 'Lora, "Times New Roman", serif', category: 'serif' },
  { label: 'EB Garamond', value: '"EB Garamond", Garamond, Georgia, serif', category: 'serif' },

  // --- Monospace & Code ---
  { label: 'Courier New', value: '"Courier New", Courier, monospace', category: 'monospace' },
  { label: 'Consolas', value: 'Consolas, Monaco, "Lucida Console", monospace', category: 'monospace' },
  { label: 'Fira Code', value: '"Fira Code", Menlo, Monaco, monospace', category: 'monospace' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono", Consolas, monospace', category: 'monospace' },
  { label: 'Inconsolata', value: 'Inconsolata, monospace', category: 'monospace' },

  // --- Display & Casual ---
  { label: 'Comic Neue', value: '"Comic Neue", "Comic Sans MS", cursive, sans-serif', category: 'display' },
  { label: 'Impact', value: 'Impact, "Arial Black", sans-serif', category: 'display' },
  { label: 'Caveat', value: 'Caveat, "Brush Script MT", cursive', category: 'handwriting' },
  { label: 'Pacifico', value: 'Pacifico, "Comic Sans MS", cursive', category: 'handwriting' },
  { label: 'Dancing Script', value: '"Dancing Script", cursive', category: 'handwriting' }
];

export const FONT_SIZES_PT = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
