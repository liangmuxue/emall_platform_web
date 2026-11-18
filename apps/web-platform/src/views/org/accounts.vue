<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { onMounted, ref } from 'vue';

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

type Account = {
  id: number;
  login: string;
  merchant: string;
  owner: string;
  role?: string;
  shop: string;
  status: string;
};
type Role = { id: number; name: string; status: string };

const rows = ref<Account[]>([]);
const roles = ref<Role[]>([]);
const open = ref(false);
const editingId = ref<null | number>(null);
const form = ref({
  login: '',
  merchant: '',
  owner: '',
  phone: '',
  roleId: undefined as number | undefined,
  shop: '',
  status: '启用',
});

const columns: TableColumnsType<Account> = [
  { title: '商户', dataIndex: 'merchant', key: 'merchant' },
  { title: '店铺', dataIndex: 'shop', key: 'shop' },
  { title: '负责人', dataIndex: 'owner', key: 'owner' },
  { title: '登录账号', dataIndex: 'login', key: 'login' },
  { title: '岗位', dataIndex: 'role', key: 'role' },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 90 },
];

async function load() {
  const [accounts, roleRows] = await Promise.all([
    requestClient.get<Account[]>('/merchant-accounts'),
    requestClient.get<Role[]>('/merchant-accounts/roles'),
  ]);
  rows.value = accounts;
  roles.value = roleRows;
}

function openCreate() {
  editingId.value = null;
  form.value = {
    login: '',
    merchant: '',
    owner: '',
    phone: '',
    roleId: undefined,
    shop: '',
    status: '启用',
  };
  open.value = true;
}

function openEdit(row: Account) {
  editingId.value = row.id;
  const role = roles.value.find((item) => item.name === row.role);
  form.value = {
    login: row.login,
    merchant: row.merchant,
    owner: row.owner,
    phone: '',
    roleId: role?.id,
    shop: row.shop,
    status: row.status,
  };
  open.value = true;
}

async function save() {
  if (editingId.value) {
    await requestClient.put(`/merchant-accounts/${editingId.value}`, {
      roleId: form.value.roleId,
      status: form.value.status,
    });
    message.success('商家账号已保存');
  } else {
    await requestClient.post('/merchant-accounts', form.value);
    message.success('账号已开通，初始密码 123456');
  }
  open.value = false;
  await load();
}

onMounted(load);
</script>

<template>
  <Page title="商家账号">
    <div class="toolbar">
      <span class="muted">开通商家经营后台登录号。菜单权限由商家端岗位决定，这里只绑初始岗位。一商户对应一个店铺。初始密码
        123456。</span>
      <Button type="primary" @click="openCreate">开通账号</Button>
    </div>
    <Table
      :columns="columns"
      :data-source="rows"
      :pagination="{ pageSize: 10 }"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <Tag :color="record.status === '启用' ? 'green' : 'default'">
            {{ record.status }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <Button size="small" type="link" @click="openEdit(record as Account)">
            处理
          </Button>
        </template>
      </template>
    </Table>
    <Modal
      v-model:open="open"
      :title="editingId ? '处理商家账号' : '开通商家账号'"
      @ok="save"
    >
      <Input
        v-model:value="form.merchant"
        :disabled="!!editingId"
        placeholder="商户名称"
      />
      <Input
        v-model:value="form.shop"
        :disabled="!!editingId"
        class="field"
        placeholder="店铺名称"
      />
      <Input
        v-model:value="form.owner"
        :disabled="!!editingId"
        class="field"
        placeholder="负责人"
      />
      <Input
        v-model:value="form.login"
        :disabled="!!editingId"
        class="field"
        placeholder="登录账号"
      />
      <Select
        v-model:value="form.roleId"
        :options="
          roles
            .filter((item) => item.status === '启用')
            .map((item) => ({ label: item.name, value: item.id }))
        "
        class="field"
        placeholder="初始岗位"
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
