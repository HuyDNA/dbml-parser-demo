import {
  ElementKind,
  createContextValidatorConfig,
  createSettingsValidatorConfig,
  createSubFieldValidatorConfig,
} from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { SyntaxToken } from '../../../lexer/tokens';
import { ElementDeclarationNode, SyntaxNode } from '../../../parser/nodes';
import { isQuotedStringNode } from '../../../utils';
import { SchemaSymbolTable, TableEntry } from '../../symbol/symbolTable';
import { extractQuotedStringToken, isBinaryRelationship, joinTokenStrings } from '../../utils';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import {
  anyBodyConfig,
  noAliasConfig,
  noSettingsConfig,
  noUniqueConfig,
  optionalNameConfig,
} from './_preset_configs';

export default class RefValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.REF;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.RefContext,
    errorCode: CompileErrorCode.INVALID_REF_CONTEXT,
    stopOnError: false,
  });

  protected unique = noUniqueConfig(false);

  protected name = optionalNameConfig(false);

  protected alias = noAliasConfig(false);

  protected settings = noSettingsConfig(false);

  protected body = anyBodyConfig(false);

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: isBinaryRelationship,
        errorCode: CompileErrorCode.INVALID_REF_RELATIONSHIP,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_REF_FIELD,
    setting: refFieldSettings(),
    shouldRegister: false,
    duplicateErrorCode: undefined,
  });

  protected elementEntry?: TableEntry;

  constructor(
    declarationNode: ElementDeclarationNode,
    globalSchema: SchemaSymbolTable,
    contextStack: ContextStack,
    errors: CompileError[],
    kindsGloballyFound: Set<ElementKind>,
    kindsLocallyFound: Set<ElementKind>,
  ) {
    super(
      declarationNode,
      globalSchema,
      contextStack,
      errors,
      kindsGloballyFound,
      kindsLocallyFound,
    );
  }
}

function isValidPolicy(value?: SyntaxNode | SyntaxToken[]): boolean {
  if (!Array.isArray(value) && !isQuotedStringNode(value)) {
    return false;
  }

  let extractedString: string | undefined;
  if (Array.isArray(value)) {
    extractedString = joinTokenStrings(value);
  } else {
    extractedString = extractQuotedStringToken(value);
  }

  if (extractedString) {
    switch (extractedString.toLowerCase()) {
      case 'cascade':
      case 'no action':
      case 'set null':
      case 'set default':
      case 'restrict':
        return true;
      default:
        return false;
    }
  }

  return false; // unreachable
}

const refFieldSettings = () =>
  createSettingsValidatorConfig(
    {
      delete: {
        allowDuplicate: false,
        isValid: isValidPolicy,
      },
      update: {
        allowDuplicate: false,
        isValid: isValidPolicy,
      },
    },
    {
      optional: true,
      notFoundErrorCode: undefined,
      allow: true,
      foundErrorCode: undefined,
      unknownErrorCode: CompileErrorCode.UNKNOWN_REF_SETTING,
      duplicateErrorCode: CompileErrorCode.DUPLICATE_REF_SETTING,
      invalidErrorCode: CompileErrorCode.INVALID_REF_SETTING_VALUE,
      stopOnError: false,
    },
  );
