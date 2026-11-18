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

    <Modal
      :footer="null"
      :open="open"
      title="仲裁"
      width="640px"
      @cancel="open = false"
    >
      <template v-if="detail">
        <div class="hero">
          <div>
            <div class="no">{{ detail.no }}</div>
            <div class="muted">
              {{ detail.shopName }} · {{ detail.typeName }} ·
              {{ detail.orderNo }}
            </div>
          </div>
          <div class="money">¥{{ detail.amount }}</div>
        </div>
        <div class="grid">
          <span>顾客</span><b>{{ detail.buyer }} {{ detail.mobile }}</b>
          <span>申请原因</span>
          <b>{{ detail.reasonName
            }}{{ detail.reasonText ? `，${detail.reasonText}` : '' }}</b>
          <span>商家回复</span><b>{{ detail.reply || '无' }}</b>
          <span>仲裁理由</span><b>{{ detail.arbitrationReason || '无' }}</b>
          <span v-if="detail.arbitrationResult">仲裁结果</span>
          <b v-if="detail.arbitrationResult">{{ detail.arbitrationResult }}</b>
        </div>
        <div class="lines">
          <div v-for="(item, index) in detail.items || []" :key="index">
            <span>{{ item.name }} {{ item.spec }} × {{ item.quantity }}</span>
            <b>¥{{ item.amount }}</b>
          </div>
        </div>
        <template v-if="detail.status === 'ARBITRATING'">
          <div class="choices">
            <button
              :class="{ on: support === 'BUYER' }"
              type="button"
              @click="support = 'BUYER'"
            >
              支持顾客，按申请金额退款
            </button>
            <button
              :class="{ on: support === 'MERCHANT' }"
              type="button"
              @click="support = 'MERCHANT'"
            >
              支持商家，关闭这单售后
            </button>
          </div>
          <Input.TextArea
            v-model:value="result"
            :maxlength="200"
            :rows="3"
            placeholder="写下仲裁说明，顾客和商家都能看到"
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
        </template>
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

.toolbar button,
.choices button {
  height: 32px;
  padding: 0 14px;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: 1px solid color-mix(in srgb, currentcolor 18%, transparent);
  border-radius: 999px;
}

.toolbar button.on,
.choices button.on {
  color: #1677ff;
  background: color-mix(in srgb, #1677ff 16%, transparent);
  border-color: #1677ff;
}

.muted {
  font-size: 12px;
  color: #8c8c8c;
}

.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.no {
  font-size: 16px;
  font-weight: 650;
}

.money {
  font-size: 28px;
  font-weight: 700;
  color: #cf1322;
}

.grid {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 8px 12px;
  margin-bottom: 16px;
}

.lines {
  padding: 4px 0;
  margin-bottom: 16px;
  border-top: 1px solid color-mix(in srgb, currentcolor 16%, transparent);
  border-bottom: 1px solid color-mix(in srgb, currentcolor 16%, transparent);
}

.lines div {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
}

.choices {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.choices button {
  height: auto;
  padding: 10px 14px;
  border-radius: 12px;
}

.actions {
  margin-top: 12px;
}
</style>
