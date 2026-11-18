import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: ['settlement'],
      icon: 'lucide:wallet',
      order: 25,
      title: '财务',
    },
    name: 'Finance',
    path: '/finance',
    children: [
      {
        name: 'MerchantSettlements',
        path: 'settlements',
        component: () => import('#/views/finance/settlements/index.vue'),
        meta: {
          authority: ['settlement'],
          icon: 'lucide:receipt',
          title: '结算单',
        },
      },
    ],
  },
];

export default routes;
