import { Model } from './Model';
import { ModelData } from '../types';

/**
 * Proxy handler for lazy loading has-many relationships (child relationships)
 * Handles collections of related records (e.g., User has many TransactionJournals)
 */
export class HasManyProxy<T extends ModelData> {
  private loaded: boolean = false;
  private data: T[] = [];
  private loading: Promise<void> | null = null;

  constructor(
    private parentModel: Model,
    private relationshipName: string,
    private foreignKeyField: string,
    private relatedModelClass: new (data?: any) => Model<T>,
    private preloadedData?: { records: T[] }
  ) {
    // If data was preloaded from a subquery, use it
    if (preloadedData?.records && Array.isArray(preloadedData.records)) {
      this.data = preloadedData.records;
      this.loaded = true;
    }
  }

  /**
   * Load the related records from Salesforce
   */
  private async loadRelationship(): Promise<void> {
    // If already loaded or currently loading, return
    if (this.loaded || this.loading) {
      if (this.loading) {
        await this.loading;
      }
      return;
    }

    // Start loading
    this.loading = (async () => {
      try {
        const parentId = this.parentModel.getId();

        if (!parentId) {
          this.data = [];
          this.loaded = true;
          return;
        }

        // Query related records where foreignKeyField equals parentId
        const ModelClass = this.relatedModelClass as any;
        const relatedRecords = await ModelClass.where(this.foreignKeyField, parentId).get();

        this.data = relatedRecords.map((record: Model<T>) => record.getData() as T);
        this.loaded = true;
      } catch (error) {
        this.loaded = true;
        throw error;
      } finally {
        this.loading = null;
      }
    })();

    await this.loading;
  }

  /**
   * Create a Proxy that intercepts array access
   */
  public createProxy(): T[] {
    const self = this;

    // Return a Proxy around an array
    return new Proxy([] as T[], {
      get(target, prop: string | symbol) {
        // Handle typeof checks and other special cases
        if (prop === Symbol.toStringTag) {
          return 'HasManyProxy';
        }

        if (prop === 'then') {
          // Make it non-thenable so it doesn't get awaited accidentally
          return undefined;
        }

        // Handle array methods and properties
        if (typeof prop === 'string') {
          // Check if already loaded
          if (self.loaded) {
            const arrayProp = (self.data as any)[prop];
            if (typeof arrayProp === 'function') {
              // Bind array methods to the data array
              return (arrayProp as Function).bind(self.data);
            }
            return arrayProp;
          }

          // If not loaded, throw error
          throw new Error(
            `Relationship '${self.relationshipName}' is not loaded. ` +
            `Access it asynchronously using: await ${self.parentModel.constructor.name.toLowerCase()}.load${self.relationshipName}() ` +
            `or eager load it in your query with a subquery`
          );
        }

        return undefined;
      },

      has(target, prop) {
        if (self.loaded) {
          return prop in self.data;
        }
        return false;
      },

      ownKeys(target) {
        if (self.loaded) {
          return Reflect.ownKeys(self.data);
        }
        return [];
      },

      getOwnPropertyDescriptor(target, prop) {
        if (self.loaded && prop in self.data) {
          return Object.getOwnPropertyDescriptor(self.data, prop);
        }
        return undefined;
      },
    }) as T[];
  }

  /**
   * Manually load the relationship
   */
  public async load(): Promise<T[]> {
    await this.loadRelationship();
    return this.data;
  }

  /**
   * Check if the relationship is loaded
   */
  public isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Get the raw data (if loaded)
   */
  public getData(): T[] {
    return this.data;
  }
}
