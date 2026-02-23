/**
 * ACE (Agentic Context Engineering) - PoC
 * 
 * 演示如何通过增量更新系统提示词来改进 Agent
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

interface PromptSection {
  name: string;
  content: string;
  priority: number;
  mutable: boolean;
}

interface PromptTemplate {
  id: string;
  version: string;
  category: 'system' | 'task' | 'tool' | 'error_handling';
  sections: PromptSection[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    performanceScore: number;
    usageCount: number;
  };
}

interface TaskExperience {
  taskId: string;
  taskDescription: string;
  actions: string[];
  outcome: 'success' | 'failure' | 'partial';
  lessons: string[];
  timestamp: Date;
}

interface PromptUpdate {
  targetSection: string;
  updateType: 'append' | 'prepend' | 'replace';
  newContent: string;
  confidence: number;
  reason: string;
}

interface EvaluationResult {
  promptId: string;
  score: number;
  improvements: string[];
  regressions: string[];
}

// ============================================================================
// Prompt Manager
// ============================================================================

class PromptManager {
  private templates: Map<string, PromptTemplate> = new Map();
  private storagePath: string;

  constructor(storagePath: string = './prompts') {
    this.storagePath = storagePath;
    this.loadTemplates();
  }

  /**
   * 获取当前 Prompt
   */
  getPrompt(taskType: string): string {
    const template = this.templates.get('system-main');
    if (!template) {
      return this.getDefaultPrompt();
    }

    // 按 priority 排序
    const sortedSections = [...template.sections].sort((a, b) => b.priority - a.priority);
    
    // 组装 Prompt
    return sortedSections
      .map(s => `## ${s.name}\n${s.content}`)
      .join('\n\n');
  }

  /**
   * 更新 Prompt 模板
   */
  updateTemplate(sectionName: string, newContent: string): void {
    const template = this.templates.get('system-main');
    if (!template) return;

    const section = template.sections.find(s => s.name === sectionName);
    if (section && section.mutable) {
      section.content = newContent;
      template.metadata.updatedAt = new Date();
      this.saveTemplates();
      console.log(`✅ Updated section: ${sectionName}`);
    } else {
      console.log(`⚠️ Section ${sectionName} is not mutable or not found`);
    }
  }

  /**
   * 应用 Prompt 更新
   */
  applyUpdate(update: PromptUpdate): void {
    const template = this.templates.get('system-main');
    if (!template) return;

    const section = template.sections.find(s => s.name === update.targetSection);
    if (!section) {
      // 创建新 section
      template.sections.push({
        name: update.targetSection,
        content: update.newContent,
        priority: 5,
        mutable: true
      });
    } else {
      switch (update.updateType) {
        case 'append':
          section.content += '\n\n' + update.newContent;
          break;
        case 'prepend':
          section.content = update.newContent + '\n\n' + section.content;
          break;
        case 'replace':
          section.content = update.newContent;
          break;
      }
    }

    // 更新版本号
    const [major, minor, patch] = template.version.split('.').map(Number);
    template.version = `${major}.${minor}.${patch + 1}`;
    template.metadata.updatedAt = new Date();

    this.saveTemplates();
    console.log(`✅ Applied update to section: ${update.targetSection}`);
  }

  /**
   * 加载模板
   */
  private loadTemplates(): void {
    const templatePath = path.join(this.storagePath, 'templates.json');
    if (fs.existsSync(templatePath)) {
      const data = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
      data.forEach((t: PromptTemplate) => {
        this.templates.set(t.id, t);
      });
    } else {
      // 创建默认模板
      this.createDefaultTemplate();
    }
  }

  /**
   * 保存模板
   */
  private saveTemplates(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
    const data = Array.from(this.templates.values());
    fs.writeFileSync(
      path.join(this.storagePath, 'templates.json'),
      JSON.stringify(data, null, 2)
    );
  }

  /**
   * 创建默认模板
   */
  private createDefaultTemplate(): void {
    const defaultTemplate: PromptTemplate = {
      id: 'system-main',
      version: '1.0.0',
      category: 'system',
      sections: [
        {
          name: 'identity',
          content: 'You are SWE-Agent-Node, an AI software engineering assistant.',
          priority: 10,
          mutable: false
        },
        {
          name: 'capabilities',
          content: `You can:
- Analyze code repositories
- Fix bugs and issues
- Generate tests
- Refactor code`,
          priority: 8,
          mutable: false
        },
        {
          name: 'learned_patterns',
          content: '',
          priority: 5,
          mutable: true
        },
        {
          name: 'error_handling',
          content: 'When encountering errors, analyze the root cause before proposing solutions.',
          priority: 6,
          mutable: true
        }
      ],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        performanceScore: 0.5,
        usageCount: 0
      }
    };

    this.templates.set('system-main', defaultTemplate);
    this.saveTemplates();
  }

  /**
   * 获取默认 Prompt
   */
  private getDefaultPrompt(): string {
    return `You are SWE-Agent-Node, an AI software engineering assistant.

You can:
- Analyze code repositories
- Fix bugs and issues
- Generate tests
- Refactor code`;
  }
}

// ============================================================================
// Experience Collector
// ============================================================================

class ExperienceCollector {
  private experiences: TaskExperience[] = [];
  private storagePath: string;

  constructor(storagePath: string = './experiences') {
    this.storagePath = storagePath;
    this.loadExperiences();
  }

  /**
   * 记录经验
   */
  recordExperience(experience: TaskExperience): void {
    this.experiences.push(experience);
    this.saveExperiences();
    console.log(`📝 Recorded experience: ${experience.taskId} (${experience.outcome})`);
  }

  /**
   * 获取相关经验
   */
  getRelevantExperience(taskDescription: string, limit: number = 5): TaskExperience[] {
    // 简单的关键词匹配
    const keywords = taskDescription.toLowerCase().split(/\s+/);
    
    return this.experiences
      .filter(exp => {
        const text = (exp.taskDescription + ' ' + exp.lessons.join(' ')).toLowerCase();
        return keywords.some(kw => text.includes(kw));
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * 分析成功模式
   */
  analyzeSuccessPatterns(): string[] {
    const successExperiences = this.experiences.filter(e => e.outcome === 'success');
    const patterns: string[] = [];

    // 提取常见教训
    const lessonCounts = new Map<string, number>();
    successExperiences.forEach(exp => {
      exp.lessons.forEach(lesson => {
        lessonCounts.set(lesson, (lessonCounts.get(lesson) || 0) + 1);
      });
    });

    // 返回出现频率 > 2 的模式
    lessonCounts.forEach((count, lesson) => {
      if (count >= 2) {
        patterns.push(lesson);
      }
    });

    return patterns;
  }

  private loadExperiences(): void {
    const expPath = path.join(this.storagePath, 'experiences.json');
    if (fs.existsSync(expPath)) {
      const data = JSON.parse(fs.readFileSync(expPath, 'utf-8'));
      this.experiences = data.map((e: any) => ({
        ...e,
        timestamp: new Date(e.timestamp)
      }));
    }
  }

  private saveExperiences(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
    fs.writeFileSync(
      path.join(this.storagePath, 'experiences.json'),
      JSON.stringify(this.experiences, null, 2)
    );
  }
}

// ============================================================================
// Prompt Evaluator
// ============================================================================

class PromptEvaluator {
  /**
   * 评估 Prompt 效果
   */
  evaluate(promptId: string, experiences: TaskExperience[]): EvaluationResult {
    const recentExperiences = experiences.slice(-100); // 最近 100 个任务
    const successCount = recentExperiences.filter(e => e.outcome === 'success').length;
    const score = recentExperiences.length > 0 ? successCount / recentExperiences.length : 0;

    // 分析改进和退化
    const improvements: string[] = [];
    const regressions: string[] = [];

    // 比较前 50 和后 50
    const firstHalf = recentExperiences.slice(0, 50);
    const secondHalf = recentExperiences.slice(50);

    if (firstHalf.length > 0 && secondHalf.length > 0) {
      const firstRate = firstHalf.filter(e => e.outcome === 'success').length / firstHalf.length;
      const secondRate = secondHalf.filter(e => e.outcome === 'success').length / secondHalf.length;

      if (secondRate > firstRate) {
        improvements.push(`Success rate improved from ${(firstRate * 100).toFixed(1)}% to ${(secondRate * 100).toFixed(1)}%`);
      } else if (secondRate < firstRate) {
        regressions.push(`Success rate dropped from ${(firstRate * 100).toFixed(1)}% to ${(secondRate * 100).toFixed(1)}%`);
      }
    }

    return {
      promptId,
      score,
      improvements,
      regressions
    };
  }
}

// ============================================================================
// Prompt Evolver
// ============================================================================

class PromptEvolver {
  private promptManager: PromptManager;
  private experienceCollector: ExperienceCollector;
  private evaluator: PromptEvaluator;

  constructor(storagePath: string = './ace-storage') {
    this.promptManager = new PromptManager(path.join(storagePath, 'prompts'));
    this.experienceCollector = new ExperienceCollector(path.join(storagePath, 'experiences'));
    this.evaluator = new PromptEvaluator();
  }

  /**
   * 从经验中进化 Prompt
   */
  async evolveFromExperience(experience: TaskExperience): Promise<PromptUpdate | null> {
    // 记录经验
    this.experienceCollector.recordExperience(experience);

    // 只在成功经验时考虑进化
    if (experience.outcome !== 'success') {
      return null;
    }

    // 分析是否值得更新 Prompt
    const lessons = experience.lessons;
    if (lessons.length === 0) {
      return null;
    }

    // 生成更新
    const update: PromptUpdate = {
      targetSection: 'learned_patterns',
      updateType: 'append',
      newContent: this.formatLessons(lessons),
      confidence: 0.7,
      reason: `Learned from successful task: ${experience.taskDescription.slice(0, 50)}...`
    };

    return update;
  }

  /**
   * 格式化学到的教训
   */
  private formatLessons(lessons: string[]): string {
    if (lessons.length === 1) {
      return `- ${lessons[0]}`;
    }
    return lessons.map(l => `- ${l}`).join('\n');
  }

  /**
   * 应用进化
   */
  async applyEvolution(update: PromptUpdate): Promise<boolean> {
    // 简单的置信度阈值
    if (update.confidence < 0.6) {
      console.log(`⚠️ Update confidence too low: ${update.confidence}`);
      return false;
    }

    this.promptManager.applyUpdate(update);
    return true;
  }

  /**
   * 运行评估
   */
  evaluateCurrentPrompt(): EvaluationResult {
    const experiences = this.experienceCollector.getRelevantExperience('', 100);
    return this.evaluator.evaluate('system-main', experiences);
  }

  /**
   * 获取当前 Prompt
   */
  getCurrentPrompt(): string {
    return this.promptManager.getPrompt('system-main');
  }
}

// ============================================================================
// Demo
// ============================================================================

async function runDemo() {
  console.log('='.repeat(60));
  console.log('ACE (Agentic Context Engineering) - PoC Demo');
  console.log('='.repeat(60));
  console.log();

  // 创建 Evolver
  const evolver = new PromptEvolver('./ace-storage');

  // 1. 显示初始 Prompt
  console.log('1. Initial Prompt:');
  console.log('-'.repeat(40));
  console.log(evolver.getCurrentPrompt());
  console.log();

  // 2. 模拟任务经验
  const experience1: TaskExperience = {
    taskId: 'task-001',
    taskDescription: 'Fix timeout issue in file upload handler',
    actions: ['analyze code', 'identify bottleneck', 'add retry logic'],
    outcome: 'success',
    lessons: [
      'For timeout issues, always add exponential backoff retry',
      'Check network conditions before assuming server fault'
    ],
    timestamp: new Date()
  };

  const experience2: TaskExperience = {
    taskId: 'task-002',
    taskDescription: 'Fix memory leak in event handler',
    actions: ['profile memory', 'find unclosed connections', 'add cleanup'],
    outcome: 'success',
    lessons: [
      'Always clean up event listeners when component unmounts',
      'Use weak references for long-lived event handlers'
    ],
    timestamp: new Date()
  };

  // 3. 从经验中学习
  console.log('2. Learning from experiences...');
  console.log('-'.repeat(40));

  for (const exp of [experience1, experience2]) {
    const update = await evolver.evolveFromExperience(exp);
    if (update) {
      console.log(`Learned from: ${exp.taskDescription}`);
      console.log(`Update: ${update.newContent.slice(0, 50)}...`);
      await evolver.applyEvolution(update);
    }
  }
  console.log();

  // 4. 显示更新后的 Prompt
  console.log('3. Updated Prompt:');
  console.log('-'.repeat(40));
  console.log(evolver.getCurrentPrompt());
  console.log();

  // 5. 评估效果
  console.log('4. Evaluation:');
  console.log('-'.repeat(40));
  const evaluation = evolver.evaluateCurrentPrompt();
  console.log(`Score: ${(evaluation.score * 100).toFixed(1)}%`);
  console.log(`Improvements: ${evaluation.improvements.join(', ') || 'None'}`);
  console.log(`Regressions: ${evaluation.regressions.join(', ') || 'None'}`);
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
  PromptManager,
  ExperienceCollector,
  PromptEvaluator,
  PromptEvolver,
  TaskExperience,
  PromptUpdate,
  EvaluationResult
};
