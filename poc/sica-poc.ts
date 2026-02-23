/**
 * Code Evolver (SICA) - PoC
 * 
 * 演示如何安全地修改 Agent 自身源码
 * 
 * 注意：这是概念验证，实际使用需要更严格的安全检查
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ============================================================================
// 类型定义
// ============================================================================

interface CodeModification {
  id: string;
  targetFile: string;
  modificationType: 'add' | 'modify' | 'delete';
  oldCode?: string;
  newCode: string;
  startLine?: number;
  endLine?: number;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high';
  author: 'agent' | 'human';
  timestamp: Date;
}

interface BackupRecord {
  id: string;
  timestamp: Date;
  files: {
    path: string;
    content: string;
    hash: string;
  }[];
  reason: string;
  modificationId?: string;
}

interface ModificationResult {
  success: boolean;
  modificationId: string;
  backupId?: string;
  reason?: string;
  errors?: string[];
  rollbackAvailable: boolean;
}

interface ImpactAnalysis {
  affectedFiles: string[];
  affectedTests: string[];
  riskLevel: 'low' | 'medium' | 'high';
  breakingChanges: boolean;
  dependencies: string[];
}

// ============================================================================
// Backup Manager
// ============================================================================

class BackupManager {
  private backupPath: string;
  private backups: BackupRecord[] = [];

  constructor(backupPath: string = './backups') {
    this.backupPath = backupPath;
    this.loadBackups();
  }

  /**
   * 创建备份
   */
  createBackup(files: string[], reason: string): BackupRecord {
    const backup: BackupRecord = {
      id: `backup_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date(),
      files: files.map(filePath => ({
        path: filePath,
        content: fs.readFileSync(filePath, 'utf-8'),
        hash: this.hashFile(fs.readFileSync(filePath, 'utf-8'))
      })),
      reason
    };

    this.backups.push(backup);
    this.saveBackups();
    this.saveBackupFiles(backup);

    console.log(`✅ Backup created: ${backup.id}`);
    return backup;
  }

  /**
   * 恢复备份
   */
  restore(backupId: string): boolean {
    const backup = this.backups.find(b => b.id === backupId);
    if (!backup) {
      console.log(`❌ Backup not found: ${backupId}`);
      return false;
    }

    for (const file of backup.files) {
      // 确保目录存在
      const dir = path.dirname(file.path);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(file.path, file.content);
      console.log(`   Restored: ${file.path}`);
    }

    console.log(`✅ Backup restored: ${backupId}`);
    return true;
  }

  /**
   * 列出备份
   */
  listBackups(limit: number = 10): BackupRecord[] {
    return this.backups
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * 获取最新备份
   */
  getLatestBackup(): BackupRecord | undefined {
    return this.backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
  }

  private hashFile(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
  }

  private loadBackups(): void {
    const indexPath = path.join(this.backupPath, 'index.json');
    if (fs.existsSync(indexPath)) {
      const data = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      this.backups = data.map((b: any) => ({
        ...b,
        timestamp: new Date(b.timestamp)
      }));
    }
  }

  private saveBackups(): void {
    if (!fs.existsSync(this.backupPath)) {
      fs.mkdirSync(this.backupPath, { recursive: true });
    }
    fs.writeFileSync(
      path.join(this.backupPath, 'index.json'),
      JSON.stringify(this.backups, null, 2)
    );
  }

  private saveBackupFiles(backup: BackupRecord): void {
    const backupDir = path.join(this.backupPath, backup.id);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    for (const file of backup.files) {
      const filePath = path.join(backupDir, path.basename(file.path));
      fs.writeFileSync(filePath, file.content);
    }
  }
}

// ============================================================================
// Impact Analyzer
// ============================================================================

class ImpactAnalyzer {
  /**
   * 分析修改的影响
   */
  analyze(modification: CodeModification, projectRoot: string): ImpactAnalysis {
    const result: ImpactAnalysis = {
      affectedFiles: [modification.targetFile],
      affectedTests: [],
      riskLevel: modification.riskLevel,
      breakingChanges: false,
      dependencies: []
    };

    // 查找相关测试文件
    const testFile = this.findTestFile(modification.targetFile, projectRoot);
    if (testFile) {
      result.affectedTests.push(testFile);
    }

    // 检查是否有其他文件依赖此文件
    result.dependencies = this.findDependencies(modification.targetFile, projectRoot);

    // 简单的破坏性变更检测
    if (modification.modificationType === 'delete') {
      result.breakingChanges = true;
      result.riskLevel = 'high';
    }

    // 检查是否修改了公共接口
    if (modification.oldCode && this.isExported(modification.oldCode)) {
      result.breakingChanges = true;
      result.riskLevel = 'high';
    }

    return result;
  }

  private findTestFile(sourceFile: string, projectRoot: string): string | null {
    // 简单的测试文件查找逻辑
    const baseName = path.basename(sourceFile, '.ts');
    const possibleTestFiles = [
      path.join(projectRoot, 'tests', `${baseName}.test.ts`),
      path.join(projectRoot, '__tests__', `${baseName}.test.ts`),
      path.join(projectRoot, 'src', '__tests__', `${baseName}.test.ts`)
    ];

    for (const testFile of possibleTestFiles) {
      if (fs.existsSync(testFile)) {
        return testFile;
      }
    }
    return null;
  }

  private findDependencies(sourceFile: string, projectRoot: string): string[] {
    const dependencies: string[] = [];
    const relativePath = path.relative(projectRoot, sourceFile);

    // 简单的依赖查找（实际中应该用 AST 分析）
    const searchDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          searchDir(filePath);
        } else if (file.endsWith('.ts')) {
          const content = fs.readFileSync(filePath, 'utf-8');
          if (content.includes(relativePath) || content.includes(path.basename(sourceFile, '.ts'))) {
            dependencies.push(filePath);
          }
        }
      }
    };

    searchDir(path.join(projectRoot, 'src'));
    return dependencies;
  }

  private isExported(code: string): boolean {
    return code.includes('export ') || code.includes('export default');
  }
}

// ============================================================================
// Safe Modifier
// ============================================================================

class SafeModifier {
  private backupManager: BackupManager;
  private impactAnalyzer: ImpactAnalyzer;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.backupManager = new BackupManager(path.join(projectRoot, '.code-evolver', 'backups'));
    this.impactAnalyzer = new ImpactAnalyzer();
  }

  /**
   * 安全地修改代码
   */
  async modify(mod: CodeModification): Promise<ModificationResult> {
    const modId = `mod_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    mod.id = modId;

    console.log(`🔧 Processing modification: ${modId}`);
    console.log(`   File: ${mod.targetFile}`);
    console.log(`   Type: ${mod.modificationType}`);
    console.log(`   Risk: ${mod.riskLevel}`);

    // 1. 检查文件是否存在
    const fullPath = path.resolve(this.projectRoot, mod.targetFile);
    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        modificationId: modId,
        reason: `File not found: ${mod.targetFile}`,
        rollbackAvailable: false
      };
    }

    // 2. 影响分析
    const impact = this.impactAnalyzer.analyze(mod, this.projectRoot);
    console.log(`   Impact: ${impact.affectedFiles.length} files, ${impact.affectedTests.length} tests`);
    console.log(`   Breaking changes: ${impact.breakingChanges}`);

    // 3. 高风险修改需要额外确认
    if (impact.riskLevel === 'high' && mod.author === 'agent') {
      return {
        success: false,
        modificationId: modId,
        reason: 'High-risk modification requires human approval',
        rollbackAvailable: false
      };
    }

    // 4. 创建备份
    const backup = this.backupManager.createBackup(
      [fullPath, ...impact.dependencies],
      `Before: ${mod.reason}`
    );

    // 5. 应用修改
    try {
      this.applyModification(fullPath, mod);
      console.log(`   ✅ Modification applied`);
    } catch (error: any) {
      // 立即回滚
      this.backupManager.restore(backup.id);
      return {
        success: false,
        modificationId: modId,
        reason: `Failed to apply modification: ${error.message}`,
        rollbackAvailable: true,
        errors: [error.message]
      };
    }

    // 6. 运行测试（如果有）
    if (impact.affectedTests.length > 0) {
      const testResult = await this.runTests(impact.affectedTests);
      if (!testResult.passed) {
        console.log(`   ❌ Tests failed, rolling back...`);
        this.backupManager.restore(backup.id);
        return {
          success: false,
          modificationId: modId,
          reason: 'Tests failed after modification',
          rollbackAvailable: true,
          errors: testResult.failures
        };
      }
      console.log(`   ✅ Tests passed`);
    }

    // 7. 记录修改历史
    this.recordModification(mod, backup.id, impact);

    return {
      success: true,
      modificationId: modId,
      backupId: backup.id,
      rollbackAvailable: true
    };
  }

  /**
   * 回滚修改
   */
  rollback(backupId: string): boolean {
    return this.backupManager.restore(backupId);
  }

  /**
   * 应用修改
   */
  private applyModification(filePath: string, mod: CodeModification): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let newContent: string;

    switch (mod.modificationType) {
      case 'add':
        // 在指定行之后添加
        if (mod.startLine !== undefined) {
          lines.splice(mod.startLine, 0, mod.newCode);
          newContent = lines.join('\n');
        } else {
          // 追加到文件末尾
          newContent = content + '\n' + mod.newCode;
        }
        break;

      case 'modify':
        // 替换指定行范围
        if (mod.startLine !== undefined && mod.endLine !== undefined) {
          lines.splice(mod.startLine - 1, mod.endLine - mod.startLine + 1, mod.newCode);
          newContent = lines.join('\n');
        } else if (mod.oldCode) {
          // 替换匹配的代码块
          newContent = content.replace(mod.oldCode, mod.newCode);
        } else {
          throw new Error('Modify operation requires startLine/endLine or oldCode');
        }
        break;

      case 'delete':
        // 删除指定行范围
        if (mod.startLine !== undefined && mod.endLine !== undefined) {
          lines.splice(mod.startLine - 1, mod.endLine - mod.startLine + 1);
          newContent = lines.join('\n');
        } else if (mod.oldCode) {
          newContent = content.replace(mod.oldCode, '');
        } else {
          throw new Error('Delete operation requires startLine/endLine or oldCode');
        }
        break;

      default:
        throw new Error(`Unknown modification type: ${mod.modificationType}`);
    }

    fs.writeFileSync(filePath, newContent);
  }

  /**
   * 运行测试（模拟）
   */
  private async runTests(testFiles: string[]): Promise<{ passed: boolean; failures: string[] }> {
    // 在实际实现中，这里会调用测试框架
    // 这里只是模拟
    console.log(`   Running ${testFiles.length} test files...`);
    
    // 模拟测试延迟
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 假设测试通过
    return { passed: true, failures: [] };
  }

  /**
   * 记录修改历史
   */
  private recordModification(mod: CodeModification, backupId: string, impact: ImpactAnalysis): void {
    const historyPath = path.join(this.projectRoot, '.code-evolver', 'history.json');
    const history = fs.existsSync(historyPath)
      ? JSON.parse(fs.readFileSync(historyPath, 'utf-8'))
      : [];

    history.push({
      ...mod,
      backupId,
      impact,
      timestamp: new Date()
    });

    if (!fs.existsSync(path.dirname(historyPath))) {
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });
    }
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  }
}

// ============================================================================
// Improvement Suggester
// ============================================================================

class ImprovementSuggester {
  /**
   * 分析代码改进机会
   */
  suggestImprovements(fileContent: string, performanceMetrics?: any): CodeModification[] {
    const suggestions: CodeModification[] = [];

    // 1. 检查代码复杂度
    const complexity = this.calculateComplexity(fileContent);
    if (complexity > 10) {
      suggestions.push({
        id: '',
        targetFile: '',
        modificationType: 'modify',
        newCode: '// TODO: Refactor this complex function',
        reason: `High cyclomatic complexity (${complexity}), consider refactoring`,
        riskLevel: 'medium',
        author: 'agent',
        timestamp: new Date()
      });
    }

    // 2. 检查重复代码
    const duplicates = this.findDuplicates(fileContent);
    if (duplicates.length > 0) {
      suggestions.push({
        id: '',
        targetFile: '',
        modificationType: 'modify',
        newCode: '// TODO: Extract duplicate code into a function',
        reason: `Found ${duplicates.length} duplicate code blocks`,
        riskLevel: 'low',
        author: 'agent',
        timestamp: new Date()
      });
    }

    // 3. 基于性能指标建议
    if (performanceMetrics?.slowFunctions) {
      for (const fn of performanceMetrics.slowFunctions) {
        suggestions.push({
          id: '',
          targetFile: '',
          modificationType: 'modify',
          newCode: `// TODO: Optimize slow function: ${fn.name}`,
          reason: `Function ${fn.name} is slow (${fn.avgTime}ms avg)`,
          riskLevel: 'medium',
          author: 'agent',
          timestamp: new Date()
        });
      }
    }

    return suggestions;
  }

  private calculateComplexity(code: string): number {
    // 简单的圈复杂度计算
    const keywords = ['if', 'else', 'for', 'while', 'case', 'catch', '&&', '||', '?'];
    let complexity = 1;
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = code.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }
    return complexity;
  }

  private findDuplicates(code: string): string[] {
    // 简单的重复检测（实际中应该用更复杂的算法）
    const lines = code.split('\n');
    const counts = new Map<string, number>();
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 20) {  // 只检查较长的行
        counts.set(trimmed, (counts.get(trimmed) || 0) + 1);
      }
    }

    const duplicates: string[] = [];
    counts.forEach((count, line) => {
      if (count > 1) {
        duplicates.push(line);
      }
    });

    return duplicates;
  }
}

// ============================================================================
// Code Evolver
// ============================================================================

class CodeEvolver {
  private modifier: SafeModifier;
  private suggester: ImprovementSuggester;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.modifier = new SafeModifier(projectRoot);
    this.suggester = new ImprovementSuggester();
  }

  /**
   * 分析并执行改进
   */
  async evolve(filePath: string): Promise<ModificationResult[]> {
    const results: ModificationResult[] = [];
    const fullPath = path.resolve(this.projectRoot, filePath);

    if (!fs.existsSync(fullPath)) {
      console.log(`❌ File not found: ${filePath}`);
      return results;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const suggestions = this.suggester.suggestImprovements(content);

    console.log(`Found ${suggestions.length} improvement suggestions`);

    for (const suggestion of suggestions) {
      suggestion.targetFile = filePath;
      const result = await this.modifier.modify(suggestion);
      results.push(result);

      if (!result.success) {
        console.log(`   Skipping remaining suggestions due to failure`);
        break;
      }
    }

    return results;
  }

  /**
   * 执行单个修改
   */
  async applyModification(mod: CodeModification): Promise<ModificationResult> {
    return this.modifier.modify(mod);
  }

  /**
   * 回滚
   */
  rollback(backupId: string): boolean {
    return this.modifier.rollback(backupId);
  }
}

// ============================================================================
// Demo
// ============================================================================

async function runDemo() {
  console.log('='.repeat(60));
  console.log('Code Evolver (SICA) - PoC Demo');
  console.log('='.repeat(60));
  console.log();

  // 创建临时项目目录
  const projectRoot = '/tmp/code-evolver-demo';
  const testFile = 'src/example.ts';

  if (!fs.existsSync(path.join(projectRoot, 'src'))) {
    fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  }

  // 创建测试文件
  const testContent = `
export function calculateSum(numbers: number[]): number {
  let sum = 0;
  for (const num of numbers) {
    sum += num;
  }
  return sum;
}

export function calculateAverage(numbers: number[]): number {
  const sum = calculateSum(numbers);
  return sum / numbers.length;
}
`;
  fs.writeFileSync(path.join(projectRoot, testFile), testContent);

  const evolver = new CodeEvolver(projectRoot);

  // 1. 分析改进机会
  console.log('1. Analyzing improvement opportunities...');
  console.log('-'.repeat(40));

  const suggester = new ImprovementSuggester();
  const suggestions = suggester.suggestImprovements(testContent);
  console.log(`Found ${suggestions.length} suggestions:`);
  suggestions.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.reason}`);
  });
  console.log();

  // 2. 尝试一个低风险修改
  console.log('2. Applying a low-risk modification...');
  console.log('-'.repeat(40));

  const modification: CodeModification = {
    id: '',
    targetFile: testFile,
    modificationType: 'modify',
    oldCode: 'export function calculateSum(numbers: number[]): number {',
    newCode: `/**
 * Calculate the sum of an array of numbers
 * @param numbers - Array of numbers to sum
 * @returns The sum of all numbers
 */
export function calculateSum(numbers: number[]): number {`,
    reason: 'Add JSDoc documentation to calculateSum function',
    riskLevel: 'low',
    author: 'agent',
    timestamp: new Date()
  };

  const result = await evolver.applyModification(modification);
  console.log('Result:', result.success ? '✅ Success' : '❌ Failed');
  if (result.success) {
    console.log(`Backup ID: ${result.backupId}`);
  } else {
    console.log(`Reason: ${result.reason}`);
  }
  console.log();

  // 3. 查看修改后的文件
  console.log('3. Modified file content:');
  console.log('-'.repeat(40));
  const modifiedContent = fs.readFileSync(path.join(projectRoot, testFile), 'utf-8');
  console.log(modifiedContent.slice(0, 500) + '...');
  console.log();

  // 4. 尝试回滚
  if (result.success && result.backupId) {
    console.log('4. Rolling back the modification...');
    console.log('-'.repeat(40));
    evolver.rollback(result.backupId);
    
    const rolledBackContent = fs.readFileSync(path.join(projectRoot, testFile), 'utf-8');
    console.log('Content restored:');
    console.log(rolledBackContent.slice(0, 300) + '...');
  }

  console.log();
  console.log('='.repeat(60));
  console.log('Demo completed!');
  console.log('='.repeat(60));
}

// 运行 Demo
if (require.main === module) {
  runDemo().catch(console.error);
}

export {
  CodeEvolver,
  SafeModifier,
  BackupManager,
  ImpactAnalyzer,
  ImprovementSuggester,
  CodeModification,
  ModificationResult,
  BackupRecord,
  ImpactAnalysis
};
