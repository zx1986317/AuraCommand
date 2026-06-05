import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, FilePlus2, FileEdit, Sparkles } from 'lucide-react';

interface AIResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    content: string;
    title: string;
    onInsert: () => void;
    onReplace: () => void;
}

const AIResultModal: React.FC<AIResultModalProps> = ({
    isOpen,
    onClose,
    content,
    title,
    onInsert,
    onReplace
}) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-teal-900/20 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl bg-white/95 backdrop-blur-2xl border border-teal-900/10 rounded-[2.5rem] shadow-premium flex flex-col max-h-[80vh] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-teal-900/5 flex items-center justify-between bg-white/40">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shadow-sm">
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-display font-bold text-foreground">{title}</h3>
                                    <p className="text-2xs font-mono text-muted uppercase tracking-widest mt-0.5">AI 生成预览</p>
                                </div>
                            </div>
                            <button 
                                onClick={onClose}
                                className="w-10 h-10 flex items-center justify-center rounded-xl text-muted hover:text-foreground hover:bg-teal-900/5 transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white/20">
                            <div className="prose prose-teal max-w-none">
                                <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed bg-transparent p-0 m-0 border-none">
                                    {content}
                                </pre>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="px-8 py-6 border-t border-teal-900/5 bg-white/40 flex items-center justify-between gap-4">
                            <button 
                                onClick={handleCopy}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white border border-teal-900/5 text-xs font-bold text-muted hover:text-accent hover:border-accent/30 transition-all shadow-sm"
                            >
                                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                {copied ? '已复制' : '复制内容'}
                            </button>

                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={onInsert}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-white border border-teal-900/5 text-xs font-bold text-foreground hover:border-accent/30 hover:bg-accent/5 transition-all shadow-sm"
                                >
                                    <FilePlus2 size={14} className="text-accent" />
                                    插入末尾
                                </button>
                                <button 
                                    onClick={onReplace}
                                    className="flex items-center gap-2 px-8 py-2.5 rounded-2xl bg-accent text-white text-xs font-bold hover:bg-accent/90 transition-all shadow-premium active:scale-95"
                                >
                                    <FileEdit size={14} />
                                    替换全文
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default AIResultModal;
