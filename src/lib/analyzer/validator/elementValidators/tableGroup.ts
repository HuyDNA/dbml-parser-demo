import { UnresolvedName } from 'lib/analyzer/types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode, SyntaxNode } from '../../../parser/nodes';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import { ElementKind, createContextValidatorConfig, createSubFieldValidatorConfig } from '../types';
import {
  complexBodyConfig,
  noAliasConfig,
  noSettingsConfig,
  noUniqueConfig,
  registerNameConfig,
} from './_preset_configs';
import { SchemaSymbol } from '../../symbol/symbols';
import { isValidName } from '../utils';
import { destructureComplexVariable } from 'lib/analyzer/utils';
import { createSchemaSymbolId, createTableSymbolId } from 'lib/analyzer/symbol/symbolIndex';

export default class TableGroupValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.TABLEGROUP;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.TableGroupContext,
    errorCode: CompileErrorCode.INVALID_TABLEGROUP_CONTEXT,
    stopOnError: false,
  });

  protected unique = noUniqueConfig(false);

  protected name = registerNameConfig(false);

  protected alias = noAliasConfig(false);

  protected settings = noSettingsConfig(false);

  protected body = complexBodyConfig(false);

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: isValidName,
        errorCode: CompileErrorCode.INVALID_TABLEGROUP_ELEMENT_NAME,
        registerUnresolvedName: registerTableName,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_TABLEGROUP_FIELD,
    setting: noSettingsConfig(false),
    shouldRegister: false,
    duplicateErrorCode: undefined,
  });

  constructor(
    declarationNode: ElementDeclarationNode,
    publicSchemaSymbol: SchemaSymbol,
    contextStack: ContextStack,
    unresolvedNames: UnresolvedName[],
    errors: CompileError[],
    kindsGloballyFound: Set<ElementKind>,
    kindsLocallyFound: Set<ElementKind>,
  ) {
    super(
      declarationNode,
      publicSchemaSymbol,
      contextStack,
      unresolvedNames,
      errors,
      kindsGloballyFound,
      kindsLocallyFound,
    );
  }
}

function registerTableName(node: SyntaxNode, ownerElement: ElementDeclarationNode, unresolvedNames: UnresolvedName[]) {
  if (!isValidName(node)) {
    throw new Error("Unreachable - Must be a valid name when registerTableName is called");
  }
  const fragments = destructureComplexVariable(node).unwrap();
  const tableId = createTableSymbolId(fragments.pop()!);
  const schemaIdStack = fragments.map(createSchemaSymbolId);

  unresolvedNames.push({
    id: tableId,
    qualifiers: schemaIdStack.length === 0 ? undefined : schemaIdStack,
    referrer: node,
    ownerElement,
  })
}
