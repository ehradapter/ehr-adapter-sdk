import {
  DataProcessor,
  ProcessingContext,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './types';
import { LoggerInterface } from '../../src/logging/LoggerInterface';

/**
 * Data Transformation Pipeline
 * Manages the execution of data processors in a configurable pipeline
 */
export class TransformationPipeline {
  private processors: Map<string, DataProcessor> = new Map();
  private logger: LoggerInterface;

  public constructor(logger: LoggerInterface) {
    this.logger = logger;
  }

  /**
   * Register a data processor
   */
  public registerProcessor(processor: DataProcessor): void {
    this.validateProcessor(processor);
    this.processors.set(processor.name, processor);

    this.logger.info(`Data processor registered: ${processor.name}`, {
      processor: processor.name,
      version: processor.version,
      type: processor.type,
      priority: processor.priority ?? 0,
    });
  }

  /**
   * Unregister a data processor
   */
  public unregisterProcessor(processorName: string): void {
    if (this.processors.delete(processorName)) {
      this.logger.info(`Data processor unregistered: ${processorName}`);
    } else {
      this.logger.warn(`Attempted to unregister non-existent processor: ${processorName}`);
    }
  }

  /**
   * Process data through the pipeline
   */
  public async processData<T>(
    data: T,
    context: ProcessingContext,
    processorType: 'PRE_PROCESS' | 'POST_PROCESS' | 'TRANSFORM' | 'VALIDATE'
  ): Promise<T> {
    const applicableProcessors = this.getProcessorsForType(processorType);
    let result = data;

    this.logger.debug(`Starting ${processorType} pipeline`, {
      processorCount: applicableProcessors.length,
      resourceType: context.resourceType,
      operation: context.operation,
    });

    for (const processor of applicableProcessors) {
      if (processor.enabled === false) {
        continue;
      }

      try {
        const startTime = Date.now();
        result = await processor.process(result, context);
        const duration = Date.now() - startTime;

        this.logger.debug(`Processor executed: ${processor.name}`, {
          processor: processor.name,
          duration,
          type: processor.type,
        });
      } catch (error) {
        this.logger.error(`Processor failed: ${processor.name}`, {
          processor: processor.name,
          error,
          context: {
            resourceType: context.resourceType,
            operation: context.operation,
            requestId: context.requestId,
          },
        });
        throw error;
      }
    }

    this.logger.debug(`Completed ${processorType} pipeline`, {
      processorCount: applicableProcessors.length,
    });

    return result;
  }

  /**
   * Validate data using validation processors
   */
  public async validateData<T>(data: T, context: ProcessingContext): Promise<ValidationResult> {
    const validators = this.getProcessorsForType('VALIDATE');
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationWarning[] = [];

    for (const validator of validators) {
      if (validator.enabled === false || !validator.validate) {
        continue;
      }

      try {
        const result = await validator.validate(data, context);
        allErrors.push(...result.errors);
        allWarnings.push(...result.warnings);
      } catch (error) {
        this.logger.error(`Validator failed: ${validator.name}`, {
          validator: validator.name,
          error,
        });

        allErrors.push({
          field: 'validation',
          message: `Validator ${validator.name} failed: ${String(error)}`,
          code: 'VALIDATOR_ERROR',
          value: undefined,
        });
      }
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  /**
   * Get processors for a specific type, sorted by priority
   */
  private getProcessorsForType(
    type: 'PRE_PROCESS' | 'POST_PROCESS' | 'TRANSFORM' | 'VALIDATE'
  ): DataProcessor[] {
    return Array.from(this.processors.values())
      .filter(processor => processor.type === type)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }

  /**
   * Validate processor structure
   */
  private validateProcessor(processor: DataProcessor): void {
    if (!processor.name) {
      throw new Error('Processor must have a name');
    }

    if (!processor.version) {
      throw new Error('Processor must have a version');
    }

    if (!processor.type) {
      throw new Error('Processor must have a type');
    }

    if (!['PRE_PROCESS', 'POST_PROCESS', 'TRANSFORM', 'VALIDATE'].includes(processor.type)) {
      throw new Error(`Invalid processor type: ${processor.type}`);
    }

    if (this.processors.has(processor.name)) {
      throw new Error(`Processor already registered: ${processor.name}`);
    }

    if (typeof processor.process !== 'function') {
      throw new Error('Processor must have a process function');
    }
  }

  /**
   * Get all registered processors
   */
  public getProcessors(): DataProcessor[] {
    return Array.from(this.processors.values());
  }

  /**
   * Get processor by name
   */
  public getProcessor(name: string): DataProcessor | undefined {
    return this.processors.get(name);
  }

  /**
   * Get processors by type
   */
  public getProcessorsByType(
    type: 'PRE_PROCESS' | 'POST_PROCESS' | 'TRANSFORM' | 'VALIDATE'
  ): DataProcessor[] {
    return this.getProcessorsForType(type);
  }

  /**
   * Get pipeline statistics
   */
  public getStats(): {
    totalProcessors: number;
    processorsByType: Record<string, number>;
    enabledProcessors: number;
    disabledProcessors: number;
  } {
    const processors = Array.from(this.processors.values());
    const processorsByType: Record<string, number> = {};

    processors.forEach(processor => {
      processorsByType[processor.type] = (processorsByType[processor.type] ?? 0) + 1;
    });

    return {
      totalProcessors: processors.length,
      processorsByType,
      enabledProcessors: processors.filter(p => p.enabled !== false).length,
      disabledProcessors: processors.filter(p => p.enabled === false).length,
    };
  }

  /**
   * Clear all processors
   */
  public clear(): void {
    const count = this.processors.size;
    this.processors.clear();
    this.logger.info(`Cleared all processors`, { count });
  }
}
