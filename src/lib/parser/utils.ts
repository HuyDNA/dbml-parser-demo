import _ from 'lodash';
import { SyntaxToken, SyntaxTokenKind } from '../lexer/tokens';
import { None, Option, Some } from '../option';
import { alternateLists, gatherIntoList } from '../utils';
import NodeFactory from './factory';
import {
  AttributeNode,
  BlockExpressionNode,
  CallExpressionNode,
  ElementDeclarationNode,
  ExpressionNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  GroupExpressionNode,
  IdentiferStreamNode,
  InfixExpressionNode,
  ListExpressionNode,
  LiteralNode,
  NormalExpressionNode,
  PostfixExpressionNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  ProgramNode,
  SyntaxNode,
  TupleExpressionNode,
  VariableNode,
} from './nodes';

// Try to interpret a function application as an element
export function convertFuncAppToElem(
  callee: ExpressionNode | undefined,
  args: NormalExpressionNode[],
  factory: NodeFactory,
): Option<ElementDeclarationNode> {
  if (!callee || !isExpressionAnIdentifierNode(callee) || args.length === 0) {
    return new None();
  }
  const cpArgs = [...args];

  const type = extractVariableNode(callee).unwrap();

  const body = cpArgs.pop();
  if (!(body instanceof BlockExpressionNode)) {
    return new None();
  }

  const attributeList =
    _.last(cpArgs) instanceof ListExpressionNode ? (cpArgs.pop() as ListExpressionNode) : undefined;

  if (cpArgs.length === 3 && extractVariableNode(cpArgs[1]).unwrap().value === 'as') {
    return new Some(
      factory.create(
        ElementDeclarationNode,
        {
          type,
          name: cpArgs[0],
          as: extractVariableNode(cpArgs[1]).unwrap(),
          alias: cpArgs[2],
          attributeList,
          body,
        },
        false,
      ),
    );
  }

  if (cpArgs.length === 1) {
    return new Some(
      factory.create(
        ElementDeclarationNode,
        {
          type,
          name: cpArgs[0],
          attributeList,
          body,
        },
        false,
      ),
    );
  }

  if (cpArgs.length === 0) {
    return new Some(
      factory.create(
        ElementDeclarationNode,
        {
          type,
          attributeList,
          body,
        },
        false,
      ),
    );
  }

  return new None();
}

// Check if a token is an `as` keyword
export function isAsKeyword(
  token: SyntaxToken,
): token is SyntaxToken & { kind: SyntaxTokenKind.IDENTIFIER; value: 'as' } {
  return token.kind === SyntaxTokenKind.IDENTIFIER && token.value === 'as';
}

export function markInvalid(nodeOrToken?: SyntaxNode | SyntaxToken) {
  if (!nodeOrToken) {
    return;
  }

  if (nodeOrToken instanceof SyntaxToken) {
    markInvalidToken(nodeOrToken);
  } else {
    markInvalidNode(nodeOrToken);
  }
}

function markInvalidToken(token: SyntaxToken) {
  if (token.kind === SyntaxTokenKind.EOF) {
    return;
  }
  // eslint-disable-next-line no-param-reassign
  token.isInvalid = true;
}

function markInvalidNode(node: SyntaxNode) {
  if (node instanceof ElementDeclarationNode) {
    markInvalid(node.type);
    markInvalid(node.name);
    markInvalid(node.as);
    markInvalid(node.alias);
    markInvalid(node.bodyColon);
    markInvalid(node.attributeList);
    markInvalid(node.body);
  } else if (node instanceof IdentiferStreamNode) {
    node.identifiers.forEach(markInvalid);
  } else if (node instanceof AttributeNode) {
    markInvalid(node.name);
    markInvalid(node.colon);
    markInvalid(node.value);
  } else if (node instanceof PrefixExpressionNode) {
    markInvalid(node.op);
    markInvalid(node.expression);
  } else if (node instanceof InfixExpressionNode) {
    markInvalid(node.leftExpression);
    markInvalid(node.op);
    markInvalid(node.rightExpression);
  } else if (node instanceof PostfixExpressionNode) {
    markInvalid(node.op);
    markInvalid(node.expression);
  } else if (node instanceof BlockExpressionNode) {
    markInvalid(node.blockOpenBrace);
    node.body.forEach(markInvalid);
    markInvalid(node.blockCloseBrace);
  } else if (node instanceof ListExpressionNode) {
    markInvalid(node.listOpenBracket);
    node.commaList.forEach(markInvalid);
    node.elementList.forEach(markInvalid);
    markInvalid(node.listCloseBracket);
  } else if (node instanceof TupleExpressionNode) {
    markInvalid(node.tupleOpenParen);
    node.commaList.forEach(markInvalid);
    node.elementList.forEach(markInvalid);
    markInvalid(node.tupleCloseParen);
  } else if (node instanceof CallExpressionNode) {
    markInvalid(node.callee);
    markInvalid(node.argumentList);
  } else if (node instanceof FunctionApplicationNode) {
    markInvalid(node.callee);
    node.args.forEach(markInvalid);
  } else if (node instanceof PrimaryExpressionNode) {
    markInvalid(node.expression);
  } else if (node instanceof FunctionExpressionNode) {
    markInvalid(node.value);
  } else if (node instanceof VariableNode) {
    markInvalid(node.variable);
  } else if (node instanceof LiteralNode) {
    markInvalid(node.literal);
  } else if (node instanceof GroupExpressionNode) {
    throw new Error('This case is handled by the TupleExpressionNode case');
  } else {
    throw new Error('Unreachable case in markInvalidNode');
  }
}

export function isInvalidToken(token?: SyntaxToken): boolean {
  return !!token?.isInvalid;
}

export function getMemberChain(node: SyntaxNode): Readonly<(SyntaxNode | SyntaxToken)[]> {
  if (node instanceof ProgramNode) {
    return [...node.body, node.eof];
  }

  if (node instanceof ElementDeclarationNode) {
    return gatherIntoList(
      node.type,
      node.name,
      node.as,
      node.alias,
      node.attributeList,
      node.bodyColon,
      node.body,
    );
  }

  if (node instanceof AttributeNode) {
    return gatherIntoList(node.name, node.colon, node.value);
  }

  if (node instanceof IdentiferStreamNode) {
    return node.identifiers;
  }

  if (node instanceof LiteralNode) {
    return [node.literal];
  }

  if (node instanceof VariableNode) {
    return [node.variable];
  }

  if (node instanceof PrefixExpressionNode) {
    return [node.op, node.expression];
  }

  if (node instanceof InfixExpressionNode) {
    return [node.leftExpression, node.op, node.rightExpression];
  }

  if (node instanceof PostfixExpressionNode) {
    return [node.expression, node.op];
  }

  if (node instanceof FunctionExpressionNode) {
    return [node.value];
  }

  if (node instanceof FunctionApplicationNode) {
    return [node.callee, ...node.args];
  }

  if (node instanceof BlockExpressionNode) {
    return [node.blockOpenBrace, ...node.body, node.blockCloseBrace];
  }

  if (node instanceof ListExpressionNode) {
    return [
      node.listOpenBracket,
      ...alternateLists(node.elementList, node.commaList),
      node.listCloseBracket,
    ];
  }

  if (node instanceof TupleExpressionNode) {
    return [
      node.tupleOpenParen,
      ...alternateLists(node.elementList, node.commaList),
      node.tupleCloseParen,
    ];
  }

  if (node instanceof CallExpressionNode) {
    return [node.callee, node.argumentList];
  }

  if (node instanceof PrimaryExpressionNode) {
    return [node.expression];
  }

  if (node instanceof GroupExpressionNode) {
    throw new Error('This case is already handled by TupleExpressionNode');
  }

  throw new Error('Unreachable - no other possible cases');
}

// Return a variable node if it's nested inside a primary expression
export function extractVariableNode(value?: unknown): Option<SyntaxToken> {
  if (isExpressionAVariableNode(value)) {
    return new Some(value.expression.variable);
  }

  return new None();
}

// Return true if an expression node is a primary expression
// with a nested quoted string (", ' or ''')
export function isExpressionAQuotedString(value?: unknown): boolean {
  return (
    value instanceof PrimaryExpressionNode &&
    ((value.expression instanceof VariableNode &&
      value.expression.variable.kind === SyntaxTokenKind.QUOTED_STRING) ||
      (value.expression instanceof LiteralNode &&
        value.expression.literal.kind === SyntaxTokenKind.STRING_LITERAL))
  );
}

// Return true if an expression node is a primary expression
// with a variable node (identifier or a double-quoted string)
export function isExpressionAVariableNode(
  value?: unknown,
): value is PrimaryExpressionNode & { expression: VariableNode } {
  return value instanceof PrimaryExpressionNode && value.expression instanceof VariableNode;
}

// Return true if an expression node is a primary expression
// with an identifier-like variable node
export function isExpressionAnIdentifierNode(value?: unknown): value is PrimaryExpressionNode & {
  expression: VariableNode & { variable: { kind: SyntaxTokenKind.IDENTIFIER } };
} {
  return (
    value instanceof PrimaryExpressionNode &&
    value.expression instanceof VariableNode &&
    value.expression.variable.kind === SyntaxTokenKind.IDENTIFIER
  );
}

export function isAccessExpression(
  node: SyntaxNode,
): node is InfixExpressionNode & { op: SyntaxToken & { value: '.' } } {
  return node instanceof InfixExpressionNode && node.op.value === '.';
}

export function extractStringFromIdentifierStream(stream: IdentiferStreamNode): Option<string> {
  const name = stream.identifiers.map((identifier) => identifier.value).join(' ');
  if (name === '') {
    return new None();
  }

  return new Some(name);
}
