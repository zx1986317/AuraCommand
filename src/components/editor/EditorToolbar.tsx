import React from 'react';
import {
  Paintbrush, Minus, Plus, ChevronDown,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Indent, Outdent, ImagePlus
} from 'lucide-react';

interface EditorToolbarProps {
  editor: any;
  imageInputRef: React.RefObject<HTMLInputElement>;
  tableMenuRef: React.RefObject<HTMLDivElement>;
  lineHeightMenuRef: React.RefObject<HTMLDivElement>;
  fontFamilyMenuRef: React.RefObject<HTMLDivElement>;
  colorMenuRef: React.RefObject<HTMLDivElement>;
  spacingMenuRef: React.RefObject<HTMLDivElement>;
  tableMenuOpen: boolean;
  formatBrushActive: boolean;
  formatBrushAttrs: any;
  lineHeightMenuOpen: boolean;
  fontFamilyMenuOpen: boolean;
  colorMenuOpen: boolean;
  spacingMenuOpen: boolean;
  onTableMenuToggle: (open: boolean) => void;
  onFormatBrushClick: () => void;
  onLineHeightMenuToggle: (open: boolean) => void;
  onFontFamilyMenuToggle: (open: boolean) => void;
  onColorMenuToggle: (open: boolean) => void;
  onSpacingMenuToggle: (open: boolean) => void;
  onImageClick: () => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor, imageInputRef, tableMenuRef, lineHeightMenuRef, fontFamilyMenuRef,
  colorMenuRef, spacingMenuRef,
  tableMenuOpen, formatBrushActive, formatBrushAttrs,
  lineHeightMenuOpen, fontFamilyMenuOpen, colorMenuOpen, spacingMenuOpen,
  onTableMenuToggle, onFormatBrushClick, onLineHeightMenuToggle,
  onFontFamilyMenuToggle, onColorMenuToggle, onSpacingMenuToggle, onImageClick
}) => {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-1 p-2 border-b border-teal-900/10 bg-white/30 rounded-t-xl sticky top-0 z-10 flex-wrap">
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''} title="粗体">
        <strong>B</strong>
      </button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'is-active' : ''} title="斜体">
        <em>I</em>
      </button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''} title="标题1">
        H1
      </button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''} title="标题2">
        H2
      </button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''} title="标题3">
        H3
      </button>
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''} title="无序列表">
        • 列表
      </button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'is-active' : ''} title="有序列表">
        1. 列表
      </button>
      <button onClick={() => editor.chain().focus().toggleTaskList().run()} className={editor.isActive('taskList') ? 'is-active' : ''} title="待办列表">
        ☑ 待办
      </button>
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? 'is-active' : ''} title="引用">
        " 引用
      </button>
      <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={editor.isActive('codeBlock') ? 'is-active' : ''} title="代码块">
        {'<>'}代码
      </button>
      <button onClick={() => editor.chain().focus().toggleHighlight().run()} className={editor.isActive('highlight') ? 'is-active' : ''} title="高亮">
        🖍 高亮
      </button>

      {/* 格式刷 */}
      <button
        onClick={onFormatBrushClick}
        className={`px-2 py-1 rounded text-xs ${formatBrushActive ? 'bg-accent/20 text-accent ring-1 ring-accent' : 'text-muted hover:bg-teal-900/5'}`}
        title="格式刷"
      >
        <Paintbrush size={14} />
      </button>

      {/* 字体 */}
      <div className="relative" ref={fontFamilyMenuRef}>
        <button
          onClick={() => onFontFamilyMenuToggle(!fontFamilyMenuOpen)}
          className={`flex items-center gap-0.5 px-2 py-1 rounded text-xs ${editor.isActive('textStyle', { fontFamily: editor.getAttributes('textStyle').fontFamily }) ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-teal-900/5'}`}
          title="字体"
        >
          <span className="max-w-[60px] truncate">{editor.getAttributes('textStyle').fontFamily || '字体'}</span>
          <ChevronDown size={10} />
        </button>
        {fontFamilyMenuOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl border border-teal-900/10 shadow-xl p-1 w-44 text-xs max-h-60 overflow-y-auto">
            {[
              { label: '宋体', value: 'SimSun' },
              { label: '黑体', value: 'SimHei' },
              { label: '楷体', value: 'KaiTi' },
              { label: '微软雅黑', value: 'Microsoft YaHei' },
              { label: '等线', value: 'DengXian' },
              { label: '仿宋', value: 'FangSong' },
              { label: 'Arial', value: 'Arial' },
              { label: 'Times New Roman', value: 'Times New Roman' },
              { label: 'Courier New', value: 'Courier New' },
              { label: 'Georgia', value: 'Georgia' },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => { editor.chain().focus().setFontFamily(f.value).run(); onFontFamilyMenuToggle(false); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent/5 hover:text-accent transition-all ${editor.getAttributes('textStyle').fontFamily === f.value ? 'bg-accent/5 text-accent font-medium' : 'text-muted'}`}
                style={{ fontFamily: f.value }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 字号 */}
      <div className="relative">
        <button
          onClick={() => editor.chain().focus().setFontSize(`${Math.max(9, (parseInt(editor.getAttributes('textStyle').fontSize || '14') - 1))}px`).run()}
          className="px-1.5 py-1 rounded text-xs text-muted hover:bg-teal-900/5"
          title="减小字号"
        >
          <Minus size={12} />
        </button>
        <span className="px-1 text-xs text-muted min-w-[32px] text-center">{editor.getAttributes('textStyle').fontSize || '14px'}</span>
        <button
          onClick={() => editor.chain().focus().setFontSize(`${Math.min(72, (parseInt(editor.getAttributes('textStyle').fontSize || '14') + 1))}px`).run()}
          className="px-1.5 py-1 rounded text-xs text-muted hover:bg-teal-900/5"
          title="增大字号"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* 文字颜色 */}
      <div className="relative" ref={colorMenuRef}>
        <button
          onClick={() => onColorMenuToggle(!colorMenuOpen)}
          className="px-2 py-1 rounded text-xs text-muted hover:bg-teal-900/5 flex items-center gap-1"
          title="文字颜色"
        >
          <span className="w-4 h-4 rounded border border-teal-900/20" style={{ background: editor.getAttributes('textStyle').color || '#000' }} />
          <ChevronDown size={10} />
        </button>
        {colorMenuOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl border border-teal-900/10 shadow-xl p-2 w-44 text-xs">
            <input
              type="color"
              className="w-full h-8 rounded cursor-pointer"
              value={editor.getAttributes('textStyle').color || '#000000'}
              onChange={e => editor.chain().focus().setColor(e.target.value).run()}
            />
            <div className="mt-2 grid grid-cols-6 gap-1">
              {['#000000','#ffffff','#e53e3e','#dd6b20','#d69e2e','#38a169','#3182ce','#805ad5','#d53f8c','#718096','#c53030','#2d3748'].map(c => (
                <button
                  key={c}
                  className="w-5 h-5 rounded border border-teal-900/10 hover:scale-110 transition-transform"
                  style={{ background: c }}
                  onClick={() => { editor.chain().focus().setColor(c).run(); onColorMenuToggle(false); }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 行高 */}
      <div className="relative" ref={lineHeightMenuRef}>
        <button
          onClick={() => onLineHeightMenuToggle(!lineHeightMenuOpen)}
          className={`flex items-center gap-0.5 px-2 py-1 rounded text-xs ${editor.isActive('textStyle', { lineHeight: editor.getAttributes('textStyle').lineHeight }) ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-teal-900/5'}`}
          title="行高"
        >
          ≡<span className="text-2xs">行高</span>
          <ChevronDown size={10} />
        </button>
        {lineHeightMenuOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl border border-teal-900/10 shadow-xl p-1 w-32 text-xs">
            {['1.0','1.2','1.5','1.8','2.0','2.5','3.0'].map(lh => (
              <button
                key={lh}
                onClick={() => { (editor.commands as { setLineHeight?: (lh: string) => void }).setLineHeight?.(lh); onLineHeightMenuToggle(false); }}
                className={`w-full flex items-center px-3 py-1.5 rounded-lg hover:bg-accent/5 hover:text-accent transition-all ${editor.getAttributes('textStyle').lineHeight === lh ? 'bg-accent/5 text-accent font-medium' : 'text-muted'}`}
              >
                {lh}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 对齐 */}
      <div className="flex items-center gap-0.5">
        {[
          { align: 'left', icon: AlignLeft, title: '左对齐' },
          { align: 'center', icon: AlignCenter, title: '居中对齐' },
          { align: 'right', icon: AlignRight, title: '右对齐' },
          { align: 'justify', icon: AlignJustify, title: '两端对齐' },
        ].map(({ align, icon: Icon, title }) => (
          <button
            key={align}
            onClick={() => editor.chain().focus().setTextAlign(align).run()}
            className={`p-1 rounded ${editor.isActive({ textAlign: align }) ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-teal-900/5'}`}
            title={title}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

      {/* 段间距 */}
      <div className="relative" ref={spacingMenuRef}>
        <button
          onClick={() => onSpacingMenuToggle(!spacingMenuOpen)}
          className="flex items-center gap-0.5 px-2 py-1 rounded text-xs text-muted hover:bg-teal-900/5"
          title="段落间距"
        >
          <span className="text-2xs">间距</span>
          <ChevronDown size={10} />
        </button>
        {spacingMenuOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl border border-teal-900/10 shadow-xl p-1 w-40 text-xs">
            <div className="px-3 py-1 text-2xs text-muted/40 font-medium uppercase tracking-wide">段前</div>
            {[
              { label: '0', value: '0' },
              { label: '0.5行', value: '0.5' },
              { label: '1行', value: '1' },
              { label: '2行', value: '2' },
            ].map(s => (
              <button
                key={s.value}
                onClick={() => {
                  editor.chain().focus().updateAttributes('paragraph', { spaceBefore: s.value }).run();
                  onSpacingMenuToggle(false);
                }}
                className="w-full flex items-center px-3 py-1.5 rounded-lg text-muted hover:bg-accent/5 hover:text-accent transition-all"
              >
                段前 {s.label}
              </button>
            ))}
            <div className="my-1 border-t border-teal-900/5" />
            <div className="px-3 py-1 text-2xs text-muted/40 font-medium uppercase tracking-wide">段后</div>
            {[
              { label: '0', value: '0' },
              { label: '0.5行', value: '0.5' },
              { label: '1行', value: '1' },
              { label: '2行', value: '2' },
            ].map(s => (
              <button
                key={s.value}
                onClick={() => {
                  editor.chain().focus().updateAttributes('paragraph', { spaceAfter: s.value }).run();
                  onSpacingMenuToggle(false);
                }}
                className="w-full flex items-center px-3 py-1.5 rounded-lg text-muted hover:bg-accent/5 hover:text-accent transition-all"
              >
                段后 {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 缩进 */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
          className="p-1 rounded text-muted hover:bg-teal-900/5"
          title="减少缩进"
        >
          <Outdent size={14} />
        </button>
        <button
          onClick={() => editor.chain().focus().liftListItem('listItem').run()}
          className="p-1 rounded text-muted hover:bg-teal-900/5"
          title="增加缩进"
        >
          <Indent size={14} />
        </button>
      </div>

      <div className="relative" ref={tableMenuRef}>
        <button
          onClick={() => onTableMenuToggle(!tableMenuOpen)}
          className={`flex items-center gap-0.5 px-2 py-1 rounded text-xs ${editor.isActive('table') ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-teal-900/5'}`}
          title="表格操作"
        >
          ⊞ 表格
          <ChevronDown size={10} />
        </button>
        {tableMenuOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl border border-teal-900/10 shadow-xl p-1 w-48 text-xs">
            <button
              onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); onTableMenuToggle(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-muted hover:bg-accent/5 hover:text-accent transition-all"
            >
              <span className="text-base w-5 text-center">+</span> 插入表格
            </button>
            <div className="my-1 border-t border-teal-900/5" />
            <div className="px-3 py-1 text-2xs text-muted/40 font-medium uppercase tracking-wide">行</div>
            <button onClick={() => { editor.chain().focus().addRowBefore().run(); onTableMenuToggle(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-muted hover:bg-accent/5 hover:text-accent transition-all">↑ 上方插入行</button>
            <button onClick={() => { editor.chain().focus().addRowAfter().run(); onTableMenuToggle(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-muted hover:bg-accent/5 hover:text-accent transition-all">↓ 下方插入行</button>
            <button onClick={() => { editor.chain().focus().deleteRow().run(); onTableMenuToggle(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-muted hover:bg-red-50 hover:text-red-500 transition-all">✕ 删除行</button>
            <div className="my-1 border-t border-teal-900/5" />
            <div className="px-3 py-1 text-2xs text-muted/40 font-medium uppercase tracking-wide">列</div>
            <button onClick={() => { editor.chain().focus().addColumnBefore().run(); onTableMenuToggle(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-muted hover:bg-accent/5 hover:text-accent transition-all">← 左侧插入列</button>
            <button onClick={() => { editor.chain().focus().addColumnAfter().run(); onTableMenuToggle(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-muted hover:bg-accent/5 hover:text-accent transition-all">→ 右侧插入列</button>
            <button onClick={() => { editor.chain().focus().deleteColumn().run(); onTableMenuToggle(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-muted hover:bg-red-50 hover:text-red-500 transition-all">✕ 删除列</button>
            <div className="my-1 border-t border-teal-900/5" />
            <div className="px-3 py-1 text-2xs text-muted/40 font-medium uppercase tracking-wide">单元格</div>
            <button onClick={() => { editor.chain().focus().mergeCells().run(); onTableMenuToggle(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-muted hover:bg-accent/5 hover:text-accent transition-all">⊞ 合并单元格</button>
            <button onClick={() => { editor.chain().focus().splitCell().run(); onTableMenuToggle(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-muted hover:bg-accent/5 hover:text-accent transition-all">⊟ 拆分单元格</button>
            <div className="my-1 border-t border-teal-900/5" />
            <div className="px-3 py-1 text-2xs text-muted/40 font-medium uppercase tracking-wide">表头</div>
            <button onClick={() => { editor.chain().focus().toggleHeaderRow().run(); onTableMenuToggle(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-muted hover:bg-accent/5 hover:text-accent transition-all">＝ 表头行</button>
            <button onClick={() => { editor.chain().focus().toggleHeaderColumn().run(); onTableMenuToggle(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-muted hover:bg-accent/5 hover:text-accent transition-all">‖ 表头列</button>
            <div className="my-1 border-t border-teal-900/5" />
            <button onClick={() => { editor.chain().focus().deleteTable().run(); onTableMenuToggle(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-muted hover:bg-red-50 hover:text-red-500 transition-all">🗑 删除表格</button>
          </div>
        )}
      </div>
      <button
        onClick={onImageClick}
        title="插入图片"
        type="button"
      >
        <ImagePlus size={16} />
      </button>
    </div>
  );
};

export default EditorToolbar;
