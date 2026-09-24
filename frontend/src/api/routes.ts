export const apiRoutes = {
  me: "/me",
  entitlements: "/entitlements",
  goals: "/goals",
  achievements: "/achievements",
  tasks: "/tasks",
  world: "/world",
  shop: "/shop",
  shopPurchase: "/shop/purchase",
  inventory: "/inventory",
  inventoryEquip: "/inventory/equip",
  inventoryUnequip: "/inventory/unequip",
  task: (taskId: string) => `/tasks/${encodeURIComponent(taskId)}`,
  completeTask: (taskId: string) =>
    `/tasks/${encodeURIComponent(taskId)}/complete`,
  upgradeBuilding: (buildingId: string) =>
    `/world/buildings/${encodeURIComponent(buildingId)}/upgrade`,
} as const;
