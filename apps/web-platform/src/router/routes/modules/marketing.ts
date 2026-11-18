import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: ['campaigns'],
      icon: 'lucide:ticket',
      order: 30,
      title: '营销中心',
    },
    name: 'Marketing',
    path: '/marketing',
    children: [
      {
        name: 'MarketingAudits',
        path: 'audits',
        component: () => import('#/views/marketing/audits/index.vue'),
        meta: {
          authority: ['campaigns'],
          icon: 'lucide:clipboard-check',
          title: '活动审核',
        },
      },
    ],
  },
];

export default routes;
