import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: ['org', 'org-roles', 'org-staff', 'accounts'],
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
        redirect: '/org/roles',
        meta: {
          hideInMenu: true,
          title: '平台组织',
        },
      },
      {
        name: 'PlatformRoles',
        path: '/org/roles',
        component: () => import('#/views/org/index.vue'),
        meta: {
          authority: ['org', 'org-roles'],
          icon: 'lucide:shield',
          title: '岗位权限',
        },
      },
      {
        name: 'PlatformStaff',
        path: '/org/staff',
        component: () => import('#/views/org/index.vue'),
        meta: {
          authority: ['org', 'org-staff'],
          icon: 'lucide:user-round',
          title: '平台员工',
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
