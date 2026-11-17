import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
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
          icon: 'lucide:package-check',
          title: '备货与自提',
        },
      },
    ],
  },
];

export default routes;
