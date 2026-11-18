<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Input,
  message,
  Modal,
  Select,
  Table,
  Tag,
} from 'ant-design-vue';

import { requestClient } from '#/api/request';

type Role = { id: number; name: string; status: string };
type Staff = {
  id: number;
  login: string;
  name: string;
  phone?: string;
  role?: string;
  roleId?: number;
  status: string;
};

const rows = ref<Staff[]>([]);
const roles = ref<Role[]>([]);
const open = ref(false);
const editingId = ref<null | number>(null);
const form = ref({
  login: '',
  name: '',
  phone: '',
  roleId: undefined as number | undefined,
  status: '启用',
});

const columns: TableColumnsType<Staff> = [
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '登录账号', dataIndex: 'login', key: 'login' },
  { title: '岗位', dataIndex: 'role', key: 'role' },
  { title: '手机号', dataIndex: 'phone', key: 'phone' },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 90 },
];
const roleOptions = computed(() =>
  roles.value
    .filter((item) => item.status === '启用')
    .map((item) => ({ label: item.name, value: item.id })),
);

async function load() {
  rows.value = await requestClient.get<Staff[]>('/org/staff');
  roles.value = await requestClient.get<Role[]>('/org/roles');
}

function edit(row?: Staff) {
  editingId.value = row?.id ?? null;
  form.value = {
    login: row?.login ?? '',
    name: row?.name ?? '',
    phone: row?.phone ?? '',
    roleId: row?.roleId,
    status: row?.status ?? '启用',
  };
  open.value = true;
}

async function save() {
  if (editingId.value) {
    await requestClient.put(`/org/staff/${editingId.value}`, form.value);
    message.success('员工已保存');
  } else {
    await requestClient.post('/org/staff', form.value);
    message.success('员工已新增，初始密码 123456');
  }
  open.value = false;
  await load();
}

onMounted(load);
</script>

<template>
  <Page title="员工账号">
    <div class="toolbar">
      <span class="muted">员工使用登录账号进入商家后台，菜单由岗位决定。新账号初始密码
        123456，登录账号创建后不能改。</span>
      <Button type="primary" @click="edit()">新增员工</Button>
    </div>
    <Table
      :columns="columns"
      :data-source="rows"
      :pagination="false"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <Tag :color="record.status === '启用' ? 'green' : 'default'">
            {{ record.status }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <Button size="small" type="link" @click="edit(record as Staff)">
            编辑
          </Button>
        </template>
      </template>
    </Table>
    <Modal
      v-model:open="open"
      :title="editingId ? '编辑员工' : '新增员工'"
      @ok="save"
    >
      <Input v-model:value="form.name" placeholder="姓名" />
      <Input
        v-model:value="form.login"
        :disabled="!!editingId"
        class="field"
        placeholder="登录账号"
      />
      <Select
        v-model:value="form.roleId"
        :options="roleOptions"
        class="field"
        placeholder="岗位"
      />
      <Input
        v-model:value="form.phone"
        class="field"
        placeholder="手机号，选填"
      />
      <Select
        v-model:value="form.status"
        :options="[
          { label: '启用', value: '启用' },
          { label: '停用', value: '停用' },
        ]"
        class="field"
      />
    </Modal>
  </Page>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.muted {
  font-size: 12px;
  color: #8c8c8c;
}

.field {
  width: 100%;
  margin-top: 12px;
}
</style>
