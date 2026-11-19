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
  Popconfirm,
  Table,
  Tag,
} from 'ant-design-vue';

import { requestClient } from '#/api/request';

type Point = {
  accountId?: null | number;
  accountLogin?: null | string;
  address: string;
  hours?: null | string;
  id: number;
  latitude?: null | number;
  longitude?: null | number;
  manager: string;
  mobile: string;
  name: string;
  pointNo: string;
  status: string;
  statusName: string;
};

type Account = {
  id: number;
  lastLoginAt: string;
  login: string;
  person: string;
  phone?: null | string;
  pickupName: string;
  pickupPointId: number;
  status: string;
  statusName: string;
};

const points = ref<Point[]>([]);
const accounts = ref<Account[]>([]);
const loading = ref(false);
const keyword = ref('');

const pointOpen = ref(false);
const pointSaving = ref(false);
const pointId = ref<null | number>(null);
const pointForm = ref({
  address: '',
  hours: '',
  latitude: '',
  longitude: '',
  manager: '',
  mobile: '',
  name: '',
  status: '营业中',
});

const accountOpen = ref(false);
const accountSaving = ref(false);
const accountId = ref<null | number>(null);
const accountForm = ref({
  login: '',
  password: '',
  person: '',
  phone: '',
  pickupPointId: undefined as number | undefined,
  status: '启用',
});

const passwordOpen = ref(false);
const passwordSaving = ref(false);
const passwordAccount = ref<Account | null>(null);
const password = ref('');

const pointColumns: TableColumnsType<Point> = [
  { title: '自提点', key: 'name' },
  { title: '地址', dataIndex: 'address', key: 'address' },
  { title: '负责人', dataIndex: 'manager', key: 'manager', width: 110 },
  { title: '电话', dataIndex: 'mobile', key: 'mobile', width: 140 },
  { title: '营业时间', key: 'hours', width: 160 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 90 },
];

const accountColumns: TableColumnsType<Account> = [
  { title: '绑定自提点', dataIndex: 'pickupName', key: 'pickupName' },
  { title: '负责人', dataIndex: 'person', key: 'person', width: 110 },
  { title: '手机号', key: 'phone', width: 140 },
  { title: '登录账号', dataIndex: 'login', key: 'login', width: 140 },
  { title: '最近登录', key: 'lastLoginAt', width: 160 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 220 },
];

const filteredPoints = computed(() => {
  const text = keyword.value.trim();
  if (!text) return points.value;
  return points.value.filter((item) =>
    [item.name, item.address, item.manager, item.mobile, item.pointNo]
      .join(' ')
      .includes(text),
  );
});

const openCount = computed(
  () => points.value.filter((item) => item.status === 'ENABLED').length,
);
const accountCount = computed(
  () => accounts.value.filter((item) => item.status === 'ENABLED').length,
);

const pointOptions = computed(() =>
  points.value
    .filter((item) => !item.accountId || item.accountId === accountId.value)
    .map((item) => ({
      label: `${item.name} · ${item.statusName}`,
      value: item.id,
    })),
);

async function load() {
  loading.value = true;
  try {
    const [pointRows, accountRows] = await Promise.all([
      requestClient.get<Point[]>('/pickup-points'),
      requestClient.get<Account[]>('/pickup-points/accounts'),
    ]);
    points.value = pointRows;
    accounts.value = accountRows;
  } finally {
    loading.value = false;
  }
}

function openPoint() {
  pointId.value = null;
  pointForm.value = {
    address: '',
    hours: '',
    latitude: '',
    longitude: '',
    manager: '',
    mobile: '',
    name: '',
    status: '营业中',
  };
  pointOpen.value = true;
}

function editPoint(row: Point) {
  pointId.value = row.id;
  pointForm.value = {
    address: row.address,
    hours: row.hours || '',
    latitude:
      row.latitude === null || row.latitude === undefined
        ? ''
        : String(row.latitude),
    longitude:
      row.longitude === null || row.longitude === undefined
        ? ''
        : String(row.longitude),
    manager: row.manager,
    mobile: row.mobile,
    name: row.name,
    status: row.statusName,
  };
  pointOpen.value = true;
}

async function savePoint() {
  pointSaving.value = true;
  const longitude = pointForm.value.longitude.trim();
  const latitude = pointForm.value.latitude.trim();
  const body = {
    ...pointForm.value,
    hours: pointForm.value.hours.trim(),
    longitude: longitude ? Number(longitude) : null,
    latitude: latitude ? Number(latitude) : null,
  };
  try {
    await (pointId.value
      ? requestClient.put(`/pickup-points/${pointId.value}`, body)
      : requestClient.post('/pickup-points', body));
    message.success(pointId.value ? '自提点已保存' : '自提点已新增');
    pointOpen.value = false;
    await load();
  } finally {
    pointSaving.value = false;
  }
}

function openAccount() {
  accountId.value = null;
  accountForm.value = {
    login: '',
    password: '',
    person: '',
    phone: '',
    pickupPointId: pointOptions.value[0]?.value,
    status: '启用',
  };
  accountOpen.value = true;
}

function editAccount(row: Account) {
  accountId.value = row.id;
  accountForm.value = {
    login: row.login,
    password: '',
    person: row.person,
    phone: row.phone || '',
    pickupPointId: row.pickupPointId,
    status: row.statusName,
  };
  accountOpen.value = true;
}

async function saveAccount() {
  accountSaving.value = true;
  const body = {
    login: accountForm.value.login,
    password: accountForm.value.password,
    person: accountForm.value.person,
    phone: accountForm.value.phone,
    pickupPointId: accountForm.value.pickupPointId,
    status: accountForm.value.status,
  };
  try {
    await (accountId.value
      ? requestClient.put(`/pickup-points/accounts/${accountId.value}`, body)
      : requestClient.post('/pickup-points/accounts', body));
    message.success(accountId.value ? '登录账号已保存' : '登录账号已创建');
    accountOpen.value = false;
    await load();
  } finally {
    accountSaving.value = false;
  }
}

async function toggleAccount(row: Account) {
  await requestClient.put(`/pickup-points/accounts/${row.id}`, {
    person: row.person,
    phone: row.phone,
    pickupPointId: row.pickupPointId,
    status: row.status === 'ENABLED' ? '停用' : '启用',
  });
  message.success(row.status === 'ENABLED' ? '账号已停用' : '账号已启用');
  await load();
}

function openPassword(row: Account) {
  passwordAccount.value = row;
  password.value = '';
  passwordOpen.value = true;
}

async function savePassword() {
  if (!passwordAccount.value) return;
  passwordSaving.value = true;
  try {
    await requestClient.put(
      `/pickup-points/accounts/${passwordAccount.value.id}/password`,
      { password: password.value },
    );
    message.success('密码已重置，请安全告知负责人');
    passwordOpen.value = false;
  } finally {
    passwordSaving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page
    description="自提点由平台独立维护，不挂在店铺下面。一个自提点只能绑定一个小程序登录账号。"
    title="自提点"
  >
    <div class="board">
      <div class="metric sale">
        <b>{{ points.length }}</b>
        <span>自提点</span>
        <small>顾客下单时只能选到营业中的点</small>
      </div>
      <div class="metric pending">
        <b>{{ openCount }}</b>
        <span>营业中</span>
        <small>休息中的点不会出现在 C 端</small>
      </div>
      <div class="metric warn">
        <b>{{ accountCount }}</b>
        <span>可登录账号</span>
        <small>停用后无法进入自提点小程序</small>
      </div>
    </div>

    <section class="callout">
      <div>
        <b>自提点小程序账号</b>
        <span>账号登录后只看自己绑定的自提点，以及这个点的待提订单。密码不会出现在列表里。</span>
      </div>
      <Button type="primary" @click="openAccount">新增登录账号</Button>
    </section>

    <div class="panel">
      <div class="head">
        <div>
          <h3>自提点资料</h3>
          <p>维护名称、地址、营业时间和联系电话。</p>
        </div>
        <div class="tools">
          <Input
            v-model:value="keyword"
            allow-clear
            placeholder="搜索名称、地址或电话"
          />
          <Button type="primary" @click="openPoint">新增自提点</Button>
        </div>
      </div>
      <Table
        :columns="pointColumns"
        :data-source="filteredPoints"
        :loading="loading"
        :pagination="false"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="who">
              <span class="avatar">{{ record.name.slice(0, 1) }}</span>
              <div>
                <div class="who-name">{{ record.name }}</div>
                <div class="muted">{{ record.pointNo }}</div>
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'hours'">
            {{ record.hours || '未设置' }}
          </template>
          <template v-else-if="column.key === 'status'">
            <Tag :color="record.status === 'ENABLED' ? 'success' : 'default'">
              {{ record.statusName }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <Button
              size="small"
              type="link"
              @click="editPoint(record as Point)"
            >
              编辑
            </Button>
          </template>
        </template>
      </Table>
    </div>

    <div class="panel">
      <div class="head">
        <div>
          <h3>登录账号</h3>
          <p>一个账号只绑定一个自提点，可以重置密码或停用。</p>
        </div>
      </div>
      <Table
        :columns="accountColumns"
        :data-source="accounts"
        :loading="loading"
        :pagination="false"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'phone'">
            {{ record.phone || '未填写' }}
          </template>
          <template v-else-if="column.key === 'lastLoginAt'">
            {{ record.lastLoginAt || '尚未登录' }}
          </template>
          <template v-else-if="column.key === 'status'">
            <Tag :color="record.status === 'ENABLED' ? 'success' : 'default'">
              {{ record.statusName }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <Button
              size="small"
              type="link"
              @click="editAccount(record as Account)"
            >
              编辑
            </Button>
            <Button
              size="small"
              type="link"
              @click="openPassword(record as Account)"
            >
              重置密码
            </Button>
            <Popconfirm
              :title="
                record.status === 'ENABLED'
                  ? '停用后将无法登录自提点小程序'
                  : '启用后可以继续登录'
              "
              @confirm="toggleAccount(record as Account)"
            >
              <Button size="small" type="link">
                {{ record.status === 'ENABLED' ? '停用' : '启用' }}
              </Button>
            </Popconfirm>
          </template>
        </template>
      </Table>
    </div>

    <Modal
      v-model:open="pointOpen"
      :confirm-loading="pointSaving"
      ok-text="保存"
      width="720px"
      @ok="savePoint"
    >
      <template #title>
        <div class="dialog-title">
          <span class="mark">{{ (pointForm.name || '提').slice(0, 1) }}</span>
          <div>
            <div class="who-name">
              {{ pointId ? '编辑自提点' : '新增自提点' }}
            </div>
            <div class="who-sub">
              {{ pointForm.name || '还没填写名称' }} · {{ pointForm.status }}
            </div>
          </div>
        </div>
      </template>
      <div class="point-hero" :class="{ rest: pointForm.status !== '营业中' }">
        <b>{{
          pointForm.status === '营业中'
            ? '保存后，顾客下单就能选到这个点'
            : '休息中的点不会出现在 C 端'
        }}</b>
        <span>自提点由平台单独维护，不挂在店铺下面。</span>
      </div>
      <Form layout="vertical" class="point-form">
        <div class="section-label">基本资料</div>
        <Form.Item label="自提点名称" required>
          <Input
            v-model:value="pointForm.name"
            placeholder="例如：动漫游大厦自提点"
            size="large"
          />
        </Form.Item>
        <div class="form-grid">
          <Form.Item label="负责人" required>
            <Input
              v-model:value="pointForm.manager"
              placeholder="负责人姓名"
              size="large"
            />
          </Form.Item>
          <Form.Item label="联系电话" required>
            <Input
              v-model:value="pointForm.mobile"
              placeholder="11 位手机号"
              size="large"
            />
          </Form.Item>
        </div>
        <div class="section-label">到店信息</div>
        <Form.Item label="地址" required>
          <Input
            v-model:value="pointForm.address"
            placeholder="顾客到店能找到的地址"
            size="large"
          />
        </Form.Item>
        <Form.Item label="营业时间">
          <Input
            v-model:value="pointForm.hours"
            placeholder="例如：09:00-21:00，14:00 截单"
            size="large"
          />
        </Form.Item>
        <div class="form-grid">
          <Form.Item label="经度">
            <Input
              v-model:value="pointForm.longitude"
              placeholder="例如 121.5272"
              size="large"
            />
          </Form.Item>
          <Form.Item label="纬度">
            <Input
              v-model:value="pointForm.latitude"
              placeholder="例如 38.8586"
              size="large"
            />
          </Form.Item>
        </div>
        <div class="section-label">营业状态</div>
        <div class="status-cards">
          <button
            :class="{ on: pointForm.status === '营业中' }"
            type="button"
            @click="pointForm.status = '营业中'"
          >
            <b>营业中</b>
            <span>C 端下单可以选择</span>
          </button>
          <button
            :class="{ off: pointForm.status === '休息中' }"
            type="button"
            @click="pointForm.status = '休息中'"
          >
            <b>休息中</b>
            <span>暂时不对外展示</span>
          </button>
        </div>
      </Form>
    </Modal>

    <Modal
      v-model:open="accountOpen"
      :confirm-loading="accountSaving"
      :title="accountId ? '编辑登录账号' : '新增登录账号'"
      ok-text="保存"
      @ok="saveAccount"
    >
      <div class="note">
        绑定后，自提点小程序只展示这个点的待提订单。密码不会在列表中展示。
      </div>
      <Form layout="vertical">
        <Form.Item label="绑定自提点" required>
          <select v-model="accountForm.pickupPointId" class="native">
            <option v-if="!pointOptions.length" disabled value="">
              没有可绑定的自提点
            </option>
            <option
              v-for="item in pointOptions"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </option>
          </select>
        </Form.Item>
        <div class="form-grid">
          <Form.Item label="负责人" required>
            <Input
              v-model:value="accountForm.person"
              placeholder="负责人姓名"
            />
          </Form.Item>
          <Form.Item label="手机号" required>
            <Input
              v-model:value="accountForm.phone"
              placeholder="11 位手机号"
            />
          </Form.Item>
          <Form.Item label="登录账号" required>
            <Input
              v-model:value="accountForm.login"
              :disabled="!!accountId"
              placeholder="字母开头，创建后不能改"
            />
          </Form.Item>
          <Form.Item v-if="!accountId" label="初始密码" required>
            <Input.Password
              v-model:value="accountForm.password"
              placeholder="至少 6 位"
            />
          </Form.Item>
        </div>
        <Form.Item label="账号状态">
          <div class="pills">
            <button
              :class="{ on: accountForm.status === '启用' }"
              type="button"
              @click="accountForm.status = '启用'"
            >
              启用
            </button>
            <button
              :class="{ off: accountForm.status === '停用' }"
              type="button"
              @click="accountForm.status = '停用'"
            >
              停用
            </button>
          </div>
        </Form.Item>
      </Form>
    </Modal>

    <Modal
      v-model:open="passwordOpen"
      :confirm-loading="passwordSaving"
      ok-text="重置"
      title="重置登录密码"
      @ok="savePassword"
    >
      <div class="note">
        正在重置账号「{{
          passwordAccount?.login
        }}」。新密码只用于进入自提点小程序。
      </div>
      <Form layout="vertical">
        <Form.Item label="新密码" required>
          <Input.Password v-model:value="password" placeholder="至少 6 位" />
        </Form.Item>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
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
  min-height: 112px;
  padding: 18px 20px;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.metric::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: '';
}

.metric.sale::before {
  background: linear-gradient(
    145deg,
    hsl(var(--primary) / 28%),
    hsl(var(--card)) 58%
  );
}

.metric.pending::before {
  background: linear-gradient(
    145deg,
    hsl(var(--success) / 24%),
    hsl(var(--card)) 58%
  );
}

.metric.warn::before {
  background: linear-gradient(
    145deg,
    hsl(var(--warning) / 26%),
    hsl(var(--card)) 58%
  );
}

.metric b,
.metric span,
.metric small {
  position: relative;
}

.metric b {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
}

.metric span {
  font-size: 13px;
  font-weight: 650;
}

.metric small {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.callout {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  margin-bottom: 16px;
  background: linear-gradient(
    145deg,
    hsl(var(--primary) / 18%),
    hsl(var(--card)) 62%
  );
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.callout b,
.callout span {
  display: block;
}

.callout span {
  margin-top: 4px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.panel {
  padding: 16px;
  margin-bottom: 16px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.head {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.head h3 {
  margin: 0;
  font-size: 16px;
}

.head p,
.muted,
.note {
  margin: 4px 0 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.tools {
  display: flex;
  gap: 8px;
  align-items: center;
}

.tools :deep(.ant-input-affix-wrapper),
.tools :deep(.ant-input) {
  width: 240px;
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

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;
}

.pills {
  display: flex;
  gap: 8px;
}

.pills button,
.native {
  height: 36px;
  padding: 0 16px;
  color: inherit;
  background: transparent;
  border: 1px solid color-mix(in srgb, currentcolor 16%, transparent);
  border-radius: 8px;
}

.pills button {
  cursor: pointer;
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

.native {
  width: 100%;
}

.note {
  margin-bottom: 12px;
}

.dialog-title {
  display: flex;
  gap: 12px;
  align-items: center;
}

.mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 42px;
  height: 42px;
  font-size: 18px;
  font-weight: 700;
  color: #1677ff;
  background: color-mix(in srgb, #1677ff 16%, transparent);
  border-radius: 12px;
}

.who-sub {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.point-hero {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  margin-bottom: 18px;
  background: linear-gradient(
    145deg,
    hsl(var(--success) / 22%),
    hsl(var(--card)) 64%
  );
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.point-hero.rest {
  background: linear-gradient(
    145deg,
    hsl(var(--warning) / 24%),
    hsl(var(--card)) 64%
  );
}

.point-hero b {
  font-size: 15px;
}

.point-hero span {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.section-label {
  margin: 4px 0 12px;
  font-size: 13px;
  font-weight: 650;
  color: hsl(var(--foreground));
}

.point-form :deep(.ant-form-item) {
  margin-bottom: 14px;
}

.status-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.status-cards button {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 1px solid color-mix(in srgb, currentcolor 14%, transparent);
  border-radius: 14px;
}

.status-cards b {
  font-size: 15px;
}

.status-cards span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.status-cards button.on {
  background: color-mix(in srgb, #1677ff 12%, transparent);
  border-color: #1677ff;
}

.status-cards button.on b {
  color: #1677ff;
}

.status-cards button.off {
  background: color-mix(in srgb, #ff4d4f 10%, transparent);
  border-color: #ff4d4f;
}

.status-cards button.off b {
  color: #ff4d4f;
}
</style>
