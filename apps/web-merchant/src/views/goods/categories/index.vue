<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Card, Table, Tag } from 'ant-design-vue';

import { requestClient } from '#/api/request';

type Category = {
  children?: Category[];
  id: number;
  name: string;
  parentId: null | number;
  sortNo: number;
  status: string;
  statusName: string;
};

const rows = ref<Category[]>([]);
const loading = ref(false);
const columns: TableColumnsType = [
  { title: '类目', dataIndex: 'name', key: 'name' },
  { title: '排序', dataIndex: 'sortNo', key: 'sortNo', width: 90 },
  { title: '状态', dataIndex: 'statusName', key: 'status', width: 110 },
];

function asTree(list: Category[]) {
  const map = new Map<number, Category>();
  list.forEach((item) => map.set(item.id, { ...item }));
  const roots: Category[] = [];
  map.forEach((item) => {
    const parent = item.parentId ? map.get(item.parentId) : undefined;
    if (parent) {
      parent.children = parent.children || [];
      parent.children.push(item);
    } else {
      roots.push(item);
    }
  });
  const dropEmpty = (nodes: Category[]) => {
    nodes.forEach((node) => {
      if (node.children?.length) dropEmpty(node.children);
      else delete node.children;
    });
  };
  dropEmpty(roots);
  return roots;
}

const dataSource = computed(() => asTree(rows.value));

onMounted(async () => {
  loading.value = true;
  try {
    rows.value = await requestClient.get<Category[]>('/categories');
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <Page description="类目由平台维护，这里只供选品时查看。" title="平台类目">
    <Card>
      <Table
        :columns="columns"
        :data-source="dataSource"
        :loading="loading"
        :pagination="false"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <Tag
            v-if="column.key === 'status'"
            :color="record.status === 'ENABLED' ? 'success' : 'default'"
          >
            {{ record.statusName }}
          </Tag>
        </template>
      </Table>
    </Card>
  </Page>
</template>
