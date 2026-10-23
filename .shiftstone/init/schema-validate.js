/**
 * Minimal JSON Schema (draft-07) interpreter for pack manifests (task 4.1).
 *
 * Supports exactly the keywords used by packs/_schema.json:
 *   type, const, enum, required, properties, additionalProperties,
 *   items, pattern, minLength, minItems, description.
 *
 * Being driven by the schema file keeps packs/_schema.json the single
 * source of truth — no duplicated rule set in code.
 */

/**
 * @typedef {Object} Schema
 * @property {string | string[]} [type]
 * @property {unknown} [const]
 * @property {unknown[]} [enum]
 * @property {string[]} [required]
 * @property {Record<string, Schema>} [properties]
 * @property {boolean | Schema} [additionalProperties]
 * @property {Schema} [items]
 * @property {string} [pattern]
 * @property {number} [minLength]
 * @property {number} [minItems]
 * @property {string} [description]
 */

/** @param {unknown} value */
function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * @param {unknown} value
 * @param {Schema} schema
 * @param {string} at
 * @param {string[]} errors
 */
function check(value, schema, at, errors) {
  if (schema.const !== undefined) {
    if (value !== schema.const) errors.push(`${at}: must be ${JSON.stringify(schema.const)}`);
    return;
  }
  if (schema.enum !== undefined) {
    if (!schema.enum.some((option) => option === value)) {
      errors.push(`${at}: must be one of ${schema.enum.map((o) => JSON.stringify(o)).join(', ')}`);
    }
    return;
  }
  if (schema.type !== undefined) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = typeOf(value);
    const matched =
      actual === 'number' && expected.includes('integer') && Number.isInteger(value)
        ? true
        : expected.includes(actual);
    if (!matched) {
      errors.push(`${at}: must be ${expected.join(' or ')}, got ${actual}`);
      return;
    }
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${at}: must be at least ${schema.minLength} character(s)`);
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${at}: ${JSON.stringify(value)} does not match pattern ${schema.pattern}`);
    }
    return;
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${at}: must have at least ${schema.minItems} item(s)`);
    }
    if (schema.items !== undefined) {
      value.forEach((item, index) => check(item, schema.items, `${at}[${index}]`, errors));
    }
    return;
  }

  if (typeOf(value) === 'object') {
    const record = /** @type {Record<string, unknown>} */ (value);
    for (const key of schema.required ?? []) {
      if (!(key in record)) errors.push(`${at}: missing required property "${key}"`);
    }
    const properties = schema.properties ?? {};
    for (const [key, propSchema] of Object.entries(properties)) {
      if (key in record) check(record[key], propSchema, `${at}.${key}`, errors);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(record)) {
        if (!(key in properties)) errors.push(`${at}: unknown property "${key}"`);
      }
    } else if (schema.additionalProperties !== undefined && schema.additionalProperties !== true) {
      const extra = schema.additionalProperties;
      for (const [key, propValue] of Object.entries(record)) {
        if (!(key in properties)) check(propValue, extra, `${at}.${key}`, errors);
      }
    }
  }
}

/**
 * @param {unknown} value
 * @param {Schema} schema
 * @returns {string[]}
 */
export function validateAgainstSchema(value, schema) {
  /** @type {string[]} */
  const errors = [];
  check(value, schema, 'manifest', errors);
  return errors;
}
