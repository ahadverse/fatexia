export interface MenuItem {
  label: string;
  path: string;
  icon?: string;
  children?: MenuItem[];
}

export interface MenuGroup {
  label?: string;
  items: MenuItem[];
}

export interface MenuConfig {
  groups: MenuGroup[];
}
