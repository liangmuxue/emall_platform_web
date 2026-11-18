import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: ['store', 'roles', 'staff-users'],
      icon: 'lucide:settings',
      order: 40,
      title: '设置',
    },
    name: 'Settings',
    path: '/settings',
    children: [
      {
        name: 'StoreSetting',
        path: 'store',
        component: () => import('#/views/settings/store.vue'),
        meta: {
          authority: ['store'],
          icon: 'lucide:store',
          title: '店铺设置',
        },
      },
      {
        name: 'MerchantRoles',
        path: 'roles',
        component: () => import('#/views/settings/roles.vue'),
        meta: {
          authority: ['roles'],
          icon: 'lucide:shield',
          title: '岗位与权限',
        },
      },
      {
        name: 'MerchantStaff',
        path: 'staff',
        component: () => import('#/views/settings/staff.vue'),
        meta: {
          authority: ['staff-users'],
          icon: 'lucide:user-round',
          title: '员工账号',
        },
      },
    ],
  },
];

export default routes;
