import { z } from "zod";

/** Teil-Update einer Task-/OKR-Zeile (Server Action + Client-Validierung). */
export const taskUpdateSchema = z
  .object({
    id: z.coerce.number().int().positive(),
    name: z.string().min(1).max(500).optional(),
    notes: z.string().max(20000).nullable().optional(),
    start_date: z.string().max(32).nullable().optional(),
    end_date: z.string().max(32).nullable().optional(),
    progress: z.coerce.number().min(0).max(100).optional(),
    status: z.string().max(80).optional(),
    topic: z.string().max(80).nullable().optional(),
    assigned: z.string().max(80).nullable().optional(),
    item_kind: z.enum(["task", "objective", "key_result"]).optional(),
    okr_objective_id: z.union([z.number().int(), z.null()]).optional(),
    okr_key_result_id: z.union([z.number().int(), z.null()]).optional(),
    parent_id: z.union([z.number().int(), z.null()]).optional(),
    custom_fields: z.record(z.string(), z.unknown()).optional(),
    department_id: z.union([z.string().uuid(), z.null()]).optional(),
    project_id: z.union([z.string().uuid(), z.null()]).optional(),
  })
  .strict();

export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

export const taskInsertSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().min(1).max(500),
  item_kind: z.enum(["task", "objective", "key_result"]),
  start_date: z.string().max(32).nullable().optional(),
  end_date: z.string().max(32).nullable().optional(),
  topic: z.string().max(80).nullable().optional(),
  assigned: z.string().max(80).nullable().optional(),
  status: z.string().max(80).optional(),
  progress: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().max(20000).nullable().optional(),
  parent_id: z.coerce.number().int().nullable().optional(),
  okr_objective_id: z.coerce.number().int().nullable().optional(),
  okr_key_result_id: z.coerce.number().int().nullable().optional(),
  dependencies: z.array(z.number()).optional(),
  attachments: z.array(z.unknown()).optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
  department_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
});
