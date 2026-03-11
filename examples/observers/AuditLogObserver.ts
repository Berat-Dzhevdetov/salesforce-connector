import { Observer } from '../../core/Observer';
import { Model } from '../../core/Model';
import { ModelData } from '../../types';

/**
 * Example Observer: Audit Log Observer
 *
 * Logs all CRUD operations for audit trail purposes.
 * This observer can be registered on multiple models to track all changes.
 *
 * @example
 * ```typescript
 * import { Account, Contact } from './models';
 * import { AuditLogObserver } from './observers/AuditLogObserver';
 *
 * const auditLogger = new AuditLogObserver();
 * Account.observe(auditLogger);
 * Contact.observe(auditLogger);
 * ```
 */
export class AuditLogObserver<T extends Model> implements Observer<T> {
  private logAction(action: string, instance: T, details?: any): void {
    const modelName = (instance.constructor as any).getObjectName();
    const id = instance.getId();
    const timestamp = new Date().toISOString();

    console.log(JSON.stringify({
      timestamp,
      action,
      model: modelName,
      recordId: id,
      details
    }));
  }

  async afterCreate(instance: T): Promise<void> {
    this.logAction('CREATE', instance, {
      data: instance.getData()
    });
  }

  async afterUpdate(instance: T, changes: Partial<ModelData>): Promise<void> {
    this.logAction('UPDATE', instance, {
      changes
    });
  }

  async afterDelete(instance: T): Promise<void> {
    this.logAction('DELETE', instance, {
      deletedData: instance.getData()
    });
  }
}
