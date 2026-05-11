/** Entspricht public.departments */
export type DepartmentRow = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
};

/** Board-Spalte: title wird beim Drag-Drop als tasks.status gesetzt. */
export type DepartmentBoardColumn = {
  id: string;
  title: string;
};

/** Entspricht public.board_projects */
export type BoardProjectRow = {
  id: string;
  board_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

/** Entspricht public.department_boards */
export type DepartmentBoardRow = {
  id: string;
  department_id: string;
  name: string;
  sort_order: number;
  column_config: DepartmentBoardColumn[] | null;
  created_at: string;
};
