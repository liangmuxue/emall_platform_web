import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: ['products', 'categories'],
      icon: 'lucide:package',
      order: 10,
      title: '商品',
    },
    name: 'Goods',
    path: '/goods',
    children: [
      {
        name: 'GoodsCategories',
        path: 'categories',
        component: () => import('#/views/goods/categories/index.vue'),
        meta: {
          authority: ['categories'],
          icon: 'lucide:folder-tree',
          title: '平台类目',
        },
      },
      {
        name: 'GoodsProducts',
        path: 'products',
        component: () => import('#/views/goods/products/index.vue'),
        meta: {
          authority: ['products'],
          icon: 'lucide:boxes',
          title: '商品与库存',
        },
      },
      {
        name: 'GoodsEdit',
        path: 'edit',
        component: () => import('#/views/goods/edit/index.vue'),
        meta: {
          authority: ['products'],
          hideInMenu: true,
          keepAlive: true,
          title: '编辑商品',
        },
      },
    ],
  },
];

export default routes;
