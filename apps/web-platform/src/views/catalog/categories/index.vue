<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

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
const open = ref(false);
const saving = ref(false);
const form = reactive({
  id: 0,
  name: '',
  parentId: 0,
  sortNo: 0,
  status: 'ENABLED',
});

const columns: TableColumnsType = [
  { title: '类目', dataIndex: 'name', key: 'name' },
  { title: '排序', dataIndex: 'sortNo', key: 'sortNo', width: 90 },
  { title: '状态', dataIndex: 'statusName', key: 'status', width: 110 },
  { title: '操作', key: 'action', width: 180 },
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
const parentOptions = computed(() => [
  { label: '无，作为一级类目', value: 0 },
  ...rows.value
    .filter((item) => item.id !== form.id)
    .map((item) => ({ label: item.name, value: item.id })),
]);

async function load() {
  loading.value = true;
  try {
    rows.value = await requestClient.get<Category[]>('/categories');
  } finally {
    loading.value = false;
  }
}

function createRoot() {
  Object.assign(form, {
    id: 0,
    name: '',
    parentId: 0,
    sortNo: 0,
    status: 'ENABLED',
  });
  open.value = true;
}

function edit(record: Category | Record<string, any>) {
  Object.assign(form, {
    id: record.id,
    name: record.name,
    parentId: record.parentId || 0,
    sortNo: record.sortNo,
    status: record.status,
  });
  open.value = true;
}

async function save() {
  if (!form.name.trim()) {
    message.warning('请填写类目名称');
    return;
  }
  saving.value = true;
  const body = {
    name: form.name.trim(),
    parentId: form.parentId || null,
    sortNo: form.sortNo,
    status: form.status,
  };
  try {
    await (form.id
      ? requestClient.put(`/categories/${form.id}`, body)
      : requestClient.post('/categories', body));
    message.success('已保存');
    open.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}

async function remove(id: number) {
  await requestClient.delete(`/categories/${id}`);
  message.success('已删除');
  await load();
}

onMounted(load);
</script>

<template>
  <Page description="类目只在平台维护，商家建商品时只能选用。" title="商品类目">
    <Card>
      <Space class="mb-4">
        <Button type="primary" @click="createRoot">新建类目</Button>
      </Space>
      <Table
        :columns="columns"
        :data-source="dataSource"
        :loading="loading"
        :pagination="false"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <Tag :color="record.status === 'ENABLED' ? 'success' : 'default'">
              {{ record.statusName }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <Space>
              <Button size="small" type="link" @click="edit(record)">
                编辑
              </Button>
              <Popconfirm title="删除这个类目？" @confirm="remove(record.id)">
                <Button danger size="small" type="link">删除</Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </Card>
    <Modal
      v-model:open="open"
      :confirm-loading="saving"
      :title="form.id ? '编辑类目' : '新建类目'"
      @ok="save"
    >
      <Form layout="vertical">
        <FormItem label="名称" required>
          <Input v-model:value="form.name" placeholder="例如 生鲜" />
        </FormItem>
        <FormItem label="上级">
          <Select v-model:value="form.parentId" :options="parentOptions" />
        </FormItem>
        <FormItem label="排序">
          <InputNumber v-model:value="form.sortNo" :min="0" class="w-full" />
        </FormItem>
        <FormItem label="状态">
          <Select
            v-model:value="form.status"
            :options="[
              { label: '启用', value: 'ENABLED' },
              { label: '停用', value: 'DISABLED' },
            ]"
          />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>
