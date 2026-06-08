/** Spalten für MainTableView / Kanban — kein `select("*")` für kleinere Payloads. */
export const MAIN_TABLE_TASK_SELECT =
  "id,name,topic,assigned,start_date,end_date,status,progress,parent_id,dependencies,attachments,notes,item_kind,okr_objective_id,okr_key_result_id,custom_fields,department_id,project_id,sort_order";
