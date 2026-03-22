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
 * LambdaParser uses TypeScript AST parsing to convert lambda expressions
 * into Salesforce SOQL query strings.
 *
 * For WHERE clauses, it uses a hybrid approach:
 * 1. Parses field names and operators from source code (reliable)
 * 2. Parses values from source code where possible (literals)
 * 3. For closure variables, uses Node.js Inspector Protocol to access [[Scopes]]
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
   * Parses a selector lambda and returns a mapping of aliases to field paths
   * Example: (x) => ({ Name: x.Name, Street: x.Address.Street })
   * Returns: { Name: "Name", Street: "Address.Street" }
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
   * Parses a WHERE condition lambda and returns SOQL WHERE clause
   * Supports closure variables via Inspector Protocol
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
   * Parses WHERE condition from a Node (used for subqueries)
   * Now uses captured WHERE functions from proxy execution
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
   * This allows us to access closure variables in subquery WHERE clauses.
   */
  private captureSubqueryWhereFunctions<T, R>(fn: (x: T) => R): void {
    this.capturedWhereFunctions.clear();

    const proxy = new Proxy<any>({}, {
      get: (_target, relationshipName: string | symbol) => {
        if (typeof relationshipName !== 'string') return undefined;

        // Return a mock SubqueryBuilder that captures WHERE functions
        return {
          select: (selectFn: any) => {
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
    const param = this.extractParam(src);

    if (!param) {
      throw new Error('Could not extract parameter name from lambda function');
    }

    // Parse structure from source to understand AND/OR logic
    const structure = this.parseLogicalStructure(src);

    // Collect actual values by executing with proxy + parsing source
    const leaves = this.collectLeaves(fn, param);

    // Merge structure with actual values
    return this.fillLeaves(structure, leaves);
  }

  /**
   * Extracts parameter name from lambda function source
   */
  private extractParam(src: string): string {
    const match = src.match(/^\s*\(?\s*(\w+)\s*(?::\s*[\w<>\[\]|& .]+)?\s*\)?\s*=>/);
    return match ? match[1] : '';
  }

  /**
   * Extracts the body of the lambda function
   */
  private extractBody(src: string): string {
    const arrowMatch = src.match(/=>\s*\{?\s*(?:return\s+)?([\s\S]+?)\s*;?\s*\}?$/);
    return arrowMatch ? arrowMatch[1].trim() : '';
  }

  /**
   * Collects all leaf conditions
   */
  private collectLeaves<T = any>(fn: (x: T) => boolean, param: string): LeafCondition[] {
    const leaves: LeafCondition[] = [];
    const src = fn.toString();
    const fieldOps = this.parseFieldOperatorPairs(src, param);

    // For each field-operator pair, extract the value
    for (const { field, op, isMethod, rhsExpr } of fieldOps) {
      if (isMethod) {
        // Execute function to capture method argument
        const value = this.captureMethodValue(fn, field);
        leaves.push({ kind: "leaf", field, operator: op, value });
      } else {
        // Parse value from source (handles literals only)
        let value = this.parseValueFromSource(rhsExpr);

        // If value is undefined (closure variable), try to capture it via execution
        if (value === undefined) {
          // Pass the rhsExpr as the variable name to extract
          value = this.captureClosureValue(fn, rhsExpr.trim());
        }

        leaves.push({ kind: "leaf", field, operator: op, value });
      }
    }

    return leaves;
  }

  /**
   * Attempts to capture a closure variable value using Node.js Inspector Protocol.
   *
   * Uses the V8 Inspector to access the function's [[Scopes]] internal property,
   * which contains all closure variables accessible to the function.
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
    const methodRegex = new RegExp(`${param}\\.(\\w+)\\.(includes|startsWith|endsWith)\\(([^)]+)\\)`, 'g');
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

    // Find comparison operators
    const comparisonRegex = new RegExp(
      `${param}\\.(\\w+(?:\\.\\w+)*)\\s*(===|!==|==|!=|>=|<=|>|<)\\s*([^&|()]+?)(?=\\s*(?:&&|\\|\\||\\)|$))`,
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
   * Parses the logical structure (AND/OR tree) from source text
   */
  private parseLogicalStructure(src: string): ConditionNode {
    const body = this.extractBody(src);

    // Split on || first (lowest precedence)
    const orParts = this.splitOnOperator(body, '||');

    if (orParts.length === 1) {
      return this.parseAndGroup(orParts[0]);
    }

    return {
      kind: "group",
      logic: "OR",
      conditions: orParts.map((part) => this.parseAndGroup(part)),
    };
  }

  /**
   * Parses an AND group
   */
  private parseAndGroup(expr: string): ConditionNode {
    const andParts = this.splitOnOperator(expr, '&&');

    if (andParts.length === 1) {
      // Single condition - return a placeholder leaf
      return { kind: "leaf", field: "", operator: "=", value: null };
    }

    return {
      kind: "group",
      logic: "AND",
      conditions: andParts.map(() => ({ kind: "leaf", field: "", operator: "=", value: null } as ConditionNode)),
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
   * Fills the structure tree with actual values from leaves array
   */
  private fillLeaves(node: ConditionNode, leaves: LeafCondition[]): ConditionNode {
    let leafIndex = 0;

    const fill = (n: ConditionNode): ConditionNode => {
      if (n.kind === "leaf") {
        const resolved = leaves[leafIndex++];
        return resolved ?? n;
      }

      return {
        ...n,
        conditions: n.conditions.map(fill),
      };
    };

    return fill(node);
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
