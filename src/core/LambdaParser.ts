import { Project, SyntaxKind, Node, PropertyAccessExpression } from 'ts-morph';
import inspector from 'node:inspector';

type Operator = "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE";

interface LeafCondition {
  kind: "leaf";
  field: string;
  operator: Operator;
  value: unknown;
}

interface GroupCondition {
  kind: "group";
  logic: "AND" | "OR";
  conditions: ConditionNode[];
}

type ConditionNode = LeafCondition | GroupCondition;

/**
 * Parses lambda expressions into Salesforce SOQL queries with full closure variable support.
 *
 * Capabilities:
 * - Field selection with nested properties (x.BillingAddress.Street)
 * - WHERE clauses with closure variables (x.Industry === industryVar)
 * - Subqueries with closure support in filters
 * - String methods (includes, startsWith, endsWith) → LIKE clauses
 *
 * Closure variables work with:
 * - Simple variables: const industry = 'Tech'
 * - Object properties: config.industry
 * - Nested properties: filters.account.industry
 *
 * Technical: Uses TypeScript AST (ts-morph) for parsing and Node.js Inspector
 * Protocol for closure variable extraction at runtime.
 */
export class LambdaParser {
  private project: Project;
  // Store captured WHERE functions from subqueries for closure variable access
  private capturedWhereFunctions: Map<string, Function> = new Map();

  constructor() {
    this.project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 99, // ESNext
        strict: false
      },
    });
  }

  /**
   * Parses a selector lambda and returns a mapping of aliases to field paths.
   * Also captures subquery WHERE functions to preserve closure variable context.
   *
   * Examples:
   * - Simple fields: (x) => ({ Name: x.Name, Street: x.Address.Street })
   *   Returns: { Name: "Name", Street: "Address.Street" }
   *
   * - Subqueries: (x) => ({ Contacts: x.Contacts.select(c => ({ Name: c.Name })) })
   *   Returns: { Contacts: "(SELECT Name FROM Contacts)" }
   *
   * - Subqueries with closures: (x) => ({ ... x.Contacts.where(c => c.Active === activeVar) ... })
   *   Captures WHERE function to preserve closure access
   */
  parseSelector<T, R>(fn: (x: T) => R): Record<keyof R, string> {
    // First, capture WHERE functions from subqueries by executing with proxy
    this.captureSubqueryWhereFunctions(fn);

    const fnString = fn.toString();

    const sourceFile = this.project.createSourceFile(
      `temp-${Date.now()}.ts`,
      `const tempFn = ${fnString}`,
      { overwrite: true }
    );

    try {
      const arrowFunction = sourceFile
        .getVariableDeclaration('tempFn')
        ?.getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);

      if (!arrowFunction) {
        throw new Error('Could not find arrow function');
      }

      const parameter = arrowFunction.getParameters()[0];
      if (!parameter) {
        throw new Error('Arrow function must have a parameter');
      }
      const paramName = parameter.getName();

      const body = arrowFunction.getBody();

      let expression;
      if (Node.isParenthesizedExpression(body)) {
        expression = body.getExpression();
      } else if (Node.isBlock(body)) {
        const returnStatement = body.getStatements()[0];
        if (Node.isReturnStatement(returnStatement)) {
          expression = returnStatement.getExpression();
        }
      } else {
        expression = body;
      }

      if (!expression) {
        throw new Error('Could not extract lambda body expression');
      }

      if (Node.isObjectLiteralExpression(expression)) {
        const result: Record<string, string> = {};

        for (const property of expression.getProperties()) {
          if (!Node.isPropertyAssignment(property)) {
            continue;
          }

          const propertyName = property.getName();
          const initializer = property.getInitializer();

          if (!initializer) {
            continue;
          }

          const propertyPath = this.extractPropertyPath(initializer, paramName);
          result[propertyName] = propertyPath;
        }

        return result as Record<keyof R, string>;
      } else if (Node.isPropertyAccessExpression(expression)) {
        const propertyPath = this.extractPropertyAccessChain(expression, paramName);
        const propertyName = propertyPath.split('.').pop() || propertyPath;
        return { [propertyName]: propertyPath } as Record<keyof R, string>;
      } else {
        throw new Error('Lambda body must return an object literal or property access');
      }
    } finally {
      this.project.removeSourceFile(sourceFile);
    }
  }

  /**
   * Parses a selector from a Node (used for nested selects)
   */
  parseSelectorFromNode(arrowFunction: Node): Record<string, string> {
    if (!Node.isArrowFunction(arrowFunction)) {
      return {};
    }

    const parameter = arrowFunction.getParameters()[0];
    if (!parameter) return {};
    const paramName = parameter.getName();

    const body = arrowFunction.getBody();
    let expression;

    if (Node.isParenthesizedExpression(body)) {
      expression = body.getExpression();
    } else if (Node.isBlock(body)) {
      const returnStatement = body.getStatements()[0];
      if (Node.isReturnStatement(returnStatement)) {
        expression = returnStatement.getExpression();
      }
    } else {
      expression = body;
    }

    if (!expression) return {};

    if (Node.isObjectLiteralExpression(expression)) {
      const result: Record<string, string> = {};

      for (const property of expression.getProperties()) {
        if (!Node.isPropertyAssignment(property)) {
          continue;
        }

        const propertyName = property.getName();
        const initializer = property.getInitializer();

        if (!initializer) {
          continue;
        }

        const propertyPath = this.extractPropertyPath(initializer, paramName);
        result[propertyName] = propertyPath;
      }

      return result;
    } else if (Node.isPropertyAccessExpression(expression)) {
      const propertyPath = this.extractPropertyAccessChain(expression, paramName);
      const propertyName = propertyPath.split('.').pop() || propertyPath;
      return { [propertyName]: propertyPath };
    }

    return {};
  }

  /**
   * Parses a WHERE condition lambda into a SOQL WHERE clause.
   *
   * Supports:
   * - Literal values: x.Industry === 'Technology'
   * - Closure variables: x.Industry === industryVar
   * - Object properties: x.Revenue > config.minRevenue
   * - Nested properties: x.City === filters.location.city
   * - String methods: x.Name.includes('Acme')
   * - Complex logic: (x.A === 'X' || x.B === 'Y') && x.C > 100
   *
   * Closure variables are extracted at runtime using Node.js Inspector API.
   *
   * @throws Error if the lambda cannot be parsed
   */
  parseWhere<T = any>(fn: (x: T) => boolean): string {
    try {
      const conditionTree = this.buildConditionTree(fn);
      return this.conditionToSOQL(conditionTree);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse WHERE condition: ${errorMessage}`);
    }
  }

  /**
   * Parses WHERE condition from an AST Node (used for subqueries).
   *
   * First attempts to use captured WHERE function (preserves closure context),
   * falls back to AST-only parsing if unavailable (no closure support).
   *
   * @param relationshipName - Used to lookup captured WHERE function
   */
  parseWhereFromNode(arrowFunction: Node, relationshipName?: string): string {
    if (!Node.isArrowFunction(arrowFunction)) {
      return '';
    }

    // Try to get the captured WHERE function with closure context
    if (relationshipName) {
      const key = `${relationshipName}_where`;
      const capturedFn = this.capturedWhereFunctions.get(key);
      if (capturedFn) {
        return this.parseWhere(capturedFn as any);
      }
    }

    // Fallback to AST-based parsing (won't support closure variables)
    const parameter = arrowFunction.getParameters()[0];
    if (!parameter) return '';
    const paramName = parameter.getName();

    const body = arrowFunction.getBody();
    let expression;

    if (Node.isBlock(body)) {
      const returnStatement = body.getStatements()[0];
      if (Node.isReturnStatement(returnStatement)) {
        expression = returnStatement.getExpression();
      }
    } else {
      expression = body;
    }

    if (!expression) return '';

    return this.convertToSOQL(expression, paramName);
  }

  /**
   * Extracts property path from a node, handling subqueries
   */
  private extractPropertyPath(node: Node, paramName: string): string {
    if (Node.isPropertyAccessExpression(node)) {
      return this.extractPropertyAccessChain(node, paramName);
    }

    if (Node.isCallExpression(node)) {
      const fullChain = this.collectMethodChain(node);
      const selectCall = fullChain.find(c => c.methodName === 'select');

      if (selectCall) {
        return this.buildSubqueryFromChain(fullChain, paramName);
      }
    }

    return node.getText();
  }

  /**
   * Extracts a property access chain (e.g., x.Address.Street -> "Address.Street")
   */
  private extractPropertyAccessChain(node: PropertyAccessExpression, paramName: string): string {
    const parts: string[] = [];
    let current: Node = node;

    while (Node.isPropertyAccessExpression(current)) {
      parts.unshift(current.getName());
      current = current.getExpression();
    }

    if (Node.isIdentifier(current) && current.getText() === paramName) {
      return parts.join('.');
    }

    return node.getText();
  }

  /**
   * Collects all chained method calls (e.g., x.Contacts.select(...).where(...).limit(...))
   */
  private collectMethodChain(node: Node): Array<{ methodName: string; args: Node[]; expression: Node }> {
    const chain = [];
    let currentNode = node;

    while (Node.isCallExpression(currentNode)) {
      const expression = currentNode.getExpression();
      if (!Node.isPropertyAccessExpression(expression)) {
        break;
      }

      chain.unshift({
        methodName: expression.getName(),
        args: currentNode.getArguments(),
        expression: expression.getExpression()
      });

      currentNode = expression.getExpression();
    }

    return chain;
  }

  /**
   * Builds a complete SOQL subquery from a method chain
   */
  private buildSubqueryFromChain(
    chain: Array<{ methodName: string; args: Node[]; expression: Node }>,
    paramName: string
  ): string {
    const selectIndex = chain.findIndex(c => c.methodName === 'select');
    if (selectIndex === -1) return '';

    const selectCall = chain[selectIndex];

    let relationshipName = '';
    if (Node.isPropertyAccessExpression(selectCall.expression)) {
      relationshipName = this.extractPropertyAccessChain(
        selectCall.expression as PropertyAccessExpression,
        paramName
      );
    }

    let fields: string[] = [];
    if (selectCall.args.length > 0 && Node.isArrowFunction(selectCall.args[0])) {
      fields = this.parseNestedSelect(selectCall.args[0]);
    }

    if (fields.length === 0) {
      fields = ['Id'];
    }

    const fieldsList = fields.join(', ');
    let soql = `SELECT ${fieldsList} FROM ${relationshipName}`;

    const chainedMethods = chain.slice(selectIndex + 1);

    let whereClause = '';
    let orderByClause = '';
    let limitClause = '';
    let offsetClause = '';

    for (const method of chainedMethods) {
      if (method.methodName === 'where' && method.args.length > 0 && Node.isArrowFunction(method.args[0])) {
        const condition = this.parseWhereFromNode(method.args[0], relationshipName);
        if (whereClause) {
          whereClause += ` AND ${condition}`;
        } else {
          whereClause = condition;
        }
      } else if (method.methodName === 'orderBy' && method.args.length > 0 && Node.isArrowFunction(method.args[0])) {
        const orderByMap = this.parseSelectorFromNode(method.args[0]);
        const fieldName = Object.values(orderByMap)[0];
        const direction = method.args.length > 1 ? method.args[1].getText().replace(/['"]/g, '') : 'ASC';
        orderByClause = `ORDER BY ${fieldName} ${direction}`;
      } else if (method.methodName === 'limit' && method.args.length > 0) {
        limitClause = `LIMIT ${method.args[0].getText()}`;
      } else if (method.methodName === 'offset' && method.args.length > 0) {
        offsetClause = `OFFSET ${method.args[0].getText()}`;
      }
    }

    if (whereClause) {
      soql += ` WHERE ${whereClause}`;
    }
    if (orderByClause) {
      soql += ` ${orderByClause}`;
    }
    if (limitClause) {
      soql += ` ${limitClause}`;
    }
    if (offsetClause) {
      soql += ` ${offsetClause}`;
    }

    return `(${soql})`;
  }

  /**
   * Parses a nested select lambda and returns field names
   */
  private parseNestedSelect(arrowFunction: Node): string[] {
    if (!Node.isArrowFunction(arrowFunction)) {
      return [];
    }

    const parameter = arrowFunction.getParameters()[0];
    if (!parameter) return [];
    const nestedParamName = parameter.getName();

    const body = arrowFunction.getBody();
    let expression;

    if (Node.isParenthesizedExpression(body)) {
      expression = body.getExpression();
    } else if (Node.isBlock(body)) {
      const returnStatement = body.getStatements()[0];
      if (Node.isReturnStatement(returnStatement)) {
        expression = returnStatement.getExpression();
      }
    } else {
      expression = body;
    }

    if (!expression || !Node.isObjectLiteralExpression(expression)) {
      return [];
    }

    const fields: string[] = [];

    for (const property of expression.getProperties()) {
      if (!Node.isPropertyAssignment(property)) {
        continue;
      }

      const initializer = property.getInitializer();
      if (!initializer) {
        continue;
      }

      if (Node.isPropertyAccessExpression(initializer)) {
        const fieldPath = this.extractPropertyAccessChain(initializer, nestedParamName);
        fields.push(fieldPath);
      } else if (Node.isCallExpression(initializer)) {
        // Handle nested subqueries
        const subquerySOQL = this.extractPropertyPath(initializer, nestedParamName);
        fields.push(subquerySOQL);
      }
    }

    return fields;
  }

  /**
   * Converts a binary expression to SOQL syntax
   */
  private convertToSOQL(node: Node | undefined, paramName: string): string {
    if (!node) {
      return '';
    }

    if (Node.isBinaryExpression(node)) {
      const left = node.getLeft();
      const operator = node.getOperatorToken().getText();
      const right = node.getRight();

      if (operator === '&&') {
        return `${this.convertToSOQL(left, paramName)} AND ${this.convertToSOQL(right, paramName)}`;
      }
      if (operator === '||') {
        return `${this.convertToSOQL(left, paramName)} OR ${this.convertToSOQL(right, paramName)}`;
      }

      const leftSOQL = Node.isPropertyAccessExpression(left)
        ? this.extractPropertyAccessChain(left, paramName)
        : left.getText();

      const soqlOperator = this.convertOperator(operator);
      const rightSOQL = this.convertValue(right, paramName);

      return `${leftSOQL} ${soqlOperator} ${rightSOQL}`;
    }

    if (Node.isParenthesizedExpression(node)) {
      return `(${this.convertToSOQL(node.getExpression(), paramName)})`;
    }

    return node.getText();
  }

  /**
   * Converts JavaScript operators to SOQL operators
   */
  private convertOperator(operator: string): string {
    const operatorMap: Record<string, string> = {
      '===': '=',
      '==': '=',
      '!==': '!=',
      '!=': '!=',
      '&&': 'AND',
      '||': 'OR'
    };

    return operatorMap[operator] || operator;
  }

  /**
   * Converts JavaScript values to SOQL format
   */
  private convertValue(node: Node, paramName?: string): string {
    if (Node.isStringLiteral(node)) {
      return `'${node.getLiteralText()}'`;
    }

    if (Node.isNumericLiteral(node)) {
      // Get the actual numeric value and format it properly
      // to avoid scientific notation (e.g., 1e6 instead of 1000000)
      const value = node.getLiteralValue();
      if (Number.isInteger(value)) {
        return value.toFixed(0);
      }
      // For decimals, use standard notation
      return String(value);
    }

    const text = node.getText();
    if (text === 'true' || text === 'false') {
      return text.toUpperCase();
    }

    if (text === 'null') {
      return 'NULL';
    }

    // Check if this is an external variable reference
    if (paramName && Node.isIdentifier(node)) {
      const identifierName = node.getText();
      if (identifierName !== paramName) {
        throw new Error(
          `Cannot use external variable "${identifierName}" in where clause. `
        );
      }
    }

    // Check for property access on external variables
    if (paramName && Node.isPropertyAccessExpression(node)) {
      let current: Node = node;
      while (Node.isPropertyAccessExpression(current)) {
        current = current.getExpression();
      }

      if (Node.isIdentifier(current) && current.getText() !== paramName) {
        throw new Error(
          `Cannot use external variable "${node.getText()}" in where clause. ` +
          `Use .whereEquals(x => x.Field, ${node.getText()}) instead.`
        );
      }
    }

    return text;
  }

  // ============================================================================
  // SUBQUERY WHERE FUNCTION CAPTURE
  // ============================================================================

  /**
   * Executes the selector function with a proxy to capture WHERE functions from subqueries.
   * This preserves closure variable context for subquery filters.
   *
   * The proxy intercepts relationship access (e.g., x.Contacts.select().where())
   * and captures the WHERE function before it's converted to a string, ensuring
   * closure variables remain accessible via Inspector Protocol.
   */
  private captureSubqueryWhereFunctions<T, R>(fn: (x: T) => R): void {
    this.capturedWhereFunctions.clear();

    const proxy = new Proxy<any>({}, {
      get: (_target, relationshipName: string | symbol) => {
        if (typeof relationshipName !== 'string') return undefined;

        // Return a mock SubqueryBuilder that captures WHERE functions
        return {
          select: () => {
            const subqueryBuilder = {
              where: (whereFn: Function) => {
                // Capture the WHERE function with closure context
                const key = `${relationshipName}_where`;
                this.capturedWhereFunctions.set(key, whereFn);
                return subqueryBuilder;
              },
              orderBy: () => subqueryBuilder,
              limit: () => subqueryBuilder,
              offset: () => subqueryBuilder
            };
            return subqueryBuilder;
          }
        };
      }
    });

    try {
      fn(proxy as T);
    } catch (error) {
      // Ignore errors during proxy execution
    }
  }

  // ============================================================================
  // WHERE CLAUSE PARSING WITH CLOSURE SUPPORT
  // ============================================================================

  /**
   * Builds a condition tree from a lambda expression
   */
  private buildConditionTree<T = any>(fn: (x: T) => boolean): ConditionNode {
    const src = fn.toString();

    const sourceFile = this.project.createSourceFile(
      `temp-tree-${Date.now()}.ts`,
      `const tempFn = ${src}`,
      { overwrite: true }
    );

    try {
      const arrowFunction = sourceFile
        .getVariableDeclaration('tempFn')
        ?.getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);

      if (!arrowFunction) {
        throw new Error('Could not find arrow function');
      }

      const parameter = arrowFunction.getParameters()[0];
      if (!parameter) {
        throw new Error('Arrow function must have a parameter');
      }
      const paramName = parameter.getName();

      const body = arrowFunction.getBody();
      let expression;

      if (Node.isBlock(body)) {
        const returnStatement = body.getStatements()[0];
        if (Node.isReturnStatement(returnStatement)) {
          expression = returnStatement.getExpression();
        }
      } else {
        expression = body;
      }

      if (!expression) {
        throw new Error('Could not extract lambda body expression');
      }

      // Build the full condition tree with field names and values using ts-morph AST
      return this.buildConditionFromExpression(expression, paramName, fn);
    } finally {
      this.project.removeSourceFile(sourceFile);
    }
  }


  /**
   * Extracts the body of the lambda function
   */
  private extractBody(src: string): string {
    const arrowMatch = src.match(/=>\s*\{?\s*(?:return\s+)?([\s\S]+?)\s*;?\s*\}?$/);
    return arrowMatch ? arrowMatch[1].trim() : '';
  }


  /**
   * Attempts to capture a closure variable value using Node.js Inspector Protocol.
   *
   * Accesses the function's [[Scopes]] internal property via V8 Inspector API
   * to extract closure variable values at runtime.
   *
   * Supports:
   * - Simple variables: varName
   * - Object properties: obj.prop
   * - Nested properties: obj.nested.deep.value
   *
   * Limitations:
   * - Synchronous execution only (uses blocking Inspector calls)
   * - Returns undefined if Inspector protocol unavailable or variable not found
   * - Fails silently - no exceptions thrown
   *
   * @param varName - Variable name or property path (e.g., "config.industry")
   * @returns The variable value, or undefined if not accessible
   */
  private captureClosureValue<T = any>(fn: (x: T) => boolean, varName: string): unknown {
    try {
      if (!varName) {
        return undefined;
      }

      const session = new inspector.Session();
      session.connect();

      let result: unknown = undefined;

      // Make function available globally for inspection
      const globalKey = `__inspect_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      (global as any)[globalKey] = fn;

      try {
        // Step 1: Evaluate to get an objectId handle
        let objectId: string | undefined;
        session.post('Runtime.evaluate', {
          expression: globalKey,
          objectGroup: 'introspect'
        }, (err: Error | null, params: any) => {
          if (!err && params?.result?.objectId) {
            objectId = params.result.objectId;
          }
        });

        if (!objectId) {
          return undefined;
        }

        // Step 2: Get internal properties including [[Scopes]]
        let scopesObjectId: string | undefined;
        session.post('Runtime.getProperties', {
          objectId: objectId,
          generatePreview: true
        }, (err: Error | null, params: any) => {
          if (!err && params?.internalProperties) {
            const scopesProp = params.internalProperties.find(
              (prop: any) => prop.name === '[[Scopes]]'
            );
            if (scopesProp?.value?.objectId) {
              scopesObjectId = scopesProp.value.objectId;
            }
          }
        });

        if (!scopesObjectId) {
          return undefined;
        }

        // Step 3: Get the scopes array
        let scopeItems: any[] = [];
        session.post('Runtime.getProperties', {
          objectId: scopesObjectId,
          ownProperties: true
        }, (err: Error | null, params: any) => {
          if (!err && params?.result) {
            scopeItems = params.result;
          }
        });

        // Step 4: Search through scopes for our variable
        // Support both simple variables (varName) and object paths (obj.prop.nested)
        const varParts = varName.split('.');
        const rootVar = varParts[0];

        for (const scopeItem of scopeItems) {
          if (scopeItem.value?.objectId) {
            let foundValue: unknown = undefined;
            session.post('Runtime.getProperties', {
              objectId: scopeItem.value.objectId,
              ownProperties: true
            }, (err: Error | null, params: any) => {
              if (!err && params?.result) {
                const variable = params.result.find(
                  (v: any) => v.name === rootVar
                );
                if (variable?.value) {
                  // If it's a simple variable, extract directly
                  if (varParts.length === 1) {
                    foundValue = this.extractValueFromInspector(variable.value);
                  } else {
                    // If it's an object path, resolve the nested property
                    foundValue = this.resolveNestedProperty(session, variable.value, varParts.slice(1));
                  }
                }
              }
            });

            if (foundValue !== undefined) {
              result = foundValue;
              break;
            }
          }
        }

      } finally {
        // Clean up
        delete (global as any)[globalKey];
        session.disconnect();
      }

      return result;

    } catch (error) {
      // Inspector protocol might not be available in all environments
      // Silently fail and return undefined
      return undefined;
    }
  }

  /**
   * Extracts the actual JavaScript value from the Inspector protocol value object
   */
  private extractValueFromInspector(inspectorValue: any): unknown {
    if (!inspectorValue) {
      return undefined;
    }

    const { type, value, description } = inspectorValue;

    switch (type) {
      case 'string':
      case 'number':
      case 'boolean':
        return value;

      case 'undefined':
        return undefined;

      case 'object':
        if (description === 'null') {
          return null;
        }
        // For objects/arrays, we'd need to recursively fetch properties
        // For now, return the description as a fallback
        return value ?? description;

      default:
        return value;
    }
  }

  /**
   * Resolves a nested property path on an object using the Inspector protocol.
   */
  private resolveNestedProperty(session: inspector.Session, objectValue: any, propertyPath: string[]): unknown {
    if (!objectValue?.objectId || propertyPath.length === 0) {
      return this.extractValueFromInspector(objectValue);
    }

    let currentObjectId = objectValue.objectId;

    // Traverse the property path
    for (let i = 0; i < propertyPath.length; i++) {
      const propName = propertyPath[i];
      let nextValue: any = undefined;

      session.post('Runtime.getProperties', {
        objectId: currentObjectId,
        ownProperties: true
      }, (err: Error | null, params: any) => {
        if (!err && params?.result) {
          const prop = params.result.find((p: any) => p.name === propName);
          if (prop?.value) {
            nextValue = prop.value;
          }
        }
      });

      if (!nextValue) {
        return undefined;
      }

      // If this is the last property in the path, extract and return its value
      if (i === propertyPath.length - 1) {
        return this.extractValueFromInspector(nextValue);
      }

      // Otherwise, continue traversing if it's an object
      if (nextValue.type === 'object' && nextValue.objectId) {
        currentObjectId = nextValue.objectId;
      } else {
        // Can't traverse further if it's not an object
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * Captures the value passed to a string method by executing the function
   */
  private captureMethodValue<T = any>(fn: (x: T) => boolean, targetField: string): string {
    let captured: unknown = undefined;

    const proxy = new Proxy<any>({}, {
      get(_target, prop: string | symbol): any {
        if (typeof prop !== "string") return () => true;

        if (prop === targetField) {
          return {
            includes: (v: unknown) => { captured = `%${v}%`; return true; },
            startsWith: (v: unknown) => { captured = `${v}%`; return true; },
            endsWith: (v: unknown) => { captured = `%${v}`; return true; },
          };
        }

        // For other fields, return dummy truthy value
        return () => true;
      },
    });

    try {
      fn(proxy as T);
    } catch {
      // Ignore errors
    }

    return captured as string ?? '';
  }

  /**
   * Parses a value from source code expression
   * Handles literals and returns undefined for closure variables
   */
  private parseValueFromSource(expr: string): unknown {
    if (!expr) return undefined;

    const trimmed = expr.trim();

    // String literals
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
        (trimmed.startsWith("`") && trimmed.endsWith("`"))) {
      return trimmed.slice(1, -1);
    }

    // Boolean literals
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Null/undefined
    if (trimmed === 'null') return null;
    if (trimmed === 'undefined') return undefined;

    // Number literals (including scientific notation like 1e6, 1.5e10, etc.)
    if (/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(trimmed)) {
      return Number(trimmed);
    }

    // For closure variables, we can't extract the value from source alone
    // Return undefined - this means the where() won't work with closure variables
    return undefined;
  }

  /**
   * Parses field-operator pairs from source text in order of appearance
   */
  private parseFieldOperatorPairs(
    src: string,
    param: string
  ): Array<{ field: string; op: Operator; isMethod: boolean; rhsExpr: string }> {
    const body = this.extractBody(src);
    const allMatches: Array<{ index: number; field: string; op: Operator; isMethod: boolean; rhsExpr: string }> = [];

    // Find method calls (includes, startsWith, endsWith)
    // Use [a-zA-Z0-9_]+ to properly match Salesforce custom field names (e.g., Active__c)
    const methodRegex = new RegExp(`${param}\\.([a-zA-Z0-9_]+)\\.(includes|startsWith|endsWith)\\(([^)]+)\\)`, 'g');
    let match;
    while ((match = methodRegex.exec(body)) !== null) {
      allMatches.push({
        index: match.index,
        field: match[1],
        op: "LIKE",
        isMethod: true,
        rhsExpr: match[3],
      });
    }

    // Find negated boolean fields: !x.IsActive or !x.Active__c
    // Matches: !param.FieldName (where it's NOT followed by an operator)
    // Use [a-zA-Z0-9_]+ to match field names with underscores (like Active__c)
    const negatedBooleanRegex = new RegExp(
      `!${param}\\.([a-zA-Z0-9_]+(?:\\.[a-zA-Z0-9_]+)*)(?!\\s*(?:===|!==|==|!=|>=|<=|>|<|\\.))`,'g'
    );
    let negMatch: RegExpExecArray | null;
    while ((negMatch = negatedBooleanRegex.exec(body)) !== null) {
      allMatches.push({
        index: negMatch.index,
        field: negMatch[1],
        op: "=",
        isMethod: false,
        rhsExpr: 'false',  // !x.IsActive means IsActive = false
      });
    }

    // Note: Standalone boolean detection is commented out for now as it conflicts with other patterns
    // It's better to require explicit comparisons: x.Active__c === true
    // We may add this back with a more sophisticated approach later

    // Find standalone boolean fields: x.IsActive (truthy check)
    // Only match when it's clearly a standalone boolean check (preceded by && or || or at start or opening paren, followed by && or || or end or closing paren)
    // This very conservative approach avoids breaking existing functionality
    const standaloneBooleanRegex = new RegExp(
      `(?:^|&&|\\|\\||\\()\\s*${param}\\.([a-zA-Z0-9_]+)\\s*(?:&&|\\|\\||\\)|$)`,
      'g'
    );
    let boolMatch: RegExpExecArray | null;
    while ((boolMatch = standaloneBooleanRegex.exec(body)) !== null) {
      // Skip if this is already matched by comparison or method regex
      const alreadyMatched = allMatches.some(m =>
        Math.abs(m.index - boolMatch!.index) < 30
      );
      if (!alreadyMatched) {
        allMatches.push({
          index: boolMatch.index,
          field: boolMatch[1],
          op: "=",
          isMethod: false,
          rhsExpr: 'true',  // x.IsActive means IsActive = true
        });
      }
    }

    // Find comparison operators
    const comparisonRegex = new RegExp(
      `${param}\\.([a-zA-Z0-9_]+(?:\\.[a-zA-Z0-9_]+)*)\\s*(===|!==|==|!=|>=|<=|>|<)\\s*([^&|()]+?)(?=\\s*(?:&&|\\|\\||\\)|$))`,
      'g'
    );
    while ((match = comparisonRegex.exec(body)) !== null) {
      allMatches.push({
        index: match.index,
        field: match[1],
        op: this.jsOperatorToSOQL(match[2]),
        isMethod: false,
        rhsExpr: match[3].trim(),
      });
    }

    // Sort by index to maintain order
    allMatches.sort((a, b) => a.index - b.index);

    return allMatches.map(({ field, op, isMethod, rhsExpr }) => ({ field, op, isMethod, rhsExpr }));
  }

  /**
   * Converts JavaScript operator to SOQL operator
   */
  private jsOperatorToSOQL(op: string): Operator {
    const map: Record<string, Operator> = {
      "===": "=",
      "==": "=",
      "!==": "!=",
      "!=": "!=",
      ">": ">",
      "<": "<",
      ">=": ">=",
      "<=": "<=",
    };
    return map[op] || "=";
  }

  /**
   * Builds a complete ConditionNode tree with field names and values from a ts-morph expression
   */
  private buildConditionFromExpression<T = any>(expr: Node, paramName: string, fn: (x: T) => boolean): ConditionNode {
    // Handle parenthesized expressions
    if (Node.isParenthesizedExpression(expr)) {
      return this.buildConditionFromExpression(expr.getExpression(), paramName, fn);
    }

    // Handle binary expressions (AND, OR, comparisons)
    if (Node.isBinaryExpression(expr)) {
      const operator = expr.getOperatorToken().getText();

      // Logical operators
      if (operator === '&&') {
        return {
          kind: "group",
          logic: "AND",
          conditions: [
            this.buildConditionFromExpression(expr.getLeft(), paramName, fn),
            this.buildConditionFromExpression(expr.getRight(), paramName, fn)
          ]
        };
      } else if (operator === '||') {
        return {
          kind: "group",
          logic: "OR",
          conditions: [
            this.buildConditionFromExpression(expr.getLeft(), paramName, fn),
            this.buildConditionFromExpression(expr.getRight(), paramName, fn)
          ]
        };
      }

      // Comparison operators - extract field, operator, and value
      const left = expr.getLeft();
      const right = expr.getRight();

      // Get field name from left side (e.g., x.Field or x.Field.SubField)
      const fieldName = this.extractFieldNameFromExpression(left, paramName);
      if (!fieldName) {
        return { kind: "leaf", field: "", operator: "=", value: null };
      }

      // Get operator
      const soqlOperator = this.jsOperatorToSOQL(operator);

      // Get value from right side
      const value = this.extractValueFromExpression(right, fn);

      return {
        kind: "leaf",
        field: fieldName,
        operator: soqlOperator,
        value
      };
    }

    // Handle prefix unary expressions (negation: !x.Field)
    if (Node.isPrefixUnaryExpression(expr)) {
      const operator = expr.getOperatorToken();
      if (operator === SyntaxKind.ExclamationToken) {
        const operand = expr.getOperand();

        // Handle !x.Field (negated boolean)
        if (Node.isPropertyAccessExpression(operand)) {
          const fieldName = this.extractFieldNameFromExpression(operand, paramName);
          if (fieldName) {
            return {
              kind: "leaf",
              field: fieldName,
              operator: "=",
              value: false
            };
          }
        }

        // Handle !(x.Field === value) - though this is rare
        return this.buildConditionFromExpression(operand, paramName, fn);
      }
    }

    // Handle property access (standalone boolean: x.Field)
    if (Node.isPropertyAccessExpression(expr)) {
      const fieldName = this.extractFieldNameFromExpression(expr, paramName);
      if (fieldName) {
        return {
          kind: "leaf",
          field: fieldName,
          operator: "=",
          value: true
        };
      }
    }

    // Handle call expressions (methods like x.Field.includes('value'))
    if (Node.isCallExpression(expr)) {
      const callExpr = expr.getExpression();
      if (Node.isPropertyAccessExpression(callExpr)) {
        const methodName = callExpr.getName();
        const object = callExpr.getExpression();

        if (Node.isPropertyAccessExpression(object)) {
          const fieldName = this.extractFieldNameFromExpression(object, paramName);

          if (fieldName) {
            // Get the argument value
            const args = expr.getArguments();
            if (args.length > 0) {
              const value = this.extractValueFromExpression(args[0], fn);

              // Handle different string methods
              if (methodName === 'includes') {
                return {
                  kind: "leaf",
                  field: fieldName,
                  operator: "LIKE",
                  value: `%${value}%`
                };
              } else if (methodName === 'startsWith') {
                return {
                  kind: "leaf",
                  field: fieldName,
                  operator: "LIKE",
                  value: `${value}%`
                };
              } else if (methodName === 'endsWith') {
                return {
                  kind: "leaf",
                  field: fieldName,
                  operator: "LIKE",
                  value: `%${value}`
                };
              }
            }
          }
        }
      }
    }

    // Default: return placeholder leaf
    return { kind: "leaf", field: "", operator: "=", value: null };
  }

  /**
   * Extracts a field name from a property access expression (e.g., x.Field or x.Field.SubField)
   */
  private extractFieldNameFromExpression(expr: Node, paramName: string): string | null {
    if (Node.isPropertyAccessExpression(expr)) {
      const parts: string[] = [];
      let current: Node = expr;

      while (Node.isPropertyAccessExpression(current)) {
        parts.unshift(current.getName());
        current = current.getExpression();
      }

      // Check if the base is the parameter name
      if (Node.isIdentifier(current) && current.getText() === paramName) {
        return parts.join('.');
      }
    }

    return null;
  }

  /**
   * Extracts a value from an expression (literal, identifier for closure variable, or computed)
   */
  private extractValueFromExpression<T = any>(expr: Node, fn: (x: T) => boolean): unknown {
    // Handle literals
    if (Node.isStringLiteral(expr)) {
      return expr.getLiteralText();
    }
    if (Node.isNumericLiteral(expr)) {
      return Number(expr.getLiteralText());
    }
    if (expr.getKind() === SyntaxKind.TrueKeyword) {
      return true;
    }
    if (expr.getKind() === SyntaxKind.FalseKeyword) {
      return false;
    }
    if (expr.getKind() === SyntaxKind.NullKeyword) {
      return null;
    }

    // Handle identifiers (closure variables)
    if (Node.isIdentifier(expr)) {
      const varName = expr.getText();
      return this.captureClosureValue(fn, varName);
    }

    // Handle property access (e.g., obj.prop)
    if (Node.isPropertyAccessExpression(expr)) {
      const text = expr.getText();
      return this.captureClosureValue(fn, text);
    }

    // Handle template expressions
    if (Node.isTemplateExpression(expr)) {
      // Try to evaluate the template
      const text = expr.getText();
      return this.captureClosureValue(fn, text);
    }

    // Default: try to capture as closure
    return this.captureClosureValue(fn, expr.getText());
  }


  /**
   * Parses an AND group
   */
  private parseAndGroup(expr: string): ConditionNode {
    const andParts = this.splitOnOperator(expr, '&&');

    if (andParts.length === 1) {
      // Single condition - could be a leaf or a grouped OR expression
      // Strip parentheses and check if it contains OR
      const trimmed = expr.trim();
      if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
        // Remove outer parentheses and recursively parse
        const inner = trimmed.slice(1, -1);
        return this.parseOrGroup(inner);
      }
      // Single leaf condition
      return { kind: "leaf", field: "", operator: "=", value: null };
    }

    return {
      kind: "group",
      logic: "AND",
      conditions: andParts.map((part) => {
        // Recursively parse each AND part (which might contain OR)
        const trimmed = part.trim();
        if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
          const inner = trimmed.slice(1, -1);
          return this.parseOrGroup(inner);
        }
        return { kind: "leaf", field: "", operator: "=", value: null };
      }),
    };
  }

  /**
   * Parses an OR group
   */
  private parseOrGroup(expr: string): ConditionNode {
    const orParts = this.splitOnOperator(expr, '||');

    if (orParts.length === 1) {
      // Single condition - could be AND group or leaf
      return this.parseAndGroup(orParts[0]);
    }

    return {
      kind: "group",
      logic: "OR",
      conditions: orParts.map((part) => this.parseAndGroup(part)),
    };
  }

  /**
   * Splits expression on a given operator while respecting parentheses
   */
  private splitOnOperator(expr: string, operator: '&&' | '||'): string[] {
    const parts: string[] = [];
    let currentPart = '';
    let depth = 0;
    let i = 0;

    while (i < expr.length) {
      const char = expr[i];
      const nextChar = expr[i + 1];

      if (char === '(') {
        depth++;
        currentPart += char;
        i++;
      } else if (char === ')') {
        depth--;
        currentPart += char;
        i++;
      } else if (depth === 0 && char + nextChar === operator) {
        parts.push(currentPart.trim());
        currentPart = '';
        i += 2;
      } else {
        currentPart += char;
        i++;
      }
    }

    if (currentPart.trim()) {
      parts.push(currentPart.trim());
    }

    return parts.length > 0 ? parts : [expr];
  }


  /**
   * Converts a condition tree to SOQL string
   */
  private conditionToSOQL(node: ConditionNode): string {
    if (node.kind === "leaf") {
      const val = this.formatValueForSOQL(node.value);
      return `${node.field} ${node.operator} ${val}`;
    }

    const parts = node.conditions.map((child) => {
      const sql = this.conditionToSOQL(child);
      // Wrap AND groups inside an OR in parentheses
      if (node.logic === "OR" && child.kind === "group" && child.logic === "AND") {
        return `(${sql})`;
      }
      // Wrap OR groups inside an AND in parentheses
      if (node.logic === "AND" && child.kind === "group" && child.logic === "OR") {
        return `(${sql})`;
      }
      return sql;
    });

    return parts.join(` ${node.logic} `);
  }

  /**
   * Formats a value for SOQL
   */
  private formatValueForSOQL(value: unknown): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }

    if (typeof value === 'number') {
      // Use toFixed(0) for integers to avoid scientific notation
      // For floating point, use string conversion but handle scientific notation
      if (Number.isInteger(value)) {
        return value.toFixed(0);
      }
      // For decimals, convert and replace scientific notation if present
      const str = value.toString();
      if (str.includes('e')) {
        return value.toFixed(10).replace(/\.?0+$/, '');
      }
      return str;
    }

    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "\\'")}'`;
    }

    // For objects and arrays, convert to JSON string
    return `'${JSON.stringify(value).replace(/'/g, "\\'")}'`;
  }
}
