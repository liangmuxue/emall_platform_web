import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: ['pickups'],
      icon: 'lucide:store',
      order: 8,
      title: '商家门店',
    },
    name: 'MerchantOps',
    path: '/merchant',
    children: [
      {
        name: 'PickupPoints',
        path: 'pickups',
        component: () => import('#/views/merchant/pickups/index.vue'),
        meta: {
          authority: ['pickups'],
          icon: 'lucide:map-pin',
          title: '自提点',
        },
      },
    ],
  },
];

export default routes;
