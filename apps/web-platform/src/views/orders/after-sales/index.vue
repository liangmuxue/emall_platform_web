<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Input, message, Modal, Table, Tag } from 'ant-design-vue';

import { requestClient } from '#/api/request';

type Line = { amount: string; name: string; quantity: number; spec: string };

type CaseRow = {
  amount: string;
  arbitrationReason?: string;
  arbitrationResult?: string;
  buyer: string;
  createdAt: string;
  id: number;
  items?: Line[];
  mobile: string;
  no: string;
  orderNo: string;
  reasonName: string;
  reasonText?: string;
  reply?: string;
  shopName: string;
  status: string;
  statusName: string;
  trackingNo?: string;
  typeName: string;
};

const rows = ref<CaseRow[]>([]);
const filter = ref('ARBITRATING');
const loading = ref(false);
const acting = ref(false);
const open = ref(false);
const detail = ref<CaseRow | null>(null);
const support = ref<'BUYER' | 'MERCHANT'>('BUYER');
const result = ref('');

const columns: TableColumnsType<CaseRow> = [
  { title: '售后单', dataIndex: 'no', key: 'no', width: 210 },
  { title: '店铺', dataIndex: 'shopName', key: 'shop', width: 160 },
  { title: '顾客', key: 'buyer', width: 150 },
  { title: '类型', dataIndex: 'typeName', key: 'type', width: 110 },
  { title: '金额', key: 'amount', width: 100 },
  { title: '状态', key: 'status', width: 120 },
  { title: '操作', key: 'action', width: 90 },
];

const filters = [
  { key: 'ARBITRATING', label: '待仲裁' },
  { key: 'REFUNDED', label: '已退款' },
  { key: 'CLOSED', label: '已关闭' },
  { key: 'ALL', label: '全部' },
];

const shown = computed(() =>
  filter.value === 'ALL'
    ? rows.value
    : rows.value.filter((item) => item.status === filter.value),
);

const color: Record<string, string> = {
  ARBITRATING: 'orange',
  CLOSED: 'default',
  PENDING_MERCHANT: 'blue',
  REFUNDED: 'green',
  REJECTED: 'red',
  WAIT_RETURN: 'gold',
};

async function load() {
  loading.value = true;
  try {
    rows.value = await requestClient.get<CaseRow[]>('/after-sales');
  } finally {
    loading.value = false;
  }
}

async function show(row: CaseRow) {
  open.value = true;
  support.value = 'BUYER';
  result.value = '';
  detail.value = await requestClient.get<CaseRow>(`/after-sales/${row.id}`);
}

async function verdict() {
  if (!detail.value || acting.value) return;
  if (!result.value.trim()) {
    message.warning('请填写仲裁说明');
    return;
  }
  acting.value = true;
  try {
    detail.value = await requestClient.post<CaseRow>(
      `/after-sales/${detail.value.id}/arbitrate`,
      { support: support.value, result: result.value.trim() },
    );
    message.success(
      support.value === 'BUYER' ? '已支持顾客并退款' : '已支持商家',
    );
    await load();
  } finally {
    acting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page title="售后仲裁">
    <div class="toolbar">
      <button
        v-for="item in filters"
        :key="item.key"
        :class="{ on: filter === item.key }"
        type="button"
        @click="filter = item.key"
      >
        {{ item.label }}
      </button>
    </div>
    <Table
      :columns="columns"
      :data-source="shown"
      :loading="loading"
      :pagination="{ pageSize: 10 }"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'buyer'">
          {{ record.buyer }}
          <div class="muted">{{ record.mobile }}</div>
        </template>
        <template v-else-if="column.key === 'amount'">
          ¥{{ record.amount }}
        </template>
        <template v-else-if="column.key === 'status'">
          <Tag :color="color[record.status] || 'default'">
            {{ record.statusName }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <Button size="small" type="link" @click="show(record as CaseRow)">
            查看
          </Button>
        </template>
      </template>
    </Table>

    <Modal :footer="null" :open="open" width="760px" @cancel="open = false">
      <template #title>
        <div class="dialog-title">
          <span class="avatar">{{
            (detail?.shopName || '售').slice(0, 1)
          }}</span>
          <div>
            <div class="who-name">{{ detail?.no || '售后详情' }}</div>
            <div class="who-sub">
              {{ detail?.typeName || '正在读取' }}
              <template v-if="detail"> · {{ detail.statusName }}</template>
            </div>
          </div>
        </div>
      </template>
      <p v-if="!detail" class="muted">正在读取售后单…</p>
      <template v-else>
        <div class="amount">
          <div>
            <span>申请金额</span>
            <b>¥{{ detail.amount }}</b>
          </div>
          <Tag :color="color[detail.status] || 'default'">
            {{ detail.statusName }}
          </Tag>
        </div>

        <div class="facts">
          <div>
            <span>顾客</span>
            <b>{{ detail.buyer }}</b>
            <small>{{ detail.mobile || '未留手机号' }}</small>
          </div>
          <div>
            <span>店铺</span>
            <b>{{ detail.shopName }}</b>
            <small>{{ detail.orderNo }}</small>
          </div>
          <div>
            <span>申请时间</span>
            <b>{{ detail.createdAt || '—' }}</b>
            <small>{{ detail.typeName }}</small>
          </div>
          <div>
            <span>退货物流</span>
            <b>{{ detail.trackingNo || '暂无单号' }}</b>
            <small>顾客寄回后填写</small>
          </div>
        </div>

        <section class="block">
          <div class="block-title">申请商品</div>
          <p v-if="!detail.items?.length" class="muted">没有商品明细</p>
          <div v-else class="lines">
            <div v-for="(item, index) in detail.items" :key="index">
              <div>
                <b>{{ item.name }}</b>
                <small>{{ item.spec || '默认规格' }} × {{ item.quantity }}</small>
              </div>
              <b>¥{{ item.amount }}</b>
            </div>
          </div>
        </section>

        <section class="block">
          <div class="block-title">双方说明</div>
          <div class="notes">
            <div>
              <span>申请原因</span>
              <p>
                {{ detail.reasonName
                }}{{ detail.reasonText ? `，${detail.reasonText}` : '' }}
              </p>
            </div>
            <div>
              <span>商家回复</span>
              <p>{{ detail.reply || '商家还没有回复' }}</p>
            </div>
            <div>
              <span>申请仲裁理由</span>
              <p>{{ detail.arbitrationReason || '未填写' }}</p>
            </div>
          </div>
        </section>

        <section v-if="detail.arbitrationResult" class="block result">
          <div class="block-title">仲裁结果</div>
          <p>{{ detail.arbitrationResult }}</p>
        </section>

        <section v-if="detail.status === 'ARBITRATING'" class="block decide">
          <div class="block-title">仲裁决定</div>
          <div class="choices">
            <button
              :class="{ on: support === 'BUYER' }"
              type="button"
              @click="support = 'BUYER'"
            >
              <b>支持顾客</b>
              <small>按申请金额退款</small>
            </button>
            <button
              :class="{ danger: support === 'MERCHANT' }"
              type="button"
              @click="support = 'MERCHANT'"
            >
              <b>支持商家</b>
              <small>关闭这单售后</small>
            </button>
          </div>
          <Input.TextArea
            v-model:value="result"
            :maxlength="200"
            :rows="3"
            placeholder="写下仲裁说明，顾客和商家都能看到"
            show-count
          />
          <div class="actions">
            <Button
              :danger="support === 'MERCHANT'"
              :loading="acting"
              type="primary"
              @click="verdict"
            >
              {{ support === 'BUYER' ? '确认退款' : '确认关闭' }}
            </Button>
          </div>
        </section>
      </template>
    </Modal>
  </Page>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.toolbar button {
  height: 32px;
  padding: 0 14px;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: 1px solid color-mix(in srgb, currentcolor 18%, transparent);
  border-radius: 999px;
}

.toolbar button.on {
  color: #1677ff;
  background: color-mix(in srgb, #1677ff 16%, transparent);
  border-color: #1677ff;
}

.muted {
  font-size: 12px;
  color: #8c8c8c;
}

.dialog-title {
  display: flex;
  gap: 12px;
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
  font-weight: 650;
}

.who-sub {
  margin-top: 2px;
  font-size: 12px;
  font-weight: 400;
  color: #8c8c8c;
}

.amount {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  margin-bottom: 14px;
  background: linear-gradient(
    145deg,
    hsl(var(--warning) / 24%),
    hsl(var(--card)) 62%
  );
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.amount span {
  display: block;
  font-size: 12px;
  color: #8c8c8c;
}

.amount b {
  display: block;
  margin-top: 2px;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  color: #cf1322;
  letter-spacing: -0.03em;
}

.facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}

.facts > div {
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, currentcolor 12%, transparent);
  border-radius: 12px;
}

.facts span,
.notes span,
.block-title {
  display: block;
  font-size: 12px;
  color: #8c8c8c;
}

.facts b,
.lines b {
  display: block;
  margin-top: 4px;
  font-weight: 650;
}

.facts small,
.lines small {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: #8c8c8c;
}

.block {
  margin-bottom: 14px;
}

.block-title {
  margin-bottom: 8px;
  font-weight: 650;
  color: inherit;
}

.lines {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, currentcolor 12%, transparent);
  border-radius: 12px;
}

.lines > div {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
}

.lines > div + div {
  border-top: 1px solid color-mix(in srgb, currentcolor 10%, transparent);
}

.notes {
  display: grid;
  gap: 10px;
}

.notes > div {
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, currentcolor 12%, transparent);
  border-radius: 12px;
}

.notes p,
.result p {
  margin: 6px 0 0;
  line-height: 1.6;
}

.result {
  padding: 12px 14px;
  background: color-mix(in srgb, #1677ff 8%, transparent);
  border: 1px solid color-mix(in srgb, #1677ff 28%, transparent);
  border-radius: 12px;
}

.decide {
  padding-top: 4px;
}

.choices {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.choices button {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  padding: 12px 14px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 1px solid color-mix(in srgb, currentcolor 14%, transparent);
  border-radius: 12px;
}

.choices button small {
  font-size: 12px;
  color: #8c8c8c;
}

.choices button.on {
  color: #1677ff;
  background: color-mix(in srgb, #1677ff 10%, transparent);
  border-color: #1677ff;
}

.choices button.danger {
  color: #ff4d4f;
  background: color-mix(in srgb, #ff4d4f 10%, transparent);
  border-color: #ff4d4f;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
