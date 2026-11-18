<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  InputNumber,
  message,
  Modal,
  Table,
  Tag,
} from 'ant-design-vue';

import { requestClient } from '#/api/request';

type Line = {
  amount: string;
  no?: string;
  orderNo: string;
  time: string;
  timing?: string;
};

type Bill = {
  adjustmentAmount: string;
  commissionAmount: string;
  id: number;
  no: string;
  orderAmount: string;
  orders?: Line[];
  paidAt?: string;
  payableAmount: string;
  period: string;
  rate: string;
  reconciledAt?: string;
  refundAmount: string;
  refunds?: Line[];
  shopName: string;
  status: string;
  statusName: string;
};

const rows = ref<Bill[]>([]);
const current = ref<Bill[]>([]);
const loading = ref(false);
const generating = ref(false);
const acting = ref(false);
const open = ref(false);
const detail = ref<Bill | null>(null);
const adjustment = ref(0);

const columns: TableColumnsType<Bill> = [
  { title: '结算单', dataIndex: 'no', key: 'no', width: 210 },
  { title: '店铺', dataIndex: 'shopName', key: 'shop', width: 140 },
  { title: '账期', dataIndex: 'period', key: 'period', width: 210 },
  { title: '订单', key: 'order', width: 100 },
  { title: '退款', key: 'refund', width: 100 },
  { title: '佣金', key: 'commission', width: 100 },
  { title: '应付', key: 'payable', width: 110 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 80 },
];

const color: Record<string, string> = {
  PAID: 'green',
  PENDING_RECONCILE: 'blue',
  RECONCILED: 'gold',
};

async function load() {
  loading.value = true;
  try {
    rows.value = await requestClient.get<Bill[]>('/settlements');
    current.value = await requestClient.get<Bill[]>('/settlements/current');
  } finally {
    loading.value = false;
  }
}

async function generate() {
  generating.value = true;
  try {
    const result = await requestClient.post<{
      created: Bill[];
      skipped: { reason: string; shopName: string }[];
    }>('/settlements/generate');
    message.success(
      `新生成 ${result.created.length} 张，已有账期跳过 ${result.skipped.length} 张`,
    );
    await load();
  } finally {
    generating.value = false;
  }
}

async function show(row: Bill) {
  open.value = true;
  adjustment.value = 0;
  detail.value = await requestClient.get<Bill>(`/settlements/${row.id}`);
  adjustment.value = Number(detail.value.adjustmentAmount || 0);
}

async function reconcile() {
  if (!detail.value || acting.value) return;
  acting.value = true;
  try {
    detail.value = await requestClient.post<Bill>(
      `/settlements/${detail.value.id}/reconcile`,
      {
        adjustment: adjustment.value || 0,
      },
    );
    message.success('已核对');
    await load();
  } finally {
    acting.value = false;
  }
}

async function pay() {
  if (!detail.value || acting.value) return;
  acting.value = true;
  try {
    detail.value = await requestClient.post<Bill>(
      `/settlements/${detail.value.id}/pay`,
    );
    message.success('已标记打款');
    await load();
  } finally {
    acting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page title="商家结算">
    <div v-for="item in current" :key="item.shopName" class="live">
      <div>
        <b>{{ item.shopName }} · 本周期进行中</b>
        <div class="muted">
          {{ item.period }} · 结束后才能出账 · 预计应付 ¥{{
            item.payableAmount
          }}
        </div>
      </div>
      <div class="muted">
        订单 ¥{{ item.orderAmount }} · 退款 ¥{{ item.refundAmount }} · 佣金 ¥{{
          item.commissionAmount
        }}
      </div>
    </div>
    <div class="toolbar">
      <Button :loading="generating" type="primary" @click="generate">
        生成上一周期
      </Button>
      <span class="muted">按店铺结算周期出上一张已结束的账。订单按完成时间计入，退款按退款时间计入；完成前的退款算在订单完成的那一期。</span>
    </div>
    <Table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="{ pageSize: 10 }"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'order'">
          ¥{{ record.orderAmount }}
        </template>
        <template v-else-if="column.key === 'refund'">
          ¥{{ record.refundAmount }}
        </template>
        <template v-else-if="column.key === 'commission'">
          ¥{{ record.commissionAmount }}
        </template>
        <template v-else-if="column.key === 'payable'">
          ¥{{ record.payableAmount }}
        </template>
        <template v-else-if="column.key === 'status'">
          <Tag :color="color[record.status] || 'default'">
            {{ record.statusName }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <Button size="small" type="link" @click="show(record as Bill)">
查看
</Button>
        </template>
      </template>
    </Table>

    <Modal
      :footer="null"
      :open="open"
      title="结算单"
      width="720px"
      @cancel="open = false"
    >
      <template v-if="detail">
        <div class="hero">
          <div>
            <div class="no">{{ detail.no }}</div>
            <div class="muted">
              {{ detail.shopName }} · 佣金 {{ detail.rate }} ·
              {{ detail.period }}
            </div>
          </div>
          <div class="money">¥{{ detail.payableAmount }}</div>
        </div>
        <div class="grid">
          <span>订单金额</span><b>¥{{ detail.orderAmount }}</b> <span>退款</span><b>¥{{ detail.refundAmount }}</b> <span>佣金</span><b>¥{{ detail.commissionAmount }}</b> <span>调整</span><b>¥{{ detail.adjustmentAmount }}</b> <span>状态</span><b>{{ detail.statusName }}</b>
        </div>
        <h4>纳入订单</h4>
        <div v-if="!(detail.orders || []).length" class="muted">
          这一期没有完成的订单
        </div>
        <div
          v-for="item in detail.orders || []"
          :key="item.orderNo"
          class="line"
        >
          <span>{{ item.orderNo }} · {{ item.time }}</span><b>¥{{ item.amount }}</b>
        </div>
        <h4>纳入退款</h4>
        <div v-if="!(detail.refunds || []).length" class="muted">
          这一期没有要扣的退款
        </div>
        <div v-for="item in detail.refunds || []" :key="item.no" class="line">
          <span>{{ item.no }} · {{ item.orderNo }} · {{ item.timing }}</span><b>¥{{ item.amount }}</b>
        </div>
        <div v-if="detail.status === 'PENDING_RECONCILE'" class="actions">
          <span>调整金额</span>
          <InputNumber v-model:value="adjustment" :precision="2" :step="1" />
          <Button :loading="acting" type="primary" @click="reconcile">
            确认核对
          </Button>
        </div>
        <div v-else-if="detail.status === 'RECONCILED'" class="actions">
          <Button :loading="acting" type="primary" @click="pay">
            标记已打款
          </Button>
        </div>
        <p v-else class="muted">
          已于 {{ detail.paidAt }} 打款。金额不能再改。
        </p>
      </template>
    </Modal>
  </Page>
</template>

<style scoped>
.live {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 12px 14px;
  margin-bottom: 12px;
  border: 1px solid color-mix(in srgb, #1677ff 45%, transparent);
  border-radius: 12px;
}

.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
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
  margin-bottom: 8px;
}

h4 {
  margin: 14px 0 8px;
}

.line {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid color-mix(in srgb, currentcolor 12%, transparent);
}

.actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 16px;
}
</style>
