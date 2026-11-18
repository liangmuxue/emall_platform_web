import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: ['finance'],
      icon: 'lucide:wallet',
      order: 40,
      title: '财务',
    },
    name: 'Finance',
    path: '/finance',
    children: [
      {
        name: 'PlatformSettlements',
        path: 'settlements',
        component: () => import('#/views/finance/settlements/index.vue'),
        meta: {
          authority: ['finance'],
          icon: 'lucide:receipt',
          title: '商家结算',
        },
      },
    ],
  },
];

export default routes;
