import { useEffect } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import {
  Bold,
  Braces,
  Italic,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline as UnderlineIcon,
} from 'lucide-react';
import { cn } from '@fatexia/ui';

/**
 * Rich-text editor for offer copy.
 *
 * TipTap (ProseMirror) rather than a contenteditable div: paste is the reason. A plain
 * contenteditable takes whatever markup the clipboard holds — Word and Google Docs
 * paste in nested tables, inline font tags and `class="MsoNormal"` — and stores it
 * verbatim. ProseMirror parses a paste against the schema below and keeps only what
 * this editor can actually produce, so copying from anywhere lands as clean HTML.
 */

// Named colours rather than a full picker: an author choosing freely produces text that
// vanishes against one of the two themes. These read on both.
const COLORS: { label: string; value: string | null }[] = [
  { label: 'Default', value: null },
  { label: 'Red', value: '#e34948' },
  { label: 'Orange', value: '#eb6834' },
  { label: 'Green', value: '#1baf7a' },
  { label: 'Blue', value: '#2a78d6' },
  { label: 'Violet', value: '#7c5cff' },
];

function ToolbarButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      // Editor selection is lost the moment the button takes focus, so the mousedown is
      // swallowed and the command runs on click with the selection still intact.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        active && 'bg-accent text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const currentColor = (editor.getAttributes('textStyle').color as string | undefined) ?? '';

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-1.5 py-1">
      <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="size-4" />
      </ToolbarButton>

      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

      <ToolbarButton label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Braces className="size-4" />
      </ToolbarButton>

      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        Colour
        <select
          value={currentColor}
          onMouseDown={(event) => event.stopPropagation()}
          onChange={(event) => {
            const value = event.target.value;
            if (value) editor.chain().focus().setColor(value).run();
            else editor.chain().focus().unsetColor().run();
          }}
          className="rounded border border-input bg-background px-1.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {COLORS.map((colour) => (
            <option key={colour.label} value={colour.value ?? ''}>
              {colour.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ value, onChange, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      // Headings capped at h3/h4: this renders inside a page that already owns h1/h2,
      // and an author dropping an h1 into a description would outrank the page title.
      StarterKit.configure({ heading: { levels: [3, 4] } }),
      TextStyle,
      Color,
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          'min-h-[8rem] w-full px-3 py-2 text-sm text-foreground focus:outline-none [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_p:not(:first-child)]:mt-2',
      },
    },
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML();
      // TipTap represents "empty" as a single empty paragraph. Reported as an empty
      // string so a description the author cleared saves as blank rather than as markup
      // that renders an invisible line.
      onChange(instance.getText().trim() ? html : '');
    },
  });

  // Keeps the editor in step when the form replaces its value from outside — loading an
  // existing offer, or resetting after a save. Guarded on inequality, because setting
  // content on every render would move the caret to the start on each keystroke.
  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div className={cn('rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring', className)}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
