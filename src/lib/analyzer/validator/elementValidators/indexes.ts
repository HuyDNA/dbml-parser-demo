import {
  ElementKind,
  createContextValidatorConfig,
  createSettingsValidatorConfig,
  createSubFieldValidatorConfig,
} from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { SyntaxToken } from '../../../lexer/tokens';
import {
  ElementDeclarationNode,
  PrimaryExpressionNode,
  SyntaxNode,
  VariableNode,
} from '../../../parser/nodes';
import { isQuotedStringNode } from '../../../utils';
import { SchemaSymbolTable, TableEntry } from '../../symbol/symbolTable';
import { destructureIndex } from '../../utils';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import { isVoid } from '../utils';
import {
 complexBodyConfig, noAliasConfig, noNameConfig, noSettingsConfig, noUniqueConfig,
} from './_preset_configs';

export default class IndexesValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.INDEXES;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.IndexesContext,
    errorCode: CompileErrorCode.INVALID_INDEXES_CONTEXT,
    stopOnError: false,
  });

  protected unique = noUniqueConfig(false);

  protected name = noNameConfig(false);

  protected alias = noAliasConfig(false);

  protected settings = noSettingsConfig(false);

  protected body = complexBodyConfig(false);

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: (node) => destructureIndex(node).unwrap_or(undefined) !== undefined,
        errorCode: CompileErrorCode.INVALID_INDEX,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_INDEX,
    setting: createSettingsValidatorConfig(
      {
        note: {
          allowDuplicate: false,
          isValid: isQuotedStringNode,
        },
        name: {
          allowDuplicate: false,
          isValid: isQuotedStringNode,
        },
        type: {
          allowDuplicate: false,
          isValid: isValidIndexesType,
        },
        unique: {
          allowDuplicate: false,
          isValid: isVoid,
        },
        pk: {
          allowDuplicate: false,
          isValid: isVoid,
        },
      },
      {
        optional: true,
        notFoundErrorCode: undefined,
        allow: true,
        foundErrorCode: undefined,
        unknownErrorCode: CompileErrorCode.UNKNOWN_INDEX_SETTING,
        duplicateErrorCode: CompileErrorCode.DUPLICATE_INDEX_SETTING,
        invalidErrorCode: CompileErrorCode.INVALID_INDEX_SETTING_VALUE,
        stopOnError: false,
      },
    ),
    shouldRegister: false,
    duplicateErrorCode: undefined,
  });

  protected elementEntry?: TableEntry;

  constructor(
    declarationNode: ElementDeclarationNode,
    globalSchema: SchemaSymbolTable,
    contextStack: ContextStack,
    errors: CompileError[],
    uniqueKindsFound: Set<ElementKind>,
  ) {
    super(declarationNode, globalSchema, contextStack, errors, uniqueKindsFound);
  }
}

export function isValidIndexesType(value?: SyntaxNode | SyntaxToken[]): boolean {
  if (!(value instanceof PrimaryExpressionNode) || !(value.expression instanceof VariableNode)) {
    return false;
  }

  const str = value.expression.variable.value;

  return str === 'btree' || str === 'hash';
}
