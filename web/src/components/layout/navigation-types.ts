export type DepartmentNavItem = {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
};

/** Ein Abteilungs-Board oder eine Gruppe für die Sidebar. */
export type DeptBoardNavItem = {
  id: string;
  name: string;
  isGroup: boolean;
  parentId: string | null;
  icon?: string;
  color?: string;
};
