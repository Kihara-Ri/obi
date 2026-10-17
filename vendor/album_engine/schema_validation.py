"""Local structural interpreter for the canonical Album Engine JSON schema.

Only the vocabulary used by our versioned protocol is implemented. References
are resolved inside that document; no remote resolution or plugins are used.
Physical sockets, graph ownership and provenance remain document.py checks.
"""
import json
import math
from pathlib import Path
import re
from uuid import UUID
from .errors import ValidationError


_KEYWORDS = frozenset({
    '$schema', '$id', '$defs', '$ref', 'title', 'description',
    'oneOf', 'anyOf', 'const', 'enum', 'type', 'required', 'properties',
    'additionalProperties', 'propertyNames', 'minProperties', 'maxProperties',
    'items', 'minItems', 'maxItems', 'uniqueItems', 'minLength', 'maxLength',
    'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'pattern', 'format',
})


class _Mismatch(ValidationError):
    pass


def document_schema():
    path = Path(__file__).with_name('album-document-v2.schema.json')
    if not path.is_file():
        path = Path(__file__).resolve().parents[2] / 'schema/album-document-v2.schema.json'
    return json.loads(path.read_text(encoding='utf-8'))


def _finite(value):
    return type(value) is int or (type(value) is float and math.isfinite(value))


def _equal(left, right):
    """JSON equality distinguishes bool from number, but equates 2 and 2.0."""
    if type(left) in (int, float) and type(right) in (int, float):
        return _finite(left) and _finite(right) and left == right
    if type(left) is not type(right):
        return False
    if isinstance(left, dict):
        return left.keys() == right.keys() and all(_equal(left[k], right[k]) for k in left)
    if isinstance(left, list):
        return len(left) == len(right) and all(_equal(a, b) for a, b in zip(left, right))
    return left == right


def _is_type(value, kind):
    if kind == 'number': return _finite(value)
    if kind == 'integer': return _finite(value) and value == int(value)
    kinds = {'object':dict, 'array':list, 'string':str, 'boolean':bool, 'null':type(None)}
    if kind not in kinds: raise ValidationError('实体协议使用了未支持的类型')
    return type(value) is kinds[kind]


def _check(value, schema, root, path, depth):
    def fail(reason): raise _Mismatch('实体文档不符合协议：' + path + ' ' + reason)
    if depth > 128: fail('嵌套过深')
    if schema is True: return
    if schema is False: fail('不允许此值')
    if not isinstance(schema, dict) or set(schema) - _KEYWORDS:
        raise ValidationError('实体协议包含未支持的结构约束')
    if '$ref' in schema:
        reference = schema['$ref']
        if not isinstance(reference, str) or not reference.startswith('#/$defs/'):
            raise ValidationError('实体协议仅允许本地定义引用')
        definition = reference[len('#/$defs/'):].replace('~1','/').replace('~0','~')
        if definition not in root.get('$defs', {}): raise ValidationError('实体协议引用了不存在的定义')
        _check(value, root['$defs'][definition], root, path, depth + 1)
    for operator in ('oneOf', 'anyOf'):
        if operator in schema:
            matches = 0
            for branch in schema[operator]:
                try: _check(value, branch, root, path, depth + 1)
                except _Mismatch: continue
                matches += 1
            if (operator == 'oneOf' and matches != 1) or (operator == 'anyOf' and matches == 0):
                fail('未满足 ' + operator)
    if 'const' in schema and not _equal(value, schema['const']): fail('常量不匹配')
    if 'enum' in schema and not any(_equal(value, choice) for choice in schema['enum']): fail('枚举值无效')
    if 'type' in schema:
        types = schema['type'] if isinstance(schema['type'], list) else [schema['type']]
        if not any(_is_type(value, kind) for kind in types): fail('类型无效')
    if isinstance(value, dict):
        for name in schema.get('required', []):
            if name not in value: fail('缺少字段 ' + name)
        for keyword, lower in (('minProperties',True), ('maxProperties',False)):
            if keyword in schema and (len(value) < schema[keyword] if lower else len(value) > schema[keyword]): fail(keyword)
        properties = schema.get('properties', {})
        additional = schema.get('additionalProperties', True)
        for name, child in value.items():
            if not isinstance(name, str): fail('对象字段名必须是字符串')
            if 'propertyNames' in schema: _check(name,schema['propertyNames'],root,path,depth+1)
            if name in properties: _check(child,properties[name],root,path+'.'+name,depth+1)
            elif additional is False: fail('未知字段 ' + name)
            elif isinstance(additional, dict): _check(child,additional,root,path+'.'+name,depth+1)
    elif isinstance(value, list):
        for keyword, lower in (('minItems',True), ('maxItems',False)):
            if keyword in schema and (len(value) < schema[keyword] if lower else len(value) > schema[keyword]): fail(keyword)
        if schema.get('uniqueItems') and any(_equal(child, earlier) for i, child in enumerate(value) for earlier in value[:i]): fail('数组成员重复')
        if 'items' in schema:
            for index, child in enumerate(value): _check(child,schema['items'],root,path+'['+str(index)+']',depth+1)
    elif isinstance(value, str):
        for keyword, lower in (('minLength',True), ('maxLength',False)):
            if keyword in schema and (len(value) < schema[keyword] if lower else len(value) > schema[keyword]): fail(keyword)
        if 'pattern' in schema and re.search(schema['pattern'], value) is None: fail('格式无效')
        if schema.get('format') == 'uuid':
            try: parsed = UUID(value)
            except ValueError: fail('UUID 无效')
            if str(parsed) != value.lower(): fail('UUID 无效')
        elif 'format' in schema: raise ValidationError('实体协议使用了未支持的格式')
    elif type(value) in (int, float):
        if not _finite(value): fail('数字必须有限')
        for keyword, accepted in (
            ('minimum', lambda limit: value >= limit), ('maximum', lambda limit: value <= limit),
            ('exclusiveMinimum', lambda limit: value > limit), ('exclusiveMaximum', lambda limit: value < limit),
        ):
            if keyword in schema and not accepted(schema[keyword]): fail(keyword)


def validate_schema(value, schema):
    """Validate a value using this local protocol vocabulary; return it unchanged."""
    _check(value, schema, schema, '$', 0)
    return value
