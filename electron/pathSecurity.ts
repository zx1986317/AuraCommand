/**
 * 路径安全防护工具
 * 防止路径遍历攻击，确保所有路径操作在安全范围内
 */
import path from 'path'
import fs from 'fs'
import log from 'electron-log'

/**
 * 验证路径是否在 Vault 目录范围内
 */
export function isPathWithinVault(filePath: string, vaultPath: string): boolean {
  const resolvedPath = path.resolve(filePath)
  const resolvedVault = path.resolve(vaultPath)
  
  // 规范化路径分隔符
  const normalizedPath = resolvedPath.replace(/\\/g, '/')
  const normalizedVault = resolvedVault.replace(/\\/g, '/')
  
  // 确保路径不以 ../ 或 ..\ 开头
  if (filePath.includes('..')) {
    return false
  }
  
  // 检查路径是否在 vault 内
  return normalizedPath.startsWith(normalizedVault + '/') || normalizedPath === normalizedVault
}

/**
 * 安全地解析文件路径
 */
export function safeResolvePath(basePath: string, relativePath: string): string {
  const resolved = path.resolve(basePath, relativePath)
  if (!resolved.startsWith(path.resolve(basePath))) {
    throw new Error('路径遍历攻击被阻止')
  }
  return resolved
}

/**
 * 验证文件是否存在且可读
 */
export function validateFileAccess(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`)
  }
  
  try {
    fs.accessSync(filePath, fs.constants.R_OK)
  } catch {
    throw new Error(`文件不可读: ${filePath}`)
  }
}

/**
 * 安全的文件复制（防止覆盖系统文件）
 */
export function safeCopyFile(src: string, dest: string, vaultPath: string): void {
  // 验证源文件
  validateFileAccess(src)
  
  // 验证目标路径在 vault 内
  if (!isPathWithinVault(dest, vaultPath)) {
    throw new Error('目标路径不在允许范围内')
  }
  
  // 确保目标目录存在
  const destDir = path.dirname(dest)
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }
  
  fs.copyFileSync(src, dest)
}

/**
 * 验证文件名安全性（防止特殊字符和路径注入）
 */
export function sanitizeFileName(fileName: string): string {
  // 移除路径分隔符和控制字符
  const sanitized = fileName
    .replace(/[\\/:*?"<>|]/g, '_')  // 移除非法文件名字符
    .replace(/\.\./g, '_')          // 移除路径遍历
    .replace(/[\x00-\x1f\x7f]/g, '') // 移除控制字符
    .trim()
  
  if (!sanitized) {
    throw new Error('文件名不能为空')
  }
  
  // 限制长度
  return sanitized.substring(0, 255)
}

/**
 * 获取安全的路径列表（用于文件导入）
 */
export function validateImportPaths(filePaths: string[], vaultPath: string): string[] {
  const validPaths: string[] = []
  
  for (const filePath of filePaths) {
    // 验证文件存在
    if (!fs.existsSync(filePath)) {
      log.warn(`[Security] File not found: ${filePath}`)
      continue
    }
    
    // 验证文件可读
    try {
      fs.accessSync(filePath, fs.constants.R_OK)
      validPaths.push(filePath)
    } catch {
      log.warn(`[Security] File not readable: ${filePath}`)
    }
  }
  
  return validPaths
}
