import { Router } from 'express';
import { db } from '../infrastructure/database/client.js';

const router = Router();

// ── Helper: parse JSON or return default ──────────────────────────────────────
function safeJson<T>(str: string | null | undefined, fallback: T): T {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TABLES
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/tables — list tables for workspace
router.get('/', async (req, res) => {
  try {
    const tables = await db.automationTable.findMany({
      where: { workspaceId: req.workspaceId },
      include: {
        fields: { orderBy: { order: 'asc' } },
        _count: { select: { records: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const result = tables.map((t) => ({
      id: t.id,
      name: t.name,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      rowCount: t._count.records,
      fields: t.fields.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        order: f.order,
        options: safeJson<{ label: string; value: string }[]>(f.options, []),
      })),
    }));

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/tables — create table
router.post('/', async (req, res) => {
  try {
    const { name, fields = [] } = req.body as {
      name: string;
      fields?: { name: string; type: string; options?: { label: string; value: string }[] }[];
    };
    if (!name?.trim()) return res.status(400).json({ error: 'Table name is required' });

    const table = await db.automationTable.create({
      data: {
        workspaceId: req.workspaceId,
        name: name.trim(),
        fields: {
          create: [
            { name: 'Name', type: 'TEXT', order: 0 },
            ...fields.map((f, i) => ({
              name: f.name,
              type: f.type ?? 'TEXT',
              order: i + 1,
              options: JSON.stringify(f.options ?? []),
            })),
          ],
        },
      },
      include: {
        fields: { orderBy: { order: 'asc' } },
        _count: { select: { records: true } },
      },
    });

    res.status(201).json({
      id: table.id,
      name: table.name,
      createdAt: table.createdAt.toISOString(),
      updatedAt: table.updatedAt.toISOString(),
      rowCount: 0,
      fields: table.fields.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        order: f.order,
        options: safeJson(f.options, []),
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/tables/:id — get table with fields + paginated records
router.get('/:id', async (req, res) => {
  try {
    const { search, page = '1', pageSize = '50', filters } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);

    const table = await db.automationTable.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
      include: { fields: { orderBy: { order: 'asc' } } },
    });

    // Records — SQLite doesn't support JSON field queries natively so we filter in-memory
    const allRecords = await db.automationTableRecord.findMany({
      where: { tableId: table.id },
      orderBy: { createdAt: 'desc' },
    });

    const fieldIds = table.fields.map((f) => f.id);

    // In-memory filter: search across all TEXT cells
    let filtered = allRecords.filter((r) => {
      if (!search) return true;
      const cells = safeJson<Record<string, unknown>>(r.cells, {});
      return Object.values(cells).some((v) =>
        String(v ?? '').toLowerCase().includes(search.toLowerCase()),
      );
    });

    // Client-sent filters [{fieldId, operator, value}]
    if (filters) {
      const parsedFilters = safeJson<{ fieldId: string; operator: string; value: string }[]>(
        filters,
        [],
      );
      filtered = filtered.filter((r) => {
        const cells = safeJson<Record<string, unknown>>(r.cells, {});
        return parsedFilters.every(({ fieldId, operator, value }) => {
          const cellVal = String(cells[fieldId] ?? '');
          switch (operator) {
            case 'equals': return cellVal === value;
            case 'not_equals': return cellVal !== value;
            case 'contains': return cellVal.toLowerCase().includes(value.toLowerCase());
            case 'not_contains': return !cellVal.toLowerCase().includes(value.toLowerCase());
            case 'greater_than': return parseFloat(cellVal) > parseFloat(value);
            case 'less_than': return parseFloat(cellVal) < parseFloat(value);
            case 'exists': return cellVal !== '' && cellVal !== 'undefined' && cellVal !== 'null';
            case 'not_exists': return cellVal === '' || cellVal === 'undefined' || cellVal === 'null';
            default: return true;
          }
        });
      });
    }

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + parseInt(pageSize));

    res.json({
      id: table.id,
      name: table.name,
      createdAt: table.createdAt.toISOString(),
      updatedAt: table.updatedAt.toISOString(),
      fields: table.fields.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        order: f.order,
        options: safeJson(f.options, []),
      })),
      records: paginated.map((r) => ({
        id: r.id,
        cells: safeJson<Record<string, unknown>>(r.cells, {}),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total },
    });
  } catch (e: any) {
    res.status(404).json({ error: 'Table not found' });
  }
});

// PATCH /api/tables/:id — rename table
router.patch('/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const table = await db.automationTable.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    const updated = await db.automationTable.update({
      where: { id: table.id },
      data: { name },
    });
    res.json({ id: updated.id, name: updated.name, updatedAt: updated.updatedAt.toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/tables/:id — delete table + all fields + records (cascade)
router.delete('/:id', async (req, res) => {
  try {
    const table = await db.automationTable.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    await db.automationTable.delete({ where: { id: table.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// FIELDS
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/tables/:id/fields — add a field
router.post('/:id/fields', async (req, res) => {
  try {
    const table = await db.automationTable.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
      include: { fields: { orderBy: { order: 'desc' }, take: 1 } },
    });
    const maxOrder = table.fields[0]?.order ?? -1;
    const { name, type = 'TEXT', options = [] } = req.body;

    const field = await db.automationTableField.create({
      data: {
        tableId: table.id,
        name,
        type,
        order: maxOrder + 1,
        options: JSON.stringify(options),
      },
    });

    res.status(201).json({
      id: field.id,
      name: field.name,
      type: field.type,
      order: field.order,
      options: safeJson(field.options, []),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/tables/:id/fields/:fieldId — update field
router.patch('/:id/fields/:fieldId', async (req, res) => {
  try {
    const { name, type, options } = req.body;
    const field = await db.automationTableField.update({
      where: { id: req.params.fieldId },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(options !== undefined && { options: JSON.stringify(options) }),
      },
    });
    res.json({
      id: field.id,
      name: field.name,
      type: field.type,
      order: field.order,
      options: safeJson(field.options, []),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/tables/:id/fields/:fieldId — delete field
router.delete('/:id/fields/:fieldId', async (req, res) => {
  try {
    await db.automationTableField.delete({ where: { id: req.params.fieldId } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// RECORDS
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/tables/:id/records — create record
router.post('/:id/records', async (req, res) => {
  try {
    const table = await db.automationTable.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    const { cells = {} } = req.body;
    const record = await db.automationTableRecord.create({
      data: { tableId: table.id, cells: JSON.stringify(cells) },
    });
    res.status(201).json({
      id: record.id,
      cells: safeJson(record.cells, {}),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/tables/:id/records/:recordId — update cells
router.patch('/:id/records/:recordId', async (req, res) => {
  try {
    const { cells } = req.body;
    const existing = await db.automationTableRecord.findUniqueOrThrow({
      where: { id: req.params.recordId },
    });
    const merged = { ...safeJson(existing.cells, {}), ...cells };
    const record = await db.automationTableRecord.update({
      where: { id: req.params.recordId },
      data: { cells: JSON.stringify(merged) },
    });
    res.json({
      id: record.id,
      cells: safeJson(record.cells, {}),
      updatedAt: record.updatedAt.toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/tables/:id/records/:recordId — delete single record
router.delete('/:id/records/:recordId', async (req, res) => {
  try {
    await db.automationTableRecord.delete({ where: { id: req.params.recordId } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/tables/:id/records — bulk delete
router.delete('/:id/records', async (req, res) => {
  try {
    const { recordIds } = req.body as { recordIds: string[] };
    if (!Array.isArray(recordIds) || recordIds.length === 0)
      return res.status(400).json({ error: 'recordIds array required' });
    await db.automationTableRecord.deleteMany({ where: { id: { in: recordIds } } });
    res.json({ success: true, deleted: recordIds.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
