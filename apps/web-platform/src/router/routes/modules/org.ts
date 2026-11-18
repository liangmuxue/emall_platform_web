import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: ['org', 'accounts'],
      icon: 'lucide:users',
      order: 5,
      title: '用户体系',
    },
    name: 'Org',
    path: '/user',
    children: [
      {
        name: 'PlatformOrg',
        path: '/org',
        component: () => import('#/views/org/index.vue'),
        meta: {
          authority: ['org'],
          icon: 'lucide:network',
          title: '平台组织',
        },
      },
      {
        name: 'MerchantAccounts',
        path: '/merchant-accounts',
        component: () => import('#/views/org/accounts.vue'),
        meta: {
          authority: ['accounts'],
          icon: 'lucide:store',
          title: '商家账号',
        },
      },
    ],
  },
];

export default routes;
