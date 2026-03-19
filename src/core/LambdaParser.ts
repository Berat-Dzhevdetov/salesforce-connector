import { Project, SyntaxKind, Node, PropertyAccessExpression, ArrowFunction } from 'ts-morph';

/**
 * LambdaParser uses TypeScript AST parsing to convert lambda expressions
 * into Salesforce SOQL query strings.
 */
export class LambdaParser {
  private project: Project;

  constructor() {
    this.project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 99, // ESNext
        strict: false
      }
    });
  }

  /**
   * Parses a selector lambda and returns a mapping of aliases to field paths
   * Example: (x) => ({ Name: x.Name, Street: x.Address.Street })
   * Returns: { Name: "Name", Street: "Address.Street" }
   */
  parseSelector<T, R>(fn: (x: T) => R): Record<keyof R, string> {
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
   * Parses a where condition lambda and returns SOQL WHERE clause
   * Example: (x) => x.Name === "Adam" && x.Age > 18
   * Returns: "Name = 'Adam' AND Age > 18"
   */
  parseWhere<T>(fn: (x: T) => boolean): string {
    const fnString = fn.toString();

    const sourceFile = this.project.createSourceFile(
      `temp-where-${Date.now()}.ts`,
      `const tempFn = ${fnString}`,
      { overwrite: true }
    );

    try {
      const arrowFunction = sourceFile
        .getVariableDeclaration('tempFn')
        ?.getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);

      if (!arrowFunction) {
        throw new Error('Could not find arrow function in WHERE clause');
      }

      const parameter = arrowFunction.getParameters()[0];
      if (!parameter) {
        throw new Error('WHERE arrow function must have a parameter');
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
        throw new Error('Could not extract WHERE condition expression');
      }

      return this.convertToSOQL(expression, paramName);
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
   * Parses WHERE condition from a Node
   */
  parseWhereFromNode(arrowFunction: Node): string {
    if (!Node.isArrowFunction(arrowFunction)) {
      return '';
    }

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
        const condition = this.parseWhereFromNode(method.args[0]);
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
      return node.getText();
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
          `Cannot use external variable "${identifierName}" in where clause. ` +
          `Use .whereEquals(x => x.Field, ${identifierName}) instead.`
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
}
