/**
 * RAG 上下文构建服务
 * 对同一文件的多个 chunk 去重合并，控制总长度
 * 优化：使用简单哈希指纹替代字符级比较，提升性能
 */

/**
 * 生成文本的简单哈希指纹（用于快速去重）
 */
function generateTextFingerprint(text: string): number {
  const sample = text.substring(0, 100);
  let hash = 0;
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash << 5) - hash + sample.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * 计算两段文本的相似度（优化版：先比较指纹，再精确匹配）
 */
function isDuplicateText(text1: string, text2: string, threshold: number = 0.7): boolean {
  // 快速路径：完全相同
  if (text1 === text2) return true;

  // 快速路径：长度差异过大
  const lenDiff = Math.abs(text1.length - text2.length);
  const maxLen = Math.max(text1.length, text2.length);
  if (maxLen > 0 && lenDiff / maxLen > (1 - threshold)) return false;

  // 精确比较（仅当长度相近时）
  const overlap = Math.min(text1.length, text2.length);
  if (overlap === 0) return false;

  let matchCount = 0;
  for (let i = 0; i < overlap; i++) {
    if (text1[i] === text2[i]) matchCount++;
  }
  return (matchCount / overlap) > threshold;
}

export function buildRAGContext(results: any[], maxChars: number = 6000): string {
  if (!results.length) return '';

  const grouped = new Map<string, { type: string; title: string; chunks: string[]; fingerprints: Set<number>; space: string }>();

  for (const r of results) {
    const text = r.text || r.content || '';
    if (!text) continue;

    const rType = r.type || 'unknown';
    let groupKey: string;
    let groupTitle: string;

    let space = '';
    if (r.project) {
      space = r.project;
    } else if (r.category && r.category !== 'file_chunk') {
      space = r.category;
    }
    if (r.folder_path) {
      const parts = r.folder_path.replace(/\\/g, '/').split('/');
      const vaultIdx = parts.findIndex((p: string) => p === 'AuraVault');
      if (vaultIdx >= 0 && parts.length > vaultIdx + 1) {
        space = parts[vaultIdx + 1]!;
      } else if (parts.length > 0) {
        space = parts[parts.length - 1] || space;
      }
    }

    if (rType === 'file_chunk') {
      groupKey = `file:${r.file_id || r.file_name || r.id}`;
      groupTitle = r.file_name || r.title || '未命名文档';
    } else if (rType === 'file') {
      groupKey = `file-meta:${r.id}`;
      groupTitle = r.title || r.file_name || '未命名文件';
    } else {
      groupKey = `memo:${r.id}`;
      groupTitle = r.title || '未命名便签';
    }

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, { type: rType, title: groupTitle, chunks: [], fingerprints: new Set(), space });
    }

    const chunkText = text.substring(0, 500);
    const group = grouped.get(groupKey)!;
    
    // 优化：先使用哈希指纹快速过滤，再进行精确比较
    const fingerprint = generateTextFingerprint(chunkText);
    if (group.fingerprints.has(fingerprint)) {
      // 指纹命中，进一步精确比较
      const isExactDuplicate = group.chunks.some(existing => isDuplicateText(existing, chunkText));
      if (!isExactDuplicate) {
        group.chunks.push(chunkText);
        group.fingerprints.add(fingerprint);
      }
    } else {
      group.chunks.push(chunkText);
      group.fingerprints.add(fingerprint);
    }
  }

  const parts: string[] = [];
  let totalLen = 0;

  for (const [, group] of grouped) {
    const typeStr = group.type === 'memo' ? '便签' : (group.type === 'file_chunk' ? '文档片段' : '文档');
    const spaceStr = group.space ? `[${group.space}] ` : '';
    const chunksStr = group.chunks.join('\n...（续）\n');
    const part = `[来源: ${spaceStr}${typeStr} - ${group.title}]\n${chunksStr}`;

    if (totalLen + part.length > maxChars) {
      const remaining = maxChars - totalLen;
      if (remaining > 50) {
        parts.push(part.substring(0, remaining) + '\n...（已截断）');
      }
      break;
    }

    parts.push(part);
    totalLen += part.length;
  }

  return parts.join('\n\n---\n\n');
}