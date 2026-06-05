import React, { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle, FontFamily, FontSize, Color, LineHeight } from '@tiptap/extension-text-style';
import { Extension } from '@tiptap/core';
import Paragraph from '@tiptap/extension-paragraph';
import { ImagePlus, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Code, Table as TableIcon, SeparatorHorizontal as Divider } from 'lucide-react';
import { marked } from 'marked';
import EditorToolbar from './editor/EditorToolbar';

interface LinkSuggestion {
  id: string;
  title: string;
  type: string;
}

interface SlashCommand {
  label: string;
  description: string;
  icon: React.ReactNode;
  action: (editor: any) => void;
}

export interface TiptapEditorHandle {
  insertMarkdown: (text: string) => void;
  getHTML: () => string;
  focus: () => void;
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  onTextSelect?: (selectedText: string | null) => void;
}

const TiptapEditor = forwardRef<TiptapEditorHandle, TiptapEditorProps>(({
  content,
  onChange,
  placeholder = '开始写作...',
  editable = true,
  onTextSelect,
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const tableMenuRef = useRef<HTMLDivElement>(null);
  const linkSuggestionRef = useRef<HTMLDivElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  const [formatBrushActive, setFormatBrushActive] = useState(false);
  const [formatBrushAttrs, setFormatBrushAttrs] = useState<any>(null);
  const [lineHeightMenuOpen, setLineHeightMenuOpen] = useState(false);
  const [fontFamilyMenuOpen, setFontFamilyMenuOpen] = useState(false);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [spacingMenuOpen, setSpacingMenuOpen] = useState(false);
  const lineHeightMenuRef = useRef<HTMLDivElement>(null);
  const fontFamilyMenuRef = useRef<HTMLDivElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);
  const spacingMenuRef = useRef<HTMLDivElement>(null);

  const [linkSuggestions, setLinkSuggestions] = useState<LinkSuggestion[]>([]);
  const [linkMenuOpen, setLinkMenuOpen] = useState(false);
  const [linkMenuPos, setLinkMenuPos] = useState({ top: 0, left: 0 });
  const [linkSelectedIndex, setLinkSelectedIndex] = useState(0);
  const [linkQuery, setLinkQuery] = useState('');
  const linkTriggerRef = useRef<{ from: number; to: number } | null>(null);

  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 });
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const [slashQuery, setSlashQuery] = useState('');
  const slashTriggerRef = useRef<{ from: number } | null>(null);

  const slashCommands: SlashCommand[] = [
    { label: '标题1', description: '大标题', icon: <Heading1 size={16} />, action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: '标题2', description: '中标题', icon: <Heading2 size={16} />, action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: '标题3', description: '小标题', icon: <Heading3 size={16} />, action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: '无序列表', description: '创建无序列表', icon: <List size={16} />, action: (e) => e.chain().focus().toggleBulletList().run() },
    { label: '有序列表', description: '创建有序列表', icon: <ListOrdered size={16} />, action: (e) => e.chain().focus().toggleOrderedList().run() },
    { label: '待办列表', description: '创建待办事项', icon: <CheckSquare size={16} />, action: (e) => e.chain().focus().toggleTaskList().run() },
    { label: '引用', description: '插入引用块', icon: <Quote size={16} />, action: (e) => e.chain().focus().toggleBlockquote().run() },
    { label: '代码块', description: '插入代码块', icon: <Code size={16} />, action: (e) => e.chain().focus().toggleCodeBlock().run() },
    { label: '表格', description: '插入3x3表格', icon: <TableIcon size={16} />, action: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { label: '分割线', description: '插入水平分割线', icon: <Divider size={16} />, action: (e) => e.chain().focus().setHorizontalRule().run() },
  ];

  const filteredSlashCommands = slashQuery
    ? slashCommands.filter(c => c.label.includes(slashQuery) || c.description.includes(slashQuery))
    : slashCommands;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        paragraph: false,
      }),
      Paragraph.extend({
        addAttributes() {
          return {
            spaceBefore: {
              default: null,
              parseHTML: (element: HTMLElement) => element.getAttribute('data-space-before') || null,
              renderHTML: (attributes: { spaceBefore?: string }) => {
                if (!attributes.spaceBefore) return {};
                return { 'data-space-before': attributes.spaceBefore };
              },
            },
            spaceAfter: {
              default: null,
              parseHTML: (element: HTMLElement) => element.getAttribute('data-space-after') || null,
              renderHTML: (attributes: { spaceAfter?: string }) => {
                if (!attributes.spaceAfter) return {};
                return { 'data-space-after': attributes.spaceAfter };
              },
            },
          };
        },
      }).configure({}),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      LineHeight.configure({ types: ['textStyle'] }),
    ],
    content,
    editable,
    editorProps: {
      transformPastedHTML(html) {
        return html.replace(/<img\b[^>]*\ssrc=["'](?!data:|https?:|blob:)[^"']*["'][^>]*>/gi, '');
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to && editable) {
        const selectedText = editor.state.doc.textBetween(from, to, ' ');
        if (onTextSelect) {
          onTextSelect(selectedText);
        }
      } else {
        if (onTextSelect) {
          onTextSelect(null);
        }
      }
    },
  });

  useImperativeHandle(ref, () => ({
    insertMarkdown: (text: string) => {
      if (!editor) return;
      const html = marked.parse(text) as string;
      editor.chain().focus().insertContent(html).run();
    },
    getHTML: () => editor?.getHTML() || '',
    focus: () => editor?.chain().focus().run(),
  }), [editor]);

  const getCaretCoords = useCallback(() => {
    if (!editor) return { top: 0, left: 0 };
    const { from } = editor.view.state.selection;
    const coords = editor.view.coordsAtPos(from);
    const editorRect = editorRef.current?.getBoundingClientRect();
    if (!editorRect) return { top: 0, left: 0 };
    return { top: coords.bottom - editorRect.top + 4, left: coords.left - editorRect.left };
  }, [editor]);

  const searchLinkSuggestions = useCallback(async (q: string) => {
    try {
      const results = await window.ipcRenderer.invoke('search-notes-for-link', { query: q });
      setLinkSuggestions(results || []);
      setLinkSelectedIndex(0);
    } catch {
      setLinkSuggestions([]);
    }
  }, []);

  useEffect(() => {
    if (!editor || !editable) return;
    const dom = editor.view.dom as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (linkMenuOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setLinkSelectedIndex(prev => Math.min(prev + 1, linkSuggestions.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setLinkSelectedIndex(prev => Math.max(prev - 1, 0));
          return;
        }
        if (e.key === 'Enter' && linkSuggestions[linkSelectedIndex]) {
          e.preventDefault();
          const selected = linkSuggestions[linkSelectedIndex];
          if (linkTriggerRef.current) {
            const { from, to } = linkTriggerRef.current;
            editor.chain().focus().deleteRange({ from, to }).insertContent(`[[${selected.title}]]`).run();
          }
          setLinkMenuOpen(false);
          setLinkQuery('');
          linkTriggerRef.current = null;
          return;
        }
        if (e.key === 'Escape') {
          setLinkMenuOpen(false);
          setLinkQuery('');
          linkTriggerRef.current = null;
          return;
        }
      }

      if (slashMenuOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSlashSelectedIndex(prev => Math.min(prev + 1, filteredSlashCommands.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSlashSelectedIndex(prev => Math.max(prev - 1, 0));
          return;
        }
        if (e.key === 'Enter' && filteredSlashCommands[slashSelectedIndex]) {
          e.preventDefault();
          if (slashTriggerRef.current) {
            const { from } = slashTriggerRef.current;
            const currentPos = editor.state.selection.from;
            editor.chain().focus().deleteRange({ from, to: currentPos }).run();
          }
          filteredSlashCommands[slashSelectedIndex].action(editor);
          setSlashMenuOpen(false);
          setSlashQuery('');
          slashTriggerRef.current = null;
          return;
        }
        if (e.key === 'Escape') {
          setSlashMenuOpen(false);
          setSlashQuery('');
          slashTriggerRef.current = null;
          return;
        }
      }

      if (e.key === '[' && !linkMenuOpen) {
        setTimeout(() => {
          const { from } = editor.state.selection;
          const textBefore = editor.state.doc.textBetween(Math.max(0, from - 2), from, '');
          if (textBefore === '[[') {
            const pos = getCaretCoords();
            setLinkMenuPos(pos);
            setLinkMenuOpen(true);
            setLinkQuery('');
            linkTriggerRef.current = { from: from - 2, to: from };
            searchLinkSuggestions('');
          }
        }, 10);
      }

      if (e.key === '/' && !slashMenuOpen && !linkMenuOpen) {
        const { from } = editor.state.selection;
        const textBefore = editor.state.doc.textBetween(Math.max(0, from - 1), from, '');
        if (textBefore === '/' && (from <= 1 || editor.state.doc.textBetween(from - 2, from - 1, '') === '\n' || editor.state.doc.textBetween(from - 2, from - 1, '') === '')) {
          setTimeout(() => {
            const pos = getCaretCoords();
            setSlashMenuPos(pos);
            setSlashMenuOpen(true);
            setSlashQuery('');
            setSlashSelectedIndex(0);
            slashTriggerRef.current = { from };
          }, 10);
        }
      }
    };

    const handleInput = () => {
      if (linkMenuOpen && linkTriggerRef.current) {
        const { from } = linkTriggerRef.current;
        const currentPos = editor.state.selection.from;
        const query = editor.state.doc.textBetween(from + 2, currentPos, '');
        setLinkQuery(query);
        searchLinkSuggestions(query);
      }
      if (slashMenuOpen && slashTriggerRef.current) {
        const { from } = slashTriggerRef.current;
        const currentPos = editor.state.selection.from;
        const query = editor.state.doc.textBetween(from, currentPos, '');
        setSlashQuery(query.replace(/^\//, ''));
      }
    };

    dom.addEventListener('keydown', handleKeyDown, true);
    dom.addEventListener('input', handleInput);
    return () => {
      dom.removeEventListener('keydown', handleKeyDown, true);
      dom.removeEventListener('input', handleInput);
    };
  }, [editor, editable, linkMenuOpen, linkSuggestions, linkSelectedIndex, slashMenuOpen, slashSelectedIndex, filteredSlashCommands, getCaretCoords, searchLinkSuggestions]);

  useEffect(() => {
    if (!linkMenuOpen && !slashMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (linkSuggestionRef.current && !linkSuggestionRef.current.contains(e.target as Node)) {
        setLinkMenuOpen(false);
      }
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target as Node)) {
        setSlashMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [linkMenuOpen, slashMenuOpen]);

  const compressImage = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const MAX_WIDTH = 1600;
      const MAX_HEIGHT = 1200;
      const QUALITY = 0.8;

      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(outType, QUALITY));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
      img.src = url;
    });
  }, []);

  const insertImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (!editor) return;
    try {
      const dataUrl = await compressImage(file);
      editor.chain().focus().setImage({ src: dataUrl, alt: file.name || 'image' }).run();
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (!dataUrl) return;
        editor.chain().focus().setImage({ src: dataUrl, alt: file.name || 'image' }).run();
      };
      reader.readAsDataURL(file);
    }
  }, [editor, compressImage]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (!editor || !editable) return;

    const dom = editor.view.dom as HTMLElement;

    const handlePaste = (event: ClipboardEvent) => {
      const items = Array.from(event.clipboardData?.items || []);
      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0 && !event.clipboardData?.types.includes('text/html')) {
        event.preventDefault();
        event.stopPropagation();
        for (const file of imageFiles) {
          insertImageFile(file);
        }
      }
    };

    const handleDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!dom.contains(event.relatedTarget as Node)) {
        setIsDragOver(false);
      }
    };

    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);
      const files = Array.from(event.dataTransfer?.files || []);
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          insertImageFile(file);
        }
      }
    };

    dom.addEventListener('paste', handlePaste, true);
    dom.addEventListener('dragover', handleDragOver);
    dom.addEventListener('dragleave', handleDragLeave);
    dom.addEventListener('drop', handleDrop);
    return () => {
      dom.removeEventListener('paste', handlePaste, true);
      dom.removeEventListener('dragover', handleDragOver);
      dom.removeEventListener('dragleave', handleDragLeave);
      dom.removeEventListener('drop', handleDrop);
    };
  }, [editor, editable, insertImageFile]);

  useEffect(() => {
    if (!tableMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (tableMenuRef.current && !tableMenuRef.current.contains(e.target as Node)) {
        setTableMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [tableMenuOpen]);

  useEffect(() => {
    const openMenus = [lineHeightMenuOpen, fontFamilyMenuOpen, colorMenuOpen, spacingMenuOpen];
    if (openMenus.every(v => !v)) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (lineHeightMenuRef.current && !lineHeightMenuRef.current.contains(e.target as Node)) setLineHeightMenuOpen(false);
      if (fontFamilyMenuRef.current && !fontFamilyMenuRef.current.contains(e.target as Node)) setFontFamilyMenuOpen(false);
      if (colorMenuRef.current && !colorMenuRef.current.contains(e.target as Node)) setColorMenuOpen(false);
      if (spacingMenuRef.current && !spacingMenuRef.current.contains(e.target as Node)) setSpacingMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [lineHeightMenuOpen, fontFamilyMenuOpen, colorMenuOpen, spacingMenuOpen]);

  const handleFormatBrushClick = useCallback(() => {
    if (!editor) return;
    if (formatBrushActive && formatBrushAttrs) {
      const chain = editor.chain().focus();
      if (formatBrushAttrs.bold !== undefined) formatBrushAttrs.bold ? chain.toggleBold().run() : chain.unsetBold().run();
      if (formatBrushAttrs.italic !== undefined) formatBrushAttrs.italic ? chain.toggleItalic().run() : chain.unsetItalic().run();
      if (formatBrushAttrs.highlight !== undefined) formatBrushAttrs.highlight ? chain.toggleHighlight().run() : chain.unsetHighlight().run();
      if (formatBrushAttrs.fontFamily) editor.commands.setFontFamily(formatBrushAttrs.fontFamily);
      if (formatBrushAttrs.fontSize) editor.commands.setFontSize(formatBrushAttrs.fontSize);
      if (formatBrushAttrs.color) editor.commands.setColor(formatBrushAttrs.color);
      if (formatBrushAttrs.lineHeight) (editor.commands as { setLineHeight?: (lh: string) => void }).setLineHeight?.(formatBrushAttrs.lineHeight);
      if (formatBrushAttrs.textAlign) chain.setTextAlign(formatBrushAttrs.textAlign).run();
      setFormatBrushActive(false);
      setFormatBrushAttrs(null);
    } else {
      const attrs: any = {};
      if (editor.isActive('bold')) attrs.bold = true;
      if (editor.isActive('italic')) attrs.italic = true;
      if (editor.isActive('highlight')) attrs.highlight = true;
      if (editor.isActive('textStyle')) {
        const ts = editor.getAttributes('textStyle');
        if (ts.fontFamily) attrs.fontFamily = ts.fontFamily;
        if (ts.fontSize) attrs.fontSize = ts.fontSize;
        if (ts.color) attrs.color = ts.color;
        if (ts.lineHeight) attrs.lineHeight = ts.lineHeight;
      }
      if (editor.isActive({ textAlign: 'left' })) attrs.textAlign = 'left';
      else if (editor.isActive({ textAlign: 'center' })) attrs.textAlign = 'center';
      else if (editor.isActive({ textAlign: 'right' })) attrs.textAlign = 'right';
      else if (editor.isActive({ textAlign: 'justify' })) attrs.textAlign = 'justify';
      if (Object.keys(attrs).length > 0) {
        setFormatBrushAttrs(attrs);
        setFormatBrushActive(true);
      }
    }
  }, [editor, formatBrushActive, formatBrushAttrs]);

  const handleImageClick = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  if (!editor) return null;

  return (
    <div ref={editorRef} className="tiptap-editor prose prose-sm max-w-none relative">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) insertImageFile(file);
          e.currentTarget.value = '';
        }}
      />
      <EditorToolbar
        editor={editor}
        imageInputRef={imageInputRef}
        tableMenuRef={tableMenuRef}
        lineHeightMenuRef={lineHeightMenuRef}
        fontFamilyMenuRef={fontFamilyMenuRef}
        colorMenuRef={colorMenuRef}
        spacingMenuRef={spacingMenuRef}
        tableMenuOpen={tableMenuOpen}
        formatBrushActive={formatBrushActive}
        formatBrushAttrs={formatBrushAttrs}
        lineHeightMenuOpen={lineHeightMenuOpen}
        fontFamilyMenuOpen={fontFamilyMenuOpen}
        colorMenuOpen={colorMenuOpen}
        spacingMenuOpen={spacingMenuOpen}
        onTableMenuToggle={setTableMenuOpen}
        onFormatBrushClick={handleFormatBrushClick}
        onLineHeightMenuToggle={setLineHeightMenuOpen}
        onFontFamilyMenuToggle={setFontFamilyMenuOpen}
        onColorMenuToggle={setColorMenuOpen}
        onSpacingMenuToggle={setSpacingMenuOpen}
        onImageClick={handleImageClick}
      />
      <div className="relative">
        <EditorContent editor={editor} />
        {isDragOver && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-accent/5 border-2 border-dashed border-accent/40 rounded-b-xl pointer-events-none">
            <div className="flex flex-col items-center gap-2 text-accent">
              <ImagePlus size={32} />
              <span className="text-sm font-semibold">松开即可插入图片</span>
            </div>
          </div>
        )}
        {linkMenuOpen && (
          <div
            ref={linkSuggestionRef}
            className="absolute z-50 bg-white rounded-xl border border-teal-900/10 shadow-xl w-64 max-h-48 overflow-y-auto"
            style={{ top: linkMenuPos.top, left: linkMenuPos.left }}
          >
            <div className="px-3 py-1.5 text-2xs text-muted/50 font-medium uppercase tracking-wide border-b border-teal-900/5">
              链接到便签
            </div>
            {linkSuggestions.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted/40 text-center">
                {linkQuery ? '未找到匹配的便签' : '输入关键词搜索...'}
              </div>
            ) : (
              linkSuggestions.map((item, idx) => (
                <button
                  key={item.id}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 text-xs transition-colors ${
                    idx === linkSelectedIndex ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-teal-900/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (linkTriggerRef.current) {
                      const { from, to } = linkTriggerRef.current;
                      editor?.chain().focus().deleteRange({ from, to }).insertContent(`[[${item.title}]]`).run();
                    }
                    setLinkMenuOpen(false);
                    setLinkQuery('');
                    linkTriggerRef.current = null;
                  }}
                >
                  <span className="shrink-0 text-muted/40">
                    {item.type === 'document' ? '📄' : '📝'}
                  </span>
                  <span className="truncate">{item.title || '未命名'}</span>
                </button>
              ))
            )}
          </div>
        )}
        {slashMenuOpen && (
          <div
            ref={slashMenuRef}
            className="absolute z-50 bg-white rounded-xl border border-teal-900/10 shadow-xl w-72 max-h-64 overflow-y-auto"
            style={{ top: slashMenuPos.top, left: slashMenuPos.left }}
          >
            <div className="px-3 py-1.5 text-2xs text-muted/50 font-medium uppercase tracking-wide border-b border-teal-900/5">
              快捷命令
            </div>
            {filteredSlashCommands.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted/40 text-center">未找到匹配的命令</div>
            ) : (
              filteredSlashCommands.map((cmd, idx) => (
                <button
                  key={cmd.label}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 text-xs transition-colors ${
                    idx === slashSelectedIndex ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-teal-900/5'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (slashTriggerRef.current) {
                      const { from } = slashTriggerRef.current;
                      const currentPos = editor?.state.selection.from || from;
                      editor?.chain().focus().deleteRange({ from, to: currentPos }).run();
                    }
                    cmd.action(editor);
                    setSlashMenuOpen(false);
                    setSlashQuery('');
                    slashTriggerRef.current = null;
                  }}
                >
                  <span className="shrink-0 w-7 h-7 rounded-lg bg-teal-900/5 flex items-center justify-center text-muted/60">
                    {cmd.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{cmd.label}</div>
                    <div className="text-2xs text-muted/40">{cmd.description}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
});

TiptapEditor.displayName = 'TiptapEditor';

export default TiptapEditor;
