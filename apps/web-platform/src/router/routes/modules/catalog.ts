import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: ['categories', 'audits'],
      icon: 'lucide:shopping-bag',
      order: 10,
      title: '商品中心',
    },
    name: 'Catalog',
    path: '/catalog',
    children: [
      {
        name: 'CatalogCategories',
        path: 'categories',
        component: () => import('#/views/catalog/categories/index.vue'),
        meta: {
          authority: ['categories'],
          icon: 'lucide:folder-tree',
          title: '商品类目',
        },
      },
      {
        name: 'CatalogAudits',
        path: 'audits',
        component: () => import('#/views/catalog/audits/index.vue'),
        meta: {
          authority: ['audits'],
          icon: 'lucide:clipboard-check',
          title: '商品审核',
        },
      },
    ],
  },
];

export default routes;
