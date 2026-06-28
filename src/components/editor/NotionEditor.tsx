import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Minus, Image as ImageIcon } from 'lucide-react';
import { useEffect } from 'react';

interface NotionEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  wrapperClassName?: string;
}

export function NotionEditor({ content, onChange, placeholder = "Press '/' for commands...", minHeight = "min-h-[150px]", wrapperClassName = "relative w-full" }: NotionEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { HTMLAttributes: { class: 'list-disc ml-4 space-y-1' } },
        orderedList: { HTMLAttributes: { class: 'list-decimal ml-4 space-y-1' } },
        heading: { levels: [1, 2, 3], HTMLAttributes: { class: 'font-bold text-text-main mt-6 mb-2' } },
        blockquote: { HTMLAttributes: { class: 'border-l-4 border-primary pl-4 italic text-text-muted my-4' } },
        codeBlock: { HTMLAttributes: { class: 'bg-surface p-4 rounded-[8px] font-mono text-[13px] text-text-main my-4' } },
        horizontalRule: { HTMLAttributes: { class: 'my-6 border-t border-border' } },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'cursor-text before:content-[attr(data-placeholder)] before:absolute before:text-text-muted/40 before:pointer-events-none',
      }),
      TaskList.configure({
        HTMLAttributes: { class: 'not-prose pl-2 space-y-1 my-4' },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: 'flex items-start gap-2' },
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: `prose prose-sm prose-stone dark:prose-invert max-w-none focus:outline-none ${minHeight} text-text-main`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const toggleHeading = (level: 1 | 2 | 3) => editor.chain().focus().toggleHeading({ level }).run();
  const toggleBulletList = () => editor.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => editor.chain().focus().toggleOrderedList().run();
  const toggleTaskList = () => editor.chain().focus().toggleTaskList().run();
  const toggleBlockquote = () => editor.chain().focus().toggleBlockquote().run();
  const setHorizontalRule = () => editor.chain().focus().setHorizontalRule().run();

  return (
    <div className={wrapperClassName}>
      
      {/* Floating Menu (Slash Commands) */}
      {editor && <FloatingMenu editor={editor}>
        <div className="flex bg-surface border border-border shadow-luxury rounded-[8px] overflow-hidden p-1 gap-0.5">
          <button onClick={() => toggleHeading(1)} className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-[6px] transition-colors" title="Heading 1"><Heading1 className="w-4 h-4" /></button>
          <button onClick={() => toggleHeading(2)} className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-[6px] transition-colors" title="Heading 2"><Heading2 className="w-4 h-4" /></button>
          <div className="w-px bg-border my-1 mx-0.5"></div>
          <button onClick={toggleBulletList} className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-[6px] transition-colors" title="Bullet List"><List className="w-4 h-4" /></button>
          <button onClick={toggleOrderedList} className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-[6px] transition-colors" title="Numbered List"><ListOrdered className="w-4 h-4" /></button>
          <button onClick={toggleTaskList} className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-[6px] transition-colors" title="Task List"><CheckSquare className="w-4 h-4" /></button>
          <div className="w-px bg-border my-1 mx-0.5"></div>
          <button onClick={toggleBlockquote} className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-[6px] transition-colors" title="Quote"><Quote className="w-4 h-4" /></button>
          <button onClick={setHorizontalRule} className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-[6px] transition-colors" title="Divider"><Minus className="w-4 h-4" /></button>
        </div>
      </FloatingMenu>}

      {/* Bubble Menu (Inline Formatting) */}
      {editor && <BubbleMenu editor={editor}>
        <div className="flex bg-surface border border-border shadow-interactive rounded-[8px] overflow-hidden p-1 gap-0.5">
          <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded-[6px] transition-colors ${editor.isActive('bold') ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'}`}><Bold className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded-[6px] transition-colors ${editor.isActive('italic') ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'}`}><Italic className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleStrike().run()} className={`p-1.5 rounded-[6px] transition-colors ${editor.isActive('strike') ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'}`}><Strikethrough className="w-4 h-4" /></button>
          <div className="w-px bg-border my-1 mx-0.5"></div>
          <button onClick={() => editor.chain().focus().toggleCode().run()} className={`p-1.5 rounded-[6px] transition-colors ${editor.isActive('code') ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'}`}><Code className="w-4 h-4" /></button>
        </div>
      </BubbleMenu>}

      <div className="cursor-text w-full h-full" onClick={() => editor.commands.focus()}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
