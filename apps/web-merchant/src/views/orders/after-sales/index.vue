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
  buyer: string;
  createdAt: string;
  id: number;
  items?: Line[];
  mobile: string;
  no: string;
  orderNo: string;
  orderStatusName?: string;
  payableAmount?: string;
  reasonName: string;
  reasonText?: string;
  reply?: string;
  status: string;
  statusName: string;
  trackingNo?: string;
  type: string;
  typeName: string;
};

const rows = ref<CaseRow[]>([]);
const filter = ref('PENDING_MERCHANT');
const loading = ref(false);
const acting = ref(false);
const open = ref(false);
const detail = ref<CaseRow | null>(null);
const reply = ref('');

const columns: TableColumnsType<CaseRow> = [
  { title: '售后单', dataIndex: 'no', key: 'no', width: 210 },
  { title: '订单', dataIndex: 'orderNo', key: 'orderNo', width: 200 },
  { title: '顾客', key: 'buyer', width: 160 },
  { title: '类型', dataIndex: 'typeName', key: 'type', width: 110 },
  { title: '金额', key: 'amount', width: 100 },
  { title: '状态', key: 'status', width: 120 },
  { title: '申请时间', dataIndex: 'createdAt', key: 'time', width: 150 },
  { title: '操作', key: 'action', width: 90 },
];

const filters = [
  { key: 'PENDING_MERCHANT', label: '待处理' },
  { key: 'WAIT_RETURN', label: '待寄回' },
  { key: 'REJECTED', label: '已拒绝' },
  { key: 'REFUNDED', label: '已退款' },
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
  reply.value = '';
  detail.value = await requestClient.get<CaseRow>(`/after-sales/${row.id}`);
}

async function act(path: 'agree' | 'receive' | 'reject') {
  if (!detail.value || acting.value) return;
  if (path === 'reject' && !reply.value.trim()) {
    message.warning('请填写拒绝原因');
    return;
  }
  acting.value = true;
  try {
    detail.value = await requestClient.post<CaseRow>(
      `/after-sales/${detail.value.id}/${path}`,
      path === 'receive' ? {} : { reply: reply.value.trim() },
    );
    message.success(path === 'reject' ? '已拒绝' : '已处理');
    reply.value = '';
    await load();
  } finally {
    acting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page title="售后处理">
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
          <Button size="small" type="link" @click="show(record)">处理</Button>
        </template>
      </template>
    </Table>

    <Modal
      :footer="null"
      :open="open"
      title="售后详情"
      width="640px"
      @cancel="open = false"
    >
      <template v-if="detail">
        <div class="hero">
          <div>
            <div class="no">{{ detail.no }}</div>
            <div class="muted">
              {{ detail.typeName }} · 订单 {{ detail.orderNo }}
            </div>
          </div>
          <div class="money">¥{{ detail.amount }}</div>
        </div>
        <div class="grid">
          <span>顾客</span><b>{{ detail.buyer }} {{ detail.mobile }}</b>
          <span>原因</span>
          <b>{{ detail.reasonName
            }}{{ detail.reasonText ? `，${detail.reasonText}` : '' }}</b>
          <span>订单状态</span><b>{{ detail.orderStatusName }}</b>
          <span v-if="detail.trackingNo">退货单号</span>
          <b v-if="detail.trackingNo">{{ detail.trackingNo }}</b>
          <span v-if="detail.reply">已回复</span>
          <b v-if="detail.reply">{{ detail.reply }}</b>
        </div>
        <div class="lines">
          <div v-for="(item, index) in detail.items || []" :key="index">
            <span>{{ item.name }} {{ item.spec }} × {{ item.quantity }}</span>
            <b>¥{{ item.amount }}</b>
          </div>
        </div>
        <template
          v-if="
            detail.status === 'PENDING_MERCHANT' ||
            detail.status === 'WAIT_RETURN'
          "
        >
          <Input.TextArea
            v-model:value="reply"
            :maxlength="200"
            :rows="3"
            placeholder="回复顾客，拒绝时必填"
          />
          <div class="actions">
            <Button
              v-if="
                detail.status === 'PENDING_MERCHANT' &&
                detail.type === 'REFUND_ONLY'
              "
              :loading="acting"
              type="primary"
              @click="act('agree')"
            >
              同意并退款
            </Button>
            <Button
              v-if="
                detail.status === 'PENDING_MERCHANT' &&
                detail.type === 'RETURN_REFUND'
              "
              :loading="acting"
              type="primary"
              @click="act('agree')"
            >
              同意退货
            </Button>
            <Button
              v-if="detail.status === 'WAIT_RETURN'"
              :disabled="!detail.trackingNo"
              :loading="acting"
              type="primary"
              @click="act('receive')"
            >
              确认收货并退款
            </Button>
            <Button danger :loading="acting" @click="act('reject')">
              拒绝
            </Button>
          </div>
          <p
            v-if="detail.status === 'WAIT_RETURN' && !detail.trackingNo"
            class="muted"
          >
            顾客还没填写退货单号，暂时不能确认收货。
          </p>
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

.actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
</style>
