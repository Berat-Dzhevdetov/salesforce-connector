import { Model } from './Model';
import { ModelData } from '../types';

/**
 * Proxy handler for lazy loading relationships
 * Intercepts property access and loads the related record if not already loaded
 */
export class RelationshipProxy<T extends ModelData> {
  private loaded: boolean = false;
  private data: Partial<T> | null = null;
  private loading: Promise<void> | null = null;

  constructor(
    private parentModel: Model,
    private relationshipName: string,
    private foreignKeyField: string,
    private relatedModelClass: new (data?: any) => Model<T>,
    private preloadedData?: Partial<T>
  ) {
    // If data was preloaded from a query (e.g., User.Name was selected), use it
    if (preloadedData && Object.keys(preloadedData).length > 0) {
      this.data = preloadedData;
      this.loaded = true;
    }
  }

  /**
   * Load the related record from Salesforce
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
        const foreignKeyValue = this.parentModel.get(this.foreignKeyField);

        if (!foreignKeyValue) {
          this.data = null;
          this.loaded = true;
          return;
        }

        // Load the full record
        const relatedRecord = await this.relatedModelClass.prototype.constructor.find(foreignKeyValue);

        if (relatedRecord) {
          this.data = relatedRecord.getData();
        } else {
          this.data = null;
        }

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
   * Create a Proxy that intercepts property access
   */
  public createProxy(): T | null {
    const self = this;

    return new Proxy({} as T, {
      get(target, prop: string | symbol) {
        // Handle typeof checks and other special cases
        if (prop === Symbol.toStringTag) {
          return 'RelationshipProxy';
        }

        if (prop === 'then') {
          // Make it non-thenable so it doesn't get awaited accidentally
          return undefined;
        }

        // For property access, trigger lazy load
        if (typeof prop === 'string') {
          // Check if already loaded
          if (self.loaded && self.data) {
            return self.data[prop as keyof T];
          }

          // If data was partially loaded (e.g., only Name was selected), return that
          if (self.loaded && self.data === null) {
            return undefined;
          }

          // Trigger lazy load - this will be synchronous for the first access
          // We throw a promise that needs to be awaited
          throw new Error(
            `Relationship '${self.relationshipName}' is not loaded. ` +
            `Access it asynchronously using: await journal.load${self.relationshipName}() ` +
            `or eager load it in your query: .select('Id', 'Name', '${self.relationshipName}.${prop}')`
          );
        }

        return undefined;
      },

      has(target, prop) {
        if (self.loaded && self.data) {
          return prop in self.data;
        }
        return false;
      },

      ownKeys(target) {
        if (self.loaded && self.data) {
          return Reflect.ownKeys(self.data);
        }
        return [];
      },

      getOwnPropertyDescriptor(target, prop) {
        if (self.loaded && self.data && prop in self.data) {
          return {
            enumerable: true,
            configurable: true,
            value: self.data[prop as keyof T],
          };
        }
        return undefined;
      },
    }) as T | null;
  }

  /**
   * Manually load the relationship
   */
  public async load(): Promise<T | null> {
    await this.loadRelationship();
    return this.data as T | null;
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
  public getData(): Partial<T> | null {
    return this.data;
  }
}
