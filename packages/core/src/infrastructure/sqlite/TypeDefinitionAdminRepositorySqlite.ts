import type { TypeDefinitionAdminRepository } from '../../application/ports/TypeDefinitionAdminRepository.js';
import { TypeDomain, ConstraintType } from '../../application/dto/TypeFieldDefinition.js';
import type { TypeListItemDto, TypeDetailDto, FieldDto, FieldConstraintDto, FieldDataType } from '../../application/dto/AdminContractDtos.js';
import { ManagedTypeDefinition } from '../../domain/models/ManagedTypeDefinition.js';
import { ManagedTypeField } from '../../domain/models/ManagedTypeField.js';
import { ManagedTypeFieldConstraint } from '../../domain/models/ManagedTypeFieldConstraint.js';
import { ManagedEnumOption } from '../../domain/models/ManagedEnumOption.js';
import { RowVersionMismatchError } from '../../domain/errors/DomainErrors.js';
import { TypeDefinitionNotFoundError } from '../../domain/errors/TypeAdminErrors.js';
import { SqliteDatabase } from './SqliteDatabase.js';

type Config = { types: string; fields: string; constraints: string; enums: string; fk: string; instances: string; instanceFk: string };
const config = (d: TypeDomain): Config => d === 'entity'
  ? { types: 'entity_types', fields: 'entity_type_fields', constraints: 'entity_type_field_constraints', enums: 'entity_type_field_enum_options', fk: 'entity_type_id', instances: 'entities', instanceFk: 'entity_type_id' }
  : { types: 'node_types', fields: 'node_type_fields', constraints: 'node_type_field_constraints', enums: 'node_type_field_enum_options', fk: 'node_type_id', instances: 'nodes', instanceFk: 'node_type_id' };
const bool = (v: unknown) => Boolean(Number(v));
const date = (v: string | Date) => new Date(v).toISOString();

export class TypeDefinitionAdminRepositorySqlite implements TypeDefinitionAdminRepository {
  constructor(private readonly database: SqliteDatabase) {}

  async findTypeById(d: TypeDomain, id: string): Promise<ManagedTypeDefinition | null> { return this.readType(d, 'id = ?', id); }
  async findTypeByKey(d: TypeDomain, key: string): Promise<ManagedTypeDefinition | null> { return this.readType(d, 'type_key = ? AND deleted_at IS NULL', key); }

  async listTypes(d: TypeDomain): Promise<TypeListItemDto[]> {
    const c = config(d);
    return this.database.all<any>(`SELECT t.*, (SELECT COUNT(*) FROM ${c.fields} f WHERE f.${c.fk}=t.id) AS fieldCount FROM ${c.types} t WHERE t.deleted_at IS NULL ORDER BY t.name`).map((r) => ({ id:r.id, kind:d, typeKey:r.type_key, name:r.name, description:r.description ?? '', storageTable:d==='entity'?(r.storage_table??null):null, currentSchemaVersion:Number(r.current_schema_version), isActive:bool(r.is_active), isSystem:bool(r.is_system), rowVersion:Number(r.row_version), fieldCount:Number(r.fieldCount), updatedAt:date(r.updated_at) }));
  }

  async getTypeDetail(d: TypeDomain, key: string): Promise<TypeDetailDto | null> {
    const t = await this.readType(d, 'type_key = ? AND deleted_at IS NULL', key); if (!t) return null;
    const c = config(d);
    const fields: FieldDto[] = this.database.all<any>(`SELECT * FROM ${c.fields} WHERE ${c.fk}=? ORDER BY position`, [t.id]).map((r) => {
      const constraints: FieldConstraintDto[] = this.database.all<any>(`SELECT id,constraint_type AS constraintType,constraint_value_text AS constraintValueText FROM ${c.constraints} WHERE field_id=?`, [r.id]).map((x) => ({ id:x.id, constraintType:x.constraintType as ConstraintType, constraintValueText:x.constraintValueText }));
      const enumOptions = this.database.all<any>(`SELECT id,value,label,position,is_active AS isActive FROM ${c.enums} WHERE field_id=? ORDER BY position`, [r.id]);
      return { id:r.id, fieldKey:r.field_key, label:r.label, columnName:r.column_name, dataType:r.data_type as FieldDataType, isRequired:bool(r.is_required), isUnique:bool(r.is_unique), isIndexed:bool(r.is_indexed), defaultValueText:r.default_value_text ?? null, position:Number(r.position ?? 0), isSystem:bool(r.is_system), relationTargetDomain:r.relation_target_domain ?? null, relationTargetTypeKey:r.relation_target_type_key ?? null, enumMode:r.enum_mode ?? 'static', encryptionMode:r.encryption_mode ?? 'plaintext', enumOptions, constraints, updatedAt:date(r.updated_at) };
    });
    const instanceCount = Number(this.database.get<any>(`SELECT COUNT(*) AS count FROM ${c.instances} WHERE ${c.instanceFk}=? AND deleted_at IS NULL`, [t.id])?.count ?? 0);
    return { id:t.id, kind:d, typeKey:t.typeKey, name:t.name, description:t.description, storageTable:t.storageTable, placementPolicyId:t.placementPolicyId, currentSchemaVersion:t.currentSchemaVersion, isActive:t.isActive, isSystem:t.isSystem, rowVersion:t.rowVersion, createdAt:t.createdAt.toISOString(), updatedAt:t.updatedAt.toISOString(), fields, isEditable:!t.isSystem, isDeletable:!t.isSystem && instanceCount===0, instanceCount };
  }

  async createType(d: TypeDomain, t: ManagedTypeDefinition): Promise<void> { const c=config(d); const cols=d==='entity'?['id','type_key','name','description','storage_table','placement_policy_id','current_schema_version','is_active','is_system','row_version','created_at','updated_at']:['id','type_key','name','description','current_schema_version','is_active','is_system','row_version','created_at','updated_at']; const vals=d==='entity'?[t.id,t.typeKey,t.name,t.description,t.storageTable,t.placementPolicyId,t.currentSchemaVersion,t.isActive?1:0,t.isSystem?1:0,t.rowVersion,t.createdAt.toISOString(),t.updatedAt.toISOString()]:[t.id,t.typeKey,t.name,t.description,t.currentSchemaVersion,t.isActive?1:0,t.isSystem?1:0,t.rowVersion,t.createdAt.toISOString(),t.updatedAt.toISOString()]; await this.database.run(`INSERT INTO ${c.types}(${cols.join(',')}) VALUES(${cols.map(()=>'?').join(',')})`,vals); }
  async updateType(d: TypeDomain, t: ManagedTypeDefinition): Promise<void> { const c=config(d); const r=this.database.run(`UPDATE ${c.types} SET name=?,description=?,current_schema_version=?,is_active=?,row_version=?,updated_at=? WHERE id=? AND row_version=? AND deleted_at IS NULL`,[t.name,t.description,t.currentSchemaVersion,t.isActive?1:0,t.rowVersion,t.updatedAt.toISOString(),t.id,t.rowVersion-1]); if(!r.changes){const current=this.database.get<any>(`SELECT row_version,deleted_at FROM ${c.types} WHERE id=?`,[t.id]); if(!current||current.deleted_at) throw new TypeDefinitionNotFoundError(t.id,d); throw new RowVersionMismatchError(t.rowVersion-1,Number(current.row_version));} }

  async findFieldById(d: TypeDomain, id: string): Promise<ManagedTypeField | null> { const c=config(d); const r=this.database.get<any>(`SELECT *,${c.fk} AS type_fk_id FROM ${c.fields} WHERE id=?`,[id]); return r?this.toField(r):null; }
  async createField(d: TypeDomain, f: ManagedTypeField): Promise<void> { const c=config(d); await this.database.run(`INSERT INTO ${c.fields}(id,${c.fk},field_key,label,column_name,data_type,is_required,is_unique,is_indexed,default_value_text,position,is_system,relation_target_domain,relation_target_type_key,enum_mode,encryption_mode,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[f.id,f.typeDefinitionId,f.fieldKey,f.label,f.columnName,f.dataType,f.isRequired?1:0,f.isUnique?1:0,f.isIndexed?1:0,f.defaultValueText,f.position,f.isSystem?1:0,f.relationTargetDomain,f.relationTargetTypeKey,f.enumMode,f.encryptionMode,f.createdAt.toISOString(),f.updatedAt.toISOString()]); }
  async updateField(d: TypeDomain, f: ManagedTypeField): Promise<void> { const c=config(d); await this.database.run(`UPDATE ${c.fields} SET label=?,is_required=?,is_unique=?,is_indexed=?,default_value_text=?,position=?,encryption_mode=?,updated_at=? WHERE id=?`,[f.label,f.isRequired?1:0,f.isUnique?1:0,f.isIndexed?1:0,f.defaultValueText,f.position,f.encryptionMode,f.updatedAt.toISOString(),f.id]); }
  async deleteField(d: TypeDomain, id: string): Promise<void> { await this.database.run(`DELETE FROM ${config(d).fields} WHERE id=?`,[id]); }
  async existsFieldByKey(d: TypeDomain, id: string, key: string): Promise<boolean> { const c=config(d); return Boolean(this.database.get(`SELECT 1 FROM ${c.fields} WHERE ${c.fk}=? AND field_key=?`,[id,key])); }
  async existsFieldByColumnName(d: TypeDomain, id: string, col: string): Promise<boolean> { const c=config(d); return Boolean(this.database.get(`SELECT 1 FROM ${c.fields} WHERE ${c.fk}=? AND column_name=?`,[id,col])); }
  async findConstraintById(d: TypeDomain, id: string): Promise<ManagedTypeFieldConstraint | null> { const r=this.database.get<any>(`SELECT * FROM ${config(d).constraints} WHERE id=?`,[id]); return r?new ManagedTypeFieldConstraint(r.id,r.field_id,r.constraint_type as ConstraintType,r.constraint_value_text,new Date(r.created_at)):null; }
  async createConstraint(d: TypeDomain, x: ManagedTypeFieldConstraint): Promise<void> { await this.database.run(`INSERT INTO ${config(d).constraints}(id,field_id,constraint_type,constraint_value_text,created_at) VALUES(?,?,?,?,?)`,[x.id,x.fieldId,x.constraintType,x.constraintValueText,x.createdAt.toISOString()]); }
  async updateConstraint(d: TypeDomain, x: ManagedTypeFieldConstraint): Promise<void> { await this.database.run(`UPDATE ${config(d).constraints} SET constraint_value_text=? WHERE id=?`,[x.constraintValueText,x.id]); }
  async deleteConstraint(d: TypeDomain, id: string): Promise<void> { await this.database.run(`DELETE FROM ${config(d).constraints} WHERE id=?`,[id]); }
  async existsEnumOption(d: TypeDomain, fieldId: string, value: string): Promise<boolean> { return Boolean(this.database.get(`SELECT 1 FROM ${config(d).enums} WHERE field_id=? AND value=?`,[fieldId,value])); }
  async createEnumOption(d: TypeDomain, x: ManagedEnumOption): Promise<void> { await this.database.run(`INSERT INTO ${config(d).enums}(id,field_id,value,label,position,is_active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`,[x.id,x.fieldId,x.value,x.label,x.position,x.isActive?1:0,x.createdAt.toISOString(),x.updatedAt.toISOString()]); }
  async hasInstancesOfType(d: TypeDomain, id: string): Promise<boolean> { const c=config(d); return Boolean(this.database.get(`SELECT 1 FROM ${c.instances} WHERE ${c.instanceFk}=? AND deleted_at IS NULL LIMIT 1`,[id])); }
  async hasValuesInField(d: TypeDomain, typeId: string, fieldKey: string, column: string): Promise<boolean> { const c=config(d); const f=this.database.get<any>(`SELECT data_type FROM ${c.fields} WHERE ${c.fk}=? AND field_key=?`,[typeId,fieldKey]); if(!f)return false; if(['file','image'].includes(String(f.data_type).toLowerCase())) return Boolean(this.database.get(`SELECT 1 FROM resource_attachments a JOIN ${c.instances} i ON i.id=a.resource_id WHERE a.resource_type=? AND a.field_key=? AND i.${c.instanceFk}=?`,[d,fieldKey,typeId])); if(d==='node') return Boolean(this.database.get(`SELECT 1 FROM nodes WHERE node_type_id=? AND deleted_at IS NULL AND json_extract(payload, '$.'||?) IS NOT NULL`,[typeId,fieldKey])); const type=this.database.get<any>('SELECT storage_table FROM entity_types WHERE id=? AND deleted_at IS NULL',[typeId]); return Boolean(type?.storage_table && this.database.get(`SELECT 1 FROM ${this.ident(type.storage_table)} s JOIN entities e ON e.id=s.entity_id WHERE e.entity_type_id=? AND e.deleted_at IS NULL AND ${this.ident(column)} IS NOT NULL`,[typeId])); }
  async countIncomingRelations(_d: TypeDomain, key: string): Promise<number> { return Number(this.database.get<any>(`SELECT COUNT(*) AS count FROM (SELECT id FROM node_type_fields WHERE data_type='relation' AND relation_target_type_key=? UNION ALL SELECT id FROM entity_type_fields WHERE data_type='relation' AND relation_target_type_key=?)`,[key,key])?.count ?? 0); }
  private async readType(d:TypeDomain, where:string, value:string):Promise<ManagedTypeDefinition|null>{const c=config(d);const r=this.database.get<any>(`SELECT * FROM ${c.types} WHERE ${where}`,[value]);return r?new ManagedTypeDefinition(r.id,r.type_key,r.name,r.description??'',d==='entity'?r.storage_table:null,d==='entity'?r.placement_policy_id:null,Number(r.current_schema_version),bool(r.is_active),bool(r.is_system),Number(r.row_version),new Date(r.created_at),new Date(r.updated_at),r.deleted_at?new Date(r.deleted_at):null):null;}
  private toField(r:any):ManagedTypeField{return new ManagedTypeField(r.id,r.type_fk_id,r.field_key,r.label,r.column_name,r.data_type,bool(r.is_required),bool(r.is_unique),bool(r.is_indexed),r.default_value_text??null,Number(r.position??0),bool(r.is_system),new Date(r.created_at),new Date(r.updated_at),r.relation_target_domain??null,r.relation_target_type_key??null,r.enum_mode??'static',r.encryption_mode??'plaintext');}
  private ident(v:string){return `"${v.replace(/"/g,'""')}"`;}
}
