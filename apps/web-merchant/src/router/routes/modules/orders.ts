import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: ['orders', 'aftersale'],
      icon: 'lucide:clipboard-list',
      order: 20,
      title: '订单',
    },
    name: 'Orders',
    path: '/orders',
    children: [
      {
        name: 'OrderFulfillment',
        path: 'fulfillment',
        component: () => import('#/views/orders/index.vue'),
        meta: {
          authority: ['orders'],
          icon: 'lucide:package-check',
          title: '备货与自提',
        },
      },
      {
        name: 'OrderAfterSales',
        path: 'after-sales',
        component: () => import('#/views/orders/after-sales/index.vue'),
        meta: {
          authority: ['aftersale'],
          icon: 'lucide:undo-2',
          title: '售后处理',
        },
      },
    ],
  },
];

export default routes;
