<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Form,
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
const loading = ref(false);
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
  { title: '负责人', dataIndex: 'owner', key: 'owner', width: 120 },
  { title: '登录账号', dataIndex: 'login', key: 'login', width: 150 },
  { title: '岗位', dataIndex: 'role', key: 'role', width: 140 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 90 },
];

const roleOptions = computed(() =>
  roles.value
    .filter((item) => item.status === '启用')
    .map((item) => ({ label: item.name, value: item.id })),
);
const selectedRoleName = computed(
  () =>
    roleOptions.value.find((item) => item.value === form.value.roleId)?.label ||
    '未选岗位',
);
const enabledCount = computed(
  () => rows.value.filter((item) => item.status === '启用').length,
);

async function load() {
  loading.value = true;
  try {
    const [accounts, roleRows] = await Promise.all([
      requestClient.get<Account[]>('/merchant-accounts'),
      requestClient.get<Role[]>('/merchant-accounts/roles'),
    ]);
    rows.value = accounts;
    roles.value = roleRows;
  } finally {
    loading.value = false;
  }
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
    if (
      !form.value.merchant.trim() ||
      !form.value.shop.trim() ||
      !form.value.owner.trim() ||
      !form.value.login.trim()
    ) {
      message.warning('请填写商户、店铺、负责人和登录账号');
      throw new Error('required');
    }
    if (!form.value.roleId) {
      message.warning('请选择初始岗位');
      throw new Error('role required');
    }
    await requestClient.post('/merchant-accounts', {
      ...form.value,
      login: form.value.login.trim(),
      merchant: form.value.merchant.trim(),
      owner: form.value.owner.trim(),
      shop: form.value.shop.trim(),
    });
    message.success('账号已开通，初始密码 123456');
  }
  open.value = false;
  await load();
}

onMounted(load);
</script>

<template>
  <Page title="商家账号">
    <div class="head">
      <p class="lead">
        开通商家经营后台登录号。菜单权限由商家端岗位决定，这里只绑定初始岗位。一个商户对应一个店铺，初始密码是
        123456。
      </p>
      <Button type="primary" @click="openCreate">开通账号</Button>
    </div>
    <div class="board">
      <div class="metric sale">
        <span>账号</span>
        <b>{{ rows.length }}</b>
        <small>商家经营后台登录号</small>
      </div>
      <div class="metric warn">
        <span>启用中</span>
        <b>{{ enabledCount }}</b>
        <small>当前可以登录商家后台</small>
      </div>
      <div class="metric pending">
        <span>可选岗位</span>
        <b>{{ roleOptions.length }}</b>
        <small>启用中的商家岗位</small>
      </div>
    </div>
    <div class="panel">
      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="{ pageSize: 10 }"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'merchant'">
            <div class="who">
              <span class="avatar">{{
                String(record.merchant).slice(0, 1)
              }}</span>
              <div class="who-name">{{ record.merchant }}</div>
            </div>
          </template>
          <template v-else-if="column.key === 'login'">
            <span class="mono">{{ record.login }}</span>
          </template>
          <template v-else-if="column.key === 'role'">
            <Tag>{{ record.role || '未分配' }}</Tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <Tag :color="record.status === '启用' ? 'green' : 'default'">
              {{ record.status }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <Button
              size="small"
              type="link"
              @click="openEdit(record as Account)"
            >
              处理
            </Button>
          </template>
        </template>
      </Table>
    </div>
    <Modal v-model:open="open" ok-text="保存" width="680px" @ok="save">
      <template #title>
        <div class="dialog-title">
          <span class="avatar">{{
            (form.shop || form.merchant || '店').slice(0, 1)
          }}</span>
          <div>
            <div class="who-name">
              {{ editingId ? '处理商家账号' : '开通商家账号' }}
            </div>
            <div class="who-sub">
              {{ form.shop || '未填店铺' }} · {{ form.owner || '未填负责人' }} ·
              {{ selectedRoleName }}
            </div>
          </div>
        </div>
      </template>
      <div v-if="editingId" class="note">
        商户、店铺和登录账号已开通，这里可以调整岗位和启用状态。
      </div>
      <div v-else class="note password">
        <b>123456</b>
        <span>初始密码。商家首次登录经营后台后建议自行修改。</span>
      </div>
      <Form layout="vertical">
        <div class="form-grid">
          <Form.Item label="商户名称" required>
            <Input
              v-model:value="form.merchant"
              :disabled="!!editingId"
              placeholder="商户名称"
              size="large"
            />
          </Form.Item>
          <Form.Item label="店铺名称" required>
            <Input
              v-model:value="form.shop"
              :disabled="!!editingId"
              placeholder="店铺名称"
              size="large"
            />
          </Form.Item>
          <Form.Item label="负责人" required>
            <Input
              v-model:value="form.owner"
              :disabled="!!editingId"
              placeholder="负责人姓名"
              size="large"
            />
          </Form.Item>
          <Form.Item label="登录账号" required>
            <Input
              v-model:value="form.login"
              :disabled="!!editingId"
              placeholder="字母开头，创建后不能改"
              size="large"
            />
          </Form.Item>
          <Form.Item label="初始岗位" required>
            <Select
              v-model:value="form.roleId"
              :options="roleOptions"
              placeholder="选择商家岗位"
              size="large"
            />
          </Form.Item>
          <Form.Item label="状态">
            <div class="pills">
              <button
                :class="{ on: form.status === '启用' }"
                type="button"
                @click="form.status = '启用'"
              >
                启用
              </button>
              <button
                :class="{ off: form.status === '停用' }"
                type="button"
                @click="form.status = '停用'"
              >
                停用
              </button>
            </div>
          </Form.Item>
        </div>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.head {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.lead {
  max-width: 720px;
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
  color: #8c8c8c;
}

.head .lead {
  margin: 0;
}

.board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.metric {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  min-height: 112px;
  padding: 18px 20px;
  overflow: hidden;
  text-align: left;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
  isolation: isolate;
}

.metric::before,
.metric::after {
  position: absolute;
  pointer-events: none;
  content: '';
}

.metric::before {
  inset: 0;
  z-index: -1;
}

.metric::after {
  top: -36px;
  right: -28px;
  z-index: -1;
  width: 120px;
  height: 120px;
  border-radius: 50%;
}

.metric.sale::before {
  background: linear-gradient(
    145deg,
    hsl(var(--primary) / 28%),
    hsl(var(--card)) 58%
  );
}

.metric.sale::after {
  background: radial-gradient(
    circle,
    hsl(var(--primary) / 42%),
    transparent 68%
  );
}

.metric.warn::before {
  background: linear-gradient(
    145deg,
    hsl(var(--warning) / 26%),
    hsl(var(--card)) 58%
  );
}

.metric.warn::after {
  background: radial-gradient(
    circle,
    hsl(var(--warning) / 40%),
    transparent 68%
  );
}

.metric.pending::before {
  background: linear-gradient(
    145deg,
    hsl(var(--success) / 24%),
    hsl(var(--card)) 58%
  );
}

.metric.pending::after {
  background: radial-gradient(
    circle,
    hsl(var(--success) / 38%),
    transparent 68%
  );
}

.metric b {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  color: hsl(var(--foreground));
  letter-spacing: -0.03em;
}

.metric span {
  font-size: 13px;
  font-weight: 650;
  color: hsl(var(--foreground));
}

.metric small {
  max-width: 16em;
  font-size: 12px;
  line-height: 1.45;
  color: hsl(var(--muted-foreground));
}

.metric.sale b {
  color: hsl(var(--primary));
}

.metric.warn b {
  color: hsl(var(--warning));
}

.metric.pending b {
  color: hsl(var(--success));
}

.panel {
  padding: 4px 8px 8px;
  border: 1px solid color-mix(in srgb, currentcolor 10%, transparent);
  border-radius: 12px;
}

.who {
  display: flex;
  gap: 10px;
  align-items: center;
}

.avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  font-weight: 650;
  color: #1677ff;
  background: color-mix(in srgb, #1677ff 16%, transparent);
  border-radius: 10px;
}

.who-name {
  font-weight: 600;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;
}

.dialog-title {
  display: flex;
  gap: 12px;
  align-items: center;
}

.pills {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 40px;
}

.pills button {
  height: 36px;
  padding: 0 18px;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: 1px solid color-mix(in srgb, currentcolor 16%, transparent);
  border-radius: 999px;
}

.pills button.on {
  color: #1677ff;
  background: color-mix(in srgb, #1677ff 12%, transparent);
  border-color: #1677ff;
}

.pills button.off {
  color: #ff4d4f;
  background: color-mix(in srgb, #ff4d4f 12%, transparent);
  border-color: #ff4d4f;
}

.note {
  margin-bottom: 16px;
  font-size: 13px;
  color: #8c8c8c;
}

.note.password {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  background: linear-gradient(
    145deg,
    hsl(var(--primary) / 22%),
    hsl(var(--card)) 62%
  );
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.note.password b {
  font-size: 20px;
  font-weight: 700;
  color: hsl(var(--primary));
  letter-spacing: 0.04em;
}
</style>
