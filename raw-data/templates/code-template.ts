// ============================================================================
// Code Template: TypeScript Module
// ============================================================================
//
// 这是一个 TypeScript 模块的模板文件，可以作为 AI 生成代码的参考。
// ============================================================================

/**
 * 模块描述
 * 说明这个模块的功能和用途
 */

export interface Config {
  /** 配置选项 1 */
  option1: string;
  /** 配置选项 2 */
  option2: number;
  /** 可选配置 */
  option3?: boolean;
}

/**
 * 类描述
 * 说明这个类的用途
 */
export class ExampleClass {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * 方法描述
   * @param input 输入参数
   * @returns 返回值说明
   */
  public async doSomething(input: string): Promise<string> {
    // 实现代码
    return `Processed: ${input}`;
  }
}

/**
 * 工具函数描述
 */
export function utilityFunction(value: number): number {
  return value * 2;
}
