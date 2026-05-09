export type FormatTag = 
  | 'TypeScript' 
  | 'GraphQL' 
  | 'Sql' 
  | 'Prisma' 
  | 'JsonSchema' 
  | 'OpenApi' 
  | 'Java' 
  | 'CSharp' 
  | 'Python' 
  | 'Protobuf' 
  | 'Unknown';

export type NodeKind = 
  | 'interface' 
  | 'enum' 
  | 'class' 
  | 'table' 
  | 'method' 
  | 'scalar';

export type RelationshipKind = 
  | 'extends' 
  | 'implements' 
  | 'references' 
  | 'returns' 
  | 'has-field' 
  | 'foreign-key';

export type FieldModifier = 
  | 'optional' 
  | 'nullable' 
  | 'array' 
  | 'readonly';

export type SchemaField = {
  name: string;
  ty: string;
  modifiers?: FieldModifier[];
  metadata?: any;
};

export type SchemaNode = {
  id: string;
  displayName: string;
  kind: NodeKind;
  fields: SchemaField[];
  metadata?: any;
  format: FormatTag;
  // UI positions
  x?: number;
  y?: number;
};

export type SchemaEdge = {
  sourceNodeId: string;
  targetNodeId: string;
  kind: RelationshipKind;
  label?: string;
};

export type ParsedSchema = {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
};
