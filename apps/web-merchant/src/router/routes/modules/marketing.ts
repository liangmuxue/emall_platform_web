import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:ticket',
      order: 30,
      title: '营销',
    },
    name: 'Marketing',
    path: '/marketing',
    children: [
      {
        name: 'MarketingActivities',
        path: 'activities',
        component: () => import('#/views/marketing/activities/index.vue'),
        meta: {
          icon: 'lucide:badge-percent',
          title: '营销活动',
        },
      },
    ],
  },
];

export default routes;
