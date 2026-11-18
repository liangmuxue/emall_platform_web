import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: ['aftersales'],
      icon: 'lucide:clipboard-list',
      order: 30,
      title: '订单',
    },
    name: 'Orders',
    path: '/orders',
    children: [
      {
        name: 'PlatformAfterSales',
        path: 'after-sales',
        component: () => import('#/views/orders/after-sales/index.vue'),
        meta: {
          authority: ['aftersales'],
          icon: 'lucide:scale',
          title: '售后仲裁',
        },
      },
    ],
  },
];

export default routes;
